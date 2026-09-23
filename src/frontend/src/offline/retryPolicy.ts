import { ServerLogicError, SessionExpiredError } from '../api/serverLogicClient'
import { appConfig } from '../config/appConfig'
import type { SyncErrorKind } from './db'

export interface RetryDecision {
  retryable: boolean
  kind: SyncErrorKind
  message: string
}

export const classifyTransportError = (error: unknown): RetryDecision => {
  if (error instanceof SessionExpiredError) {
    return {
      retryable: true,
      kind: 'authentication',
      message: error.message,
    }
  }

  if (error instanceof ServerLogicError) {
    if (error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500) {
      return {
        retryable: true,
        kind: 'transient',
        message: error.message,
      }
    }

    return {
      retryable: false,
      kind: 'permanent',
      message: error.message,
    }
  }

  if (error instanceof TypeError) {
    return {
      retryable: true,
      kind: 'transient',
      message: error.message || 'Network request failed.',
    }
  }

  return {
    retryable: true,
    kind: 'transient',
    message: error instanceof Error ? error.message : 'Unexpected synchronization error.',
  }
}

export const computeRetryDelayMs = (attemptCount: number, random = Math.random): number => {
  const exponential = Math.min(
    appConfig.sync.retryMaxMs,
    appConfig.sync.retryBaseMs * 2 ** Math.max(0, attemptCount - 1),
  )
  const jitterFactor = 0.8 + random() * 0.4
  return Math.round(exponential * jitterFactor)
}
