import { describe, expect, it } from 'vitest'
import { detectWorkOrderConflict } from './conflictResolver'
import type { WorkOrderCacheRow, WorkOrderExecutionRow } from './db'

const remote: WorkOrderCacheRow = {
  id: '11111111-1111-4111-8111-111111111111',
  modifiedOn: '2026-09-23T10:00:00.000Z',
  fetchedAt: '2026-09-23T10:00:01.000Z',
  updatedLocallyAt: '2026-09-23T10:00:01.000Z',
}

const local: WorkOrderExecutionRow = {
  id: remote.id,
  workOrderId: remote.id,
  status: 'inProgress',
  technicianNote: 'offline draft',
  followUpRequired: false,
  baseModifiedOn: '2026-09-23T09:00:00.000Z',
  localUpdatedAt: '2026-09-23T09:30:00.000Z',
  syncStatus: 'dirty',
}

describe('conflict resolver', () => {
  it('defaults stale offline work to manual resolution', () => {
    expect(detectWorkOrderConflict(local, remote).resolution).toBe('manual')
  })

  it('supports explicit server-wins policy', () => {
    expect(detectWorkOrderConflict(local, remote, 'serverWins').resolution).toBe('useServer')
  })
})
