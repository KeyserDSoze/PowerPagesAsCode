import { powerPagesFetch, SessionExpiredError } from './powerPagesClient'

type Envelope = {
  success?: boolean
  Success?: boolean
  data?: string | null
  Data?: string | null
  error?: string | null
  Error?: string | null
}

export { SessionExpiredError }

export async function callServerLogic<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    query?: Record<string, string>
    body?: unknown
  } = {},
): Promise<T> {
  const method = options.method ?? 'GET'
  const query = options.query ? `?${new URLSearchParams(options.query)}` : ''
  const response = await powerPagesFetch(`/_api/serverlogics/${endpoint}${query}`, {
    method,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const text = await response.text()
  if (!response.ok) throw new Error(text || `Server Logic request failed (${response.status}).`)

  const envelope = JSON.parse(text) as Envelope
  const success = envelope.success ?? envelope.Success ?? false
  const error = envelope.error ?? envelope.Error
  const data = envelope.data ?? envelope.Data

  if (!success) throw new Error(error || `Server Logic endpoint '${endpoint}' failed.`)
  if (data === null || data === undefined || data === '') return undefined as T
  return JSON.parse(data) as T
}
