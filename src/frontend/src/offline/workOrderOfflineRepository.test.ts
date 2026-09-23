import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { saveWorkOrderExecution } from './workOrderOfflineRepository'

describe('central offline Work Order repository', () => {
  beforeEach(async () => {
    await db.outbox.clear()
    await db.workOrderExecutions.clear()
  })

  it('stores the local copy and outbox command in one operation', async () => {
    const workOrderId = '11111111-1111-4111-8111-111111111111'

    await saveWorkOrderExecution({
      workOrderId,
      status: 'inProgress',
      technicianNote: 'Replaced filter and verified pressure.',
      followUpRequired: true,
      arrivedOn: '2026-09-23T08:00:00.000Z',
    })

    const local = await db.workOrderExecutions.get(workOrderId)
    const queued = await db.outbox.toArray()

    expect(local?.technicianNote).toBe('Replaced filter and verified pressure.')
    expect(local?.syncStatus).toBe('dirty')
    expect(queued).toHaveLength(1)
    expect(queued[0]?.payload.followUpRequired).toBe(true)
    expect(queued[0]?.operation).toBe('submitWorkOrderExecution')
  })

  it('requires completion time for completed work', async () => {
    await expect(saveWorkOrderExecution({
      workOrderId: '11111111-1111-4111-8111-111111111111',
      status: 'completed',
      technicianNote: 'Done',
      followUpRequired: false,
    })).rejects.toThrow(/Completed On/)
  })
})
