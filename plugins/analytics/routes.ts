import { Hono } from 'hono'
import type { AppBindings } from '../types'
import { requireAuth } from '../middleware'

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

// Record a custom event
analyticsRoutes.post('/event', async (c) => {
  const body = await c.req.json<{
    name: string
    properties?: Record<string, unknown>
    path?: string
    sessionId?: string
  }>()

  if (!body.name) return c.json({ error: 'name required' }, 400)

  const ip = c.req.header('cf-connecting-ip') ?? 'anonymous'
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + (body.sessionId ?? new Date().toISOString().slice(0, 10)))
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const visitorHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)

  const country = c.req.header('cf-ipcountry') ?? 'unknown'
  const mobile = c.req.header('sec-ch-ua-mobile')
  const device = mobile === '?1' ? 'mobile' : 'desktop'
  const referrer = c.req.header('referer') ?? null
  const tenant = c.get('tenant_slug') ?? null
  const db = c.get('db_analytics')

  // Parse UTM from the event path or stored session
  const url = new URL(c.req.url)
  const utm = {
    source: url.searchParams.get('utm_source') ?? null,
    medium: url.searchParams.get('utm_medium') ?? null,
    campaign: url.searchParams.get('utm_campaign') ?? null,
    content: url.searchParams.get('utm_content') ?? null,
    term: url.searchParams.get('utm_term') ?? null,
  }

  const id = crypto.randomUUID()
  await db.execute(
    `INSERT INTO events (id, event_name, properties, path, visitor_hash, session_id, tenant,
     utm_source, utm_medium, utm_campaign, utm_content, utm_term,
     referrer, country, device, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, body.name, body.properties ? JSON.stringify(body.properties) : null,
      body.path ?? '/', visitorHash, body.sessionId ?? null, tenant,
      utm.source, utm.medium, utm.campaign, utm.content, utm.term,
      referrer, country, device, new Date().toISOString(),
    ]
  )

  // Update visitor profile (fire-and-forget)
  c.executionCtx.waitUntil(
    db.execute(
      `INSERT INTO visitor_profiles (visitor_hash, first_seen, last_seen, visit_count, total_events, last_event_name, last_path, country, device, tenant,
       utm_first_source, utm_first_medium, utm_first_campaign, utm_last_source, utm_last_medium, utm_last_campaign)
       VALUES (?, datetime('now'), datetime('now'), 1, 1, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?)
       ON CONFLICT(visitor_hash) DO UPDATE SET
         last_seen = datetime('now'),
         visit_count = visitor_profiles.visit_count + 1,
         total_events = visitor_profiles.total_events + 1,
         last_event_name = excluded.last_event_name,
         last_path = excluded.last_path,
         country = excluded.country,
         device = excluded.device,
         utm_last_source = COALESCE(excluded.utm_last_source, visitor_profiles.utm_last_source),
         utm_last_medium = COALESCE(excluded.utm_last_medium, visitor_profiles.utm_last_medium),
         utm_last_campaign = COALESCE(excluded.utm_last_campaign, visitor_profiles.utm_last_campaign)`,
      [visitorHash, body.name, body.path ?? '/', country, device, tenant,
       utm.source, utm.medium, utm.campaign, utm.source, utm.medium, utm.campaign]
    )
  )

  return c.json({ ok: true, id })
})

// Funnel analysis — conversion between ordered event steps
analyticsRoutes.get('/funnel', requireAuth, async (c) => {
  const steps = c.req.query('steps')  // comma-separated event names: "Page Viewed,Form Started,Form Submitted"
  const days = Number(c.req.query('days')) || 30
  const tenant = c.get('tenant_slug') ?? null

  if (!steps) return c.json({ error: 'steps query param required (comma-separated event names)' }, 400)

  const stepNames = steps.split(',').map(s => s.trim())
  const db = c.get('db_analytics')
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const funnelSteps: Array<{ step: string; total: number; uniqueVisitors: number }> = []
  for (const stepName of stepNames) {
    const tenantClause = tenant ? ' AND tenant = ?' : ''
    const params: unknown[] = [stepName, since]
    if (tenant) params.push(tenant)

    const result = await db.queryOne<{ total: number; unique_visitors: number }>(
      `SELECT COUNT(*) as total, COUNT(DISTINCT visitor_hash) as unique_visitors
       FROM events WHERE event_name = ? AND created_at >= ?${tenantClause}`,
      params
    )

    funnelSteps.push({
      step: stepName,
      total: result?.total ?? 0,
      uniqueVisitors: result?.unique_visitors ?? 0,
    })
  }

  // Calculate conversion rates between steps
  const funnel = funnelSteps.map((step, i) => ({
    ...step,
    conversionRate: i === 0
      ? 1.0
      : funnelSteps[i - 1].uniqueVisitors > 0
        ? step.uniqueVisitors / funnelSteps[i - 1].uniqueVisitors
        : 0,
    dropoff: i === 0
      ? 0
      : funnelSteps[i - 1].uniqueVisitors - step.uniqueVisitors,
  }))

  return c.json({ steps: funnel, days, totalEntries: funnelSteps[0]?.uniqueVisitors ?? 0 })
})

// Behavioral cohorts — group visitors by behavior patterns
analyticsRoutes.get('/cohorts', requireAuth, async (c) => {
  const days = Number(c.req.query('days')) || 30
  const tenant = c.get('tenant_slug') ?? null
  const db = c.get('db_analytics')
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const tenantClause = tenant ? ' AND tenant = ?' : ''
  const baseParams: unknown[] = [since]
  if (tenant) baseParams.push(tenant)

  // Power users: 10+ events in the period
  const powerUsers = await db.queryOne<{ count: number }>(
    `SELECT COUNT(DISTINCT visitor_hash) as count FROM events
     WHERE created_at >= ?${tenantClause}
     GROUP BY visitor_hash HAVING COUNT(*) >= 10`,
    baseParams
  )

  // New visitors: first_seen in the period
  const newVisitors = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM visitor_profiles
     WHERE first_seen >= ?${tenantClause}`,
    baseParams
  )

  // Returning visitors: first_seen before period, last_seen in period
  const returning = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM visitor_profiles
     WHERE first_seen < ? AND last_seen >= ?${tenantClause}`,
    [...baseParams, since]
  )

  // At-risk: last_seen > 14 days ago but was active before
  const atRiskDate = new Date(Date.now() - 14 * 86400000).toISOString()
  const atRisk = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM visitor_profiles
     WHERE last_seen < ? AND total_events >= 5${tenantClause}`,
    [atRiskDate, ...(tenant ? [tenant] : [])]
  )

  // UTM source breakdown
  const utmSources = await db.query<{ source: string; count: number }>(
    `SELECT COALESCE(utm_first_source, 'direct') as source, COUNT(*) as count
     FROM visitor_profiles WHERE first_seen >= ?${tenantClause}
     GROUP BY utm_first_source ORDER BY count DESC LIMIT 10`,
    baseParams
  )

  return c.json({
    period: { days, since },
    cohorts: {
      powerUsers: powerUsers?.count ?? 0,
      newVisitors: newVisitors?.count ?? 0,
      returning: returning?.count ?? 0,
      atRisk: atRisk?.count ?? 0,
    },
    attribution: utmSources.map(r => ({ source: r.source, visitors: r.count })),
  })
})

// Content recommendations — based on graph + engagement data
analyticsRoutes.get('/recommendations/:slug', async (c) => {
  const slug = c.req.param('slug')!
  const limit = Number(c.req.query('limit')) || 5
  const db = c.get('db_core')

  // Get related pages via knowledge graph edges + engagement ranking
  const related = await db.query<{ slug: string; title: string; type: string; score: number }>(
    `SELECT gn.slug, gn.title, gn.type,
            (COALESCE(pv.view_count, 0) * 0.7 + COALESCE(ge.weight, 1) * 0.3) as score
     FROM graph_edges ge
     JOIN graph_nodes gn ON (
       (ge.source = ? AND ge.target = gn.slug) OR
       (ge.target = ? AND ge.source = gn.slug)
     )
     LEFT JOIN (
       SELECT slug, COUNT(*) as view_count FROM page_views
       WHERE timestamp >= datetime('now', '-30 days')
       GROUP BY slug
     ) pv ON pv.slug = gn.slug
     WHERE gn.visibility = 'public' AND gn.slug != ?
     ORDER BY score DESC
     LIMIT ?`,
    [slug, slug, slug, limit]
  )

  return c.json({ slug, recommendations: related })
})

export { analyticsRoutes }
