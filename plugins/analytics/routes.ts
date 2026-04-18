import { Hono } from 'hono'
import type { AppBindings } from '../types'

const analyticsRoutes = new Hono<AppBindings>()

// Record page view
analyticsRoutes.post('/view', async (c) => {
  const body = await c.req.json<{ slug: string; referrer?: string; scroll_depth?: number }>()
  const { slug, referrer, scroll_depth } = body

  if (!slug) return c.json({ error: 'slug required' }, 400)

  const country = c.req.header('cf-ipcountry') ?? 'unknown'
  const mobile = c.req.header('sec-ch-ua-mobile')
  const device = mobile === '?1' ? 'mobile' : 'desktop'

  await c.env.DB_ANALYTICS.prepare(
    'INSERT INTO page_views (slug, referrer, scroll_depth, country, device, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(slug, referrer ?? null, scroll_depth ?? null, country, device, new Date().toISOString()).run()

  return c.json({ ok: true })
})

// Record reaction
analyticsRoutes.post('/reaction', async (c) => {
  const body = await c.req.json<{ slug: string; emoji: string }>()
  const { slug, emoji } = body

  if (!slug || !emoji) return c.json({ error: 'slug and emoji required' }, 400)

  const ip = c.req.header('cf-connecting-ip') ?? 'anonymous'
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + slug)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const visitorHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)

  await c.env.DB_ANALYTICS.prepare(
    'INSERT INTO reactions (slug, emoji, visitor_hash, timestamp) VALUES (?, ?, ?, ?)'
  ).bind(slug, emoji, visitorHash, new Date().toISOString()).run()

  const counts = await c.env.DB_ANALYTICS.prepare(
    'SELECT emoji, COUNT(*) as count FROM reactions WHERE slug = ? GROUP BY emoji'
  ).bind(slug).all<{ emoji: string; count: number }>()

  const result: Record<string, number> = {}
  for (const row of counts.results) {
    result[row.emoji] = row.count
  }

  return c.json({ ok: true, counts: result })
})

// Get reaction counts for a slug
analyticsRoutes.get('/reactions/:slug', async (c) => {
  const slug = c.req.param('slug')

  const counts = await c.env.DB_ANALYTICS.prepare(
    'SELECT emoji, COUNT(*) as count FROM reactions WHERE slug = ? GROUP BY emoji'
  ).bind(slug).all<{ emoji: string; count: number }>()

  const result: Record<string, number> = {}
  for (const row of counts.results) {
    result[row.emoji] = row.count
  }

  return c.json({ counts: result })
})

// Subscribe
analyticsRoutes.post('/subscribe', async (c) => {
  const body = await c.req.json<{ email: string; name?: string; source?: string }>()
  const { email, name, source } = body

  if (!email) return c.json({ error: 'email required' }, 400)

  await c.env.DB_ANALYTICS.prepare(
    'INSERT OR IGNORE INTO subscribers (email, name, status, source) VALUES (?, ?, ?, ?)'
  ).bind(email, name ?? '', 'active', source ?? 'website').run()

  return c.json({ ok: true, status: 'subscribed' })
})

// Unsubscribe
analyticsRoutes.post('/unsubscribe', async (c) => {
  const body = await c.req.json<{ email: string }>()
  const { email } = body

  if (!email) return c.json({ error: 'email required' }, 400)

  await c.env.DB_ANALYTICS.prepare(
    'UPDATE subscribers SET status = ? WHERE email = ?'
  ).bind('unsubscribed', email).run()

  return c.json({ ok: true, status: 'unsubscribed' })
})

// Feedback
analyticsRoutes.post('/feedback', async (c) => {
  const body = await c.req.json<{ slug: string; type: 'positive' | 'negative'; text?: string }>()
  const { slug, type, text } = body

  if (!slug || !type) return c.json({ error: 'slug and type required' }, 400)

  const ip = c.req.header('cf-connecting-ip') ?? 'anonymous'
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + slug)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const visitorHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)

  await c.env.DB_ANALYTICS.prepare(
    'INSERT INTO feedback (slug, type, text, visitor_hash, timestamp) VALUES (?, ?, ?, ?, ?)'
  ).bind(slug, type, text ?? null, visitorHash, new Date().toISOString()).run()

  return c.json({ ok: true })
})

// Stats for a slug
analyticsRoutes.get('/stats/:slug', async (c) => {
  const slug = c.req.param('slug')

  const views = await c.env.DB_ANALYTICS.prepare(
    'SELECT COUNT(*) as count, AVG(scroll_depth) as avg_scroll FROM page_views WHERE slug = ?'
  ).bind(slug).first<{ count: number; avg_scroll: number | null }>()

  const reactions = await c.env.DB_ANALYTICS.prepare(
    'SELECT emoji, COUNT(*) as count FROM reactions WHERE slug = ? GROUP BY emoji'
  ).bind(slug).all<{ emoji: string; count: number }>()

  const reactionCounts: Record<string, number> = {}
  for (const row of reactions.results) {
    reactionCounts[row.emoji] = row.count
  }

  return c.json({
    slug,
    views: views?.count ?? 0,
    avg_scroll_depth: views?.avg_scroll ?? null,
    reactions: reactionCounts,
  })
})

export { analyticsRoutes }
