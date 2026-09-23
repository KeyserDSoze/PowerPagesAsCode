import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { syncCoordinator } from './offline/syncCoordinator'
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
