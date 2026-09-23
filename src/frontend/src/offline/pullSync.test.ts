import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { applyPulledWorkOrders, getWorkOrderPullCursor } from './workOrderOfflineRepository'

describe('pull synchronization cache', () => {
  beforeEach(async () => {
    await db.workOrders.clear()
    await db.syncState.clear()
  })

  it('stores remote rows and advances the cursor in one transaction', async () => {
    await applyPulledWorkOrders([
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'WO-001',
        modifiedOn: '2026-09-23T11:00:00.000Z',
        fetchedAt: '2026-09-23T11:00:01.000Z',
        updatedLocallyAt: '2026-09-23T11:00:01.000Z',
      },
    ], '2026-09-23T11:00:00.000Z')

    expect(await db.workOrders.count()).toBe(1)
    expect(await getWorkOrderPullCursor()).toBe('2026-09-23T11:00:00.000Z')
  })
})
