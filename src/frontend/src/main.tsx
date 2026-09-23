import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { syncCoordinator } from './offline/syncCoordinator'
import './styles.css'

registerSW({ immediate: true })
syncCoordinator.start()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
