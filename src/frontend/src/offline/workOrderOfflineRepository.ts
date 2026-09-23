import { appConfig } from '../config/appConfig'
import type { WorkOrderExecutionDraft } from '../domain/workOrderExecution'
import { toSyncPayload } from '../domain/workOrderExecution'
import { db, type OutboxRow, type SyncErrorKind, type WorkOrderCacheRow } from './db'
import { computeRetryDelayMs } from './retryPolicy'

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const WORK_ORDER_CURSOR_KEY = 'fieldService.workOrders.cursor'

function validateDraft(draft: WorkOrderExecutionDraft): WorkOrderExecutionDraft {
  const workOrderId = draft.workOrderId.trim()
  const technicianNote = draft.technicianNote.trim()

  if (!guidPattern.test(workOrderId)) throw new Error('Work Order ID must be a valid GUID.')
  if (technicianNote.length > 8000) throw new Error('Technician note must be 8000 characters or less.')
  if (draft.status === 'completed' && !draft.completedOn) {
    throw new Error('Completed On is required when the work order is completed.')
  }

  if (draft.arrivedOn && draft.completedOn) {
    const arrived = Date.parse(draft.arrivedOn)
    const completed = Date.parse(draft.completedOn)
    if (!Number.isNaN(arrived) && !Number.isNaN(completed) && completed < arrived) {
      throw new Error('Completed On cannot be before Arrived On.')
    }
  }

  return { ...draft, workOrderId, technicianNote }
}

export async function saveWorkOrderExecution(input: WorkOrderExecutionDraft): Promise<string> {
  const validated = validateDraft(input)
  const cached = validated.baseModifiedOn
    ? undefined
    : await db.workOrders.get(validated.workOrderId)
  const draft: WorkOrderExecutionDraft = {
    ...validated,
    baseModifiedOn: validated.baseModifiedOn ?? cached?.modifiedOn,
  }
  const operationId = crypto.randomUUID()
  const now = new Date().toISOString()

  await db.transaction('rw', db.workOrderExecutions, db.outbox, async () => {
    await db.workOrderExecutions.put({
      ...draft,
      id: draft.workOrderId,
      localUpdatedAt: now,
      syncStatus: 'dirty',
      lastSyncError: undefined,
    })

    await db.outbox.add({
      id: operationId,
      aggregate: 'workOrderExecution',
      recordId: draft.workOrderId,
      operation: 'submitWorkOrderExecution',
      payload: toSyncPayload(draft),
      createdAt: now,
      attemptCount: 0,
      status: 'pending',
    })
  })

  return operationId
}

export async function getWorkOrderExecution(workOrderId: string) {
  return db.workOrderExecutions.get(workOrderId)
}

export async function recoverInterruptedSyncs(): Promise<number> {
  const stuck = await db.outbox.where('status').equals('syncing').toArray()
  if (stuck.length === 0) return 0

  await db.transaction('rw', db.outbox, db.workOrderExecutions, async () => {
    for (const row of stuck) {
      await db.outbox.update(row.id, {
        status: 'pending',
        nextAttemptAt: undefined,
        lastError: 'Recovered after an interrupted synchronization.',
      })
      await db.workOrderExecutions.update(row.recordId, {
        syncStatus: 'dirty',
        lastSyncError: undefined,
      })
    }
  })

  return stuck.length
}

export async function getPendingBatch(
  limit = appConfig.sync.pushBatchSize,
  excludeIds: ReadonlySet<string> = new Set(),
): Promise<OutboxRow[]> {
  const now = Date.now()
  const rows = await db.outbox.orderBy('createdAt').toArray()

  return rows
    .filter((row) => {
      if (excludeIds.has(row.id)) return false
      if (row.status !== 'pending' && row.status !== 'failed') return false
      if (row.attemptCount >= appConfig.sync.maxAttempts) return false
      if (!row.nextAttemptAt) return true
      return Date.parse(row.nextAttemptAt) <= now
    })
    .slice(0, limit)
}

export async function markBatchSyncing(rows: OutboxRow[]): Promise<void> {
  await db.transaction('rw', db.outbox, db.workOrderExecutions, async () => {
    for (const row of rows) {
      await db.outbox.update(row.id, {
        status: 'syncing',
        attemptCount: row.attemptCount + 1,
        nextAttemptAt: undefined,
        lastError: undefined,
        errorKind: undefined,
      })
      await db.workOrderExecutions.update(row.recordId, {
        syncStatus: 'syncing',
        lastSyncError: undefined,
      })
    }
  })
}

export async function markOperationSucceeded(operationId: string, recordId: string): Promise<void> {
  await db.transaction('rw', db.outbox, db.workOrderExecutions, async () => {
    await db.outbox.delete(operationId)

    const remainingForRecord = await db.outbox.where('recordId').equals(recordId).toArray()
    if (remainingForRecord.length === 0) {
      await db.workOrderExecutions.update(recordId, {
        syncStatus: 'clean',
        lastSyncedAt: new Date().toISOString(),
        lastSyncError: undefined,
      })
      return
    }

    const blocked = remainingForRecord.find((row) => row.status === 'blocked')
    if (blocked) {
      await db.workOrderExecutions.update(recordId, {
        syncStatus: 'error',
        lastSyncError: blocked.lastError || 'A queued operation is blocked.',
      })
      return
    }

    await db.workOrderExecutions.update(recordId, { syncStatus: 'dirty' })
  })
}

export async function markOperationRejected(
  operationId: string,
  recordId: string,
  error: string,
  kind: SyncErrorKind = 'permanent',
): Promise<void> {
  await db.transaction('rw', db.outbox, db.workOrderExecutions, async () => {
    await db.outbox.update(operationId, {
      status: 'blocked',
      errorKind: kind,
      nextAttemptAt: undefined,
      lastError: error,
    })
    await db.workOrderExecutions.update(recordId, {
      syncStatus: 'error',
      lastSyncError: error,
    })
  })
}

export async function markOperationTransportFailure(
  row: OutboxRow,
  error: string,
  kind: SyncErrorKind,
  retryable: boolean,
): Promise<void> {
  const current = await db.outbox.get(row.id)
  const recordedAttemptCount = current?.attemptCount ?? row.attemptCount + 1
  const authenticationFailure = kind === 'authentication'

  // Authentication is not an operation-quality failure. Do not consume the
  // finite business retry budget while the Power Pages session is expired.
  const effectiveAttemptCount = authenticationFailure
    ? row.attemptCount
    : recordedAttemptCount
  const exhausted = !authenticationFailure && effectiveAttemptCount >= appConfig.sync.maxAttempts
  const shouldRetry = retryable && !exhausted

  // Authentication retries are event-driven (focus/manual/sign-in recovery),
  // not timer-driven, so a signed-out device cannot spin until it blocks.
  const nextAttemptAt = shouldRetry && !authenticationFailure
    ? new Date(Date.now() + computeRetryDelayMs(effectiveAttemptCount)).toISOString()
    : undefined

  await db.transaction('rw', db.outbox, db.workOrderExecutions, async () => {
    await db.outbox.update(row.id, {
      status: shouldRetry ? 'failed' : 'blocked',
      attemptCount: effectiveAttemptCount,
      errorKind: kind,
      nextAttemptAt,
      lastError: exhausted ? `${error} Maximum attempts reached.` : error,
    })
    await db.workOrderExecutions.update(row.recordId, {
      syncStatus: 'error',
      lastSyncError: error,
    })
  })
}

export async function pendingOperationCount(): Promise<number> {
  return db.outbox.where('status').anyOf('pending', 'failed', 'syncing').count()
}

export async function blockedOperationCount(): Promise<number> {
  return db.outbox.where('status').equals('blocked').count()
}

export async function getNextRetryAt(): Promise<string | undefined> {
  const rows = await db.outbox.where('status').equals('failed').toArray()
  return rows
    .map((row) => row.nextAttemptAt)
    .filter((value): value is string => Boolean(value))
    .sort()[0]
}

export async function getWorkOrderPullCursor(): Promise<string | undefined> {
  return (await db.syncState.get(WORK_ORDER_CURSOR_KEY))?.value
}

export async function applyPulledWorkOrders(
  records: WorkOrderCacheRow[],
  nextCursor: string | undefined,
): Promise<void> {
  await db.transaction('rw', db.workOrders, db.syncState, async () => {
    if (records.length > 0) await db.workOrders.bulkPut(records)
    if (nextCursor) {
      await db.syncState.put({ key: WORK_ORDER_CURSOR_KEY, value: nextCursor })
    }
  })
}
