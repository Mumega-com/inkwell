import { describe, it, expect, vi } from 'vitest'
import { KVSessionAdapter } from '../adapters/kv-session'

function mockKV() {
  return {
    get: vi.fn(),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  }
}

describe('KVSessionAdapter', () => {
  it('get delegates to kv.get', async () => {
    const kv = mockKV()
    kv.get.mockResolvedValue('session-data')
    const adapter = new KVSessionAdapter(kv)

    const result = await adapter.get('session:abc')
    expect(kv.get).toHaveBeenCalledWith('session:abc')
    expect(result).toBe('session-data')
  })

  it('get returns null for missing key', async () => {
    const kv = mockKV()
    kv.get.mockResolvedValue(null)
    const adapter = new KVSessionAdapter(kv)

    expect(await adapter.get('missing')).toBeNull()
  })

  it('set with TTL passes expirationTtl', async () => {
    const kv = mockKV()
    const adapter = new KVSessionAdapter(kv)

    await adapter.set('key', 'value', 3600)
    expect(kv.put).toHaveBeenCalledWith('key', 'value', { expirationTtl: 3600 })
  })

  it('set without TTL passes no options', async () => {
    const kv = mockKV()
    const adapter = new KVSessionAdapter(kv)

    await adapter.set('key', 'value')
    expect(kv.put).toHaveBeenCalledWith('key', 'value', undefined)
  })

  it('delete delegates to kv.delete', async () => {
    const kv = mockKV()
    const adapter = new KVSessionAdapter(kv)

    await adapter.delete('session:abc')
    expect(kv.delete).toHaveBeenCalledWith('session:abc')
  })
})
