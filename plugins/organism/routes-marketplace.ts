import { Hono } from 'hono'
import type { AppBindings } from '../../workers/inkwell-api/src/types'
import type { DatabasePort, GraphPort } from '../../kernel/types'

const marketplace = new Hono<AppBindings>()

// ── GET /api/marketplace ────────────────────────────────────────────────────
// List available plugins from the graph (community-published plugins are graph nodes)
marketplace.get('/marketplace', async (c) => {
  const graph = c.get('graph' as never) as GraphPort
  const tag = c.req.query('tag')
  const limit = parseInt(c.req.query('limit') ?? '50')

  // Plugins are nodes with type='plugin' in the network graph
  const data = await graph.queryNetwork({
    type: 'plugin',
    tag: tag ?? undefined,
    limit,
  })

  return c.json({
    plugins: data.nodes.map(n => ({
      slug: n.slug,
      title: n.title,
      tags: n.tags,
      author: n.author,
      tenant: n.tenant,
      url: n.url,
    })),
    total: data.nodes.length,
  })
})

// ── POST /api/marketplace/publish ───────────────────────────────────────────
// Publish a plugin to the marketplace (creates a graph node of type 'plugin')
marketplace.post('/marketplace/publish', async (c) => {
  const tenant = c.get('tenant_slug')
  if (!tenant) return c.json({ error: 'no_tenant' }, 400)

  const body = await c.req.json<{
    slug: string
    title: string
    description: string
    tags: string[]
    url?: string       // git repo or package URL
    version?: string
  }>()

  const graph = c.get('graph' as never) as GraphPort

  await graph.upsertNode({
    slug: `plugin:${body.slug}`,
    title: body.title,
    type: 'plugin',
    tags: [...body.tags, 'marketplace'],
    tenant,
    visibility: 'public',
    author: tenant,
    date: new Date().toISOString(),
    url: body.url,
  })

  // Create tag edges for discoverability
  for (const tag of body.tags) {
    await graph.upsertEdge({
      source: `plugin:${body.slug}`,
      target: `tag:${tag}`,
      type: 'tag',
      tenant,
    })
  }

  return c.json({ ok: true, slug: `plugin:${body.slug}` })
})

// ── GET /api/marketplace/installed ──────────────────────────────────────────
// List plugins installed for this tenant
marketplace.get('/marketplace/installed', async (c) => {
  const tenant = c.get('tenant_slug')
  if (!tenant) return c.json({ error: 'no_tenant' }, 400)

  const db = c.get('db_core' as never) as DatabasePort
  const rows = await db.query<{ plugin_slug: string; installed_at: string; config: string }>(
    'SELECT plugin_slug, installed_at, config FROM tenant_plugins WHERE tenant_id = ? ORDER BY installed_at DESC',
    [tenant],
  )

  return c.json({
    installed: rows.map(r => ({
      slug: r.plugin_slug,
      installedAt: r.installed_at,
      config: JSON.parse(r.config || '{}'),
    })),
  })
})

// ── POST /api/marketplace/install ───────────────────────────────────────────
// Install a marketplace plugin for this tenant
marketplace.post('/marketplace/install', async (c) => {
  const tenant = c.get('tenant_slug')
  if (!tenant) return c.json({ error: 'no_tenant' }, 400)

  const body = await c.req.json<{
    pluginSlug: string
    config?: Record<string, unknown>
  }>()

  const db = c.get('db_core' as never) as DatabasePort

  // Verify plugin exists in marketplace
  const graph = c.get('graph' as never) as GraphPort
  const node = await graph.getNode(`plugin:${body.pluginSlug}`)
  if (!node) return c.json({ error: 'plugin_not_found' }, 404)

  await db.execute(
    `INSERT INTO tenant_plugins (tenant_id, plugin_slug, config, installed_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(tenant_id, plugin_slug) DO UPDATE SET config = excluded.config`,
    [tenant, body.pluginSlug, JSON.stringify(body.config ?? {}), new Date().toISOString()],
  )

  return c.json({ ok: true, installed: body.pluginSlug })
})

// ── DELETE /api/marketplace/uninstall ────────────────────────────────────────
marketplace.delete('/marketplace/uninstall/:slug', async (c) => {
  const tenant = c.get('tenant_slug')
  if (!tenant) return c.json({ error: 'no_tenant' }, 400)

  const slug = c.req.param('slug')
  const db = c.get('db_core' as never) as DatabasePort

  await db.execute(
    'DELETE FROM tenant_plugins WHERE tenant_id = ? AND plugin_slug = ?',
    [tenant, slug],
  )

  return c.json({ ok: true, uninstalled: slug })
})

export { marketplace as marketplaceRoutes }
