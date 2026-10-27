import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AppBindings, Env } from '../types'
import type { GraphEdge, GraphNode } from '../../../../kernel/types'
import { contentRoutes } from '../routes/content'
import { contentRoutes as pluginContentRoutes } from '../../../../plugins/content/routes-content'
import { graphRoutes } from '../../../../plugins/content/routes-graph'
import { contractRoutes } from '../../../../plugins/contracts/routes'
import { mcpRoutes } from '../routes/mcp'
import { mcpRoutes as pluginMcpRoutes } from '../../../../plugins/mcp/routes'
import { hasValidBearer } from '../lib/bearer-auth'

const TOKEN = 'route-contract-fixture'
const PAYLOAD = { title: 'Route contract', content: 'Test content.', overwrite: true }

// Only storage ports are faked. All requests exercise the real Hono routes and
// native constant-time crypto, with no configured network or deploy adapters.
function fixture(router: Hono<AppBindings>, token: string | undefined = TOKEN, tenant: string | null = null) {
  const values = new Map<string, string>()
  const graphNodes = new Map<string, GraphNode>()
  const graphEdges: GraphEdge[] = []
  const graph = {
    getNode: vi.fn(async (slug: string) => graphNodes.get(slug) ?? null),
    getNeighbors: vi.fn(async () => ({ nodes: [...graphNodes.values()], edges: graphEdges })),
    getBacklinks: vi.fn(async () => graphEdges),
    upsertNode: vi.fn(async (node: GraphNode) => { graphNodes.set(node.slug, node) }),
    queryNodes: vi.fn().mockResolvedValue([]),
  }
  const rows = [{ slug: 'entry', title: 'Entry', published_at: '2026-10-26' }]
  const statement = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: rows }),
    run: vi.fn().mockResolvedValue({ success: true }),
  }
  const db = { prepare: vi.fn().mockReturnValue(statement) }
  const content = {
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => { values.set(key, value) }),
  }
  const bindings = {
    PUBLISH_TOKEN: token,
    CONTENT: content,
    DB_ANALYTICS: db,
    SITE_URL: 'https://example.invalid',
  } as unknown as Env
  const app = new Hono<AppBindings>()
  app.use('*', async (c, next) => {
    c.set('tenant_slug', tenant)
    c.set('content', { getPage: content.get, putPage: content.put } as never)
    c.set('graph', graph as never)
    c.set('db_analytics', {
      query: vi.fn().mockResolvedValue(rows),
      execute: vi.fn().mockResolvedValue({ success: true }),
    } as never)
    await next()
  })
  app.route('/api', router)
  return {
    values, db, content, bindings, graphNodes, graphEdges,
    request(path: string, authorization?: string, method = 'GET', body?: unknown) {
      return app.request(`http://localhost/api${path === '/' ? '' : path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(authorization === undefined ? {} : { Authorization: authorization }),
        },
        ...(body === undefined || method === 'GET' ? {} : { body: JSON.stringify(body) }),
      }, bindings)
    },
  }
}

describe.each([
  ['worker', contentRoutes],
  ['plugin', pluginContentRoutes],
] as const)('%s content access', (_name, router) => {
  beforeEach(() => { vi.clearAllMocks() })

  describe.each([
    ['/publish', 'POST'], ['/drafts', 'GET'],
    ...(router === contentRoutes ? [['/pipeline', 'GET']] : []),
  ])('%s', (path, method) => {
    it.each([undefined, ''])('returns 503 when the token is unconfigured (%s)', async (token) => {
      const f = fixture(router)
      f.bindings.PUBLISH_TOKEN = token
      const res = await f.request(path, `Bearer ${TOKEN}`, method, PAYLOAD)
      expect(res.status).toBe(503)
      expect(await res.json()).toEqual({ error: 'publish_token_unconfigured' })
      expect(f.content.get).not.toHaveBeenCalled()
      expect(f.db.prepare).not.toHaveBeenCalled()
    })

    it.each([undefined, 'Bearer wrong', `Bearer ${'x'.repeat(TOKEN.length)}`, `Basic ${TOKEN}`])(
      'returns 401 for absent or invalid authorization (%s)', async (authorization) => {
        const f = fixture(router)
        const res = await f.request(path, authorization, method, PAYLOAD)
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ error: 'unauthorized' })
        expect(f.content.get).not.toHaveBeenCalled()
        expect(f.db.prepare).not.toHaveBeenCalled()
      },
    )

    it('accepts the configured bearer', async () => {
      const f = fixture(router)
      const res = await f.request(path, `Bearer ${TOKEN}`, method, method === 'POST' ? PAYLOAD : undefined)
      expect(res.status).toBe(200)
      if (method === 'POST') {
        expect(await res.json()).toMatchObject({ ok: true, slug: 'route-contract', deploy: 'manual' })
        expect(JSON.parse(f.values.get('meta:route-contract')!)).toMatchObject({ status: 'published' })
      }
    })
  })

  it.each(['idea', 'draft', 'archived', 'review', 'scheduled', 'killed', undefined])(
    'hides a %s slug unless the publish bearer is valid', async (status) => {
      const f = fixture(router)
      f.values.set('post:entry', 'Private content')
      f.values.set('meta:entry', JSON.stringify(status === undefined ? {} : { status }))
      expect((await f.request('/posts/entry')).status).toBe(404)
      expect((await f.request('/posts/entry', 'Bearer wrong')).status).toBe(404)
      const authorized = await f.request('/posts/entry', `Bearer ${TOKEN}`)
      expect(authorized.status).toBe(200)
      expect(await authorized.json()).toMatchObject({ markdown: 'Private content' })
    },
  )

  it.each([null, '{malformed'])('keeps missing or invalid metadata private (%s)', async (meta) => {
    const f = fixture(router)
    f.values.set('post:entry', 'Unclassified content')
    if (meta !== null) f.values.set('meta:entry', meta)
    expect((await f.request('/posts/entry')).status).toBe(404)
    expect((await f.request('/posts/entry', `Bearer ${TOKEN}`)).status).toBe(200)
    f.bindings.PUBLISH_TOKEN = undefined
    expect((await f.request('/posts/entry', `Bearer ${TOKEN}`)).status).toBe(404)
  })

  it('serves explicitly published content publicly', async () => {
    const f = fixture(router)
    f.bindings.PUBLISH_TOKEN = undefined
    f.values.set('post:entry', 'Published content')
    f.values.set('meta:entry', JSON.stringify({ status: 'published' }))
    expect((await f.request('/posts/entry')).status).toBe(200)
  })

  it('keeps unknown slugs at 404 even with a valid bearer', async () => {
    const f = fixture(router)
    expect((await f.request('/posts/unknown', `Bearer ${TOKEN}`)).status).toBe(404)
  })

  it.each(['idea', 'draft', 'review', 'scheduled', 'archived', 'killed', null, 'published'])('lists only published entries (%s)', async (status) => {
    const f = fixture(router)
    if (status) f.values.set('meta:entry', JSON.stringify({ status }))
    const res = await f.request('/posts')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ posts: status === 'published' ? [{ slug: 'entry' }] : [] })
  })

  it('omits malformed metadata from public listings', async () => {
    const f = fixture(router)
    f.values.set('meta:entry', '{malformed')
    expect(await (await f.request('/posts')).json()).toEqual({ posts: [] })
  })

  it('applies visibility checks to the tenant-scoped metadata', async () => {
    const f = fixture(router, TOKEN, 'tenant-a')
    f.values.set('tenant-a:post:entry', 'Tenant draft')
    f.values.set('tenant-a:meta:entry', JSON.stringify({ status: 'draft' }))
    f.values.set('meta:entry', JSON.stringify({ status: 'published' }))
    expect((await f.request('/posts/entry')).status).toBe(404)
    expect((await f.request('/posts/entry', `Bearer ${TOKEN}`)).status).toBe(200)
  })
})

describe('related route guards', () => {
  it.each(['idea', 'draft', 'review', 'scheduled', 'archived', 'killed', 'published'])(
    'marks only published graph entries public (%s)', async (status) => {
      const f = fixture(pluginContentRoutes)
      expect((await f.request('/publish', `Bearer ${TOKEN}`, 'POST', { ...PAYLOAD, status })).status).toBe(200)
      expect(f.graphNodes.get('route-contract')?.visibility).toBe(status === 'published' ? 'public' : 'private')
    },
  )

  it.each(['/graph/node/entry', '/graph/backlinks/entry'])('hides private graph targets at %s', async (path) => {
    const f = fixture(graphRoutes)
    f.graphNodes.set('entry', { slug: 'entry', title: 'Private', type: 'blog', tags: [], visibility: 'private' })
    expect((await f.request(path)).status).toBe(404)
    expect((await f.request(path, 'Bearer wrong')).status).toBe(404)
    expect((await f.request(path, `Bearer ${TOKEN}`)).status).toBe(200)
  })

  it('filters private graph neighbors, edges and backlink sources', async () => {
    const f = fixture(graphRoutes)
    f.graphNodes.set('entry', { slug: 'entry', title: 'Public', type: 'blog', tags: [], visibility: 'public' })
    f.graphNodes.set('private', { slug: 'private', title: 'Private', type: 'blog', tags: [], visibility: 'private' })
    f.graphEdges.push({ source: 'private', target: 'entry', type: 'wikilink' })
    const publicNode = await (await f.request('/graph/node/entry')).json()
    expect(publicNode).toMatchObject({ neighbors: { nodes: [{ slug: 'entry' }], edges: [] } })
    expect(await (await f.request('/graph/backlinks/entry')).json()).toMatchObject({ backlinks: [], sources: [] })
    expect(await (await f.request('/graph/backlinks/entry', `Bearer ${TOKEN}`)).json()).toMatchObject({ sources: [{ slug: 'private' }] })
    f.bindings.PUBLISH_TOKEN = undefined
    expect(await (await f.request('/graph/node/entry', `Bearer ${TOKEN}`)).json()).toMatchObject({ neighbors: { nodes: [{ slug: 'entry' }], edges: [] } })
  })

  it.each([undefined, '', 'Bearer wrong', `Bearer ${TOKEN}`])('guards ingest (%s)', async (authorization) => {
    const f = fixture(graphRoutes)
    const res = await f.request('/ingest', authorization, 'POST', {})
    expect(res.status).toBe(authorization === `Bearer ${TOKEN}` ? 400 : 401)
    f.bindings.PUBLISH_TOKEN = undefined
    expect((await f.request('/ingest', authorization, 'POST', {})).status).toBe(503)
  })

  it('requires a configured milestone bearer', async () => {
    const f = fixture(contractRoutes)
    expect((await f.request('/entry/milestone', undefined, 'POST', {})).status).toBe(503)
    f.bindings.CONTRACT_AUTH_TOKEN = TOKEN
    expect((await f.request('/entry/milestone', 'Bearer wrong', 'POST', {})).status).toBe(401)
  })

  it('requires a configured legacy MCP bearer', async () => {
    const f = fixture(mcpRoutes)
    expect((await f.request('/', undefined, 'POST', {})).status).toBe(503)
    f.bindings.INKWELL_MCP_TOKEN = TOKEN
    expect((await f.request('/', undefined, 'POST', {})).status).toBe(401)
    expect((await f.request('/', 'Bearer wrong', 'POST', {})).status).toBe(401)
    const res = await f.request('/', `Bearer ${TOKEN}`, 'POST', { jsonrpc: '2.0', method: 'initialize', id: 1 })
    expect(res.status).toBe(200)
  })

  it('rejects anonymous plugin MCP even without a global token', async () => {
    const f = fixture(pluginMcpRoutes)
    f.bindings.PUBLISH_TOKEN = undefined
    expect((await f.request('/', undefined, 'POST', {})).status).toBe(401)
  })
})

describe('bearer byte comparison', () => {
  it('checks encoded byte length before calling the native primitive', () => {
    const compare = vi.spyOn(crypto.subtle as SubtleCrypto & { timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean }, 'timingSafeEqual')
    expect(hasValidBearer('Bearer aa', 'é')).toBe(false)
    expect(compare).toHaveBeenCalledTimes(1)
    expect(hasValidBearer('Bearer a', 'é')).toBe(false)
    expect(compare).toHaveBeenCalledTimes(1)
    expect(hasValidBearer('Bearer é', 'é')).toBe(true)
    compare.mockRestore()
  })
})
