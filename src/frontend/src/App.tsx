import { useEffect, useMemo, useState } from 'react'
import { callServerLogic, SessionExpiredError } from './api/serverLogicClient'
import type { WorkOrderExecutionStatus } from './domain/workOrderExecution'
import { syncCoordinator, type SyncCoordinatorState } from './offline/syncCoordinator'
import { saveWorkOrderExecution } from './offline/workOrderOfflineRepository'

type Health = {
  status: string
  activityId: string
  user: string | null
  timestamp: string
}

const toIsoOrUndefined = (value: string): string | undefined =>
  value ? new Date(value).toISOString() : undefined

export function App() {
  const [backend, setBackend] = useState<'checking' | 'reachable' | 'unreachable' | 'login-required'>('checking')
  const [syncState, setSyncState] = useState<SyncCoordinatorState>(syncCoordinator.getState())
  const [workOrderId, setWorkOrderId] = useState('')
  const [status, setStatus] = useState<WorkOrderExecutionStatus>('inProgress')
  const [technicianNote, setTechnicianNote] = useState('')
  const [followUpRequired, setFollowUpRequired] = useState(false)
  const [arrivedOn, setArrivedOn] = useState('')
  const [completedOn, setCompletedOn] = useState('')
  const [message, setMessage] = useState('')

  const signInUrl = useMemo(
    () => `/SignIn?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`,
    [],
  )

  const checkBackend = async () => {
    setBackend('checking')
    try {
      await callServerLogic<Health>('health')
      setBackend('reachable')
    } catch (error) {
      if (error instanceof SessionExpiredError) setBackend('login-required')
      else setBackend('unreachable')
    }
  }

  useEffect(() => {
    const unsubscribe = syncCoordinator.subscribe(setSyncState)
    void checkBackend()
    return unsubscribe
  }, [])

  const saveOffline = async () => {
    setMessage('')
    try {
      const operationId = await saveWorkOrderExecution({
        workOrderId,
        status,
        technicianNote,
        followUpRequired,
        arrivedOn: toIsoOrUndefined(arrivedOn),
        completedOn: toIsoOrUndefined(completedOn),
      })

      await syncCoordinator.refreshPending()
      setMessage(`Saved locally in IndexedDB. Outbox operation: ${operationId}`)

      if (navigator.onLine) void syncCoordinator.syncNow('manual')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save offline draft.')
    }
  }

  return (
    <main className="shell">
      <header>
        <p className="eyebrow">{__APP_DISPLAY_NAME__}</p>
        <h1>{__APP_SHORT_NAME__} offline-first boilerplate</h1>
        <p>
          React PWA → centralized IndexedDB store/outbox → Sync Coordinator → Power Pages Server Logic → Field Service.
        </p>
      </header>

      <section className="grid">
        <article className="card">
          <h2>Central sync status</h2>
          <dl>
            <div><dt>Network</dt><dd data-testid="network-status">{syncState.online ? 'Online' : 'Offline'}</dd></div>
            <div><dt>Backend</dt><dd data-testid="backend-status">{backend}</dd></div>
            <div><dt>Sync engine</dt><dd>{syncState.running ? 'Synchronizing' : 'Idle'}</dd></div>
            <div><dt>Pending outbox</dt><dd>{syncState.pending}</dd></div>
            <div><dt>Blocked outbox</dt><dd>{syncState.blocked}</dd></div>
            <div><dt>Last pull rows</dt><dd>{syncState.lastPullCount ?? '—'}</dd></div>
          </dl>
          <div className="actions">
            <button onClick={() => void checkBackend()}>Health check</button>
            <button onClick={() => void syncCoordinator.syncNow('manual')} disabled={!syncState.online || syncState.running}>
              Sync now
            </button>
            <a className="button-link" href="/diagnostics">Diagnostics</a>
            {backend === 'login-required' && <a className="button-link" href={signInUrl}>Sign in with Entra ID</a>}
          </div>
          {syncState.lastError && <p className="error">{syncState.lastError}</p>}
        </article>

        <article className="card">
          <h2>Offline Work Order execution</h2>
          <p>
            Example local copy of the data a technician wants to send to Field Service. Saving always writes IndexedDB
            first and appends an outbox operation in the same transaction.
          </p>

          <label>
            Work Order GUID
            <input value={workOrderId} onChange={(event) => setWorkOrderId(event.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
          </label>

          <label>
            Execution status
            <select value={status} onChange={(event) => setStatus(event.target.value as WorkOrderExecutionStatus)}>
              <option value="inProgress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </label>

          <label>
            Technician note
            <textarea value={technicianNote} onChange={(event) => setTechnicianNote(event.target.value)} rows={4} placeholder="Example: replaced filter, pressure restored to normal." />
          </label>

          <label className="checkbox">
            <input type="checkbox" checked={followUpRequired} onChange={(event) => setFollowUpRequired(event.target.checked)} />
            Follow-up required
          </label>

          <label>
            First arrived on
            <input type="datetime-local" value={arrivedOn} onChange={(event) => setArrivedOn(event.target.value)} />
          </label>

          <label>
            Completed on
            <input type="datetime-local" value={completedOn} onChange={(event) => setCompletedOn(event.target.value)} />
          </label>

          <button onClick={() => void saveOffline()} disabled={!workOrderId}>
            Save locally
          </button>
        </article>
      </section>

      {message && <p className="message">{message}</p>}
      <footer>
        <span>
          v{__APP_VERSION__} · {__BUILD_SHA__.slice(0, 7)} · Writes to Field Service remain backend-feature-flagged until security and licensing review is complete.
        </span>
      </footer>
    </main>
  )
}
