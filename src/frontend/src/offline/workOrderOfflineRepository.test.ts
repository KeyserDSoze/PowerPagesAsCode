import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  markBatchSyncing,
  markOperationRejected,
  markOperationSucceeded,
  markOperationTransportFailure,
  recoverInterruptedSyncs,
  saveWorkOrderExecution,
} from './workOrderOfflineRepository'

describe('central offline Work Order repository', () => {
  beforeEach(async () => {
    await db.workOrders.clear()
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

  it('captures baseModifiedOn from the cached Work Order automatically', async () => {
    const workOrderId = '11111111-1111-4111-8111-111111111111'
    const modifiedOn = '2026-09-23T07:45:00.000Z'

    await db.workOrders.put({
      id: workOrderId,
      name: 'WO-001',
      modifiedOn,
      fetchedAt: '2026-09-23T07:46:00.000Z',
      updatedLocallyAt: '2026-09-23T07:46:00.000Z',
    })

    await saveWorkOrderExecution({
      workOrderId,
      status: 'inProgress',
      technicianNote: 'Started work.',
      followUpRequired: false,
    })

    const local = await db.workOrderExecutions.get(workOrderId)
    const queued = await db.outbox.toArray()

    expect(local?.baseModifiedOn).toBe(modifiedOn)
    expect(queued[0]?.payload.baseModifiedOn).toBe(modifiedOn)
  })

  it('requires completion time for completed work', async () => {
    await expect(saveWorkOrderExecution({
      workOrderId: '11111111-1111-4111-8111-111111111111',
      status: 'completed',
      technicianNote: 'Done',
      followUpRequired: false,
    })).rejects.toThrow(/Completed On/)
  })

  it('recovers outbox rows left syncing after an interrupted app session', async () => {
    const workOrderId = '11111111-1111-4111-8111-111111111111'
    const operationId = await saveWorkOrderExecution({
      workOrderId,
      status: 'inProgress',
      technicianNote: 'Working',
      followUpRequired: false,
    })

    await db.outbox.update(operationId, { status: 'syncing' })
    await db.workOrderExecutions.update(workOrderId, { syncStatus: 'syncing' })

    expect(await recoverInterruptedSyncs()).toBe(1)
    expect((await db.outbox.get(operationId))?.status).toBe('pending')
    expect((await db.workOrderExecutions.get(workOrderId))?.syncStatus).toBe('dirty')
  })

  it('does not consume retry attempts while authentication is expired', async () => {
    const workOrderId = '11111111-1111-4111-8111-111111111111'
    const operationId = await saveWorkOrderExecution({
      workOrderId,
      status: 'inProgress',
      technicianNote: 'Working',
      followUpRequired: false,
    })
    const row = await db.outbox.get(operationId)
    if (!row) throw new Error('Expected queued operation.')

    await markBatchSyncing([row])
    await markOperationTransportFailure(
      row,
      'Session expired.',
      'authentication',
      true,
    )

    const failed = await db.outbox.get(operationId)
    expect(failed?.status).toBe('failed')
    expect(failed?.attemptCount).toBe(0)
    expect(failed?.nextAttemptAt).toBeUndefined()
    expect(failed?.errorKind).toBe('authentication')
  })

  it('does not mark a draft clean while another operation for the same Work Order is blocked', async () => {
    const workOrderId = '11111111-1111-4111-8111-111111111111'
    const first = await saveWorkOrderExecution({
      workOrderId,
      status: 'inProgress',
      technicianNote: 'First',
      followUpRequired: false,
    })
    const second = await saveWorkOrderExecution({
      workOrderId,
      status: 'inProgress',
      technicianNote: 'Second',
      followUpRequired: false,
    })

    await markOperationRejected(first, workOrderId, 'Rejected transition')
    await markOperationSucceeded(second, workOrderId)

    expect((await db.workOrderExecutions.get(workOrderId))?.syncStatus).toBe('error')
    expect((await db.outbox.get(first))?.status).toBe('blocked')
  })
})
