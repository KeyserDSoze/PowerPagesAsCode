import { callServerLogic } from '../api/serverLogicClient'
import type { OutboxRow, WorkOrderCacheRow } from './db'

export interface SyncOperationResult {
  operationId: string
  recordId: string
  status: 'applied' | 'rejected'
  code?: string
  retryable?: boolean
  error?: string
}

interface SyncBatchResponse {
  results: SyncOperationResult[]
}

export interface PullPageResponse {
  records: Array<{
    id: string
    name?: string
    systemStatus?: number
    modifiedOn?: string
  }>
  nextCursor?: string
  hasMore: boolean
}

export async function pushFieldServiceBatch(
  rows: OutboxRow[],
): Promise<SyncOperationResult[]> {
  if (rows.length === 0) return []

  const response = await callServerLogic<SyncBatchResponse>('field-service-sync', {
    method: 'POST',
    body: {
      operations: rows.map((row) => ({
        operationId: row.id,
        operation: row.operation,
        recordId: row.recordId,
        payload: row.payload,
      })),
    },
  })

  return response.results
}

export async function pullFieldServicePage(
  cursor: string | undefined,
  limit: number,
): Promise<PullPageResponse> {
  return callServerLogic<PullPageResponse>('field-service-pull', {
    method: 'GET',
    query: {
      ...(cursor ? { cursor } : {}),
      limit: String(limit),
    },
  })
}

export const toCacheRow = (
  record: PullPageResponse['records'][number],
): WorkOrderCacheRow => {
  const now = new Date().toISOString()
  return {
    id: record.id,
    name: record.name,
    systemStatus: record.systemStatus,
    modifiedOn: record.modifiedOn,
    fetchedAt: now,
    updatedLocallyAt: now,
  }
}
