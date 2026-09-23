import type { WorkOrderExecutionDraft } from '../domain/workOrderExecution'
import { toSyncPayload } from '../domain/workOrderExecution'
import { db, type OutboxRow } from './db'

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

  return {
    ...draft,
    workOrderId,
    technicianNote,
  }
}

export async function saveWorkOrderExecution(
  input: WorkOrderExecutionDraft,
): Promise<string> {
  const draft = validateDraft(input)
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
  limit = 20,
  excludeIds: ReadonlySet<string> = new Set(),
): Promise<OutboxRow[]> {
  const rows = await db.outbox.orderBy('createdAt').toArray()
  return rows
    .filter((row) => (row.status === 'pending' || row.status === 'failed') && !excludeIds.has(row.id))
    .slice(0, limit)
}

export async function markBatchSyncing(rows: OutboxRow[]): Promise<void> {
  await db.transaction('rw', db.outbox, db.workOrderExecutions, async () => {
    for (const row of rows) {
      await db.outbox.update(row.id, {
        status: 'syncing',
        attemptCount: row.attemptCount + 1,
        lastError: undefined,
      })
      await db.workOrderExecutions.update(row.recordId, {
        syncStatus: 'syncing',
        lastSyncError: undefined,
      })
    }
  })
}

export async function markOperationSucceeded(
  operationId: string,
  recordId: string,
): Promise<void> {
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

    const failed = remainingForRecord.find((row) => row.status === 'failed')
    if (failed) {
      await db.workOrderExecutions.update(recordId, {
        syncStatus: 'error',
        lastSyncError: failed.lastError || 'A queued operation failed.',
      })
    } else {
      await db.workOrderExecutions.update(recordId, {
        syncStatus: 'dirty',
        lastSyncError: undefined,
      })
    }
  })
}

export async function markOperationFailed(
  operationId: string,
  recordId: string,
  error: string,
): Promise<void> {
  await db.transaction('rw', db.outbox, db.workOrderExecutions, async () => {
    await db.outbox.update(operationId, {
      status: 'failed',
      lastError: error,
    })
    await db.workOrderExecutions.update(recordId, {
      syncStatus: 'error',
      lastSyncError: error,
    })
  })
}

export async function pendingOperationCount(): Promise<number> {
  return db.outbox.count()
}
