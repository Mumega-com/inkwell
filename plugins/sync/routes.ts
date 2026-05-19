import { Hono } from 'hono'
import { requireAuth } from '../middleware'
import type { AppBindings } from '../types'
import { createContentSources } from '../../workers/inkwell-api/src/middleware/adapters'
import { compileMdx } from '../../kernel/processors/mdx-compiler'

const syncRoutes = new Hono<AppBindings>()

// POST /api/sync — pull from all configured content sources and ingest
syncRoutes.post('/', requireAuth, async (c) => {
  const body = await c.req.json<{ since?: string }>().catch(() => ({}))
  const since = body.since

  const sources = createContentSources(c.env)

  if (sources.length === 0) {
    return c.json({ synced: 0, message: 'No content sources configured' })
  }

  const results: Array<{ source: string; synced: number; errors: string[] }> = []
  const tenant = c.get('tenant_slug') ?? undefined
  const content = c.get('content')
  const graph = c.get('graph')

  for (const source of sources) {
    const errors: string[] = []
    let synced = 0

    try {
      const items = await source.sync(since)

      for (const item of items) {
        try {
          const compiled = compileMdx(item.content, { basePath: '/', tenant })
          const fm = compiled.frontmatter
          const slug = item.slug
          const title = typeof fm.title === 'string' ? fm.title : item.title
          const tags = Array.isArray(fm.tags)
            ? fm.tags.filter((t): t is string => typeof t === 'string')
            : []
          const contentType = typeof fm.type === 'string' ? fm.type : 'page'
          const author = typeof fm.author === 'string' ? fm.author : 'sync'
          const date = item.updatedAt.slice(0, 10)

          // Store compiled HTML
          const kvKey = tenant ? `${tenant}:page:${slug}.html` : `page:${slug}.html`
          await content.putPage(kvKey, compiled.html)

          // Upsert graph node
          await graph.upsertNode({
            slug,
            title,
            type: contentType,
            tags,
            tenant,
            visibility: 'public',
            author,
            date,
          })

          // Create wikilink edges
          for (const target of compiled.wikilinks) {
            await graph.upsertEdge({
              source: slug,
              target,
              type: 'wikilink',
              tenant,
              weight: 1,
            })
          }

          synced++
        } catch (err) {
          errors.push(`${item.slug}: ${err instanceof Error ? err.message : 'unknown error'}`)
        }
      }
    } catch (err) {
      errors.push(`source error: ${err instanceof Error ? err.message : 'unknown error'}`)
    }

    results.push({ source: source.name, synced, errors })
  }

  const totalSynced = results.reduce((sum, r) => sum + r.synced, 0)
  return c.json({ synced: totalSynced, sources: results })
})

// GET /api/sync/sources — list configured content sources
syncRoutes.get('/sources', requireAuth, async (c) => {
  const sources = createContentSources(c.env)
  return c.json({
    sources: sources.map(s => ({ name: s.name })),
    count: sources.length,
  })
})

export { syncRoutes }
