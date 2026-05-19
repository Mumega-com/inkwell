import { Hono } from 'hono'
import type { AppBindings } from '../types'

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
  const dbCore = c.get('db_core')
  const dbMarketing = c.get('db_marketing')
  const since = daysAgoIso(28)

  // Pull all needed metrics from DB_MARKETING in one query
  const [snapshots, ga4Sessions, leadsResult] = await Promise.allSettled([
    dbMarketing.query<SnapshotRow>(
      `SELECT metric, value, fetched_at
       FROM marketing_snapshots
       WHERE source = 'gsc'
         AND metric IN ('total_clicks', 'total_impressions')
         AND date >= ?
       ORDER BY fetched_at DESC`,
      [since]
    ),

    dbMarketing.query<SnapshotRow>(
      `SELECT metric, value, fetched_at
       FROM marketing_snapshots
       WHERE source = 'ga4'
         AND metric IN ('sessions', 'bounce_rate')
         AND date >= ?
       ORDER BY fetched_at DESC`,
      [since]
    ),

    dbCore.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM contracts
       WHERE created_at >= ?`,
      [since + 'T00:00:00.000Z']
    ),
  ])

  // Aggregate GSC metrics
  let clicks = 0
  let impressions = 0
  let lastUpdated = ''

  if (snapshots.status === 'fulfilled') {
    for (const row of snapshots.value) {
      if (row.metric === 'total_clicks') clicks += row.value
      if (row.metric === 'total_impressions') impressions += row.value
      if (!lastUpdated || row.fetched_at > lastUpdated) lastUpdated = row.fetched_at
    }
  }

  // Aggregate GA4 metrics
  let sessions = 0
  let bounceRate = 0

  if (ga4Sessions.status === 'fulfilled') {
    for (const row of ga4Sessions.value) {
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
  const dbMarketing = c.get('db_marketing')
  const periodParam = c.req.query('period') ?? '28d'
  const days = periodToDays(periodParam)
  const since = daysAgoIso(days)

  const [summaryResult, queriesResult, pagesResult, trendResult] = await Promise.allSettled([
    dbMarketing.query<{ metric: string; value: number }>(
      `SELECT metric, SUM(value) as value
       FROM marketing_snapshots
       WHERE source = 'gsc'
         AND metric IN ('total_clicks', 'total_impressions', 'avg_ctr', 'avg_position')
         AND date >= ?
       GROUP BY metric`,
      [since]
    ),

    dbMarketing.query<QueryRow>(
      `SELECT query, SUM(clicks) as clicks, SUM(impressions) as impressions,
              AVG(ctr) as ctr, AVG(position) as position
       FROM gsc_queries
       WHERE date >= ?
       GROUP BY query
       ORDER BY clicks DESC
       LIMIT 20`,
      [since]
    ),

    dbMarketing.query<PageRow>(
      `SELECT page, SUM(clicks) as clicks, SUM(impressions) as impressions,
              AVG(ctr) as ctr, AVG(position) as position
       FROM gsc_pages
       WHERE date >= ?
       GROUP BY page
       ORDER BY clicks DESC
       LIMIT 15`,
      [since]
    ),

    dbMarketing.query<TrendRow>(
      `SELECT date, SUM(clicks) as clicks, SUM(impressions) as impressions
       FROM gsc_daily
       WHERE date >= ?
       GROUP BY date
       ORDER BY date ASC`,
      [since]
    ),
  ])

  // Build summary from aggregate metrics
  const summaryMap: Record<string, number> = {}
  if (summaryResult.status === 'fulfilled') {
    for (const row of summaryResult.value) {
      summaryMap[row.metric] = row.value
    }
  }

  const summary = {
    clicks: summaryMap['total_clicks'] ?? 0,
    impressions: summaryMap['total_impressions'] ?? 0,
    ctr: summaryMap['avg_ctr'] ?? 0,
    avgPosition: summaryMap['avg_position'] ?? 0,
  }

  const queries = queriesResult.status === 'fulfilled' ? queriesResult.value : []
  const pages = pagesResult.status === 'fulfilled' ? pagesResult.value : []
  const trend = trendResult.status === 'fulfilled' ? trendResult.value : []

  return c.json({ summary, queries, pages, trend })
})

// ── GET /leads ────────────────────────────────────────────────────────────

dashboardRoutes.get('/leads', async (c) => {
  const dbCore = c.get('db_core')
  const limitParam = c.req.query('limit')
  const statusParam = c.req.query('status') ?? 'all'
  const limit = Math.min(Math.max(parseInt(limitParam ?? '20', 10) || 20, 1), 100)

  const weekAgo = daysAgoIso(7)

  const [totalResult, thisWeekResult, leadsResult] = await Promise.allSettled([
    dbCore.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM contracts'
    ),

    dbCore.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM contracts WHERE created_at >= ?',
      [weekAgo + 'T00:00:00.000Z']
    ),

    statusParam === 'all'
      ? dbCore.query<ContractRow>(
          `SELECT id, reference, customer_name, destination, service_type,
                  rate, status, customer_email, created_at
           FROM contracts
           ORDER BY created_at DESC
           LIMIT ?`,
          [limit]
        )
      : dbCore.query<ContractRow>(
          `SELECT id, reference, customer_name, destination, service_type,
                  rate, status, customer_email, created_at
           FROM contracts
           WHERE status = ?
           ORDER BY created_at DESC
           LIMIT ?`,
          [statusParam, limit]
        ),
  ])

  const total = totalResult.status === 'fulfilled' && totalResult.value
    ? totalResult.value.count
    : 0

  const thisWeek = thisWeekResult.status === 'fulfilled' && thisWeekResult.value
    ? thisWeekResult.value.count
    : 0

  const rawLeads: ContractRow[] = leadsResult.status === 'fulfilled' ? leadsResult.value : []

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
