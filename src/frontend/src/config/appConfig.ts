const numberFromEnv = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const booleanFromEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === '') return fallback
  return value.toLowerCase() === 'true'
}

const appEnvironment = import.meta.env.VITE_APP_ENVIRONMENT || 'local'

export const appConfig = Object.freeze({
  app: Object.freeze({
    displayName: __APP_DISPLAY_NAME__,
    shortName: __APP_SHORT_NAME__,
    databaseName: __APP_DB_NAME__,
    version: __APP_VERSION__,
    buildSha: __BUILD_SHA__,
    buildTime: __BUILD_TIME__,
    environment: appEnvironment,
  }),
  sync: Object.freeze({
    pushBatchSize: numberFromEnv(import.meta.env.VITE_SYNC_PUSH_BATCH_SIZE, 20),
    pullPageSize: numberFromEnv(import.meta.env.VITE_SYNC_PULL_PAGE_SIZE, 50),
    pullMaxPages: numberFromEnv(import.meta.env.VITE_SYNC_PULL_MAX_PAGES, 10),
    maxAttempts: numberFromEnv(import.meta.env.VITE_SYNC_MAX_ATTEMPTS, 6),
    retryBaseMs: numberFromEnv(import.meta.env.VITE_SYNC_RETRY_BASE_MS, 2_000),
    retryMaxMs: numberFromEnv(import.meta.env.VITE_SYNC_RETRY_MAX_MS, 5 * 60_000),
    cacheRetentionDays: numberFromEnv(import.meta.env.VITE_CACHE_RETENTION_DAYS, 30),
  }),
  versioning: Object.freeze({
    checkIntervalMs: numberFromEnv(import.meta.env.VITE_VERSION_CHECK_INTERVAL_MS, 60_000),
  }),
  diagnostics: Object.freeze({
    enabled: booleanFromEnv(
      import.meta.env.VITE_DIAGNOSTICS_ENABLED,
      appEnvironment !== 'production',
    ),
    maxRecentLogs: numberFromEnv(import.meta.env.VITE_DIAGNOSTICS_MAX_LOGS, 100),
  }),
})
