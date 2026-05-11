import { Hono, type Context } from 'hono'
import type { AppBindings, AuthSession } from '../types'
import type { DatabasePort } from '../../kernel/types'
import { D1DatabaseAdapter } from '../../kernel/adapters/d1'

const bountyRoutes = new Hono<AppBindings>()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BountyStatus = 'open' | 'claimed' | 'submitted' | 'approved' | 'paid'
type BountyAssigneeType = 'user' | 'agent'

interface BountyActor {
  claimantId: string
  assigneeType: BountyAssigneeType
  agentId: string | null
  role: string
  tenantSlug: string | null
}

interface BountyRow {
  id: string
  customer_slug: string
  title: string
  description: string | null
  reward_cents: number
  currency: string
  status: BountyStatus
  creator_id: string
  claimant_id: string | null
  agent_id: string | null
  assignee_type: BountyAssigneeType
  proof_url: string | null
  squad_id: string | null
  labels_json: string
  expires_at: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_COOKIE_NAME = 'inkwell_session'

function now(): string {
  return new Date().toISOString()
}

function nanoid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20)
}

function getDb(c: Context<AppBindings>): DatabasePort {
  return c.get('db_core') ?? new D1DatabaseAdapter(c.env.DB_CORE)
}

function bearerToken(c: Context<AppBindings>): string | null {
  const auth = c.req.header('Authorization') ?? ''
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
}

function parseCookieHeader(headerValue: string | undefined | null): Record<string, string> {
  if (!headerValue) return {}

  const cookies: Record<string, string> = {}
  for (const segment of headerValue.split(';')) {
    const [rawName, ...rawValueParts] = segment.trim().split('=')
    if (!rawName) continue
    cookies[rawName] = decodeURIComponent(rawValueParts.join('='))
  }

  return cookies
}

function sessionTokenFromCookie(c: Context<AppBindings>): string | null {
  const cookieName = c.env.AUTH_COOKIE_NAME?.trim() || DEFAULT_COOKIE_NAME
  const token = parseCookieHeader(c.req.header('Cookie'))[cookieName]
  return token && token.trim() ? token : null
}

function isSystemToken(c: Context<AppBindings>, token: string): boolean {
  return Boolean(
    (c.env.PUBLISH_TOKEN && token === c.env.PUBLISH_TOKEN) ||
    (c.env.INKWELL_MCP_TOKEN && token === c.env.INKWELL_MCP_TOKEN) ||
    (c.env.CONTRACT_AUTH_TOKEN && token === c.env.CONTRACT_AUTH_TOKEN),
  )
}

function normalizeAgentId(value: string | undefined | null, fallback = 'agent'): string {
  const raw = (value ?? fallback).trim() || fallback
  return raw.replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 128)
}

function requestTenant(c: Context<AppBindings>): string | null {
  return c.req.header('X-Tenant-Slug')?.trim() || null
}

function tenantForActor(c: Context<AppBindings>, actor: BountyActor): string | null {
  return c.get('tenant_slug') ?? actor.tenantSlug ?? requestTenant(c)
}

function managerAllowed(actor: BountyActor): boolean {
  return ['manager', 'admin', 'owner'].includes(actor.role)
}

async function sessionActor(c: Context<AppBindings>): Promise<BountyActor | null> {
  const existing = c.get('authSession')
  if (existing) {
    return {
      claimantId: existing.identityId,
      assigneeType: 'user',
      agentId: null,
      role: existing.role ?? 'viewer',
      tenantSlug: existing.customerSlug,
    }
  }

  let token = sessionTokenFromCookie(c)
  const bearer = bearerToken(c)
  if (!token && bearer && !isSystemToken(c, bearer)) token = bearer
  if (!token) return null

  const raw = await c.env.SESSIONS.get(`session:${token}`).catch(() => null)
  if (!raw) return null

  const session = JSON.parse(raw) as AuthSession
  return {
    claimantId: session.identityId,
    assigneeType: 'user',
    agentId: null,
    role: session.role ?? 'viewer',
    tenantSlug: session.customerSlug,
  }
}

async function agentActor(c: Context<AppBindings>): Promise<BountyActor | null> {
  const token = bearerToken(c)
  if (!token) return null

  const headerAgentId = c.req.header('X-Agent-Id') ?? c.req.query('agent_id')

  if (isSystemToken(c, token)) {
    const agentId = normalizeAgentId(headerAgentId, 'system-agent')
    return {
      claimantId: agentId,
      assigneeType: 'agent',
      agentId,
      role: 'admin',
      tenantSlug: requestTenant(c) ?? c.get('tenant_slug') ?? null,
    }
  }

  const row = await c.env.DB_CORE.prepare(
    `SELECT tenant_slug, label, role
     FROM mcp_tokens
     WHERE token = ?
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > datetime('now'))
     LIMIT 1`,
  ).bind(token).first<{ tenant_slug: string; label: string; role: string }>().catch(() => null)

  if (!row) return null

  const agentId = normalizeAgentId(headerAgentId, row.label || `mcp:${token.slice(0, 8)}`)
  if (!c.get('tenant_slug')) c.set('tenant_slug', row.tenant_slug)

  return {
    claimantId: agentId,
    assigneeType: 'agent',
    agentId,
    role: row.role ?? 'admin',
    tenantSlug: row.tenant_slug,
  }
}

async function requireActor(c: Context<AppBindings>): Promise<BountyActor | Response> {
  const actor = await sessionActor(c) ?? await agentActor(c)
  if (!actor) return c.json({ error: 'unauthenticated' }, 401)
  if (actor.tenantSlug && !c.get('tenant_slug')) c.set('tenant_slug', actor.tenantSlug)
  return actor
}

async function claimBodyAgentId(c: Context<AppBindings>): Promise<string | null> {
  const body = await c.req.json<{ agent_id?: string }>().catch(() => null)
  return typeof body?.agent_id === 'string' ? body.agent_id : null
}

// ---------------------------------------------------------------------------
// GET /api/bounties/stats — summary widget (auth required)
// ---------------------------------------------------------------------------

bountyRoutes.get('/stats', async (c) => {
  const actor = await requireActor(c)
  if (actor instanceof Response) return actor

  const tenant = tenantForActor(c, actor)
  if (!tenant) return c.json({ error: 'tenant_required' }, 400)

  const db = getDb(c)

  const rows = await db.query<{ status: string; count: number; reward_sum: number }>(
    `SELECT status,
            COUNT(*) as count,
            SUM(reward_cents) as reward_sum
     FROM bounties
     WHERE customer_slug = ?
     GROUP BY status`,
    [tenant],
  )

  const stats: Record<string, number> = {}
  let total_reward_cents = 0
  let open_count = 0

  for (const row of rows) {
    stats[`${row.status}_count`] = Number(row.count)
    total_reward_cents += Number(row.reward_sum ?? 0)
    if (row.status === 'open') open_count = Number(row.count)
  }

  const open_reward = rows.find((r) => r.status === 'open')?.reward_sum ?? 0

  return c.json({
    open_count,
    open_reward_cents: Number(open_reward),
    total_reward_cents,
    ...stats,
  })
})

// ---------------------------------------------------------------------------
// GET /api/bounties/my — my bounties (auth required)
// ---------------------------------------------------------------------------

bountyRoutes.get('/my', async (c) => {
  const actor = await requireActor(c)
  if (actor instanceof Response) return actor

  const tenant = tenantForActor(c, actor)
  if (!tenant) return c.json({ error: 'tenant_required' }, 400)

  const db = getDb(c)
  const bounties = await db.query<BountyRow>(
    `SELECT * FROM bounties
     WHERE customer_slug = ? AND claimant_id = ?
     ORDER BY updated_at DESC`,
    [tenant, actor.claimantId],
  )

  return c.json({ bounties })
})

// ---------------------------------------------------------------------------
// GET /api/bounties — list bounties (auth required)
// ---------------------------------------------------------------------------

bountyRoutes.get('/', async (c) => {
  const actor = await requireActor(c)
  if (actor instanceof Response) return actor

  const tenant = tenantForActor(c, actor)
  if (!tenant) return c.json({ error: 'tenant_required' }, 400)

  const status = c.req.query('status') as BountyStatus | undefined
  const db = getDb(c)

  let bounties: BountyRow[]
  if (status) {
    bounties = await db.query<BountyRow>(
      `SELECT * FROM bounties
       WHERE customer_slug = ? AND status = ?
       ORDER BY created_at DESC`,
      [tenant, status],
    )
  } else {
    bounties = await db.query<BountyRow>(
      `SELECT * FROM bounties
       WHERE customer_slug = ?
       ORDER BY created_at DESC`,
      [tenant],
    )
  }

  return c.json({ bounties })
})

// ---------------------------------------------------------------------------
// POST /api/bounties — create bounty (manager+)
// ---------------------------------------------------------------------------

bountyRoutes.post('/', async (c) => {
  const actor = await requireActor(c)
  if (actor instanceof Response) return actor

  const tenant = tenantForActor(c, actor)
  if (!tenant) return c.json({ error: 'tenant_required' }, 400)

  if (!managerAllowed(actor)) {
    return c.json({ error: 'forbidden', message: 'manager role required to create bounties' }, 403)
  }

  const body = await c.req.json<{
    title: string
    description?: string
    reward_cents: number
    currency?: string
    squad_id?: string
    labels?: string[]
    expires_at?: string
  }>()

  if (!body.title || typeof body.reward_cents !== 'number') {
    return c.json({ error: 'title and reward_cents are required' }, 400)
  }

  const id = nanoid()
  const ts = now()
  const db = getDb(c)

  await db.execute(
    `INSERT INTO bounties
       (id, customer_slug, title, description, reward_cents, currency,
        status, creator_id, squad_id, labels_json, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)`,
    [
      id,
      tenant,
      body.title,
      body.description ?? null,
      body.reward_cents,
      body.currency ?? 'USD',
      actor.claimantId,
      body.squad_id ?? null,
      JSON.stringify(body.labels ?? []),
      body.expires_at ?? null,
      ts,
      ts,
    ],
  )

  const bounty = await db.queryOne<BountyRow>('SELECT * FROM bounties WHERE id = ?', [id])
  return c.json({ bounty }, 201)
})

// ---------------------------------------------------------------------------
// GET /api/bounties/:id — get one bounty (auth required)
// ---------------------------------------------------------------------------

bountyRoutes.get('/:id', async (c) => {
  const actor = await requireActor(c)
  if (actor instanceof Response) return actor

  const id = c.req.param('id')
  const tenant = tenantForActor(c, actor)
  if (!tenant) return c.json({ error: 'tenant_required' }, 400)

  const db = getDb(c)
  const bounty = await db.queryOne<BountyRow>(
    'SELECT * FROM bounties WHERE id = ? AND customer_slug = ?',
    [id, tenant],
  )
  if (!bounty) return c.json({ error: 'not_found' }, 404)
  return c.json({ bounty })
})

// ---------------------------------------------------------------------------
// POST /api/bounties/:id/claim — claim open bounty (any authenticated member)
// ---------------------------------------------------------------------------

bountyRoutes.post('/:id/claim', async (c) => {
  let actor = await requireActor(c)
  if (actor instanceof Response) return actor

  if (actor.assigneeType === 'agent') {
    const bodyAgentId = await claimBodyAgentId(c)
    if (bodyAgentId) {
      const agentId = normalizeAgentId(bodyAgentId, actor.agentId ?? actor.claimantId)
      actor = { ...actor, claimantId: agentId, agentId }
    }
  }

  const id = c.req.param('id')
  const tenant = tenantForActor(c, actor)
  if (!tenant) return c.json({ error: 'tenant_required' }, 400)

  const db = getDb(c)
  const bounty = await db.queryOne<BountyRow>(
    'SELECT * FROM bounties WHERE id = ? AND customer_slug = ?',
    [id, tenant],
  )

  if (!bounty) return c.json({ error: 'not_found' }, 404)
  if (bounty.status !== 'open') return c.json({ error: 'not_claimable', status: bounty.status }, 409)

  await db.execute(
    `UPDATE bounties
     SET status = 'claimed',
         claimant_id = ?,
         agent_id = ?,
         assignee_type = ?,
         updated_at = ?
     WHERE id = ? AND status = 'open'`,
    [actor.claimantId, actor.agentId, actor.assigneeType, now(), id],
  )

  const updated = await db.queryOne<BountyRow>('SELECT * FROM bounties WHERE id = ?', [id])
  return c.json({ bounty: updated })
})

// ---------------------------------------------------------------------------
// POST /api/bounties/:id/submit — submit proof (claimant only)
// ---------------------------------------------------------------------------

bountyRoutes.post('/:id/submit', async (c) => {
  const actor = await requireActor(c)
  if (actor instanceof Response) return actor

  const id = c.req.param('id')
  const tenant = tenantForActor(c, actor)
  if (!tenant) return c.json({ error: 'tenant_required' }, 400)

  const body = await c.req.json<{ proof_url: string }>()
  if (!body.proof_url) return c.json({ error: 'proof_url is required' }, 400)

  const db = getDb(c)
  const bounty = await db.queryOne<BountyRow>(
    'SELECT * FROM bounties WHERE id = ? AND customer_slug = ?',
    [id, tenant],
  )

  if (!bounty) return c.json({ error: 'not_found' }, 404)
  if (bounty.status !== 'claimed') return c.json({ error: 'not_claimable', status: bounty.status }, 409)
  if (bounty.claimant_id !== actor.claimantId) {
    return c.json({ error: 'forbidden', message: 'only the claimant can submit proof' }, 403)
  }

  await db.execute(
    `UPDATE bounties
     SET status = 'submitted', proof_url = ?, updated_at = ?
     WHERE id = ?`,
    [body.proof_url, now(), id],
  )

  const updated = await db.queryOne<BountyRow>('SELECT * FROM bounties WHERE id = ?', [id])
  return c.json({ bounty: updated })
})

// ---------------------------------------------------------------------------
// POST /api/bounties/:id/approve — approve + mark paid (manager+)
// ---------------------------------------------------------------------------

bountyRoutes.post('/:id/approve', async (c) => {
  const actor = await requireActor(c)
  if (actor instanceof Response) return actor

  const id = c.req.param('id')
  const tenant = tenantForActor(c, actor)
  if (!tenant) return c.json({ error: 'tenant_required' }, 400)

  if (!managerAllowed(actor)) {
    return c.json({ error: 'forbidden', message: 'manager role required to approve bounties' }, 403)
  }

  const db = getDb(c)
  const bounty = await db.queryOne<BountyRow>(
    'SELECT * FROM bounties WHERE id = ? AND customer_slug = ?',
    [id, tenant],
  )

  if (!bounty) return c.json({ error: 'not_found' }, 404)
  if (bounty.status !== 'submitted') {
    return c.json({ error: 'not_approvable', message: 'bounty must be in submitted status', status: bounty.status }, 409)
  }

  await db.execute(
    `UPDATE bounties
     SET status = 'paid', updated_at = ?
     WHERE id = ?`,
    [now(), id],
  )

  const updated = await db.queryOne<BountyRow>('SELECT * FROM bounties WHERE id = ?', [id])
  return c.json({ bounty: updated })
})

export { bountyRoutes }
