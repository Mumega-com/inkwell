import { Hono } from 'hono'
import type { AppBindings } from '../types'

const PLATFORM_FEE_RATE = 0.05

interface TransactionBody {
  tenant_id: string
  amount_cents: number
  tx_type: string
  description?: string
  stripe_tx_id?: string
}

interface MeteringBody {
  tenant_id: string
  resource_type: string
  quantity: number
}

interface TransactionRow {
  id: string
  tenant_id: string
  stripe_tx_id: string | null
  amount_cents: number
  currency: string
  tx_type: string
  status: string
  description: string | null
  created_at: string
  settled_at: string | null
}

interface RoyaltyRow {
  id: string
  transaction_id: string
  recipient_type: string
  recipient_id: string
  amount_cents: number
  status: string
  payout_date: string | null
  created_at: string
}

interface MeteringRow {
  id: string
  tenant_id: string
  resource_type: string
  quantity: number
  billing_cycle_start: string
  recorded_at: string
}

export const glassRoutes = new Hono<AppBindings>()

// ---------------------------------------------------------------------------
// KV Snapshot endpoints (existing)
// ---------------------------------------------------------------------------

// GET /api/glass/daily — latest daily snapshot
glassRoutes.get('/daily', async (c) => {
  const data = await c.env.CONTENT.get('glass:daily')
  if (!data) {
    return c.json({ error: 'No daily snapshot yet. Flywheel runs at 6am UTC.' }, 404)
  }
  return c.json(JSON.parse(data))
})

// GET /api/glass/history — list available snapshot dates
glassRoutes.get('/history', async (c) => {
  const list = await c.env.CONTENT.list({ prefix: 'glass:2' })
  const dates = list.keys.map((k) => k.name.replace('glass:', '')).sort().reverse()
  return c.json({ dates, count: dates.length })
})

// ---------------------------------------------------------------------------
// Commerce endpoints
// ---------------------------------------------------------------------------

// POST /api/glass/transactions — record a Glass transaction
glassRoutes.post('/transactions', async (c) => {
  const body = await c.req.json<TransactionBody>()

  // Prefer tenant from middleware (multi-tenant mode); fall back to body for direct API calls
  const tenantId = c.get('tenant_slug') ?? body.tenant_id
  if (!tenantId || typeof tenantId !== 'string') {
    return c.json({ error: 'tenant_id is required' }, 400)
  }
  if (!body.amount_cents || typeof body.amount_cents !== 'number' || body.amount_cents <= 0) {
    return c.json({ error: 'amount_cents must be a positive integer' }, 400)
  }
  if (!body.tx_type || typeof body.tx_type !== 'string') {
    return c.json({ error: 'tx_type is required' }, 400)
  }

  const txId = crypto.randomUUID()
  const platformFeeCents = Math.round(body.amount_cents * PLATFORM_FEE_RATE)
  const tenantAmountCents = body.amount_cents - platformFeeCents

  const db = c.get('db_core')

  // Insert transaction
  await db.execute(
    `INSERT INTO glass_transactions (id, tenant_id, stripe_tx_id, amount_cents, currency, tx_type, status, description)
     VALUES (?, ?, ?, ?, 'usd', ?, 'pending', ?)`,
    [txId, tenantId, body.stripe_tx_id ?? null, body.amount_cents, body.tx_type, body.description ?? null]
  )

  // Create platform royalty (5%)
  const platformRoyaltyId = crypto.randomUUID()
  await db.execute(
    `INSERT INTO glass_royalties (id, transaction_id, recipient_type, recipient_id, amount_cents)
     VALUES (?, ?, 'platform', 'mumega', ?)`,
    [platformRoyaltyId, txId, platformFeeCents]
  )

  // Create tenant royalty (95%)
  const tenantRoyaltyId = crypto.randomUUID()
  await db.execute(
    `INSERT INTO glass_royalties (id, transaction_id, recipient_type, recipient_id, amount_cents)
     VALUES (?, ?, 'tenant', ?, ?)`,
    [tenantRoyaltyId, txId, tenantId, tenantAmountCents]
  )

  return c.json(
    {
      transaction_id: txId,
      platform_fee_cents: platformFeeCents,
      tenant_amount_cents: tenantAmountCents,
    },
    201
  )
})

// GET /api/glass/transactions — list transactions for a tenant
glassRoutes.get('/transactions', async (c) => {
  const tenantId = c.get('tenant_slug') ?? c.req.query('tenant_id')
  if (!tenantId) {
    return c.json({ error: 'tenant_id query param is required' }, 400)
  }

  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 200)

  const db = c.get('db_core')

  const countResult = await db.queryOne<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM glass_transactions WHERE tenant_id = ?',
    [tenantId]
  )

  const transactions = await db.query<TransactionRow>(
    'SELECT * FROM glass_transactions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?',
    [tenantId, limit]
  )

  return c.json({
    transactions,
    total_count: countResult?.cnt ?? 0,
  })
})

// GET /api/glass/revenue — revenue summary for a tenant
glassRoutes.get('/revenue', async (c) => {
  const tenantId = c.get('tenant_slug') ?? c.req.query('tenant_id')
  if (!tenantId) {
    return c.json({ error: 'tenant_id query param is required' }, 400)
  }

  const period = c.req.query('period') // YYYY-MM format
  const db = c.get('db_core')

  let dateFilter = ''
  const binds: (string | number)[] = [tenantId]

  if (period && /^\d{4}-\d{2}$/.test(period)) {
    dateFilter = "AND created_at >= ? AND created_at < date(?, '+1 month')"
    const periodStart = `${period}-01`
    binds.push(periodStart, periodStart)
  }

  // Total revenue
  const totalResult = await db.queryOne<{ total_revenue_cents: number }>(
    `SELECT COALESCE(SUM(amount_cents), 0) as total_revenue_cents
     FROM glass_transactions
     WHERE tenant_id = ? ${dateFilter}`,
    binds
  )

  // Platform fees (royalties to platform for this tenant's transactions)
  const feesResult = await db.queryOne<{ platform_fees_cents: number }>(
    `SELECT COALESCE(SUM(r.amount_cents), 0) as platform_fees_cents
     FROM glass_royalties r
     JOIN glass_transactions t ON r.transaction_id = t.id
     WHERE t.tenant_id = ? AND r.recipient_type = 'platform' ${dateFilter.replace(/created_at/g, 't.created_at')}`,
    binds
  )

  // Breakdown by tx_type
  const breakdownResults = await db.query<{ tx_type: string; count: number; total_cents: number }>(
    `SELECT tx_type, COUNT(*) as count, COALESCE(SUM(amount_cents), 0) as total_cents
     FROM glass_transactions
     WHERE tenant_id = ? ${dateFilter}
     GROUP BY tx_type`,
    binds
  )

  const breakdownByType: Record<string, { count: number; total_cents: number }> = {}
  for (const row of breakdownResults) {
    breakdownByType[row.tx_type] = { count: row.count, total_cents: row.total_cents }
  }

  return c.json({
    total_revenue_cents: totalResult?.total_revenue_cents ?? 0,
    platform_fees_cents: feesResult?.platform_fees_cents ?? 0,
    breakdown_by_type: breakdownByType,
  })
})

// POST /api/glass/metering — record a usage event
glassRoutes.post('/metering', async (c) => {
  const body = await c.req.json<MeteringBody>()

  // Prefer tenant from middleware (multi-tenant mode); fall back to body for direct API calls
  const tenantId = c.get('tenant_slug') ?? body.tenant_id
  if (!tenantId || typeof tenantId !== 'string') {
    return c.json({ error: 'tenant_id is required' }, 400)
  }
  if (!body.resource_type || typeof body.resource_type !== 'string') {
    return c.json({ error: 'resource_type is required' }, 400)
  }
  if (!body.quantity || typeof body.quantity !== 'number' || body.quantity <= 0) {
    return c.json({ error: 'quantity must be a positive integer' }, 400)
  }

  const id = crypto.randomUUID()
  const now = new Date()
  const billingCycleStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`

  await c.get('db_core').execute(
    `INSERT INTO glass_metering (id, tenant_id, resource_type, quantity, billing_cycle_start)
     VALUES (?, ?, ?, ?, ?)`,
    [id, tenantId, body.resource_type, body.quantity, billingCycleStart]
  )

  return c.json({ id, billing_cycle_start: billingCycleStart }, 201)
})

// GET /api/glass/metering — usage metering for a tenant
glassRoutes.get('/metering', async (c) => {
  const tenantId = c.get('tenant_slug') ?? c.req.query('tenant_id')
  if (!tenantId) {
    return c.json({ error: 'tenant_id query param is required' }, 400)
  }

  const period = c.req.query('period') // YYYY-MM format
  const billingCycleStart = period && /^\d{4}-\d{2}$/.test(period)
    ? `${period}-01`
    : (() => {
        const now = new Date()
        return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
      })()

  const rows = await c.get('db_core').query<{ resource_type: string; total_quantity: number }>(
    `SELECT resource_type, COALESCE(SUM(quantity), 0) as total_quantity
     FROM glass_metering
     WHERE tenant_id = ? AND billing_cycle_start = ?
     GROUP BY resource_type`,
    [tenantId, billingCycleStart]
  )

  const usage: Record<string, number> = {}
  for (const row of rows) {
    usage[row.resource_type] = row.total_quantity
  }

  return c.json({
    tenant_id: tenantId,
    billing_cycle_start: billingCycleStart,
    usage,
  })
})

// ---------------------------------------------------------------------------
// Historical snapshot (must be last — /:date is a catch-all param)
// ---------------------------------------------------------------------------

// GET /api/glass/:date — historical snapshot by date (YYYY-MM-DD)
glassRoutes.get('/:date', async (c) => {
  const date = c.req.param('date')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: 'Date format: YYYY-MM-DD' }, 400)
  }
  const data = await c.env.CONTENT.get(`glass:${date}`)
  if (!data) {
    return c.json({ error: `No snapshot for ${date}` }, 404)
  }
  return c.json(JSON.parse(data))
})
