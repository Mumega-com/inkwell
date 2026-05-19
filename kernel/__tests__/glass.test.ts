import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createSosGlassAdapter,
  GlassTileError,
  type TilePayload,
} from '../adapters/glass/sos'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTilePayload(overrides: Partial<TilePayload> = {}): TilePayload {
  return {
    tile_id: 'test-tile',
    rendered_at: '2026-04-19T00:00:00Z',
    data: { value: 42, label: 'Test' },
    cache_ttl_s: 60,
    ...overrides,
  }
}

function mockKV(initial?: TilePayload) {
  return {
    get: vi.fn().mockResolvedValue(initial ?? null),
    put: vi.fn().mockResolvedValue(undefined),
  }
}

function makeFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : status === 404 ? 'Not Found' : 'Error',
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('createSosGlassAdapter — fetchTile', () => {
  const baseUrl = 'http://localhost:8092'

  it('returns parsed payload on 200', async () => {
    const payload = makeTilePayload()
    const fetchImpl = makeFetch(200, payload)
    const adapter = createSosGlassAdapter({ baseUrl, fetchImpl })

    const result = await adapter.fetchTile('acme', 'test-tile')

    expect(result).toEqual(payload)
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:8092/glass/payload/acme/test-tile',
    )
  })

  it('cache hit short-circuits the HTTP call', async () => {
    const payload = makeTilePayload()
    const kv = mockKV(payload)   // KV returns cached value
    const fetchImpl = makeFetch(200, payload)

    const adapter = createSosGlassAdapter({ baseUrl, kv, fetchImpl })
    const result = await adapter.fetchTile('acme', 'test-tile')

    expect(result).toEqual(payload)
    expect(kv.get).toHaveBeenCalledWith('glass:payload:acme:test-tile', 'json')
    // fetch must NOT be called on cache hit
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('cache miss: GETs remote and stores result in KV', async () => {
    const payload = makeTilePayload({ cache_ttl_s: 120 })
    const kv = mockKV()          // KV returns null → cache miss
    const fetchImpl = makeFetch(200, payload)

    const adapter = createSosGlassAdapter({ baseUrl, kv, fetchImpl })
    const result = await adapter.fetchTile('acme', 'test-tile')

    expect(result).toEqual(payload)
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(kv.put).toHaveBeenCalledWith(
      'glass:payload:acme:test-tile',
      JSON.stringify(payload),
      { expirationTtl: 120 },
    )
  })

  it('non-200 throws GlassTileError with correct status', async () => {
    const fetchImpl = makeFetch(404, { error: 'not found' })
    const adapter = createSosGlassAdapter({ baseUrl, fetchImpl })

    await expect(adapter.fetchTile('acme', 'missing-tile')).rejects.toSatisfy(
      (err: unknown) => err instanceof GlassTileError && (err as GlassTileError).status === 404,
    )
  })

  it('501 also throws GlassTileError (query kind unimplemented)', async () => {
    const fetchImpl = makeFetch(501, { error: 'not implemented' })
    const adapter = createSosGlassAdapter({ baseUrl, fetchImpl })

    await expect(adapter.fetchTile('acme', 'future-tile')).rejects.toSatisfy(
      (err: unknown) => err instanceof GlassTileError && (err as GlassTileError).status === 501,
    )
  })
})

describe('createSosGlassAdapter — listTiles', () => {
  const baseUrl = 'http://localhost:8092'

  it('returns tiles array from /glass/tiles/{tenant}', async () => {
    const tiles = [
      { id: 'health', title: 'Health', template: 'status_light', refresh_interval_s: 30, tenant: 'acme' },
    ]
    const fetchImpl = makeFetch(200, { tiles, count: 1 })
    const adapter = createSosGlassAdapter({ baseUrl, fetchImpl })

    const result = await adapter.listTiles('acme')

    expect(result).toEqual(tiles)
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:8092/glass/tiles/acme',
    )
  })

  it('throws GlassTileError on non-200', async () => {
    const fetchImpl = makeFetch(404, {})
    const adapter = createSosGlassAdapter({ baseUrl, fetchImpl })

    await expect(adapter.listTiles('ghost')).rejects.toSatisfy(
      (err: unknown) => err instanceof GlassTileError && (err as GlassTileError).status === 404,
    )
  })
})
