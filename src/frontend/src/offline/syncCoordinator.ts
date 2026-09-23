import { pushFieldServiceBatch } from './fieldServiceSyncTransport'
import {
  getPendingBatch,
  markBatchSyncing,
  markOperationFailed,
  markOperationSucceeded,
  pendingOperationCount,
} from './workOrderOfflineRepository'

export type SyncReason = 'startup' | 'online' | 'focus' | 'manual'

export interface SyncCoordinatorState {
  online: boolean
  running: boolean
  pending: number
  lastReason?: SyncReason
  lastSyncAt?: string
  lastError?: string
}

type Listener = (state: SyncCoordinatorState) => void

class SyncCoordinator {
  private started = false
  private inFlight: Promise<void> | null = null
  private readonly listeners = new Set<Listener>()
  private state: SyncCoordinatorState = {
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    running: false,
    pending: 0,
  }

  private readonly onOnline = () => {
    this.setState({ online: true })
    void this.syncNow('online')
  }

  private readonly onOffline = () => {
    this.setState({ online: false })
  }

  private readonly onFocus = () => {
    if (navigator.onLine) void this.syncNow('focus')
  }

  start(): void {
    if (this.started || typeof window === 'undefined') return
    this.started = true
    window.addEventListener('online', this.onOnline)
    window.addEventListener('offline', this.onOffline)
    window.addEventListener('focus', this.onFocus)
    void this.refreshPending()
    if (navigator.onLine) void this.syncNow('startup')
  }

  stop(): void {
    if (!this.started || typeof window === 'undefined') return
    window.removeEventListener('online', this.onOnline)
    window.removeEventListener('offline', this.onOffline)
    window.removeEventListener('focus', this.onFocus)
    this.started = false
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  getState(): SyncCoordinatorState {
    return this.state
  }

  async refreshPending(): Promise<void> {
    this.setState({ pending: await pendingOperationCount() })
  }

  async syncNow(reason: SyncReason = 'manual'): Promise<void> {
    if (!navigator.onLine) {
      this.setState({ online: false })
      await this.refreshPending()
      return
    }

    if (this.inFlight) return this.inFlight

    this.inFlight = this.run(reason).finally(() => {
      this.inFlight = null
    })
    return this.inFlight
  }

  private async run(reason: SyncReason): Promise<void> {
    this.setState({ online: true, running: true, lastReason: reason, lastError: undefined })

    const attempted = new Set<string>()

    try {
      while (true) {
        const batch = await getPendingBatch(20, attempted)
        if (batch.length === 0) break

        batch.forEach((row) => attempted.add(row.id))
        await markBatchSyncing(batch)

        const results = await pushFieldServiceBatch(batch)
        const resultById = new Map(results.map((result) => [result.operationId, result]))

        for (const row of batch) {
          const result = resultById.get(row.id)
          if (!result) {
            await markOperationFailed(row.id, row.recordId, 'Backend did not return a result for this operation.')
          } else if (result.status === 'applied') {
            await markOperationSucceeded(row.id, row.recordId)
          } else {
            await markOperationFailed(row.id, row.recordId, result.error || 'Operation rejected.')
          }
        }
      }

      this.setState({ lastSyncAt: new Date().toISOString() })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected synchronization error.'
      this.setState({ lastError: message })

      const batch = await getPendingBatch(20)
      for (const row of batch.filter((item) => item.status === 'syncing')) {
        await markOperationFailed(row.id, row.recordId, message)
      }
    } finally {
      this.setState({
        running: false,
        pending: await pendingOperationCount(),
      })
    }
  }

  private setState(patch: Partial<SyncCoordinatorState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener(this.state)
  }
}

export const syncCoordinator = new SyncCoordinator()
