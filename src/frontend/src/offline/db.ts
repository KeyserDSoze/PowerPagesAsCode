import Dexie, { type EntityTable } from 'dexie'

export type OutboxStatus = 'pending' | 'syncing' | 'failed'

export interface WorkOrderCacheRow {
  id: string
  name?: string
  modifiedOn?: string
  updatedLocallyAt: string
}

export interface OutboxRow {
  id: string
  aggregate: 'workOrder'
  recordId: string
  operation: 'updateName'
  payload: { msdyn_name: string }
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
  outbox: EntityTable<OutboxRow, 'id'>
  syncState: EntityTable<SyncStateRow, 'key'>
}

db.version(1).stores({
  workOrders: 'id, modifiedOn, updatedLocallyAt',
  outbox: 'id, aggregate, recordId, status, createdAt',
  syncState: 'key',
})
