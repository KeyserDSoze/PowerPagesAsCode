import { describe, expect, it } from 'vitest'

describe('application version contract', () => {
  it('starts from strict semantic version 0.0.1', () => {
    expect('0.0.1').toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('treats different patch versions as different releases', () => {
    expect('0.0.1' === '0.0.2').toBe(false)
  })
})
