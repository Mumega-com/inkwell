import { describe, it, expect, beforeEach } from 'vitest'
import {
  setAdapter,
  getAdapter,
  tryGetAdapter,
  hasAdapter,
  clearAdapters,
} from '../adapter-registry'
import type { DatabasePort } from '../types'

function mockDatabasePort(): DatabasePort {
  return {
    query: async () => [],
    queryOne: async () => null,
    execute: async () => ({ changes: 0 }),
    batch: async () => {},
  }
}

describe('adapter-registry', () => {
  beforeEach(() => {
    clearAdapters()
  })

  it('throws when getting unregistered adapter', () => {
    expect(() => getAdapter('database')).toThrowError(/No adapter registered for port "database"/)
  })

  it('registers and retrieves an adapter', () => {
    const db = mockDatabasePort()
    setAdapter('database', db)
    expect(getAdapter('database')).toBe(db)
  })

  it('hasAdapter returns false for unregistered, true for registered', () => {
    expect(hasAdapter('database')).toBe(false)
    setAdapter('database', mockDatabasePort())
    expect(hasAdapter('database')).toBe(true)
  })

  it('tryGetAdapter returns undefined for unregistered', () => {
    expect(tryGetAdapter('database')).toBeUndefined()
  })

  it('tryGetAdapter returns adapter when registered', () => {
    const db = mockDatabasePort()
    setAdapter('database', db)
    expect(tryGetAdapter('database')).toBe(db)
  })

  it('overwrites adapter on re-register', () => {
    const db1 = mockDatabasePort()
    const db2 = mockDatabasePort()
    setAdapter('database', db1)
    setAdapter('database', db2)
    expect(getAdapter('database')).toBe(db2)
  })

  it('clearAdapters removes all adapters', () => {
    setAdapter('database', mockDatabasePort())
    expect(hasAdapter('database')).toBe(true)
    clearAdapters()
    expect(hasAdapter('database')).toBe(false)
  })
})
