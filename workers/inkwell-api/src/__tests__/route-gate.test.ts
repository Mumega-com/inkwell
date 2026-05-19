import { describe, it, expect, beforeAll } from 'vitest'
import { request, seedTables } from './helpers'

describe('Route gate middleware', () => {
  beforeAll(async () => {
    await seedTables()
  })

  it('health check always works regardless of ENABLED_ROUTES', async () => {
    const res = await request('GET', '/health')
    expect(res.status).toBe(200)
    const body = await res.json<{ status: string }>()
    expect(body.status).toBe('ok')
  })

  it('analytics routes always work (ungated)', async () => {
    // /api/reactions/:slug is under analyticsRoutes which is ungated
    const res = await request('GET', '/api/reactions/nonexistent')
    expect(res.status).toBe(200)
    // Should return empty counts, not 404 route_disabled
    const body = await res.json<{ counts: Record<string, number> }>()
    expect(body.counts).toBeDefined()
  })

  it('content routes always work (ungated)', async () => {
    const res = await request('GET', '/api/posts')
    // May return 200 with empty list or populated list, but not route_disabled
    expect(res.status).toBe(200)
    const body = await res.json<{ posts: unknown[] }>()
    expect(Array.isArray(body.posts)).toBe(true)
  })
})
