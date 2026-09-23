export type WorkOrderExecutionStatus = 'inProgress' | 'completed'

export interface WorkOrderExecutionDraft {
  workOrderId: string
  status: WorkOrderExecutionStatus
  technicianNote: string
  followUpRequired: boolean
  arrivedOn?: string
  completedOn?: string
  baseModifiedOn?: string
}

export interface WorkOrderExecutionSyncPayload {
  workOrderId: string
  status: WorkOrderExecutionStatus
  technicianNote: string
  followUpRequired: boolean
  arrivedOn?: string
  completedOn?: string
  baseModifiedOn?: string
}

export const toSyncPayload = (
  draft: WorkOrderExecutionDraft,
): WorkOrderExecutionSyncPayload => ({
  workOrderId: draft.workOrderId,
  status: draft.status,
  technicianNote: draft.technicianNote,
  followUpRequired: draft.followUpRequired,
  arrivedOn: draft.arrivedOn,
  completedOn: draft.completedOn,
  baseModifiedOn: draft.baseModifiedOn,
})
