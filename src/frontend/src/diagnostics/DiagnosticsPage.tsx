import { useEffect, useState } from 'react'
import { appConfig } from '../config/appConfig'
import { db } from '../offline/db'
import { getStorageSnapshot, type StorageSnapshot } from '../offline/storageMaintenance'
import { syncCoordinator, type SyncCoordinatorState } from '../offline/syncCoordinator'
import { appLogger, type AppLogEntry } from '../observability/appLogger'
import { appVersionManager, type AppVersionState } from '../version/appVersionManager'

interface DiagnosticsSnapshot {
  dbVersion: number
  workOrders: number
  drafts: number
  outbox: number
  serviceWorker: string
  storage: StorageSnapshot
  logs: readonly AppLogEntry[]
}

const loadSnapshot = async (): Promise<DiagnosticsSnapshot> => {
  const registration = await navigator.serviceWorker?.getRegistration()

  return {
    dbVersion: db.verno,
    workOrders: await db.workOrders.count(),
    drafts: await db.workOrderExecutions.count(),
    outbox: await db.outbox.count(),
    serviceWorker: registration?.active?.state || registration?.waiting?.state || 'not-active',
    storage: await getStorageSnapshot(),
    logs: appLogger.recent().slice(-25).reverse(),
  }
}

export function DiagnosticsPage() {
  const [sync, setSync] = useState<SyncCoordinatorState>(syncCoordinator.getState())
  const [version, setVersion] = useState<AppVersionState>(appVersionManager.getState())
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot>()

  const refresh = async () => setSnapshot(await loadSnapshot())

  useEffect(() => {
    const unsubscribeSync = syncCoordinator.subscribe(setSync)
    const unsubscribeVersion = appVersionManager.subscribe(setVersion)
    const onLog = () => void refresh()

    window.addEventListener('app-log', onLog)
    void refresh()

    return () => {
      unsubscribeSync()
      unsubscribeVersion()
      window.removeEventListener('app-log', onLog)
    }
  }, [])

  return (
    <main className="shell">
      <header>
        <p className="eyebrow">Diagnostics</p>
        <h1>PowerPagesAsCode runtime</h1>
        <p>No business payloads, credentials or access tokens are displayed here.</p>
      </header>

      <section className="grid">
        <article className="card">
          <h2>Build</h2>
          <dl>
            <div><dt>Version</dt><dd>{appConfig.app.version}</dd></div>
            <div><dt>SHA</dt><dd>{appConfig.app.buildSha.slice(0, 12)}</dd></div>
            <div><dt>Build time</dt><dd>{appConfig.app.buildTime}</dd></div>
            <div><dt>Environment</dt><dd>{appConfig.app.environment}</dd></div>
            <div><dt>Remote version</dt><dd>{version.remoteVersion || '—'}</dd></div>
            <div><dt>Update required</dt><dd>{version.updateRequired ? 'yes' : 'no'}</dd></div>
          </dl>
        </article>

        <article className="card">
          <h2>Synchronization</h2>
          <dl>
            <div><dt>Network</dt><dd>{sync.online ? 'online' : 'offline'}</dd></div>
            <div><dt>Running</dt><dd>{sync.running ? 'yes' : 'no'}</dd></div>
            <div><dt>Pending</dt><dd>{sync.pending}</dd></div>
            <div><dt>Blocked</dt><dd>{sync.blocked}</dd></div>
            <div><dt>Last sync</dt><dd>{sync.lastSyncAt || '—'}</dd></div>
            <div><dt>Last pull rows</dt><dd>{sync.lastPullCount ?? '—'}</dd></div>
            <div><dt>Next retry</dt><dd>{sync.nextRetryAt || '—'}</dd></div>
          </dl>
          <div className="actions">
            <button onClick={() => void syncCoordinator.syncNow('manual')}>Sync now</button>
            <button onClick={() => void appVersionManager.checkNow()}>Check version</button>
            <button onClick={() => void refresh()}>Refresh diagnostics</button>
          </div>
        </article>

        <article className="card">
          <h2>Local storage</h2>
          <dl>
            <div><dt>IndexedDB schema</dt><dd>{snapshot?.dbVersion ?? '—'}</dd></div>
            <div><dt>Work Orders cached</dt><dd>{snapshot?.workOrders ?? '—'}</dd></div>
            <div><dt>Local drafts</dt><dd>{snapshot?.drafts ?? '—'}</dd></div>
            <div><dt>Outbox rows</dt><dd>{snapshot?.outbox ?? '—'}</dd></div>
            <div><dt>Service Worker</dt><dd>{snapshot?.serviceWorker ?? '—'}</dd></div>
            <div><dt>Persistent storage</dt><dd>{snapshot?.storage.persisted ? 'yes' : 'no/unknown'}</dd></div>
            <div><dt>Storage usage</dt><dd>{snapshot?.storage.usagePercent ?? '—'}%</dd></div>
          </dl>
        </article>
      </section>

      <article className="card diagnostics-logs">
        <h2>Recent structured events</h2>
        <pre>{JSON.stringify(snapshot?.logs ?? [], null, 2)}</pre>
      </article>

      <footer>
        <a href="/">Back to application</a>
      </footer>
    </main>
  )
}
