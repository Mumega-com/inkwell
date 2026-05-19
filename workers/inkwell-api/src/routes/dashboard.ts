import { Hono } from 'hono'
import type { AppBindings } from '../types'
import { authSessionMiddleware } from '../middleware/auth'

export const dashboardRoutes = new Hono<AppBindings>()

// ── Types ────────────────────────────────────────────────────────────────────

type SnapshotRow = {
  metric: string
  value: number
  fetched_at: string
}

type QueryRow = {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

type PageRow = {
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

type TrendRow = {
  date: string
  clicks: number
  impressions: number
}

type ContractRow = {
  id: string
  reference: string
  customer_name: string
  destination: string | null
  service_type: string | null
  rate: number | null
  status: string
  customer_email: string | null
  created_at: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function periodToDays(period: string): number {
  switch (period) {
    case '7d': return 7
    case '90d': return 90
    default: return 28
  }
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// ── GET /overview ─────────────────────────────────────────────────────────

dashboardRoutes.get('/overview', async (c) => {
  const since = daysAgoIso(28)

  // Pull all needed metrics from DB_MARKETING in one query
  const [snapshots, ga4Sessions, leadsResult] = await Promise.allSettled([
    c.env.DB_MARKETING.prepare(
      `SELECT metric, value, fetched_at
       FROM marketing_snapshots
       WHERE source = 'gsc'
         AND metric IN ('total_clicks', 'total_impressions')
         AND date >= ?
       ORDER BY fetched_at DESC`
    ).bind(since).all<SnapshotRow>(),

    c.env.DB_MARKETING.prepare(
      `SELECT metric, value, fetched_at
       FROM marketing_snapshots
       WHERE source = 'ga4'
         AND metric IN ('sessions', 'bounce_rate')
         AND date >= ?
       ORDER BY fetched_at DESC`
    ).bind(since).all<SnapshotRow>(),

    c.env.DB_CORE.prepare(
      `SELECT COUNT(*) as count
       FROM contracts
       WHERE created_at >= ?`
    ).bind(since + 'T00:00:00.000Z').first<{ count: number }>(),
  ])

  // Aggregate GSC metrics
  let clicks = 0
  let impressions = 0
  let lastUpdated = ''

  if (snapshots.status === 'fulfilled') {
    for (const row of snapshots.value.results) {
      if (row.metric === 'total_clicks') clicks += row.value
      if (row.metric === 'total_impressions') impressions += row.value
      if (!lastUpdated || row.fetched_at > lastUpdated) lastUpdated = row.fetched_at
    }
  }

  // Aggregate GA4 metrics
  let sessions = 0
  let bounceRate = 0

  if (ga4Sessions.status === 'fulfilled') {
    for (const row of ga4Sessions.value.results) {
      if (row.metric === 'sessions') sessions += row.value
      if (row.metric === 'bounce_rate') bounceRate = row.value
    }
  }

  // Count leads from DB_CORE contracts
  const leads = leadsResult.status === 'fulfilled' && leadsResult.value
    ? leadsResult.value.count
    : 0

  const note = !lastUpdated
    ? 'No marketing data yet — connect GSC and GA4 via the flywheel scheduled job'
    : undefined

  return c.json({
    clicks,
    impressions,
    leads,
    sessions,
    bounceRate,
    lastUpdated: lastUpdated || null,
    ...(note ? { note } : {}),
  })
})

// ── GET /seo ─────────────────────────────────────────────────────────────

dashboardRoutes.get('/seo', async (c) => {
  const periodParam = c.req.query('period') ?? '28d'
  const days = periodToDays(periodParam)
  const since = daysAgoIso(days)

  const [summaryResult, queriesResult, pagesResult, trendResult] = await Promise.allSettled([
    c.env.DB_MARKETING.prepare(
      `SELECT metric, SUM(value) as value
       FROM marketing_snapshots
       WHERE source = 'gsc'
         AND metric IN ('total_clicks', 'total_impressions', 'avg_ctr', 'avg_position')
         AND date >= ?
       GROUP BY metric`
    ).bind(since).all<{ metric: string; value: number }>(),

    c.env.DB_MARKETING.prepare(
      `SELECT query, SUM(clicks) as clicks, SUM(impressions) as impressions,
              AVG(ctr) as ctr, AVG(position) as position
       FROM gsc_queries
       WHERE date >= ?
       GROUP BY query
       ORDER BY clicks DESC
       LIMIT 20`
    ).bind(since).all<QueryRow>(),

    c.env.DB_MARKETING.prepare(
      `SELECT page, SUM(clicks) as clicks, SUM(impressions) as impressions,
              AVG(ctr) as ctr, AVG(position) as position
       FROM gsc_pages
       WHERE date >= ?
       GROUP BY page
       ORDER BY clicks DESC
       LIMIT 15`
    ).bind(since).all<PageRow>(),

    c.env.DB_MARKETING.prepare(
      `SELECT date, SUM(clicks) as clicks, SUM(impressions) as impressions
       FROM gsc_daily
       WHERE date >= ?
       GROUP BY date
       ORDER BY date ASC`
    ).bind(since).all<TrendRow>(),
  ])

  // Build summary from aggregate metrics
  const summaryMap: Record<string, number> = {}
  if (summaryResult.status === 'fulfilled') {
    for (const row of summaryResult.value.results) {
      summaryMap[row.metric] = row.value
    }
  }

  const summary = {
    clicks: summaryMap['total_clicks'] ?? 0,
    impressions: summaryMap['total_impressions'] ?? 0,
    ctr: summaryMap['avg_ctr'] ?? 0,
    avgPosition: summaryMap['avg_position'] ?? 0,
  }

  const queries = queriesResult.status === 'fulfilled' ? queriesResult.value.results : []
  const pages = pagesResult.status === 'fulfilled' ? pagesResult.value.results : []
  const trend = trendResult.status === 'fulfilled' ? trendResult.value.results : []

  return c.json({ summary, queries, pages, trend })
})

// ── GET /leads ────────────────────────────────────────────────────────────

dashboardRoutes.get('/leads', async (c) => {
  const limitParam = c.req.query('limit')
  const VALID_CONTRACT_STATUSES = ['pending', 'signed', 'delivered', 'draft', 'sent', 'viewed', 'cancelled']
  const statusParam = c.req.query('status') ?? 'all'
  if (statusParam !== 'all' && !VALID_CONTRACT_STATUSES.includes(statusParam)) {
    return c.json({ error: 'invalid_status', valid: ['all', ...VALID_CONTRACT_STATUSES] }, 400)
  }
  const limit = Math.min(Math.max(parseInt(limitParam ?? '20', 10) || 20, 1), 100)

  const weekAgo = daysAgoIso(7)

  const [totalResult, thisWeekResult, leadsResult] = await Promise.allSettled([
    c.env.DB_CORE.prepare(
      'SELECT COUNT(*) as count FROM contracts'
    ).first<{ count: number }>(),

    c.env.DB_CORE.prepare(
      'SELECT COUNT(*) as count FROM contracts WHERE created_at >= ?'
    ).bind(weekAgo + 'T00:00:00.000Z').first<{ count: number }>(),

    statusParam === 'all'
      ? c.env.DB_CORE.prepare(
          `SELECT id, reference, customer_name, destination, service_type,
                  rate, status, customer_email, created_at
           FROM contracts
           ORDER BY created_at DESC
           LIMIT ?`
        ).bind(limit).all<ContractRow>()
      : c.env.DB_CORE.prepare(
          `SELECT id, reference, customer_name, destination, service_type,
                  rate, status, customer_email, created_at
           FROM contracts
           WHERE status = ?
           ORDER BY created_at DESC
           LIMIT ?`
        ).bind(statusParam, limit).all<ContractRow>(),
  ])

  const total = totalResult.status === 'fulfilled' && totalResult.value
    ? totalResult.value.count
    : 0

  const thisWeek = thisWeekResult.status === 'fulfilled' && thisWeekResult.value
    ? thisWeekResult.value.count
    : 0

  const rawLeads: ContractRow[] = leadsResult.status === 'fulfilled' ? leadsResult.value.results : []

  const leads = rawLeads.map((row) => ({
    id: row.id,
    name: row.customer_name,
    destination: row.destination,
    serviceType: row.service_type,
    rate: row.rate,
    status: row.status,
    source: row.customer_email ? 'email' : 'direct',
    createdAt: row.created_at,
  }))

  return c.json({ total, thisWeek, leads })
})

// ── GET /campaigns ────────────────────────────────────────────────────────

dashboardRoutes.get('/campaigns', async (c) => {
  // Google Ads integration requires re-scoping OAuth — stub with sample structure
  const campaigns = [
    {
      name: 'Vehicle Shipping — Toronto',
      status: 'paused',
      budget: 50,
      spend: 0,
      leads: 0,
      cpa: 0,
      channel: 'google_ads',
    },
    {
      name: 'International Shipping — Nigeria',
      status: 'paused',
      budget: 75,
      spend: 0,
      leads: 0,
      cpa: 0,
      channel: 'google_ads',
    },
    {
      name: 'Caribbean Route — Jamaica',
      status: 'paused',
      budget: 40,
      spend: 0,
      leads: 0,
      cpa: 0,
      channel: 'google_ads',
    },
  ]

  return c.json({
    campaigns,
    totalBudget: campaigns.reduce((sum, camp) => sum + camp.budget, 0),
    totalSpend: 0,
    note: 'Google Ads data unavailable — re-scope OAuth to include google_ads_readonly and reconnect via /api/auth/google-ads',
  })
})

// ── GET /calendar ─────────────────────────────────────────────────────────

dashboardRoutes.get('/calendar', async (c) => {
  const months = [
    {
      month: 1,
      name: 'January',
      volume: 'low',
      events: ['Post-holiday slowdown', 'Snowbird departures'],
      actions: ['Off-peak promotions, good rates', 'Target snowbird market'],
    },
    {
      month: 2,
      name: 'February',
      volume: 'low',
      events: ['Snowbird returns begin', 'Winter clearance'],
      actions: ['Snowbird returns', 'Push early spring bookings'],
    },
    {
      month: 3,
      name: 'March',
      volume: 'building',
      events: ['Europe bookings open', 'Italy retirement season starts'],
      actions: ['Europe bookings start, Italy retirement season', 'Ramp up EU-bound marketing'],
    },
    {
      month: 4,
      name: 'April',
      volume: 'building',
      events: ['African route ramp-up', 'European bookings peak'],
      actions: ['African route ramp, European bookings', 'Allocate container space early'],
    },
    {
      month: 5,
      name: 'May',
      volume: 'peak',
      events: ['Container space tightens', 'Caribbean season starts'],
      actions: ['Container space tightens, Caribbean starts', 'Lock in rates now — surcharges incoming'],
    },
    {
      month: 6,
      name: 'June',
      volume: 'peak',
      events: ['Summer relocations', 'Highest rate season'],
      actions: ['Summer relocations, highest rates', 'Maximize capacity, premium pricing'],
    },
    {
      month: 7,
      name: 'July',
      volume: 'peak',
      events: ['Diaspora summer shipping', 'High volume West Africa'],
      actions: ['Diaspora summer shipping', 'Staff up, reduce SLA targets'],
    },
    {
      month: 8,
      name: 'August',
      volume: 'peak',
      events: ['Caribana Toronto', 'Nigerian pre-holiday rush'],
      actions: ['Caribana Toronto, Nigerian pre-holiday', 'Sponsor Caribana, capture diaspora leads'],
    },
    {
      month: 9,
      name: 'September',
      volume: 'shoulder',
      events: ['Caribbean hurricane season', 'Jamaica PSS (Peak Season Surcharge)'],
      actions: ['Caribbean hurricane season, Jamaica PSS', 'Communicate delays proactively'],
    },
    {
      month: 10,
      name: 'October',
      volume: 'shoulder',
      events: ['Nigeria peak season', 'Christmas deadline approaching'],
      actions: ['Nigeria peak, Christmas deadline approaching', 'Deadline-driven campaigns for December delivery'],
    },
    {
      month: 11,
      name: 'November',
      volume: 'winding',
      events: ['Last booking window for December delivery', 'Carrier pre-holiday cutoffs'],
      actions: ['Last chance for December delivery', 'Urgency messaging — book now or wait until January'],
    },
    {
      month: 12,
      name: 'December',
      volume: 'low',
      events: ['Carrier holidays', 'Limited sailings'],
      actions: ['Carrier holidays, limited sailings', 'Focus on January pipeline, minimal ops'],
    },
  ]

  return c.json({ months })
})

// ── POST /squads/:id/kpis/snapshot ───────────────────────────────────────

type KpiSnapshotBody = {
  velocity: number
  success_rate: number
  kpi_score: number
  tokens_used: number
  tokens_by_grade: Record<string, number>
  total_earned_cents: number
  balance_cents: number
  bounty_score: number
}

dashboardRoutes.post('/squads/:id/kpis/snapshot', async (c) => {
  // Verify caller is internal (NETWORK_TOKEN)
  const auth = c.req.header('Authorization') ?? ''
  const token = c.env.NETWORK_TOKEN ?? ''
  if (!token || auth !== `Bearer ${token}`) return c.json({ error: 'forbidden' }, 403)

  const id = c.req.param('id')
  const body = await c.req.json<KpiSnapshotBody>()

  const today = new Date().toISOString().slice(0, 10)
  const tenantSlug = c.get('tenant_slug') ?? 'default'

  await c.env.DB_CORE.prepare(`
    INSERT INTO diagnostics_snapshots
      (squad_id, tenant_id, snapshot_date, conductance, force, coherence,
       tasks_completed, tasks_failed, kpi_score, velocity, success_rate,
       tokens_used, tokens_by_grade, total_earned_cents, wallet_balance_cents, bounties_claimed)
    VALUES (?, ?, ?, 0, 0, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(squad_id, snapshot_date) DO UPDATE SET
      kpi_score = excluded.kpi_score,
      velocity = excluded.velocity,
      success_rate = excluded.success_rate,
      tokens_used = excluded.tokens_used,
      tokens_by_grade = excluded.tokens_by_grade,
      total_earned_cents = excluded.total_earned_cents,
      wallet_balance_cents = excluded.wallet_balance_cents
  `).bind(
    id, tenantSlug, today,
    body.kpi_score, body.velocity, body.success_rate,
    body.tokens_used, JSON.stringify(body.tokens_by_grade),
    body.total_earned_cents, body.balance_cents,
  ).run()

  return c.json({ saved: true })
})

// ── GET /squads/:id/kpis ─────────────────────────────────────────────────

dashboardRoutes.get('/squads/:id/kpis', authSessionMiddleware, async (c) => {
  const id = c.req.param('id')
  const saasUrl = c.env.SOS_SAAS_URL
  if (!saasUrl) return c.json({ error: 'sos_saas_url_required' }, 503)
  const token = c.env.NETWORK_TOKEN ?? ''
  const res = await fetch(`${saasUrl}/squads/${id}/kpis`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return c.json({ error: 'unavailable' }, 502)
  return c.json(await res.json())
})

// ── GET /squads/:id/kpis/history ──────────────────────────────────────────

dashboardRoutes.get('/squads/:id/kpis/history', authSessionMiddleware, async (c) => {
  const id = c.req.param('id')
  const tenantSlug = c.get('tenant_slug') ?? 'default'
  const rows = await c.env.DB_CORE.prepare(`
    SELECT * FROM diagnostics_snapshots
    WHERE squad_id = ? AND tenant_id = ?
    ORDER BY snapshot_date DESC LIMIT 30
  `).bind(id, tenantSlug).all()
  return c.json({ history: rows.results })
})

// ── GET /squads/:id/memory ────────────────────────────────────────────────

dashboardRoutes.get('/squads/:id/memory', authSessionMiddleware, async (c) => {
  const { id } = c.req.param()
  const q = c.req.query('q') ?? ''
  const limit = c.req.query('limit') ?? '20'
  const saasUrl = c.env.SOS_SAAS_URL
  if (!saasUrl) return c.json({ memories: [] })
  const token = c.env.NETWORK_TOKEN ?? ''
  const url = `${saasUrl}/squads/${id}/memory?q=${encodeURIComponent(q)}&limit=${limit}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return c.json({ memories: [] })
  return c.json(await res.json())
})

// ── POST /squads/:id/memory ───────────────────────────────────────────────

dashboardRoutes.post('/squads/:id/memory', authSessionMiddleware, async (c) => {
  const { id } = c.req.param()
  const body = await c.req.json<{ text: string }>()
  const session = c.get('authSession')
  const saasUrl = c.env.SOS_SAAS_URL
  if (!saasUrl) return c.json({ error: 'sos_saas_url_required' }, 503)
  const token = c.env.NETWORK_TOKEN ?? ''
  const res = await fetch(`${saasUrl}/squads/${id}/memory`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: body.text, agent_id: session?.identityId ?? 'user' }),
  })
  if (!res.ok) return c.json({ error: 'failed' }, 500)
  return c.json({ stored: true })
})

// ── GET /squads/:id/achievements → proxy to SOS Squad service ────────────

dashboardRoutes.get('/squads/:id/achievements', authSessionMiddleware, async (c) => {
  const squadId = c.req.param('id')
  const sosUrl = c.env.SOS_SAAS_URL
  if (!sosUrl) return c.json({ achievements: [] })

  try {
    const res = await fetch(`${sosUrl}/squads/${squadId}/achievements`, {
      headers: { Authorization: `Bearer ${c.env.NETWORK_TOKEN ?? ''}` },
    })
    if (!res.ok) return c.json({ achievements: [] })
    const data = await res.json() as { achievements: unknown[] }
    return c.json(data)
  } catch {
    return c.json({ achievements: [] })
  }
})

// ── GET /league ───────────────────────────────────────────────────────────

dashboardRoutes.get('/league', authSessionMiddleware, async (c) => {
  const saasUrl = c.env.SOS_SAAS_URL
  if (!saasUrl) return c.json({ error: 'sos_saas_url_required' }, 503)
  const token = c.env.NETWORK_TOKEN ?? ''
  const res = await fetch(`${saasUrl}/league`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return c.json({ error: 'unavailable' }, 502)
  return c.json(await res.json())
})

// ── GET /league/seasons ───────────────────────────────────────────────────

dashboardRoutes.get('/league/seasons', authSessionMiddleware, async (c) => {
  const saasUrl = c.env.SOS_SAAS_URL
  if (!saasUrl) return c.json({ error: 'sos_saas_url_required' }, 503)
  const token = c.env.NETWORK_TOKEN ?? ''
  const res = await fetch(`${saasUrl}/league/seasons`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return c.json({ error: 'unavailable' }, 502)
  return c.json(await res.json())
})

// ── GET /sessions — active session listing for access review (NETWORK_TOKEN) ──

dashboardRoutes.get('/sessions', async (c) => {
  const auth = c.req.header('Authorization') ?? ''
  const token = c.env.NETWORK_TOKEN ?? ''
  if (!token || auth !== `Bearer ${token}`) {
    return c.json({ error: 'forbidden' }, 403)
  }

  const tenantSlug = c.req.query('tenant_slug')
  if (!tenantSlug) return c.json({ error: 'tenant_slug_required' }, 400)

  const includeRevoked = c.req.query('include_revoked') === 'true'

  type SessionRow = {
    id: string
    tenant_slug: string
    identity_id: string
    full_name: string | null
    contact_value: string | null
    channel: string | null
    ip: string | null
    created_at: string
    expires_at: string
    revoked_at: string | null
    last_seen_at: string | null
  }

  const sql = includeRevoked
    ? `SELECT id, tenant_slug, identity_id, full_name, contact_value, channel,
              ip, created_at, expires_at, revoked_at, last_seen_at
       FROM portal_sessions
       WHERE tenant_slug = ?
       ORDER BY created_at DESC LIMIT 100`
    : `SELECT id, tenant_slug, identity_id, full_name, contact_value, channel,
              ip, created_at, expires_at, revoked_at, last_seen_at
       FROM portal_sessions
       WHERE tenant_slug = ? AND revoked_at IS NULL AND expires_at > datetime('now')
       ORDER BY created_at DESC LIMIT 100`

  const rows = await c.env.DB_CORE.prepare(sql)
    .bind(tenantSlug)
    .all<SessionRow>()

  return c.json({
    sessions: rows.results ?? [],
    total: rows.results?.length ?? 0,
    includeRevoked,
  })
})

// ── GET /compliance-summary (NETWORK_TOKEN) ────────────────────────────────

dashboardRoutes.get('/compliance-summary', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') ?? c.req.header('NETWORK_TOKEN')
  if (!token || token !== c.env.NETWORK_TOKEN) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const tenantSlug = c.req.query('tenant_slug')
  if (!tenantSlug) return c.json({ error: 'tenant_slug_required' }, 400)

  const [sessions, termsAgreements, totalIdentities, identitiesVerified, riskCount] =
    await Promise.all([
      c.env.DB_CORE.prepare(
        `SELECT COUNT(*) as count FROM portal_sessions
         WHERE tenant_slug = ? AND revoked_at IS NULL AND expires_at > datetime('now')`
      ).bind(tenantSlug).first<{ count: number }>(),
      c.env.DB_CORE.prepare(
        `SELECT COUNT(DISTINCT identity_id) as count FROM agreements
         WHERE tenant_slug = ? AND agreement_type = 'portal_terms'`
      ).bind(tenantSlug).first<{ count: number }>(),
      c.env.DB_CORE.prepare(
        `SELECT COUNT(*) as count FROM auth_identities WHERE customer_slug = ?`
      ).bind(tenantSlug).first<{ count: number }>(),
      c.env.DB_CORE.prepare(
        `SELECT COUNT(*) as count FROM portal_accounts
         WHERE identity_verified_at IS NOT NULL
         AND id IN (SELECT portal_account_id FROM auth_identities WHERE customer_slug = ?)`
      ).bind(tenantSlug).first<{ count: number }>(),
      c.env.DB_CORE.prepare(
        `SELECT COUNT(*) as count FROM risk_acceptances WHERE tenant_slug = ?`
      ).bind(tenantSlug).first<{ count: number }>(),
    ])

  const total = totalIdentities?.count ?? 0
  const signed = termsAgreements?.count ?? 0
  const agreementCoverage = total > 0 ? Math.round((signed / total) * 100) : 0

  return c.json({
    activeSessions: sessions?.count ?? 0,
    termsSigned: signed,
    totalIdentities: total,
    identitiesVerified: identitiesVerified?.count ?? 0,
    agreementCoverage,
    riskAcceptances: riskCount?.count ?? 0,
  })
})

// ── GET /risk-acceptances (NETWORK_TOKEN) ──────────────────────────────────

dashboardRoutes.get('/risk-acceptances', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') ?? c.req.header('NETWORK_TOKEN')
  if (!token || token !== c.env.NETWORK_TOKEN) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const tenantSlug = c.req.query('tenant_slug')
  if (!tenantSlug) return c.json({ error: 'tenant_slug_required' }, 400)

  const limit = Math.min(parseInt(c.req.query('limit') ?? '50'), 200)
  const offset = parseInt(c.req.query('offset') ?? '0')

  const [rows, countRow] = await Promise.all([
    c.env.DB_CORE.prepare(
      `SELECT id, actor_id, alert_type, reason, accepted_at, ip
       FROM risk_acceptances WHERE tenant_slug = ?
       ORDER BY accepted_at DESC LIMIT ? OFFSET ?`
    ).bind(tenantSlug, limit, offset).all<{
      id: string; actor_id: string; alert_type: string; reason: string | null; accepted_at: string; ip: string | null
    }>(),
    c.env.DB_CORE.prepare(
      `SELECT COUNT(*) as count FROM risk_acceptances WHERE tenant_slug = ?`
    ).bind(tenantSlug).first<{ count: number }>(),
  ])

  return c.json({ acceptances: rows.results, total: countRow?.count ?? 0 })
})

// ── POST /alerts/:alertId/accept-risk (NETWORK_TOKEN) ─────────────────────

dashboardRoutes.post('/alerts/:alertId/accept-risk', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') ?? c.req.header('NETWORK_TOKEN')
  if (!token || token !== c.env.NETWORK_TOKEN) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const alertId = c.req.param('alertId')
  const body = await c.req.json<{ tenant_slug?: string; reason?: string }>().catch(() => ({}))
  const tenantSlug = body.tenant_slug
  if (!tenantSlug) return c.json({ error: 'tenant_slug_required' }, 400)

  const id = crypto.randomUUID()
  const ip = c.req.header('CF-Connecting-IP') ?? null

  await c.env.DB_CORE.prepare(
    `INSERT INTO risk_acceptances (id, tenant_slug, actor_id, alert_type, reason, ip)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, tenantSlug, 'admin', alertId, body.reason ?? null, ip).run()

  return c.json({ accepted: true, id })
})

// ── PUT /portal-config — upsert portal config for a tenant (NETWORK_TOKEN) ──

dashboardRoutes.put('/portal-config', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
    ?? c.req.header('NETWORK_TOKEN')
  if (!token || token !== c.env.NETWORK_TOKEN) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const body = await c.req.json<{ tenant_slug?: string; config?: Record<string, unknown> }>()
    .catch(() => ({}))

  if (!body.tenant_slug || !body.config) {
    return c.json({ error: 'tenant_slug and config required' }, 400)
  }

  const id = crypto.randomUUID()
  await c.env.DB_CORE.prepare(
    `INSERT INTO portal_configs (id, customer_slug, config_json, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(customer_slug) DO UPDATE SET
       config_json = excluded.config_json,
       updated_at = excluded.updated_at`
  ).bind(id, body.tenant_slug, JSON.stringify(body.config)).run()

  return c.json({ updated: true, tenant_slug: body.tenant_slug })
})

// ── POST /sessions/:sessionId/revoke (NETWORK_TOKEN) ───────────────────────

dashboardRoutes.post('/sessions/:sessionId/revoke', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') ?? c.req.header('NETWORK_TOKEN')
  if (!token || token !== c.env.NETWORK_TOKEN) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const sessionId = c.req.param('sessionId')
  const body = await c.req.json<{ tenant_slug?: string }>().catch(() => ({}))
  const tenantSlug = body.tenant_slug
  if (!tenantSlug) return c.json({ error: 'tenant_slug_required' }, 400)

  const result = await c.env.DB_CORE.prepare(
    `UPDATE portal_sessions SET revoked_at = datetime('now')
     WHERE id = ? AND tenant_slug = ? AND revoked_at IS NULL`
  ).bind(sessionId, tenantSlug).run()

  if (result.meta.changes === 0) {
    return c.json({ error: 'session_not_found' }, 404)
  }

  return c.json({ revoked: true })
})

// ── POST /automation-config — configure per-tenant automation provider (NETWORK_TOKEN) ──
//
// Stores provider credentials in SESSIONS KV under key `connector:automation`.
// Each Inkwell Worker deployment maps to one tenant, so no tenantSlug prefix is needed.
// This is how admins wire a specific n8n/Zapier/ToRivers instance to a specific tenant.
//
//   Body: { provider: 'n8n'|'torivers'|'zapier'|'webhook', apiUrl: string, apiKey?: string }
//   Returns: { configured: true, provider }

const VALID_AUTOMATION_PROVIDERS = ['n8n', 'torivers', 'zapier', 'webhook'] as const
type AutomationProvider = typeof VALID_AUTOMATION_PROVIDERS[number]

dashboardRoutes.post('/automation-config', async (c) => {
  const auth = c.req.header('Authorization') ?? ''
  const token = c.env.NETWORK_TOKEN ?? ''
  if (!token || auth !== `Bearer ${token}`) {
    return c.json({ error: 'forbidden' }, 403)
  }

  type AutomationConfigBody = {
    provider?: string
    apiUrl?: string
    apiKey?: string
  }

  const bodyRaw: unknown = await c.req.json().catch(() => ({}))
  const body: AutomationConfigBody = bodyRaw !== null && typeof bodyRaw === 'object' ? (bodyRaw as AutomationConfigBody) : {}

  const provider = body.provider as AutomationProvider | undefined
  const apiUrl = typeof body.apiUrl === 'string' ? body.apiUrl.trim() : ''
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''

  if (!provider || !(VALID_AUTOMATION_PROVIDERS as readonly string[]).includes(provider)) {
    return c.json({
      error: 'invalid_provider',
      valid: VALID_AUTOMATION_PROVIDERS,
    }, 400)
  }

  if (!apiUrl) {
    return c.json({ error: 'apiUrl is required' }, 400)
  }

  const config = JSON.stringify({ provider, apiUrl, apiKey })

  // Store in SESSIONS KV — scoped to this deployment (one Worker = one tenant)
  await c.env.SESSIONS.put('connector:automation', config)

  return c.json({ configured: true, provider })
})

// ── GET /audit — paginated audit log query (NETWORK_TOKEN) ─────────────────

dashboardRoutes.get('/audit', async (c) => {
  const auth = c.req.header('Authorization') ?? ''
  const token = c.env.NETWORK_TOKEN ?? ''
  if (!token || auth !== `Bearer ${token}`) {
    return c.json({ error: 'forbidden' }, 403)
  }

  const tenantSlug = c.req.query('tenant_slug')
  if (!tenantSlug) {
    return c.json({ error: 'tenant_slug_required' }, 400)
  }

  const actorId = c.req.query('actor_id') ?? null
  const action = c.req.query('action') ?? null
  const limitParam = c.req.query('limit')
  const offsetParam = c.req.query('offset')
  const limit = Math.min(Math.max(parseInt(limitParam ?? '50', 10) || 50, 1), 200)
  const offset = Math.max(parseInt(offsetParam ?? '0', 10) || 0, 0)

  type AuditRow = {
    id: string
    tenant_slug: string
    actor_id: string | null
    actor_type: string
    action: string
    resource_type: string | null
    resource_id: string | null
    ip: string | null
    created_at: string
    metadata_json: string | null
  }

  // Build query dynamically based on optional filters
  const conditions: string[] = ['tenant_slug = ?']
  const binds: unknown[] = [tenantSlug]

  if (actorId) {
    conditions.push('actor_id = ?')
    binds.push(actorId)
  }
  if (action) {
    conditions.push('action = ?')
    binds.push(action)
  }

  const where = conditions.join(' AND ')

  const [rows, totalRow] = await Promise.all([
    c.env.DB_CORE.prepare(
      `SELECT id, tenant_slug, actor_id, actor_type, action, resource_type,
              resource_id, ip, created_at, metadata_json
       FROM audit_logs WHERE ${where}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...binds, limit, offset)
      .all<AuditRow>(),
    c.env.DB_CORE.prepare(
      `SELECT COUNT(*) as count FROM audit_logs WHERE ${where}`,
    )
      .bind(...binds)
      .first<{ count: number }>(),
  ])

  return c.json({
    logs: rows.results ?? [],
    total: totalRow?.count ?? 0,
    limit,
    offset,
  })
})

// ── Workflows — proxy to tenant's automation provider (n8n) ──────────────
//
// Auth: Bearer NETWORK_TOKEN
// Tenant: ?tenant_slug query param
// Provider config: SESSIONS KV key `connector:{tenantSlug}:automation`
//   Value: { provider, apiUrl, apiKey }

type WorkflowNode = {
  type: string
  parameters?: {
    rule?: { interval?: Array<{ field?: string; expression?: string }> }
    cronExpression?: string
  }
}

type N8nWorkflow = {
  id: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
  nodes?: WorkflowNode[]
  tags?: Array<{ name: string }>
}

type N8nExecution = {
  id: string
  status: string
  startedAt: string
  stoppedAt?: string
}

function extractSchedule(nodes: WorkflowNode[] | undefined): string | undefined {
  if (!nodes) return undefined
  const trigger = nodes.find(n => n.type === 'n8n-nodes-base.scheduleTrigger')
  if (!trigger) return undefined
  const params = trigger.parameters ?? {}
  if (params.cronExpression) return params.cronExpression
  const intervals = params.rule?.interval
  if (intervals && intervals.length > 0) {
    const first = intervals[0]
    return first.expression ?? undefined
  }
  return undefined
}

async function getAutomationConfig(
  env: AppBindings['Bindings'],
  tenantSlug: string,
): Promise<{ provider: string; apiUrl: string; apiKey: string } | null> {
  const raw = await env.SESSIONS.get(`connector:${tenantSlug}:automation`)
    ?? await env.SESSIONS.get('connector:automation')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { provider?: string; apiUrl?: string; apiKey?: string }
    if (!parsed.apiUrl) return null
    return {
      provider: parsed.provider ?? 'n8n',
      apiUrl: parsed.apiUrl.replace(/\/+$/, ''),
      apiKey: parsed.apiKey ?? '',
    }
  } catch {
    return null
  }
}

// ── GET /workflows ────────────────────────────────────────────────────────

dashboardRoutes.get('/workflows', async (c) => {
  const auth = c.req.header('Authorization') ?? ''
  const token = c.env.NETWORK_TOKEN ?? ''
  if (!token || auth !== `Bearer ${token}`) return c.json({ error: 'forbidden' }, 403)

  const tenantSlug = c.req.query('tenant_slug')
  if (!tenantSlug) return c.json({ error: 'tenant_slug_required' }, 400)

  const config = await getAutomationConfig(c.env, tenantSlug)
  if (!config) return c.json({ error: 'no_automation_configured' }, 404)

  const res = await fetch(`${config.apiUrl}/api/v1/workflows?limit=50`, {
    headers: { 'X-N8N-API-KEY': config.apiKey },
  })
  if (!res.ok) return c.json({ error: 'provider_error', status: res.status }, 502)

  const data = await res.json() as { data?: N8nWorkflow[] }
  const raw = data.data ?? []

  const workflows = raw.map(wf => ({
    id: wf.id,
    name: wf.name,
    active: wf.active,
    createdAt: wf.createdAt,
    updatedAt: wf.updatedAt,
    schedule: extractSchedule(wf.nodes),
    tags: (wf.tags ?? []).map(t => t.name),
  }))

  return c.json({ workflows })
})

// ── POST /workflows/:workflowId/toggle ────────────────────────────────────

dashboardRoutes.post('/workflows/:workflowId/toggle', async (c) => {
  const auth = c.req.header('Authorization') ?? ''
  const token = c.env.NETWORK_TOKEN ?? ''
  if (!token || auth !== `Bearer ${token}`) return c.json({ error: 'forbidden' }, 403)

  const tenantSlug = c.req.query('tenant_slug')
  if (!tenantSlug) return c.json({ error: 'tenant_slug_required' }, 400)

  const workflowId = c.req.param('workflowId')
  const config = await getAutomationConfig(c.env, tenantSlug)
  if (!config) return c.json({ error: 'no_automation_configured' }, 404)

  const headers = { 'X-N8N-API-KEY': config.apiKey, 'Content-Type': 'application/json' }

  // Fetch current state
  const getRes = await fetch(`${config.apiUrl}/api/v1/workflows/${workflowId}`, { headers })
  if (!getRes.ok) return c.json({ error: 'workflow_not_found' }, 404)
  const wf = await getRes.json() as N8nWorkflow

  // Toggle
  const patchRes = await fetch(`${config.apiUrl}/api/v1/workflows/${workflowId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ active: !wf.active }),
  })
  if (!patchRes.ok) return c.json({ error: 'toggle_failed', status: patchRes.status }, 502)

  return c.json({ id: workflowId, active: !wf.active })
})

// ── PUT /workflows/:workflowId/schedule ───────────────────────────────────

dashboardRoutes.put('/workflows/:workflowId/schedule', async (c) => {
  const auth = c.req.header('Authorization') ?? ''
  const token = c.env.NETWORK_TOKEN ?? ''
  if (!token || auth !== `Bearer ${token}`) return c.json({ error: 'forbidden' }, 403)

  const tenantSlug = c.req.query('tenant_slug')
  if (!tenantSlug) return c.json({ error: 'tenant_slug_required' }, 400)

  const workflowId = c.req.param('workflowId')
  const body = await c.req.json<{ cronExpression?: string }>().catch(() => ({}))
  if (!body.cronExpression) return c.json({ error: 'cronExpression_required' }, 400)

  const config = await getAutomationConfig(c.env, tenantSlug)
  if (!config) return c.json({ error: 'no_automation_configured' }, 404)

  const headers = { 'X-N8N-API-KEY': config.apiKey, 'Content-Type': 'application/json' }

  const getRes = await fetch(`${config.apiUrl}/api/v1/workflows/${workflowId}`, { headers })
  if (!getRes.ok) return c.json({ error: 'workflow_not_found' }, 404)
  const wf = await getRes.json() as N8nWorkflow & { nodes: WorkflowNode[] }

  // Update scheduleTrigger node
  const updatedNodes = (wf.nodes ?? []).map(node => {
    if (node.type !== 'n8n-nodes-base.scheduleTrigger') return node
    return {
      ...node,
      parameters: {
        ...node.parameters,
        cronExpression: body.cronExpression,
      },
    }
  })

  const patchRes = await fetch(`${config.apiUrl}/api/v1/workflows/${workflowId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ nodes: updatedNodes }),
  })
  if (!patchRes.ok) return c.json({ error: 'schedule_update_failed', status: patchRes.status }, 502)

  return c.json({ id: workflowId, schedule: body.cronExpression })
})

// ── GET /workflows/:workflowId/runs ───────────────────────────────────────

dashboardRoutes.get('/workflows/:workflowId/runs', async (c) => {
  const auth = c.req.header('Authorization') ?? ''
  const token = c.env.NETWORK_TOKEN ?? ''
  if (!token || auth !== `Bearer ${token}`) return c.json({ error: 'forbidden' }, 403)

  const tenantSlug = c.req.query('tenant_slug')
  if (!tenantSlug) return c.json({ error: 'tenant_slug_required' }, 400)

  const workflowId = c.req.param('workflowId')
  const limitParam = c.req.query('limit')
  const limit = Math.min(Math.max(parseInt(limitParam ?? '20', 10) || 20, 1), 100)

  const config = await getAutomationConfig(c.env, tenantSlug)
  if (!config) return c.json({ error: 'no_automation_configured' }, 404)

  const url = `${config.apiUrl}/api/v1/executions?workflowId=${workflowId}&limit=${limit}`
  const res = await fetch(url, {
    headers: { 'X-N8N-API-KEY': config.apiKey },
  })
  if (!res.ok) return c.json({ error: 'provider_error', status: res.status }, 502)

  const data = await res.json() as { data?: N8nExecution[] }
  const raw = data.data ?? []

  type RunStatus = 'success' | 'error' | 'running' | 'waiting'
  const statusMap: Record<string, RunStatus> = {
    success: 'success',
    error: 'error',
    running: 'running',
    waiting: 'waiting',
  }

  const runs = raw.map(ex => {
    const startedAt = ex.startedAt
    const finishedAt = ex.stoppedAt ?? undefined
    const durationMs = (startedAt && finishedAt)
      ? new Date(finishedAt).getTime() - new Date(startedAt).getTime()
      : undefined
    return {
      id: ex.id,
      status: statusMap[ex.status] ?? 'error' as RunStatus,
      startedAt,
      finishedAt,
      durationMs,
    }
  })

  return c.json({ runs })
})
