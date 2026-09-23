import { useEffect, useMemo, useState } from 'react'
import { callServerLogic, SessionExpiredError } from './api/serverLogicClient'
import { db } from './offline/db'
import { enqueueWorkOrderNamePatch, flushOutbox } from './offline/syncEngine'

type Health = {
  status: string
  activityId: string
  user: string | null
  timestamp: string
}

export function App() {
  const [online, setOnline] = useState(navigator.onLine)
  const [backend, setBackend] = useState<'checking' | 'reachable' | 'unreachable' | 'login-required'>('checking')
  const [queueCount, setQueueCount] = useState(0)
  const [workOrderId, setWorkOrderId] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  const signInUrl = useMemo(
    () => `/SignIn?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`,
    [],
  )

  const refreshQueueCount = async () => setQueueCount(await db.outbox.count())

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

  const sync = async () => {
    setMessage('')
    try {
      const result = await flushOutbox()
      await refreshQueueCount()
      setMessage(`Sync completed: ${result.synced} synced, ${result.failed} pending/failed.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sync failed')
    }
  }

  useEffect(() => {
    const onOnline = () => {
      setOnline(true)
      void checkBackend()
      void sync()
    }
    const onOffline = () => setOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    void refreshQueueCount()
    void checkBackend()

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return (
    <main className="shell">
      <header>
        <p className="eyebrow">PowerPagesAsCode</p>
        <h1>Field Service offline-first boilerplate</h1>
        <p>React PWA → IndexedDB outbox → Power Pages Server Logic → Dataverse / Dynamics 365 Field Service.</p>
      </header>

      <section className="grid">
        <article className="card">
          <h2>Runtime status</h2>
          <dl>
            <div><dt>Network</dt><dd data-testid="network-status">{online ? 'Online' : 'Offline'}</dd></div>
            <div><dt>Backend</dt><dd>{backend}</dd></div>
            <div><dt>Pending outbox</dt><dd>{queueCount}</dd></div>
          </dl>
          <div className="actions">
            <button onClick={() => void checkBackend()}>Health check</button>
            <button onClick={() => void sync()} disabled={!online}>Sync now</button>
            {backend === 'login-required' && <a className="button-link" href={signInUrl}>Sign in with Entra ID</a>}
          </div>
        </article>

        <article className="card">
          <h2>Offline write example</h2>
          <p>
            This queues a work-order name update in IndexedDB. Server-side Field Service writes are disabled by
            default and must only be enabled after permissions and licensing are validated.
          </p>
          <label>
            Work Order GUID
            <input value={workOrderId} onChange={(event) => setWorkOrderId(event.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
          </label>
          <label>
            New name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Demo work order name" />
          </label>
          <button
            onClick={async () => {
              await enqueueWorkOrderNamePatch(workOrderId, name)
              await refreshQueueCount()
              setMessage('Operation queued locally.')
            }}
            disabled={!workOrderId || !name}
          >
            Queue operation
          </button>
        </article>
      </section>

      {message && <p className="message">{message}</p>}
      <footer><span>Backend status: {backend === 'reachable' ? 'Backend reachable' : backend}</span></footer>
    </main>
  )
}
