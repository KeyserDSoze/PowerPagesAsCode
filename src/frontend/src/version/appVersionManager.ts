export interface AppVersionManifest {
  version: string
  buildSha: string
  buildTime: string
}

export interface AppVersionState {
  currentVersion: string
  remoteVersion?: string
  updateRequired: boolean
  checking: boolean
  lastCheckedAt?: string
}

type Listener = (state: AppVersionState) => void
type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>

const CHECK_INTERVAL_MS = 60_000

class AppVersionManager {
  private started = false
  private updating = false
  private timer: number | undefined
  private updateServiceWorker: UpdateServiceWorker | undefined
  private readonly listeners = new Set<Listener>()
  private state: AppVersionState = {
    currentVersion: __APP_VERSION__,
    updateRequired: false,
    checking: false,
  }

  private readonly onOnline = () => void this.checkNow()
  private readonly onFocus = () => void this.checkNow()
  private readonly onVisibility = () => {
    if (document.visibilityState === 'visible') void this.checkNow()
  }

  start(updateServiceWorker: UpdateServiceWorker): void {
    if (this.started || typeof window === 'undefined') return

    this.started = true
    this.updateServiceWorker = updateServiceWorker

    window.addEventListener('online', this.onOnline)
    window.addEventListener('focus', this.onFocus)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.timer = window.setInterval(() => void this.checkNow(), CHECK_INTERVAL_MS)

    void this.checkNow()
  }

  stop(): void {
    if (!this.started || typeof window === 'undefined') return

    window.removeEventListener('online', this.onOnline)
    window.removeEventListener('focus', this.onFocus)
    document.removeEventListener('visibilitychange', this.onVisibility)
    if (this.timer !== undefined) window.clearInterval(this.timer)

    this.started = false
    this.timer = undefined
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  getState(): AppVersionState {
    return this.state
  }

  async checkNow(): Promise<void> {
    if (!navigator.onLine || this.updating) return

    this.setState({ checking: true })

    try {
      const remote = await this.fetchRemoteVersion()
      const updateRequired = remote.version !== __APP_VERSION__

      this.setState({
        remoteVersion: remote.version,
        updateRequired,
        lastCheckedAt: new Date().toISOString(),
      })

      if (updateRequired) {
        await this.forceUpdate(remote)
      }
    } catch {
      // Version checks must never block normal/offline app usage.
      this.setState({ lastCheckedAt: new Date().toISOString() })
    } finally {
      this.setState({ checking: false })
    }
  }

  async forceServiceWorkerRefresh(): Promise<void> {
    if (this.updating) return
    await this.forceUpdate({
      version: 'service-worker',
      buildSha: 'unknown',
      buildTime: new Date().toISOString(),
    })
  }

  private async fetchRemoteVersion(): Promise<AppVersionManifest> {
    const response = await fetch(`/version.json?cacheBust=${Date.now()}`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    })

    if (!response.ok) {
      throw new Error(`Unable to check application version (${response.status}).`)
    }

    const manifest = (await response.json()) as Partial<AppVersionManifest>
    if (!manifest.version || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
      throw new Error('Invalid version manifest.')
    }

    return {
      version: manifest.version,
      buildSha: manifest.buildSha || 'unknown',
      buildTime: manifest.buildTime || 'unknown',
    }
  }

  private async forceUpdate(remote: AppVersionManifest): Promise<void> {
    if (this.updating) return
    this.updating = true

    this.setState({
      remoteVersion: remote.version,
      updateRequired: true,
    })

    window.dispatchEvent(
      new CustomEvent('app-version:update-required', {
        detail: {
          currentVersion: __APP_VERSION__,
          remoteVersion: remote.version,
        },
      }),
    )

    let controllerChanged = false
    const reloadOnControllerChange = () => {
      controllerChanged = true
      window.location.reload()
    }

    navigator.serviceWorker?.addEventListener(
      'controllerchange',
      reloadOnControllerChange,
      { once: true },
    )

    try {
      const registration = await navigator.serviceWorker?.getRegistration()
      await registration?.update()
      await this.updateServiceWorker?.(true)
    } catch {
      // The cache-busted navigation below is the final fallback.
    }

    window.setTimeout(() => {
      if (controllerChanged) return

      const url = new URL(window.location.href)
      url.searchParams.set('__appVersion', remote.version)
      window.location.replace(url.toString())
    }, 2_500)
  }

  private setState(patch: Partial<AppVersionState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener(this.state)
  }
}

export const appVersionManager = new AppVersionManager()
