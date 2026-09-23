import { callServerLogic } from '../api/serverLogicClient'
import type { OutboxRow } from './db'

export interface SyncOperationResult {
  operationId: string
  recordId: string
  status: 'applied' | 'rejected'
  error?: string
}

interface SyncBatchResponse {
  results: SyncOperationResult[]
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
