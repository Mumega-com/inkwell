import { Hono } from 'hono'
import type { Context } from 'hono'
import { readSessionFromRequest } from '../middleware'
import type { AppBindings } from '../types'

const bountyRoutes = new Hono<AppBindings>()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BountyStatus = 'open' | 'claimed' | 'submitted' | 'approved' | 'paid'
type AssigneeType = 'human' | 'agent'

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
  assignee_type: AssigneeType | null
  proof_url: string | null
  squad_id: string | null
  labels_json: string
  expires_at: string | null
  created_at: string
  updated_at: string
}

interface BountyActor {
  id: string
  role: string
  type: AssigneeType
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): string {
  return new Date().toISOString()
}

function nanoid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20)
}

function bearerToken(c: Context<AppBindings>): string | null {
  const auth = c.req.header('Authorization') ?? ''
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
}

function isConfiguredToken(candidate: string | null, tokens: Array<string | undefined>): boolean {
  return Boolean(candidate && tokens.some((token) => token && token === candidate))
}

async function getBountyActor(c: Context<AppBindings>): Promise<BountyActor | null> {
  const { token, session } = await readSessionFromRequest(c)
  c.set('authSessionToken', token)
  c.set('authSession', session)

  if (session) {
    return {
      id: session.identityId,
      role: session.role ?? 'viewer',
      type: 'human',
    }
  }

  const tokenFromHeader = bearerToken(c)
  const env = c.env as AppBindings['Bindings'] & { MUMEGA_TOKEN?: string }
  const isAgentToken = isConfiguredToken(tokenFromHeader, [
    env.NETWORK_TOKEN,
    env.MUMEGA_TOKEN,
    env.INKWELL_MCP_TOKEN,
  ])
  const isSystemToken = isConfiguredToken(tokenFromHeader, [
    env.PUBLISH_TOKEN,
    env.CONTRACT_AUTH_TOKEN,
  ])

  if (!isAgentToken && !isSystemToken) return null

  const headerAgentId = c.req.header('X-Agent-Id')?.trim()
  const fallbackAgentId = isSystemToken ? 'system' : 'agent'

  return {
    id: headerAgentId || fallbackAgentId,
    role: isSystemToken ? 'admin' : 'member',
    type: 'agent',
  }
}

async function requireBountyActor(c: Context<AppBindings>): Promise<BountyActor | Response> {
  const actor = await getBountyActor(c)
  if (actor) return actor
  return c.json({ error: 'unauthenticated' }, 401)
}

function tenantSlug(c: Context<AppBindings>): string | null {
  return c.get('tenant_slug') ?? c.req.header('X-Tenant-Slug')?.trim() ?? null
}

function canSubmitBounty(bounty: BountyRow, actor: BountyActor): boolean {
  if (bounty.assignee_type === 'agent') {
    return bounty.agent_id === actor.id || bounty.claimant_id === actor.id
  }
  return bounty.claimant_id === actor.id
}

// ---------------------------------------------------------------------------
// GET /api/bounties/stats — summary widget (auth required)
// ---------------------------------------------------------------------------

bountyRoutes.get('/stats', async (c) => {
  const actor = await requireBountyActor(c)
  if (actor instanceof Response) return actor

  const tenant = tenantSlug(c)
  if (!tenant) return c.json({ error: 'tenant_required' }, 400)

  const db = c.get('db_core')

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
  const actor = await requireBountyActor(c)
  if (actor instanceof Response) return actor

  const tenant = tenantSlug(c)
  if (!tenant) return c.json({ error: 'tenant_required' }, 400)

  const db = c.get('db_core')
  const bounties = await db.query<BountyRow>(
    `SELECT * FROM bounties
     WHERE customer_slug = ? AND claimant_id = ?
     ORDER BY updated_at DESC`,
    [tenant, actor.id],
  )

  return c.json({ bounties })
})

// ---------------------------------------------------------------------------
// GET /api/bounties — list bounties (auth required)
// ---------------------------------------------------------------------------

bountyRoutes.get('/', async (c) => {
  const actor = await requireBountyActor(c)
  if (actor instanceof Response) return actor

  const tenant = tenantSlug(c)
  if (!tenant) return c.json({ error: 'tenant_required' }, 400)

  const status = c.req.query('status') as BountyStatus | undefined
  const db = c.get('db_core')

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
  const actor = await requireBountyActor(c)
  if (actor instanceof Response) return actor

  const tenant = tenantSlug(c)
  if (!tenant) return c.json({ error: 'tenant_required' }, 400)

  const role = actor.role
  const managerRoles = ['manager', 'admin', 'owner']
  if (!managerRoles.includes(role)) {
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
  const db = c.get('db_core')

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
      actor.id,
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
  const actor = await requireBountyActor(c)
  if (actor instanceof Response) return actor

  const id = c.req.param('id')
  const tenant = tenantSlug(c)
  if (!tenant) return c.json({ error: 'tenant_required' }, 400)

  const db = c.get('db_core')
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
  const actor = await requireBountyActor(c)
  if (actor instanceof Response) return actor

  const id = c.req.param('id')
  const tenant = tenantSlug(c)
  if (!tenant) return c.json({ error: 'tenant_required' }, 400)

  const db = c.get('db_core')
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
         assignee_type = ?,
         agent_id = ?,
         updated_at = ?
     WHERE id = ? AND status = 'open'`,
    [actor.id, actor.type, actor.type === 'agent' ? actor.id : null, now(), id],
  )

  const updated = await db.queryOne<BountyRow>('SELECT * FROM bounties WHERE id = ?', [id])
  return c.json({ bounty: updated })
})

// ---------------------------------------------------------------------------
// POST /api/bounties/:id/submit — submit proof (claimant only)
// ---------------------------------------------------------------------------

bountyRoutes.post('/:id/submit', async (c) => {
  const actor = await requireBountyActor(c)
  if (actor instanceof Response) return actor

  const id = c.req.param('id')
  const tenant = tenantSlug(c)
  if (!tenant) return c.json({ error: 'tenant_required' }, 400)

  const body = await c.req.json<{ proof_url: string }>()
  if (!body.proof_url) return c.json({ error: 'proof_url is required' }, 400)

  const db = c.get('db_core')
  const bounty = await db.queryOne<BountyRow>(
    'SELECT * FROM bounties WHERE id = ? AND customer_slug = ?',
    [id, tenant],
  )

  if (!bounty) return c.json({ error: 'not_found' }, 404)
  if (bounty.status !== 'claimed') return c.json({ error: 'not_claimable', status: bounty.status }, 409)
  if (!canSubmitBounty(bounty, actor)) {
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
  const actor = await requireBountyActor(c)
  if (actor instanceof Response) return actor

  const id = c.req.param('id')
  const tenant = tenantSlug(c)
  if (!tenant) return c.json({ error: 'tenant_required' }, 400)

  const role = actor.role
  const managerRoles = ['manager', 'admin', 'owner']
  if (!managerRoles.includes(role)) {
    return c.json({ error: 'forbidden', message: 'manager role required to approve bounties' }, 403)
  }

  const db = c.get('db_core')
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
