import type { WorkOrderCacheRow, WorkOrderExecutionRow } from './db'

export type ConflictStrategy = 'serverWins' | 'clientWins' | 'manual'

export interface ConflictResult {
  hasConflict: boolean
  strategy: ConflictStrategy
  resolution: 'none' | 'useServer' | 'useClient' | 'manual'
  reason?: string
}

export const detectWorkOrderConflict = (
  local: WorkOrderExecutionRow | undefined,
  remote: WorkOrderCacheRow,
  strategy: ConflictStrategy = 'manual',
): ConflictResult => {
  if (!local?.baseModifiedOn || !remote.modifiedOn) {
    return { hasConflict: false, strategy, resolution: 'none' }
  }

  if (local.baseModifiedOn === remote.modifiedOn) {
    return { hasConflict: false, strategy, resolution: 'none' }
  }

  if (strategy === 'serverWins') {
    return {
      hasConflict: true,
      strategy,
      resolution: 'useServer',
      reason: 'Remote Work Order changed after the offline draft was based on it.',
    }
  }

  if (strategy === 'clientWins') {
    return {
      hasConflict: true,
      strategy,
      resolution: 'useClient',
      reason: 'Remote Work Order changed, but this command explicitly allows client-wins.',
    }
  }

  return {
    hasConflict: true,
    strategy,
    resolution: 'manual',
    reason: 'Remote Work Order changed while the device had an offline draft.',
  }
}
