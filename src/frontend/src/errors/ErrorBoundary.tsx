import React from 'react'
import { appLogger } from '../observability/appLogger'

interface State {
  failed: boolean
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    appLogger.error('ui.unhandled_error', {
      details: {
        message: error.message,
        componentStack: info.componentStack?.slice(0, 1000),
      },
    })
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="shell">
          <article className="card">
            <p className="eyebrow">PowerPagesAsCode</p>
            <h1>Application error</h1>
            <p>
              The application hit an unexpected error. Your offline data has not been intentionally removed.
            </p>
            <p>Version: {__APP_VERSION__}</p>
            <button onClick={() => window.location.reload()}>Reload application</button>
          </article>
        </main>
      )
    }

    return this.props.children
  }
}
