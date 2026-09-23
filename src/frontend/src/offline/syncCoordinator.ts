import { appConfig } from '../config/appConfig'
import { appLogger } from '../observability/appLogger'
import type { OutboxRow } from './db'
import {
  pullFieldServicePage,
  pushFieldServiceBatch,
  toCacheRow,
} from './fieldServiceSyncTransport'
import { classifyTransportError } from './retryPolicy'
import {
  applyPulledWorkOrders,
  blockedOperationCount,
  getNextRetryAt,
  getPendingBatch,
  getWorkOrderPullCursor,
  markBatchSyncing,
  markOperationRejected,
  markOperationSucceeded,
  markOperationTransportFailure,
  pendingOperationCount,
  recoverInterruptedSyncs,
} from './workOrderOfflineRepository'

export type SyncReason = 'startup' | 'online' | 'focus' | 'manual' | 'retry'

export interface SyncCoordinatorState {
  online: boolean
  running: boolean
  pending: number
  blocked: number
  lastReason?: SyncReason
  lastSyncAt?: string
  lastPullCount?: number
  nextRetryAt?: string
  lastError?: string
}

type Listener = (state: SyncCoordinatorState) => void

class SyncCoordinator {
  private started = false
  private inFlight: Promise<void> | null = null
  private retryTimer: number | undefined
  private readonly listeners = new Set<Listener>()
  private state: SyncCoordinatorState = {
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    running: false,
    pending: 0,
    blocked: 0,
  }

  private readonly onOnline = () => {
    this.setState({ online: true })
    void this.syncNow('online')
  }

  private readonly onOffline = () => {
    this.clearRetryTimer()
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
    void this.bootstrap()
  }

  stop(): void {
    if (!this.started || typeof window === 'undefined') return
    window.removeEventListener('online', this.onOnline)
    window.removeEventListener('offline', this.onOffline)
    window.removeEventListener('focus', this.onFocus)
    this.clearRetryTimer()
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

  async refreshQueueState(): Promise<void> {
    this.setState({
      pending: await pendingOperationCount(),
      blocked: await blockedOperationCount(),
      nextRetryAt: await getNextRetryAt(),
    })
  }

  async refreshPending(): Promise<void> {
    await this.refreshQueueState()
  }

  async syncNow(reason: SyncReason = 'manual'): Promise<void> {
    if (!navigator.onLine) {
      this.setState({ online: false })
      await this.refreshQueueState()
      return
    }

    if (this.inFlight) return this.inFlight

    this.clearRetryTimer()
    this.inFlight = this.run(reason).finally(() => {
      this.inFlight = null
    })
    return this.inFlight
  }

  private async bootstrap(): Promise<void> {
    const recovered = await recoverInterruptedSyncs()
    if (recovered > 0) {
      appLogger.warn('sync.interrupted_operations_recovered', {
        details: { count: recovered },
      })
    }

    await this.refreshQueueState()
    if (navigator.onLine) await this.syncNow('startup')
  }

  private async run(reason: SyncReason): Promise<void> {
    this.setState({
      online: true,
      running: true,
      lastReason: reason,
      lastError: undefined,
    })

    appLogger.info('sync.started', { details: { reason } })

    try {
      await this.pushOutbox()
      const pullCount = await this.pullRemoteChanges()

      this.setState({
        lastSyncAt: new Date().toISOString(),
        lastPullCount: pullCount,
      })

      appLogger.info('sync.completed', { details: { reason, pullCount } })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected synchronization error.'
      this.setState({ lastError: message })
      appLogger.error('sync.failed', { details: { reason, message } })
    } finally {
      await this.refreshQueueState()
      this.setState({ running: false })
      this.scheduleRetry()
    }
  }

  private async pushOutbox(): Promise<void> {
    const attempted = new Set<string>()

    while (true) {
      const batch = await getPendingBatch(appConfig.sync.pushBatchSize, attempted)
      if (batch.length === 0) return

      batch.forEach((row) => attempted.add(row.id))
      await markBatchSyncing(batch)

      let results
      try {
        results = await pushFieldServiceBatch(batch)
      } catch (error) {
        const decision = classifyTransportError(error)

        for (const row of batch) {
          await markOperationTransportFailure(
            row,
            decision.message,
            decision.kind,
            decision.retryable,
          )
        }

        appLogger.warn('sync.push_transport_failed', {
          details: {
            count: batch.length,
            kind: decision.kind,
            retryable: decision.retryable,
          },
        })
        return
      }

      const resultById = new Map(results.map((result) => [result.operationId, result]))

      for (const row of batch) {
        const result = resultById.get(row.id)

        if (!result) {
          await markOperationTransportFailure(
            row,
            'Backend did not return a result for this operation.',
            'transient',
            true,
          )
        } else if (result.status === 'applied') {
          await markOperationSucceeded(row.id, row.recordId)
        } else if (result.retryable) {
          await markOperationTransportFailure(
            row,
            result.error || 'Operation temporarily rejected.',
            'transient',
            true,
          )
        } else {
          await markOperationRejected(
            row.id,
            row.recordId,
            result.error || 'Operation rejected.',
            result.code === 'CONFLICT' ? 'conflict' : 'permanent',
          )
        }
      }
    }
  }

  private async pullRemoteChanges(): Promise<number> {
    let cursor = await getWorkOrderPullCursor()
    let pulled = 0

    for (let page = 0; page < appConfig.sync.pullMaxPages; page += 1) {
      const result = await pullFieldServicePage(cursor, appConfig.sync.pullPageSize)
      const rows = result.records.map(toCacheRow)

      await applyPulledWorkOrders(rows, result.nextCursor)
      pulled += rows.length
      cursor = result.nextCursor ?? cursor

      if (!result.hasMore) break
    }

    return pulled
  }

  private scheduleRetry(): void {
    if (!navigator.onLine || !this.state.nextRetryAt) return

    const delay = Math.max(250, Date.parse(this.state.nextRetryAt) - Date.now())
    this.retryTimer = window.setTimeout(() => {
      void this.syncNow('retry')
    }, delay)
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== undefined) {
      window.clearTimeout(this.retryTimer)
      this.retryTimer = undefined
    }
  }

  private setState(patch: Partial<SyncCoordinatorState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener(this.state)
  }
}

export const syncCoordinator = new SyncCoordinator()
