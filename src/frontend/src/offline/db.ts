import Dexie, { type EntityTable } from 'dexie'
import type {
  WorkOrderExecutionDraft,
  WorkOrderExecutionSyncPayload,
} from '../domain/workOrderExecution'

export type LocalSyncStatus = 'clean' | 'dirty' | 'syncing' | 'error'
export type OutboxStatus = 'pending' | 'syncing' | 'failed'

export interface WorkOrderCacheRow {
  id: string
  name?: string
  systemStatus?: number
  modifiedOn?: string
  fetchedAt?: string
  updatedLocallyAt: string
}

export interface WorkOrderExecutionRow extends WorkOrderExecutionDraft {
  id: string
  localUpdatedAt: string
  syncStatus: LocalSyncStatus
  lastSyncedAt?: string
  lastSyncError?: string
}

export interface OutboxRow {
  id: string
  aggregate: 'workOrderExecution'
  recordId: string
  operation: 'submitWorkOrderExecution'
  payload: WorkOrderExecutionSyncPayload
  createdAt: string
  attemptCount: number
  status: OutboxStatus
  lastError?: string
}

export interface SyncStateRow {
  key: string
  value: string
}

export const db = new Dexie('PowerPagesFieldService') as Dexie & {
  workOrders: EntityTable<WorkOrderCacheRow, 'id'>
  workOrderExecutions: EntityTable<WorkOrderExecutionRow, 'id'>
  outbox: EntityTable<OutboxRow, 'id'>
  syncState: EntityTable<SyncStateRow, 'key'>
}

db.version(1).stores({
  workOrders: 'id, modifiedOn, updatedLocallyAt',
  outbox: 'id, aggregate, recordId, status, createdAt',
  syncState: 'key',
})

db.version(2).stores({
  workOrders: 'id, modifiedOn, updatedLocallyAt',
  workOrderExecutions: 'id, workOrderId, syncStatus, localUpdatedAt',
  outbox: 'id, aggregate, recordId, status, createdAt',
  syncState: 'key',
})
