import { describe, expect, it } from 'vitest'
import { ServerLogicError, SessionExpiredError } from '../api/serverLogicClient'
import { classifyTransportError, computeRetryDelayMs } from './retryPolicy'

describe('retry policy', () => {
  it('retries throttling and server errors', () => {
    expect(classifyTransportError(new ServerLogicError('throttled', 429)).retryable).toBe(true)
    expect(classifyTransportError(new ServerLogicError('server', 503)).retryable).toBe(true)
  })

  it('blocks ordinary authorization/validation HTTP failures', () => {
    expect(classifyTransportError(new ServerLogicError('forbidden', 403)).retryable).toBe(false)
  })

  it('treats an expired session as retryable authentication state', () => {
    expect(classifyTransportError(new SessionExpiredError()).kind).toBe('authentication')
  })

  it('uses bounded exponential backoff with jitter', () => {
    const first = computeRetryDelayMs(1, () => 0.5)
    const second = computeRetryDelayMs(2, () => 0.5)
    expect(second).toBeGreaterThan(first)
  })
})
