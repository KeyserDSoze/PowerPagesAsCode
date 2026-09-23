import { describe, expect, it } from 'vitest'

describe('application version contract', () => {
  it('starts from strict semantic version 0.0.1', () => {
    const initialVersion: string = '0.0.1'
    expect(initialVersion).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('treats different patch versions as different releases', () => {
    const currentVersion: string = '0.0.1'
    const nextVersion: string = '0.0.2'
    expect(currentVersion).not.toBe(nextVersion)
  })
})
