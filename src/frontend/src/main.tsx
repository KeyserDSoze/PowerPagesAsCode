import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { appConfig } from './config/appConfig'
import { DiagnosticsPage } from './diagnostics/DiagnosticsPage'
import { ErrorBoundary } from './errors/ErrorBoundary'
import { runStorageMaintenance } from './offline/storageMaintenance'
import { syncCoordinator } from './offline/syncCoordinator'
import { appLogger } from './observability/appLogger'
import { appVersionManager } from './version/appVersionManager'
import './styles.css'

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    void appVersionManager.forceServiceWorkerRefresh()
  },
})

appVersionManager.start(updateSW)
syncCoordinator.start()
void runStorageMaintenance()

appLogger.info('app.started', {
  details: {
    version: appConfig.app.version,
    environment: appConfig.app.environment,
  },
})

const showDiagnostics =
  appConfig.diagnostics.enabled &&
  window.location.pathname.replace(/\/$/, '') === '/diagnostics'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {showDiagnostics ? <DiagnosticsPage /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>,
)
