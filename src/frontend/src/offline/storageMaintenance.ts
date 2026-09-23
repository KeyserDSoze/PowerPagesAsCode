import { appConfig } from '../config/appConfig'
import { appLogger } from '../observability/appLogger'
import { db } from './db'

export interface StorageSnapshot {
  persisted?: boolean
  usage?: number
  quota?: number
  usagePercent?: number
}

export async function getStorageSnapshot(): Promise<StorageSnapshot> {
  if (!navigator.storage) return {}

  let persisted = false
  let estimate: StorageEstimate = {}

  try {
    if (navigator.storage.persisted) {
      persisted = await navigator.storage.persisted()
    }
  } catch {
    persisted = false
  }

  try {
    if (navigator.storage.estimate) {
      estimate = await navigator.storage.estimate()
    }
  } catch {
    estimate = {}
  }

  const usage = estimate.usage
  const quota = estimate.quota

  return {
    persisted,
    usage,
    quota,
    usagePercent: usage !== undefined && quota ? Math.round((usage / quota) * 10_000) / 100 : undefined,
  }
}

export async function requestPersistentStorage(): Promise<boolean | undefined> {
  if (!navigator.storage?.persist) return undefined
  return navigator.storage.persist()
}

export async function cleanupSyncedCache(): Promise<number> {
  const cutoff = Date.now() - appConfig.sync.cacheRetentionDays * 24 * 60 * 60 * 1000
  const protectedIds = new Set(
    (await db.workOrderExecutions.filter((row) => row.syncStatus !== 'clean').toArray())
      .map((row) => row.workOrderId),
  )

  const stale = await db.workOrders
    .filter((row) => Date.parse(row.fetchedAt) < cutoff && !protectedIds.has(row.id))
    .primaryKeys()

  if (stale.length > 0) await db.workOrders.bulkDelete(stale)

  appLogger.info('storage.cleanup_completed', {
    details: { deletedWorkOrders: stale.length },
  })

  return stale.length
}

export async function runStorageMaintenance(): Promise<void> {
  try {
    await requestPersistentStorage()
    await cleanupSyncedCache()
  } catch (error) {
    appLogger.warn('storage.maintenance_failed', {
      details: { message: error instanceof Error ? error.message : String(error) },
    })
  }
}
