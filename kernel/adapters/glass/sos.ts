/**
 * SOS Glass adapter — fetches tile payloads from the Glass service.
 *
 * Glass service exposes:
 *   GET /glass/payload/{tenant}/{tile_id} → TilePayload
 *   GET /glass/tiles/{tenant}             → { tiles: Tile[], count: number }
 *
 * Dev URL:  http://localhost:8092
 * Prod URL: https://api.mumega.com
 *
 * Caching: if a KV binding is provided, payloads are cached using the
 * cache_ttl_s value from the response. The adapter is KV-optional so it
 * can be used in Node test environments without a Cloudflare binding.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type TileTemplate =
  | 'number'
  | 'sparkline'
  | 'progress_bar'
  | 'event_log'
  | 'status_light'
  | 'chart'

export interface TilePayload {
  tile_id: string
  rendered_at: string        // ISO-8601 UTC
  data: Record<string, unknown>
  cache_ttl_s: number
}

export interface Tile {
  id: string                 // slug, [a-z0-9-]+
  title: string
  template: TileTemplate
  refresh_interval_s: number
  tenant: string
  // query field is server-side only — Inkwell never receives it
}

// ─── Error ───────────────────────────────────────────────────────────────────

export class GlassTileError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'GlassTileError'
  }
}

// ─── Interface ───────────────────────────────────────────────────────────────

export interface GlassAdapter {
  fetchTile(tenant: string, tileId: string): Promise<TilePayload>
  listTiles(tenant: string): Promise<Tile[]>
}

// ─── Minimal KV binding interface (avoids importing @cloudflare/workers-types) ─

interface KVBinding {
  get(key: string, type: 'json'): Promise<unknown>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createSosGlassAdapter(config: {
  /** Base URL of the Glass service, e.g. "https://api.mumega.com" or "http://localhost:8092" */
  baseUrl: string
  /** Cloudflare KV namespace for caching — optional; omit in Node test environments */
  kv?: KVBinding
  /** Inject a custom fetch implementation for testing */
  fetchImpl?: typeof fetch
}): GlassAdapter {
  const { baseUrl, kv } = config
  const fetchFn = config.fetchImpl ?? fetch

  async function fetchTile(tenant: string, tileId: string): Promise<TilePayload> {
    const cacheKey = `glass:payload:${tenant}:${tileId}`

    // 1. KV cache read
    if (kv) {
      const cached = await kv.get(cacheKey, 'json')
      if (cached !== null) {
        return cached as TilePayload
      }
    }

    // 2. Fetch from Glass service
    const url = `${baseUrl}/glass/payload/${encodeURIComponent(tenant)}/${encodeURIComponent(tileId)}`
    const res = await fetchFn(url)

    // 3. Non-200 → typed error (dashboard renders placeholder for any GlassTileError)
    if (!res.ok) {
      throw new GlassTileError(
        res.status,
        `Glass tile fetch failed: ${res.status} ${res.statusText} — tenant=${tenant} tileId=${tileId}`,
      )
    }

    // 4. Parse
    const payload = await res.json() as TilePayload

    // 5. KV cache write
    if (kv) {
      const ttl = Math.max(payload.cache_ttl_s, 1)  // KV requires ttl >= 1
      await kv.put(cacheKey, JSON.stringify(payload), { expirationTtl: ttl })
    }

    return payload
  }

  async function listTiles(tenant: string): Promise<Tile[]> {
    // Called at build time / low frequency — no caching needed
    const url = `${baseUrl}/glass/tiles/${encodeURIComponent(tenant)}`
    const res = await fetchFn(url)

    if (!res.ok) {
      throw new GlassTileError(
        res.status,
        `Glass tile list failed: ${res.status} ${res.statusText} — tenant=${tenant}`,
      )
    }

    const body = await res.json() as { tiles: Tile[]; count: number }
    return body.tiles
  }

  return { fetchTile, listTiles }
}
