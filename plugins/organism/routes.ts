import { Hono } from 'hono'
import type { AppBindings } from '../../workers/inkwell-api/src/types'
import type { AgentConfig } from '../../kernel/types'

const organism = new Hono<AppBindings>()

// ── POST /api/organism/activate ─────────────────────────────────────────────
// Provision a managed agent for a tenant. Stores config in D1,
// returns the agent configuration. Anthropic Managed Agent provisioning
// happens asynchronously — status starts as 'provisioning'.
organism.post('/organism/activate', async (c) => {
  const tenant = c.get('tenant_slug')
  if (!tenant) return c.json({ error: 'no_tenant' }, 400)

  const body = await c.req.json<{
    model?: 'haiku' | 'sonnet' | 'opus'
    systemPrompt?: string
    mcpServers?: Array<{ url: string; token?: string }>
    tools?: string[]
    budgetPerDay?: number
    budgetPerMonth?: number
  }>()

  const agent = c.get('agent' as never) as import('../../kernel/types').AgentPort | undefined
  if (!agent) return c.json({ error: 'agent_port_not_configured' }, 503)

  // Check if already provisioned
  const existing = await agent.getConfig(tenant)
  if (existing && existing.status === 'active') {
    return c.json({ error: 'already_active', config: existing }, 409)
  }

  // Default MCP servers: this Inkwell instance + SOS (if configured)
  const defaultMcpServers: Array<{ url: string; token?: string }> = []
  const siteUrl = c.env.SITE_URL
  if (siteUrl) {
    defaultMcpServers.push({ url: `${siteUrl}/mcp/sse`, token: c.env.INKWELL_MCP_TOKEN })
  }
  if (c.env.SOS_BUS_URL) {
    defaultMcpServers.push({ url: c.env.SOS_BUS_URL, token: c.env.MUMEGA_TOKEN })
  }

  // Default system prompt
  const businessName = c.env.BUSINESS_NAME ?? tenant
  const defaultPrompt = `You are the AI operator for ${businessName}. You document the business, manage content, respond to leads, and coordinate with the network. Use your MCP tools to publish content, check the dashboard, manage leads, and communicate via the bus. Be concise, professional, and proactive.`

  const config = await agent.provision({
    tenantId: tenant,
    model: body.model ?? 'haiku',
    systemPrompt: body.systemPrompt ?? defaultPrompt,
    mcpServers: body.mcpServers ?? defaultMcpServers,
    tools: body.tools ?? ['publish_content', 'get_dashboard', 'get_leads', 'site_info', 'send_telegram'],
    budgetPerDay: body.budgetPerDay ?? 500,       // $5/day default
    budgetPerMonth: body.budgetPerMonth ?? 10000,  // $100/month default
    anthropicAgentId: undefined,
  })

  // Notify bus if available
  const bus = c.get('bus' as never) as import('../../kernel/types').BusPort | undefined
  if (bus) {
    await bus.send('mumega', `New organism activated: ${tenant} (model: ${config.model})`)
      .catch(() => {})  // Non-blocking
  }

  return c.json({ ok: true, config })
})

// ── GET /api/organism/config ────────────────────────────────────────────────
organism.get('/organism/config', async (c) => {
  const tenant = c.get('tenant_slug')
  if (!tenant) return c.json({ error: 'no_tenant' }, 400)

  const agent = c.get('agent' as never) as import('../../kernel/types').AgentPort | undefined
  if (!agent) return c.json({ error: 'agent_port_not_configured' }, 503)

  const config = await agent.getConfig(tenant)
  if (!config) return c.json({ error: 'not_provisioned' }, 404)

  return c.json(config)
})

// ── PUT /api/organism/config ────────────────────────────────────────────────
organism.put('/organism/config', async (c) => {
  const tenant = c.get('tenant_slug')
  if (!tenant) return c.json({ error: 'no_tenant' }, 400)

  const agent = c.get('agent' as never) as import('../../kernel/types').AgentPort | undefined
  if (!agent) return c.json({ error: 'agent_port_not_configured' }, 503)

  const body = await c.req.json<Partial<Pick<AgentConfig, 'model' | 'systemPrompt' | 'mcpServers' | 'tools' | 'budgetPerDay' | 'budgetPerMonth' | 'status'>>>()
  const updated = await agent.updateConfig(tenant, body)

  return c.json({ ok: true, config: updated })
})

// ── GET /api/organism/usage ─────────────────────────────────────────────────
organism.get('/organism/usage', async (c) => {
  const tenant = c.get('tenant_slug')
  if (!tenant) return c.json({ error: 'no_tenant' }, 400)

  const agent = c.get('agent' as never) as import('../../kernel/types').AgentPort | undefined
  if (!agent) return c.json({ error: 'agent_port_not_configured' }, 503)

  const from = c.req.query('from') ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const to = c.req.query('to') ?? new Date().toISOString().slice(0, 10)

  const usage = await agent.getUsage(tenant, from, to)
  return c.json({ usage })
})

// ── GET /api/organism/budget ────────────────────────────────────────────────
organism.get('/organism/budget', async (c) => {
  const tenant = c.get('tenant_slug')
  if (!tenant) return c.json({ error: 'no_tenant' }, 400)

  const agent = c.get('agent' as never) as import('../../kernel/types').AgentPort | undefined
  if (!agent) return c.json({ error: 'agent_port_not_configured' }, 503)

  const budget = await agent.checkBudget(tenant)
  return c.json(budget)
})

// ── POST /api/organism/usage/record ─────────────────────────────────────────
// Called by the agent runtime to report usage (typically from a webhook/callback)
organism.post('/organism/usage/record', async (c) => {
  const tenant = c.get('tenant_slug')
  if (!tenant) return c.json({ error: 'no_tenant' }, 400)

  const agent = c.get('agent' as never) as import('../../kernel/types').AgentPort | undefined
  if (!agent) return c.json({ error: 'agent_port_not_configured' }, 503)

  const body = await c.req.json<{
    sessionHours?: number
    inputTokens?: number
    outputTokens?: number
    costCents?: number
  }>()

  await agent.recordUsage({
    tenantId: tenant,
    date: new Date().toISOString().slice(0, 10),
    sessionHours: body.sessionHours ?? 0,
    inputTokens: body.inputTokens ?? 0,
    outputTokens: body.outputTokens ?? 0,
    costCents: body.costCents ?? 0,
  })

  return c.json({ ok: true })
})

export { organism as organismRoutes }
