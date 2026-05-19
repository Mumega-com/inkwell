import { Hono } from 'hono'
import { requireAuth } from '../middleware'
import type { AppBindings } from '../types'

const seoRoutes = new Hono<AppBindings>()

// GET /api/seo/crawl-stats — crawl analytics for the given time window
seoRoutes.get('/crawl-stats', requireAuth, async (c) => {
  const days = Number(c.req.query('days')) || 7
  const tenant = c.get('tenant_slug') ?? undefined
  const seo = c.get('seo')
  const stats = await seo.getCrawlStats(tenant, days)
  return c.json(stats)
})

// GET /api/seo/redirects — list all redirect rules
seoRoutes.get('/redirects', requireAuth, async (c) => {
  const tenant = c.get('tenant_slug') ?? undefined
  const seo = c.get('seo')
  const redirects = await seo.listRedirects(tenant)
  return c.json({ redirects })
})

// POST /api/seo/redirects — create or update a redirect rule
seoRoutes.post('/redirects', requireAuth, async (c) => {
  const body = await c.req.json<{
    fromPath: string
    toPath: string
    statusCode?: number
  }>()

  if (!body.fromPath || !body.toPath) {
    return c.json({ error: 'fromPath and toPath are required' }, 400)
  }

  const tenant = c.get('tenant_slug') ?? undefined
  const seo = c.get('seo')
  const redirect = await seo.upsertRedirect({
    fromPath: body.fromPath,
    toPath: body.toPath,
    statusCode: (body.statusCode ?? 301) as 301 | 302 | 307 | 308,
    tenant,
  })
  return c.json(redirect)
})

// DELETE /api/seo/redirects/:id — delete a redirect rule
seoRoutes.delete('/redirects/:id', requireAuth, async (c) => {
  const seo = c.get('seo')
  await seo.deleteRedirect(c.req.param('id')!)
  return c.json({ deleted: true })
})

// GET /api/seo/meta-overrides — list all meta overrides
seoRoutes.get('/meta-overrides', requireAuth, async (c) => {
  const tenant = c.get('tenant_slug') ?? undefined
  const seo = c.get('seo')
  const overrides = await seo.listMetaOverrides(tenant)
  return c.json({ overrides })
})

// POST /api/seo/meta-overrides — set a meta override for a path
seoRoutes.post('/meta-overrides', requireAuth, async (c) => {
  const body = await c.req.json<{
    path: string
    title?: string
    description?: string
    ogImage?: string
    robots?: string
    canonical?: string
  }>()

  if (!body.path) {
    return c.json({ error: 'path is required' }, 400)
  }

  const tenant = c.get('tenant_slug') ?? undefined
  const seo = c.get('seo')
  await seo.setMetaOverride({ ...body, tenant })
  return c.json({ ok: true, path: body.path })
})

// DELETE /api/seo/meta-overrides/:path — delete a meta override
seoRoutes.delete('/meta-overrides/:path', requireAuth, async (c) => {
  const tenant = c.get('tenant_slug') ?? undefined
  const seo = c.get('seo')
  await seo.deleteMetaOverride(decodeURIComponent(c.req.param('path')!), tenant)
  return c.json({ deleted: true })
})

// llms.txt routes are mounted separately via the llms router
import { llmsRoutes } from './llms'
seoRoutes.route('/', llmsRoutes)

export { seoRoutes }
