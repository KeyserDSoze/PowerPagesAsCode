import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { enqueueWorkOrderNamePatch } from './syncEngine'

describe('offline outbox', () => {
  beforeEach(async () => {
    await db.outbox.clear()
    await db.workOrders.clear()
  })

  it('queues a work order patch and updates the local cache atomically', async () => {
    const workOrderId = '11111111-1111-4111-8111-111111111111'
    await enqueueWorkOrderNamePatch(workOrderId, 'Offline update')
    expect(await db.outbox.count()).toBe(1)
    expect((await db.workOrders.get(workOrderId))?.name).toBe('Offline update')
  })

  it('rejects invalid record identifiers', async () => {
    await expect(enqueueWorkOrderNamePatch('not-a-guid', 'Bad')).rejects.toThrow(/GUID/)
  })
})
