/**
 * MCP (Model Context Protocol) endpoint — Streamable HTTP
 *
 * POST /mcp
 *
 * Implements JSON-RPC 2.0 with MCP methods:
 *   initialize   — handshake
 *   tools/list   — enumerate available tools
 *   tools/call   — invoke a tool
 *
 * Auth: Bearer token must match INKWELL_MCP_TOKEN env var.
 */

import { Hono } from 'hono'
import type { AppBindings } from '../types'
import { makeMemoryPort } from '../lib/memory-port'

// ── JSON-RPC types ────────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string | null
  method: string
  params?: unknown
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number | string | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

// ── Tool input schemas (JSON Schema subset) ───────────────────────────────────

interface ToolDef {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

const TOOLS: ToolDef[] = [
  {
    name: 'publish_content',
    description: 'Publish or draft content to Inkwell. Creates a markdown entry stored in KV and indexed in D1.',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Content collection (e.g. blog, case-study)' },
        slug: { type: 'string', description: 'URL slug. Auto-derived from title if omitted.' },
        title: { type: 'string', description: 'Post title (required)' },
        content: { type: 'string', description: 'Markdown body (required)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tag list (max 12)' },
        status: { type: 'string', enum: ['draft', 'published'], description: 'Publish status (default: published)' },
        author: { type: 'string', description: 'Author name (default: agent)' },
        overwrite: { type: 'boolean', description: 'Replace existing slug if true (default: false)' },
      },
      required: ['collection', 'title', 'content'],
    },
  },
  {
    name: 'get_dashboard',
    description: 'Return marketing KPI summary from DB_MARKETING: clicks, impressions, leads, spend, CPL.',
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['7d', '28d', '90d'], description: 'Lookback period (default: 28d)' },
      },
    },
  },
  {
    name: 'get_seo_data',
    description: 'Return Google Search Console snapshot data from DB_MARKETING.',
    inputSchema: {
      type: 'object',
      properties: {
        metric: {
          type: 'string',
          enum: ['queries', 'pages', 'overview'],
          description: 'Which dimension to return (default: overview)',
        },
      },
    },
  },
  {
    name: 'get_leads',
    description: 'Return recent lead events from DB_CORE.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max rows to return (default: 20, max: 100)' },
        status: { type: 'string', description: 'Filter by lead status (optional)' },
      },
    },
  },
  {
    name: 'create_checkout',
    description: 'Create a Stripe checkout session for an Inkwell subscription plan.',
    inputSchema: {
      type: 'object',
      properties: {
        plan: { type: 'string', enum: ['seo', 'seo-ads', 'full'], description: 'Plan identifier' },
        email: { type: 'string', description: 'Customer email address' },
      },
      required: ['plan', 'email'],
    },
  },
  {
    name: 'subscription_status',
    description: 'Return current subscription plan, status, and billing period end for the authenticated user.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'send_telegram',
    description: 'Send a message to the configured Telegram chat via the Inkwell bot.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Message text (Markdown supported)' },
        chat_id: { type: 'string', description: 'Override the default chat ID (optional)' },
      },
      required: ['text'],
    },
  },
  {
    name: 'site_info',
    description: 'Return Inkwell site configuration: name, domain, enabled features and connectors.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  // ── Network tools (require NETWORK_API_URL + NETWORK_TOKEN) ─────────────────
  {
    name: 'remember',
    description: '[Inkwell Network] Store a memory engram for this site. Requires network connection. Returns engram ID.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The memory text to store' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags for categorization' },
      },
      required: ['text'],
    },
  },
  {
    name: 'recall',
    description: '[Inkwell Network] Search memories stored for this site. Requires network connection. Returns matching engrams.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Semantic search query to find relevant memories' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_task',
    description: '[Inkwell Network] Create a task in the network task service for this site. Requires network connection.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description or instructions' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], description: 'Task priority (default: normal)' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Labels for routing (e.g. ["seo", "content"])' },
      },
      required: ['title'],
    },
  },
  {
    name: 'browse_marketplace',
    description: '[Inkwell Network] Browse the network skill marketplace — available agent skills, integrations, and add-ons. Requires network connection.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category (e.g. seo, content, outreach, ops)' },
      },
    },
  },
  {
    name: 'recall_content',
    description: 'Search Mirror memory for previously published content. Use before drafting to detect duplicates or find related articles.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Topic or keywords to search for' },
        limit: { type: 'number', description: 'Max results (default 5)' },
      },
      required: ['query'],
    },
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(id: number | string | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result }
}

function err(id: number | string | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } }
}

function periodDays(period?: unknown): number {
  if (period === '7d') return 7
  if (period === '90d') return 90
  return 28
}

function args(params: unknown): Record<string, unknown> {
  if (params && typeof params === 'object') {
    const p = params as Record<string, unknown>
    if (p.arguments && typeof p.arguments === 'object') {
      return p.arguments as Record<string, unknown>
    }
  }
  return {}
}

// ── Tool handlers ─────────────────────────────────────────────────────────────

async function toolPublishContent(
  env: AppBindings['Bindings'],
  a: Record<string, unknown>,
): Promise<unknown> {
  const title = typeof a.title === 'string' ? a.title.trim() : ''
  const content = typeof a.content === 'string' ? a.content.trim() : ''
  const slug = typeof a.slug === 'string'
    ? a.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
    : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
  const author = typeof a.author === 'string' ? a.author.trim().slice(0, 80) : 'agent'
  const tags = Array.isArray(a.tags)
    ? (a.tags as unknown[]).filter((t): t is string => typeof t === 'string').slice(0, 12)
    : []
  const status = a.status === 'draft' ? 'draft' : 'published'
  const overwrite = a.overwrite === true

  if (!title) return { error: 'title required' }
  if (!content) return { error: 'content required' }
  if (!slug) return { error: 'invalid_slug' }

  if (!overwrite) {
    const existing = await env.CONTENT.get(`meta:${slug}`)
    if (existing) return { error: 'slug_exists', slug, hint: 'Set overwrite:true to replace' }
  }

  const date = new Date().toISOString().slice(0, 10)
  const description = content.replace(/```[\s\S]*?```/g, ' ').replace(/[#*_>\-\[\]`]/g, ' ').trim().slice(0, 220)

  const frontmatter = [
    `title: "${title}"`,
    `date: "${date}"`,
    `author: "${author}"`,
    `tags: [${tags.map(t => `"${t}"`).join(', ')}]`,
    `description: "${description.slice(0, 220)}"`,
    `status: "${status}"`,
  ].join('\n')

  const markdown = `---\n${frontmatter}\n---\n\n${content}`

  await env.CONTENT.put(`post:${slug}`, markdown)
  await env.CONTENT.put(`meta:${slug}`, JSON.stringify({ title, slug, author, tags, description, date, status }))

  await env.DB_ANALYTICS.prepare(
    'INSERT OR REPLACE INTO content_index (slug, title, type, lang, author, tags, description, published_at, updated_at, word_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(slug, title, 'blog', 'en', author, JSON.stringify(tags), description, date, date, content.split(/\s+/).length).run()

  // Fire-and-forget to Mirror — outage must not block publish
  const memory = makeMemoryPort(env.SOS_BUS_URL, env.INKWELL_MCP_TOKEN)
  if (memory) {
    memory.storeContent({
      slug,
      title,
      description,
      tags,
      type: 'blog',
      publishedAt: date,
      url: `/blog/${slug}`,
    }).catch(() => {})
  }

  let deployState = 'manual'
  if (env.CF_PAGES_DEPLOY_HOOK) {
    try {
      const resp = await fetch(env.CF_PAGES_DEPLOY_HOOK, { method: 'POST' })
      deployState = resp.ok ? 'triggered' : `trigger_failed_${resp.status}`
    } catch {
      deployState = 'trigger_failed'
    }
  }

  return { ok: true, slug, status, url: `${env.SITE_URL}/blog/${slug}`, deploy: deployState }
}

async function toolGetDashboard(
  env: AppBindings['Bindings'],
  a: Record<string, unknown>,
): Promise<unknown> {
  const days = periodDays(a.period)

  const row = await env.DB_MARKETING.prepare(
    `SELECT
       SUM(clicks)      AS clicks,
       SUM(impressions) AS impressions,
       SUM(leads)       AS leads,
       SUM(spend)       AS spend
     FROM marketing_snapshots
     WHERE date >= date('now', '-${days} days')`
  ).first<{ clicks: number | null; impressions: number | null; leads: number | null; spend: number | null }>()

  const clicks = row?.clicks ?? 0
  const impressions = row?.impressions ?? 0
  const leads = row?.leads ?? 0
  const spend = Number(row?.spend ?? 0)

  return {
    period: `${days}d`,
    clicks,
    impressions,
    leads,
    spend: Number(spend.toFixed(2)),
    cpl: leads > 0 ? Number((spend / leads).toFixed(2)) : null,
    ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : null,
  }
}

async function toolGetSeoData(
  env: AppBindings['Bindings'],
  a: Record<string, unknown>,
): Promise<unknown> {
  const metric = typeof a.metric === 'string' ? a.metric : 'overview'

  if (metric === 'queries') {
    const rows = await env.DB_MARKETING.prepare(
      `SELECT query, clicks, impressions, ctr, position
       FROM gsc_queries
       ORDER BY clicks DESC
       LIMIT 25`
    ).all<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>()
    return { metric: 'queries', rows: rows.results }
  }

  if (metric === 'pages') {
    const rows = await env.DB_MARKETING.prepare(
      `SELECT page, clicks, impressions, ctr, position
       FROM gsc_pages
       ORDER BY clicks DESC
       LIMIT 25`
    ).all<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>()
    return { metric: 'pages', rows: rows.results }
  }

  // overview — aggregate from marketing_snapshots
  const row = await env.DB_MARKETING.prepare(
    `SELECT
       SUM(clicks)      AS clicks,
       SUM(impressions) AS impressions,
       AVG(position)    AS avg_position
     FROM marketing_snapshots
     WHERE date >= date('now', '-28 days')`
  ).first<{ clicks: number | null; impressions: number | null; avg_position: number | null }>()

  return {
    metric: 'overview',
    period: '28d',
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    avg_position: row?.avg_position != null ? Number(row.avg_position.toFixed(1)) : null,
  }
}

async function toolGetLeads(
  env: AppBindings['Bindings'],
  a: Record<string, unknown>,
): Promise<unknown> {
  const rawLimit = typeof a.limit === 'number' ? a.limit : 20
  const limit = Math.min(Math.max(1, rawLimit), 100)
  const status = typeof a.status === 'string' ? a.status : null

  const query = status
    ? `SELECT id, email, source, status, created_at FROM lead_events WHERE status = ? ORDER BY created_at DESC LIMIT ${limit}`
    : `SELECT id, email, source, status, created_at FROM lead_events ORDER BY created_at DESC LIMIT ${limit}`

  const stmt = status
    ? env.DB_CORE.prepare(query).bind(status)
    : env.DB_CORE.prepare(query)

  const rows = await stmt.all<{ id: string; email: string; source: string; status: string; created_at: string }>()

  return { total: rows.results.length, leads: rows.results }
}

async function toolCreateCheckout(
  env: AppBindings['Bindings'],
  a: Record<string, unknown>,
): Promise<unknown> {
  const plan = typeof a.plan === 'string' ? a.plan : ''
  const email = typeof a.email === 'string' ? a.email.trim() : ''

  if (!['seo', 'seo-ads', 'full'].includes(plan)) return { error: 'invalid_plan' }
  if (!email || !email.includes('@')) return { error: 'valid_email_required' }
  if (!env.STRIPE_SECRET_KEY) return { error: 'stripe_not_configured' }

  const priceMap: Record<string, string | undefined> = {
    seo: env.STRIPE_PRICE_SEO,
    'seo-ads': env.STRIPE_PRICE_SEO_ADS,
    full: env.STRIPE_PRICE_FULL,
  }
  const priceId = priceMap[plan]
  if (!priceId) return { error: 'plan_not_configured' }

  const siteUrl = env.SITE_URL ?? ''
  const params = new URLSearchParams()
  params.append('mode', 'subscription')
  params.append('payment_method_types[]', 'card')
  params.append('line_items[0][price]', priceId)
  params.append('line_items[0][quantity]', '1')
  params.append('customer_email', email.toLowerCase())
  params.append('metadata[plan]', plan)
  params.append('success_url', `${siteUrl}/portal/welcome?session_id={CHECKOUT_SESSION_ID}`)
  params.append('cancel_url', `${siteUrl}/pricing`)
  params.append('allow_promotion_codes', 'true')

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })
    const data = await res.json() as { id?: string; url?: string; error?: { message: string } }
    if (!res.ok || data.error) return { error: 'checkout_failed', detail: data.error?.message }
    return { ok: true, url: data.url }
  } catch {
    return { error: 'stripe_unreachable' }
  }
}

async function toolSubscriptionStatus(
  env: AppBindings['Bindings'],
): Promise<unknown> {
  // Look up the tenant's primary subscription from portal_accounts.
  // MCP calls are authenticated via INKWELL_MCP_TOKEN (per-deployment secret),
  // so we return the subscription for this Inkwell instance's primary account.
  const account = await env.DB_CORE.prepare(
    `SELECT status, metadata_json
     FROM portal_accounts
     WHERE json_extract(metadata_json, '$.stripe_subscription') IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 1`
  ).first<{ status: string; metadata_json: string | null }>()

  if (!account) {
    return {
      status: 'free',
      message: 'No active subscription. Visit the dashboard to upgrade.',
    }
  }

  let metadata: Record<string, unknown> = {}
  if (account.metadata_json) {
    try {
      metadata = JSON.parse(account.metadata_json) as Record<string, unknown>
    } catch {
      // ignore parse failure — return cached account status below
    }
  }

  const stripeSubscriptionId = typeof metadata.stripe_subscription === 'string'
    ? metadata.stripe_subscription
    : null

  if (!stripeSubscriptionId || !env.STRIPE_SECRET_KEY) {
    return {
      plan: metadata.plan ?? null,
      status: account.status,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    }
  }

  // Fetch live data from Stripe
  try {
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${stripeSubscriptionId}`, {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    })

    if (!res.ok) {
      // Stripe returned an error — fall back to cached data
      return {
        plan: metadata.plan ?? null,
        status: account.status,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      }
    }

    const sub = await res.json() as {
      status: string
      current_period_end: number
      cancel_at_period_end: boolean
      items: { data: Array<{ price: { id: string; nickname: string | null } }> }
    }

    return {
      plan: metadata.plan ?? null,
      status: sub.status,
      currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    }
  } catch {
    // Network error — return cached data
    return {
      plan: metadata.plan ?? null,
      status: account.status,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    }
  }
}

async function toolSendTelegram(
  env: AppBindings['Bindings'],
  a: Record<string, unknown>,
): Promise<unknown> {
  const token = env.TELEGRAM_BOT_TOKEN
  if (!token) return { error: 'telegram_not_configured' }

  const text = typeof a.text === 'string' ? a.text.trim() : ''
  if (!text) return { error: 'text required' }

  const chatId = typeof a.chat_id === 'string' ? a.chat_id : env.TELEGRAM_CHAT_ID
  if (!chatId) return { error: 'no_chat_id_configured' }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
    const data = await res.json() as { ok: boolean; description?: string }
    if (!data.ok) return { error: 'telegram_error', description: data.description }
    return { ok: true }
  } catch {
    return { error: 'telegram_unreachable' }
  }
}

function toolSiteInfo(env: AppBindings['Bindings']): unknown {
  return {
    site_url: env.SITE_URL,
    features: {
      analytics: true,
      reactions: true,
      subscriptions: true,
      publishing: true,
      telegram: Boolean(env.TELEGRAM_BOT_TOKEN),
      payments: Boolean(env.STRIPE_SECRET_KEY),
      sos_bus: Boolean(env.SOS_BUS_URL),
      pages_deploy_hook: Boolean(env.CF_PAGES_DEPLOY_HOOK),
    },
  }
}

// ── Network tool helpers ──────────────────────────────────────────────────────

const NETWORK_REQUIRED_ERROR = (feature: string) => ({
  error: 'network_required',
  message: `Connect a network API for ${feature}. Add SOS_SAAS_URL and NETWORK_TOKEN to your Worker env.`,
})

async function mumegaPost(
  env: AppBindings['Bindings'],
  path: string,
  body: unknown,
): Promise<unknown> {
  const baseUrl = env.SOS_SAAS_URL ?? env.NETWORK_API_URL
  if (!baseUrl) return NETWORK_REQUIRED_ERROR('network POST')
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.NETWORK_TOKEN ?? ''}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { error: 'network_error', status: res.status, detail: text.slice(0, 300) }
    }
    return await res.json()
  } catch {
    return { error: 'network_unreachable', message: 'Could not reach the configured network API. Check SOS_SAAS_URL and network connectivity.' }
  }
}

async function mumegaGet(
  env: AppBindings['Bindings'],
  path: string,
): Promise<unknown> {
  const baseUrl = env.SOS_SAAS_URL ?? env.NETWORK_API_URL
  if (!baseUrl) return NETWORK_REQUIRED_ERROR('network GET')
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${env.NETWORK_TOKEN ?? ''}` },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { error: 'network_error', status: res.status, detail: text.slice(0, 300) }
    }
    return await res.json()
  } catch {
    return { error: 'network_unreachable', message: 'Could not reach the configured network API. Check SOS_SAAS_URL and network connectivity.' }
  }
}

async function toolRemember(
  env: AppBindings['Bindings'],
  a: Record<string, unknown>,
): Promise<unknown> {
  if (!env.SOS_SAAS_URL && !env.NETWORK_API_URL) return NETWORK_REQUIRED_ERROR('memory (remember/recall)')

  const text = typeof a.text === 'string' ? a.text.trim() : ''
  if (!text) return { error: 'text required' }

  const tags = Array.isArray(a.tags)
    ? (a.tags as unknown[]).filter((t): t is string => typeof t === 'string')
    : []

  // tenantSlug derived from SITE_URL hostname, or fallback to "inkwell"
  const tenantSlug = env.SITE_URL
    ? new URL(env.SITE_URL).hostname.replace(/\./g, '-')
    : 'inkwell'

  return mumegaPost(env, '/mcp/remember', { agent: tenantSlug, text, tags })
}

async function toolRecall(
  env: AppBindings['Bindings'],
  a: Record<string, unknown>,
): Promise<unknown> {
  if (!env.SOS_SAAS_URL && !env.NETWORK_API_URL) return NETWORK_REQUIRED_ERROR('memory (remember/recall)')

  const query = typeof a.query === 'string' ? a.query.trim() : ''
  if (!query) return { error: 'query required' }

  const tenantSlug = env.SITE_URL
    ? new URL(env.SITE_URL).hostname.replace(/\./g, '-')
    : 'inkwell'

  return mumegaPost(env, '/mcp/recall', { agent: tenantSlug, query })
}

async function toolCreateTask(
  env: AppBindings['Bindings'],
  a: Record<string, unknown>,
): Promise<unknown> {
  if (!env.SOS_SAAS_URL && !env.NETWORK_API_URL) return NETWORK_REQUIRED_ERROR('task management')

  const title = typeof a.title === 'string' ? a.title.trim() : ''
  if (!title) return { error: 'title required' }

  const description = typeof a.description === 'string' ? a.description.trim() : ''
  const priority = ['low', 'normal', 'high', 'urgent'].includes(a.priority as string)
    ? (a.priority as string)
    : 'normal'
  const labels = Array.isArray(a.labels)
    ? (a.labels as unknown[]).filter((l): l is string => typeof l === 'string')
    : []

  const tenantSlug = env.SITE_URL
    ? new URL(env.SITE_URL).hostname.replace(/\./g, '-')
    : 'inkwell'

  return mumegaPost(env, '/mcp/task', { title, description, priority, labels, source: tenantSlug })
}

async function toolBrowseMarketplace(
  env: AppBindings['Bindings'],
  a: Record<string, unknown>,
): Promise<unknown> {
  if (!env.SOS_SAAS_URL && !env.NETWORK_API_URL) return NETWORK_REQUIRED_ERROR('marketplace')

  const category = typeof a.category === 'string' ? a.category.trim() : ''
  const path = category ? `/mcp/marketplace?category=${encodeURIComponent(category)}` : '/mcp/marketplace'
  return mumegaGet(env, path)
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

async function callTool(
  env: AppBindings['Bindings'],
  name: string,
  a: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'publish_content': return toolPublishContent(env, a)
    case 'get_dashboard': return toolGetDashboard(env, a)
    case 'get_seo_data': return toolGetSeoData(env, a)
    case 'get_leads': return toolGetLeads(env, a)
    case 'create_checkout': return toolCreateCheckout(env, a)
    case 'subscription_status': return toolSubscriptionStatus(env)
    case 'send_telegram': return toolSendTelegram(env, a)
    case 'site_info': return toolSiteInfo(env)
    // Network tools
    case 'remember': return toolRemember(env, a)
    case 'recall': return toolRecall(env, a)
    case 'create_task': return toolCreateTask(env, a)
    case 'browse_marketplace': return toolBrowseMarketplace(env, a)
    case 'recall_content': {
      const memory = makeMemoryPort(env.SOS_BUS_URL, env.INKWELL_MCP_TOKEN)
      if (!memory) return { content: [{ type: 'text', text: 'Memory not configured' }] }
      const results = await memory.recallContent(a.query as string, (a.limit as number) ?? 5)
      return {
        content: [{
          type: 'text',
          text: results.length
            ? results.map(r => `[${r.score.toFixed(2)}] ${r.text}`).join('\n')
            : 'No related content found in memory.',
        }],
      }
    }
    default: return null
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

const mcpRoutes = new Hono<AppBindings>()

mcpRoutes.post('/', async (c) => {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const mcpToken = c.env.INKWELL_MCP_TOKEN
  if (mcpToken) {
    const auth = c.req.header('Authorization') ?? ''
    if (auth !== `Bearer ${mcpToken}`) {
      return c.json(
        { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized' } } satisfies JsonRpcResponse,
        401,
      )
    }
  }

  // ── Parse request ─────────────────────────────────────────────────────────
  let rpc: JsonRpcRequest
  try {
    rpc = await c.req.json() as JsonRpcRequest
  } catch {
    return c.json(err(null, -32700, 'Parse error'))
  }

  if (rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') {
    return c.json(err(rpc?.id ?? null, -32600, 'Invalid Request'))
  }

  const id = rpc.id ?? null

  // ── Method dispatch ───────────────────────────────────────────────────────

  if (rpc.method === 'initialize') {
    return c.json(ok(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'inkwell-mcp', version: '1.0.0' },
    }))
  }

  if (rpc.method === 'tools/list') {
    return c.json(ok(id, { tools: TOOLS }))
  }

  if (rpc.method === 'tools/call') {
    const params = rpc.params as Record<string, unknown> | undefined
    const toolName = typeof params?.name === 'string' ? params.name : ''

    if (!toolName) return c.json(err(id, -32602, 'Invalid params: name required'))

    const knownTool = TOOLS.find(t => t.name === toolName)
    if (!knownTool) return c.json(err(id, -32602, `Unknown tool: ${toolName}`))

    const toolArgs = args(params)

    try {
      const result = await callTool(c.env, toolName, toolArgs)
      return c.json(ok(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }))
    } catch (e) {
      console.error(`[mcp] tool ${toolName} failed:`, e)
      return c.json(err(id, -32603, 'Internal error'))
    }
  }

  return c.json(err(id, -32601, `Method not found: ${rpc.method}`))
})

export { mcpRoutes }
