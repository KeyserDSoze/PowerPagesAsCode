import { appConfig } from '../config/appConfig'

export type LogLevel = 'info' | 'warn' | 'error'

export interface AppLogEntry {
  timestamp: string
  level: LogLevel
  event: string
  operationId?: string
  activityId?: string
  details?: Record<string, string | number | boolean | null | undefined>
}

const recent: AppLogEntry[] = []

const write = (
  level: LogLevel,
  event: string,
  context: Omit<AppLogEntry, 'timestamp' | 'level' | 'event'> = {},
): void => {
  const entry: AppLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...context,
  }

  recent.push(entry)
  while (recent.length > appConfig.diagnostics.maxRecentLogs) recent.shift()

  const line = JSON.stringify({
    ...entry,
    appVersion: appConfig.app.version,
    buildSha: appConfig.app.buildSha.slice(0, 12),
  })

  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app-log', { detail: entry }))
  }
}

export const appLogger = {
  info: (event: string, context?: Omit<AppLogEntry, 'timestamp' | 'level' | 'event'>) =>
    write('info', event, context),
  warn: (event: string, context?: Omit<AppLogEntry, 'timestamp' | 'level' | 'event'>) =>
    write('warn', event, context),
  error: (event: string, context?: Omit<AppLogEntry, 'timestamp' | 'level' | 'event'>) =>
    write('error', event, context),
  recent: (): readonly AppLogEntry[] => [...recent],
}
