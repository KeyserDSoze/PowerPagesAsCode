import { callServerLogic } from '../api/serverLogicClient'
import { db, type OutboxRow } from './db'

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function enqueueWorkOrderNamePatch(recordId: string, name: string): Promise<string> {
  const normalizedId = recordId.trim()
  if (!guidPattern.test(normalizedId)) throw new Error('Work Order ID must be a valid GUID.')
  if (!name.trim()) throw new Error('Name is required.')

  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  await db.transaction('rw', db.workOrders, db.outbox, async () => {
    await db.workOrders.put({ id: normalizedId, name: name.trim(), updatedLocallyAt: createdAt })
    await db.outbox.add({
      id,
      aggregate: 'workOrder',
      recordId: normalizedId,
      operation: 'updateName',
      payload: { msdyn_name: name.trim() },
      createdAt,
      attemptCount: 0,
      status: 'pending',
    })
  })

  return id
}

async function syncOne(item: OutboxRow): Promise<boolean> {
  await db.outbox.update(item.id, { status: 'syncing', attemptCount: item.attemptCount + 1 })

  try {
    await callServerLogic<{ operationId: string; recordId: string }>('field-service', {
      method: 'POST',
      body: {
        operationId: item.id,
        operation: item.operation,
        recordId: item.recordId,
        patch: item.payload,
      },
    })
    await db.outbox.delete(item.id)
    return true
  } catch (error) {
    await db.outbox.update(item.id, {
      status: 'failed',
      lastError: error instanceof Error ? error.message : 'Unknown sync error',
    })
    return false
  }
}

export async function flushOutbox(): Promise<{ synced: number; failed: number }> {
  if (!navigator.onLine) return { synced: 0, failed: await db.outbox.count() }

  const pending = await db.outbox.orderBy('createdAt').toArray()
  let synced = 0
  let failed = 0

  for (const item of pending) {
    const ok = await syncOne(item)
    if (ok) synced += 1
    else failed += 1
  }

  return { synced, failed }
}
