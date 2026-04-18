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
  const db = c.get('db_analytics')

  await db.execute(
    'INSERT INTO page_views (slug, referrer, scroll_depth, country, device, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
    [slug, referrer ?? null, scroll_depth ?? null, country, device, new Date().toISOString()],
  )

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
  const db = c.get('db_analytics')

  await db.execute(
    'INSERT INTO reactions (slug, emoji, visitor_hash, timestamp) VALUES (?, ?, ?, ?)',
    [slug, emoji, visitorHash, new Date().toISOString()],
  )

  const rows = await db.query<{ emoji: string; count: number }>(
    'SELECT emoji, COUNT(*) as count FROM reactions WHERE slug = ? GROUP BY emoji',
    [slug],
  )

  const result: Record<string, number> = {}
  for (const row of rows) {
    result[row.emoji] = row.count
  }

  return c.json({ ok: true, counts: result })
})

// Get reaction counts for a slug
analyticsRoutes.get('/reactions/:slug', async (c) => {
  const slug = c.req.param('slug')
  const db = c.get('db_analytics')

  const rows = await db.query<{ emoji: string; count: number }>(
    'SELECT emoji, COUNT(*) as count FROM reactions WHERE slug = ? GROUP BY emoji',
    [slug],
  )

  const result: Record<string, number> = {}
  for (const row of rows) {
    result[row.emoji] = row.count
  }

  return c.json({ counts: result })
})

// Subscribe
analyticsRoutes.post('/subscribe', async (c) => {
  const body = await c.req.json<{ email: string; name?: string; source?: string }>()
  const { email, name, source } = body

  if (!email) return c.json({ error: 'email required' }, 400)
  const db = c.get('db_analytics')

  await db.execute(
    'INSERT OR IGNORE INTO subscribers (email, name, status, source) VALUES (?, ?, ?, ?)',
    [email, name ?? '', 'active', source ?? 'website'],
  )

  return c.json({ ok: true, status: 'subscribed' })
})

// Unsubscribe
analyticsRoutes.post('/unsubscribe', async (c) => {
  const body = await c.req.json<{ email: string }>()
  const { email } = body

  if (!email) return c.json({ error: 'email required' }, 400)
  const db = c.get('db_analytics')

  await db.execute(
    'UPDATE subscribers SET status = ? WHERE email = ?',
    ['unsubscribed', email],
  )

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
  const db = c.get('db_analytics')

  await db.execute(
    'INSERT INTO feedback (slug, type, text, visitor_hash, timestamp) VALUES (?, ?, ?, ?, ?)',
    [slug, type, text ?? null, visitorHash, new Date().toISOString()],
  )

  return c.json({ ok: true })
})

// Stats for a slug
analyticsRoutes.get('/stats/:slug', async (c) => {
  const slug = c.req.param('slug')
  const db = c.get('db_analytics')

  const views = await db.queryOne<{ count: number; avg_scroll: number | null }>(
    'SELECT COUNT(*) as count, AVG(scroll_depth) as avg_scroll FROM page_views WHERE slug = ?',
    [slug],
  )

  const rows = await db.query<{ emoji: string; count: number }>(
    'SELECT emoji, COUNT(*) as count FROM reactions WHERE slug = ? GROUP BY emoji',
    [slug],
  )

  const reactionCounts: Record<string, number> = {}
  for (const row of rows) {
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
