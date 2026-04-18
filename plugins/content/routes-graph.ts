import { Hono } from 'hono'
import type { AppBindings } from '../types'
import type { GraphNode } from '../../kernel/types'
import { compileMdx } from '../../kernel/processors/mdx-compiler'

const graphRoutes = new Hono<AppBindings>()

// GET /api/graph — full graph for tenant (public nodes only for unauthenticated)
graphRoutes.get('/graph', async (c) => {
  const tenant = c.get('tenant_slug') ?? undefined
  const tag = c.req.query('tag') ?? undefined
  const type = c.req.query('type') ?? undefined

  const nodes = await c.get('graph').queryNodes({
    tenant,
    tag,
    type,
    visibility: 'public',
  })

  // Build edges between returned nodes
  const slugSet = new Set(nodes.map((n) => n.slug))
  const edges = []
  for (const node of nodes) {
    const backlinks = await c.get('graph').getBacklinks(node.slug, tenant)
    for (const edge of backlinks) {
      if (slugSet.has(edge.source)) edges.push(edge)
    }
  }

  return c.json({ nodes, edges })
})

// GET /api/graph/node/:slug — single node with neighbors
graphRoutes.get('/graph/node/:slug', async (c) => {
  const slug = c.req.param('slug')
  const tenant = c.get('tenant_slug') ?? undefined
  const depth = Math.min(parseInt(c.req.query('depth') ?? '1', 10) || 1, 3)

  const node = await c.get('graph').getNode(slug, tenant)
  if (!node) return c.json({ error: 'not_found' }, 404)

  const neighbors = await c.get('graph').getNeighbors(slug, depth, tenant)
  return c.json({ node, neighbors })
})

// GET /api/graph/backlinks/:slug — backlinks for a page
graphRoutes.get('/graph/backlinks/:slug', async (c) => {
  const slug = c.req.param('slug')
  const tenant = c.get('tenant_slug') ?? undefined

  const edges = await c.get('graph').getBacklinks(slug, tenant)

  // Enrich with node titles
  const nodes = []
  for (const edge of edges) {
    const sourceNode = await c.get('graph').getNode(edge.source, tenant)
    if (sourceNode) nodes.push(sourceNode)
  }

  return c.json({ slug, backlinks: edges, sources: nodes })
})

// POST /api/ingest — accept raw MDX, compile, store, graph
graphRoutes.post('/ingest', async (c) => {
  // Auth check
  const token = c.env.PUBLISH_TOKEN
  if (token) {
    const auth = c.req.header('Authorization')
    if (auth !== `Bearer ${token}`) return c.json({ error: 'unauthorized' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  const source = body.source
  if (typeof source !== 'string' || !source.trim()) {
    return c.json({ error: 'source required (raw MDX)' }, 400)
  }

  const visibility = body.visibility === 'private' ? ('private' as const) : ('public' as const)
  const contentType = typeof body.type === 'string' ? body.type : 'page'
  const tenant = c.get('tenant_slug') ?? undefined

  // Compile MDX
  const compiled = compileMdx(source, { basePath: '/', tenant })
  const fm = compiled.frontmatter

  const title = typeof fm.title === 'string' ? fm.title : 'Untitled'
  const slug =
    typeof fm.slug === 'string'
      ? fm.slug
      : title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 80)
  const tags = Array.isArray(fm.tags)
    ? fm.tags.filter((t): t is string => typeof t === 'string')
    : []
  const author = typeof fm.author === 'string' ? fm.author : 'agent'
  const date = typeof fm.date === 'string' ? fm.date : new Date().toISOString().slice(0, 10)

  // Store compiled HTML in content KV
  const kvKey = tenant ? `${tenant}:page:${slug}.html` : `page:${slug}.html`
  await c.get('content').putPage(kvKey, compiled.html)

  // Store raw MDX too (for re-compilation later)
  const rawKey = tenant ? `${tenant}:raw:${slug}.mdx` : `raw:${slug}.mdx`
  await c.get('content').putPage(rawKey, source)

  // Graph node
  await c.get('graph').upsertNode({
    slug,
    title,
    type: contentType,
    tags,
    tenant,
    visibility,
    author,
    date,
    url: `/${slug}`,
  })

  // Graph edges from wikilinks
  for (const target of compiled.wikilinks) {
    await c.get('graph').upsertEdge({ source: slug, target, type: 'wikilink', tenant })
    await c.get('graph').upsertEdge({ source: target, target: slug, type: 'backlink', tenant })
  }

  // Cross-tenant edge resolution — find matching public nodes in other organisms
  const crossTenantEdges = await c.get('graph').resolveCrossTenantEdges(slug, compiled.wikilinks, tenant ?? '')

  // Tag-based edges (connect to nodes sharing 2+ tags)
  if (tags.length >= 2) {
    const existing = await c.get('graph').queryNodes({ tenant })
    for (const other of existing) {
      if (other.slug === slug) continue
      const shared = tags.filter((t) => other.tags.includes(t))
      if (shared.length >= 2) {
        await c.get('graph').upsertEdge({
          source: slug,
          target: other.slug,
          type: 'tag',
          tenant,
          weight: shared.length,
        })
      }
    }
  }

  return c.json({
    ok: true,
    slug,
    title,
    wikilinks: compiled.wikilinks,
    visibility,
    graph_node: true,
    edges: compiled.wikilinks.length,
    cross_tenant_edges: crossTenantEdges.length,
  })
})

// GET /api/graph/network — public graph across ALL tenants (the mycelium)
graphRoutes.get('/graph/network', async (c) => {
  const tag = c.req.query('tag') ?? undefined
  const type = c.req.query('type') ?? undefined
  const limit = parseInt(c.req.query('limit') ?? '200', 10) || 200

  const data = await c.get('graph').queryNetwork({ tag, type, limit })
  return c.json(data)
})

// GET /api/graph/search — search nodes by text across the network
graphRoutes.get('/graph/search', async (c) => {
  const q = c.req.query('q')
  if (!q || q.trim().length < 2) return c.json({ error: 'query too short' }, 400)

  const tenant = c.req.query('tenant') ?? undefined

  // Search by title LIKE + tag match
  const conditions: string[] = ["visibility = 'public'"]
  const params: unknown[] = []

  // Title search
  conditions.push('(title LIKE ? OR tags LIKE ?)')
  params.push(`%${q}%`, `%${q}%`)

  if (tenant) {
    conditions.push('tenant = ?')
    params.push(tenant)
  }

  const where = `WHERE ${conditions.join(' AND ')}`
  const rows = await c.get('db_core').query<{ slug: string; tenant: string; title: string; type: string; tags: string; visibility: string; author: string | null; date: string | null; url: string | null }>(
    `SELECT slug, tenant, title, type, tags, visibility, author, date, url FROM graph_nodes ${where} ORDER BY date DESC LIMIT 50`,
    params
  )

  const nodes: GraphNode[] = rows.map(r => ({
    slug: r.slug, tenant: r.tenant, title: r.title, type: r.type,
    tags: JSON.parse(r.tags || '[]') as string[], visibility: r.visibility as 'public' | 'private',
    author: r.author ?? undefined, date: r.date ?? undefined, url: r.url ?? undefined,
  }))

  return c.json({ query: q, results: nodes })
})

export { graphRoutes }
