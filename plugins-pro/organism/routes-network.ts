import { Hono } from 'hono'
import type { AppBindings } from '../../workers/inkwell-api/src/types'
import type { BusPort, EconomyPort, GraphPort } from '../../kernel/types'

const network = new Hono<AppBindings>()

// ── POST /api/network/quote ─────────────────────────────────────────────────
// Request a quote from another organism. Sends a structured bus message.
// Flow: tenant A sends quote request → bus → tenant B's agent responds with price
network.post('/network/quote', async (c) => {
  const tenant = c.get('tenant_slug')
  if (!tenant) return c.json({ error: 'no_tenant' }, 400)

  const body = await c.req.json<{
    to: string           // target tenant slug
    service: string      // what service is being requested
    details: string      // free-text description
    maxBudget?: number   // max budget in cents
  }>()

  if (!body.to || !body.service) {
    return c.json({ error: 'missing_fields', required: ['to', 'service'] }, 400)
  }

  const bus = c.get('bus' as never) as BusPort
  const message = JSON.stringify({
    kind: 'quote_request',
    payload: {
      from: tenant,
      to: body.to,
      service: body.service,
      details: body.details,
      maxBudget: body.maxBudget,
      ts: new Date().toISOString(),
    },
  })

  await bus.send(`organism:${body.to}`, message)

  return c.json({ ok: true, status: 'quote_requested', to: body.to })
})

// ── POST /api/network/quote/respond ─────────────────────────────────────────
// Respond to a quote request with a price
network.post('/network/quote/respond', async (c) => {
  const tenant = c.get('tenant_slug')
  if (!tenant) return c.json({ error: 'no_tenant' }, 400)

  const body = await c.req.json<{
    to: string           // original requester tenant
    quoteId?: string     // reference to original request
    price: number        // price in cents
    currency?: string    // default: 'MIND'
    description: string  // what's included
    expiresIn?: number   // seconds until quote expires (default 86400 = 24h)
  }>()

  const bus = c.get('bus' as never) as BusPort
  const message = JSON.stringify({
    kind: 'quote_response',
    payload: {
      from: tenant,
      to: body.to,
      quoteId: body.quoteId ?? `q_${Date.now()}`,
      price: body.price,
      currency: body.currency ?? 'MIND',
      description: body.description,
      expiresAt: new Date(Date.now() + (body.expiresIn ?? 86400) * 1000).toISOString(),
      ts: new Date().toISOString(),
    },
  })

  await bus.send(`organism:${body.to}`, message)

  return c.json({ ok: true, status: 'quote_sent' })
})

// ── POST /api/network/transact ──────────────────────────────────────────────
// Execute a transaction: charge buyer, pay seller
network.post('/network/transact', async (c) => {
  const tenant = c.get('tenant_slug')
  if (!tenant) return c.json({ error: 'no_tenant' }, 400)

  const body = await c.req.json<{
    seller: string        // seller tenant slug
    amount: number        // amount in cents
    reason: string        // transaction description
  }>()

  const economy = c.get('economy' as never) as EconomyPort

  // Transfer from buyer to seller
  const result = await economy.transfer(tenant, body.seller, body.amount, body.reason)

  if (!result.charged) {
    return c.json({ error: 'transaction_failed', reason: result.reason }, 402)
  }

  // Notify both parties via bus
  const bus = c.get('bus' as never) as BusPort
  await bus.send(`organism:${body.seller}`, JSON.stringify({
    kind: 'payment_received',
    payload: { from: tenant, amount: body.amount, reason: body.reason, tx_id: result.tx_id },
  })).catch(() => {})

  return c.json({ ok: true, tx_id: result.tx_id, remaining_balance: result.remaining_balance })
})

// ── GET /api/network/discover ───────────────────────────────────────────────
// Graph-driven discovery: find organisms by tags, type, or proximity in the graph
network.get('/network/discover', async (c) => {
  const graph = c.get('graph' as never) as GraphPort

  const tag = c.req.query('tag')
  const type = c.req.query('type')
  const limit = parseInt(c.req.query('limit') ?? '20')
  const near = c.req.query('near')  // slug — discover organisms near this node

  if (near) {
    // BFS from a node, return cross-tenant neighbors
    const neighbors = await graph.getNeighbors(near, 2)
    const crossTenantNodes = neighbors.nodes.filter(n =>
      n.tenant && n.tenant !== c.get('tenant_slug') && n.visibility === 'public'
    )

    // Group by tenant
    const tenants = new Map<string, typeof crossTenantNodes>()
    for (const node of crossTenantNodes) {
      const t = node.tenant!
      if (!tenants.has(t)) tenants.set(t, [])
      tenants.get(t)!.push(node)
    }

    return c.json({
      discoveries: Array.from(tenants.entries()).map(([tenant, nodes]) => ({
        tenant,
        nodes: nodes.slice(0, 5),
        connectionStrength: nodes.length,
      })).sort((a, b) => b.connectionStrength - a.connectionStrength).slice(0, limit),
    })
  }

  // Tag/type-based discovery across network
  const data = await graph.queryNetwork({ tag: tag ?? undefined, type: type ?? undefined, limit })

  // Group by tenant
  const tenants = new Map<string, typeof data.nodes>()
  for (const node of data.nodes) {
    const t = node.tenant ?? 'unknown'
    if (!tenants.has(t)) tenants.set(t, [])
    tenants.get(t)!.push(node)
  }

  return c.json({
    discoveries: Array.from(tenants.entries())
      .filter(([t]) => t !== c.get('tenant_slug'))
      .map(([tenant, nodes]) => ({
        tenant,
        nodes: nodes.slice(0, 5),
        tags: [...new Set(nodes.flatMap(n => n.tags))].slice(0, 10),
      })),
  })
})

// ── GET /api/network/reputation ─────────────────────────────────────────────
// Simple reputation score based on graph metrics (backlinks = trust)
network.get('/network/reputation', async (c) => {
  const tenant = c.req.query('tenant') ?? c.get('tenant_slug')
  if (!tenant) return c.json({ error: 'no_tenant' }, 400)

  const graph = c.get('graph' as never) as GraphPort

  // Get all nodes for this tenant
  const nodes = await graph.queryNodes({ tenant, visibility: 'public' })

  // Count inbound cross-tenant edges (backlinks from other organisms)
  let inboundLinks = 0
  for (const node of nodes) {
    const backlinks = await graph.getBacklinks(node.slug, tenant)
    inboundLinks += backlinks.filter(e => e.tenant !== tenant).length
  }

  // Simple score: nodes × 1 + inbound_links × 3
  const score = nodes.length + inboundLinks * 3

  return c.json({
    tenant,
    publicNodes: nodes.length,
    inboundLinks,
    score,
    rank: score > 50 ? 'established' : score > 10 ? 'growing' : 'new',
  })
})

export { network as networkRoutes }
