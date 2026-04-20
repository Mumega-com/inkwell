/**
 * MCP (Model Context Protocol) endpoint — Streamable HTTP
 *
 * POST /mcp
 *
 * Implements JSON-RPC 2.0 with MCP methods:
 *   initialize   — handshake
 *   tools/list   — enumerate available tools (collected from all active plugins)
 *   tools/call   — invoke a tool (dispatched to owning plugin's handler)
 *
 * Auth: Bearer token must match INKWELL_MCP_TOKEN env var.
 *
 * Tool definitions live in each plugin's manifest (mcpTools property).
 * The kernel's collectMcpTools() gathers them at runtime.
 */

import { Hono } from 'hono'
import type { AppBindings } from '../types'
import { collectMcpTools } from '../../kernel/plugin-loader'
import { config } from '../../inkwell.config'
import type { McpToolDef } from '../../kernel/types'

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(id: number | string | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result }
}

function err(id: number | string | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } }
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

/** Strip handlers from tool defs for the tools/list response */
function toolsForListing(tools: McpToolDef[]): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
  return tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
}

// ── Route ─────────────────────────────────────────────────────────────────────

const mcpRoutes = new Hono<AppBindings>()

// ── Connection info — returns MCP URL + per-platform config snippets ─────────
// Used by ConnectPanel (Settings) and OnboardingWizard (Step 3).
// Provider-agnostic: derives URL from SITE_URL env or request hostname.
/** Generate a cryptographically random MCP token */
function generateMcpToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return `mcp_${hex}`
}

/** Build platform config snippets for a given MCP URL and token */
function buildPlatformConfigs(mcpUrl: string, token: string | null) {
  const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined

  const claudeConfig = JSON.stringify({
    mcpServers: {
      inkwell: {
        type: 'streamable-http',
        url: mcpUrl,
        ...(authHeader ? { headers: authHeader } : {}),
      },
    },
  }, null, 2)

  const chatgptConfig = JSON.stringify({
    tools: [{
      type: 'mcp',
      server_url: mcpUrl,
      ...(authHeader ? { headers: authHeader } : {}),
    }],
  }, null, 2)

  return [
    {
      platform: 'claude_code',
      label: 'Claude Code',
      config: `# Add to .mcp.json in your project root:\n${claudeConfig}`,
    },
    {
      platform: 'claude_desktop',
      label: 'Claude Desktop',
      config: `# Add to your claude_desktop_config.json:\n${claudeConfig}`,
    },
    {
      platform: 'cursor',
      label: 'Cursor',
      config: `# Add to .cursor/mcp.json in your project:\n${claudeConfig}`,
    },
    {
      platform: 'chatgpt',
      label: 'ChatGPT',
      config: `# In ChatGPT Settings → Connectors → Add MCP server:\n${chatgptConfig}`,
    },
  ]
}

// ── Connection info — returns MCP URL + per-platform config snippets ─────────
mcpRoutes.get('/connect', async (c) => {
  const siteUrl = (c.env.SITE_URL ?? '').replace(/\/$/, '')
  const mcpUrl = siteUrl
    ? `${siteUrl}/mcp`
    : `${new URL(c.req.url).origin}/mcp`

  // Prefer per-tenant token if tenant is resolved and has one
  const tenantSlug = c.get('tenant_slug')
  let token: string | null = c.env.INKWELL_MCP_TOKEN ?? null

  if (tenantSlug) {
    const row = await c.env.DB_CORE.prepare(
      'SELECT token FROM mcp_tokens WHERE tenant_slug = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > datetime(\'now\')) ORDER BY created_at DESC LIMIT 1',
    ).bind(tenantSlug).first<{ token: string }>()
    if (row) token = row.token
  }

  const allTools = collectMcpTools([...config.plugins])
  const platforms = buildPlatformConfigs(mcpUrl, token)

  return c.json({
    mcp_url: mcpUrl,
    token: token ? `${token.slice(0, 8)}${'*'.repeat(token.length - 8)}` : null,
    tools_count: allTools.length,
    tools: allTools.map(t => t.name),
    platforms,
  })
})

// ── Token management — create, list, revoke ──────────────────────────────────

// POST /mcp/tokens — create a new per-tenant token
mcpRoutes.post('/tokens', async (c) => {
  const tenantSlug = c.get('tenant_slug')
  if (!tenantSlug) {
    return c.json({ error: 'tenant_required', message: 'Tenant context required to create MCP tokens' }, 400)
  }

  const body = await c.req.json<{ label?: string; expires_in_days?: number }>().catch(() => ({}))
  const label = (body as Record<string, unknown>).label as string | undefined ?? 'default'
  const expiresInDays = (body as Record<string, unknown>).expires_in_days as number | undefined

  const token = generateMcpToken()
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400000).toISOString().replace('T', ' ').slice(0, 19)
    : null

  await c.env.DB_CORE.prepare(
    'INSERT INTO mcp_tokens (token, tenant_slug, label, expires_at) VALUES (?, ?, ?, ?)',
  ).bind(token, tenantSlug, label, expiresAt).run()

  return c.json({ ok: true, token, label, tenant_slug: tenantSlug, expires_at: expiresAt })
})

// GET /mcp/tokens — list tokens for current tenant
mcpRoutes.get('/tokens', async (c) => {
  const tenantSlug = c.get('tenant_slug')
  if (!tenantSlug) {
    return c.json({ error: 'tenant_required' }, 400)
  }

  const { results } = await c.env.DB_CORE.prepare(
    'SELECT token, label, role, created_at, expires_at, revoked_at FROM mcp_tokens WHERE tenant_slug = ? ORDER BY created_at DESC',
  ).bind(tenantSlug).all<{ token: string; label: string; role: string; created_at: string; expires_at: string | null; revoked_at: string | null }>()

  // Mask tokens in listing — only show prefix
  const tokens = (results ?? []).map(r => ({
    ...r,
    token: `${r.token.slice(0, 8)}${'*'.repeat(r.token.length - 8)}`,
    active: !r.revoked_at && (!r.expires_at || r.expires_at > new Date().toISOString()),
  }))

  return c.json({ tokens })
})

// DELETE /mcp/tokens/:token_prefix — revoke a token by its prefix
mcpRoutes.delete('/tokens/:token_prefix', async (c) => {
  const tenantSlug = c.get('tenant_slug')
  if (!tenantSlug) {
    return c.json({ error: 'tenant_required' }, 400)
  }

  const prefix = c.req.param('token_prefix')
  // Find token by prefix within this tenant
  const row = await c.env.DB_CORE.prepare(
    'SELECT token FROM mcp_tokens WHERE tenant_slug = ? AND token LIKE ? AND revoked_at IS NULL LIMIT 1',
  ).bind(tenantSlug, `${prefix}%`).first<{ token: string }>()

  if (!row) {
    return c.json({ error: 'token_not_found' }, 404)
  }

  await c.env.DB_CORE.prepare(
    'UPDATE mcp_tokens SET revoked_at = datetime(\'now\') WHERE token = ?',
  ).bind(row.token).run()

  // Invalidate KV cache
  await c.env.SESSIONS.put(`mcp_token:${row.token}`, '__revoked__', { expirationTtl: 300 })

  return c.json({ ok: true, revoked: `${row.token.slice(0, 8)}...` })
})

/**
 * Resolve a Bearer token to a tenant slug.
 * Checks: 1) global INKWELL_MCP_TOKEN (no tenant), 2) per-tenant token from DB with KV cache.
 * Returns tenant_slug or null (global token / no token required).
 * Throws 'unauthorized' if a token is required but invalid.
 */
async function resolveMcpToken(
  token: string | null,
  env: AppBindings['Bindings'],
): Promise<{ authorized: boolean; tenant_slug: string | null }> {
  // No token provided
  if (!token) {
    // If global token is configured, require auth
    if (env.INKWELL_MCP_TOKEN) return { authorized: false, tenant_slug: null }
    // No auth required at all
    return { authorized: true, tenant_slug: null }
  }

  // Check global MCP token (backwards compat)
  if (env.INKWELL_MCP_TOKEN && token === env.INKWELL_MCP_TOKEN) {
    return { authorized: true, tenant_slug: null }
  }

  // System tokens (same ones RBAC middleware accepts) have full MCP access
  if (
    (env.PUBLISH_TOKEN && token === env.PUBLISH_TOKEN) ||
    (env.CONTRACT_AUTH_TOKEN && token === env.CONTRACT_AUTH_TOKEN)
  ) {
    return { authorized: true, tenant_slug: null }
  }

  // Check per-tenant token — KV cache first, then DB
  const cacheKey = `mcp_token:${token}`
  const cached = await env.SESSIONS.get(cacheKey)
  if (cached === '__revoked__') return { authorized: false, tenant_slug: null }
  if (cached) return { authorized: true, tenant_slug: cached }

  // DB lookup for dedicated MCP tokens
  const row = await env.DB_CORE.prepare(
    'SELECT tenant_slug FROM mcp_tokens WHERE token = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > datetime(\'now\'))',
  ).bind(token).first<{ tenant_slug: string }>()

  if (row) {
    // Cache positive result (1 hour)
    await env.SESSIONS.put(cacheKey, row.tenant_slug, { expirationTtl: 3600 })
    return { authorized: true, tenant_slug: row.tenant_slug }
  }

  // Fall back to session token — allow admin/owner sessions to use MCP tools
  const sessionRaw = await env.SESSIONS.get(`session:${token}`)
  if (sessionRaw) {
    try {
      const session = JSON.parse(sessionRaw) as { role?: string; customerSlug?: string }
      const adminRoles = new Set(['owner', 'admin'])
      if (session.role && adminRoles.has(session.role)) {
        return { authorized: true, tenant_slug: session.customerSlug ?? null }
      }
    } catch {
      // malformed session — fall through
    }
  }

  // Cache negative result briefly (5 min) to avoid DB hammering
  await env.SESSIONS.put(cacheKey, '__revoked__', { expirationTtl: 300 })
  return { authorized: false, tenant_slug: null }
}

mcpRoutes.post('/', async (c) => {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = c.req.header('Authorization') ?? ''
  const bearerToken = auth.startsWith('Bearer ') ? auth.slice(7) : null

  const { authorized, tenant_slug } = await resolveMcpToken(bearerToken, c.env)
  if (!authorized) {
    return c.json(
      { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized' } } satisfies JsonRpcResponse,
      401,
    )
  }

  // Set tenant context from token if resolved
  if (tenant_slug && !c.get('tenant_slug')) {
    c.set('tenant_slug', tenant_slug)
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

  // Collect all MCP tools from active plugins
  const allTools = collectMcpTools([...config.plugins])

  // ── Method dispatch ───────────────────────────────────────────────────────

  if (rpc.method === 'initialize') {
    return c.json(ok(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'inkwell-mcp', version: '1.0.0' },
    }))
  }

  if (rpc.method === 'tools/list') {
    return c.json(ok(id, { tools: toolsForListing(allTools) }))
  }

  if (rpc.method === 'tools/call') {
    const params = rpc.params as Record<string, unknown> | undefined
    const toolName = typeof params?.name === 'string' ? params.name : ''

    if (!toolName) return c.json(err(id, -32602, 'Invalid params: name required'))

    const tool = allTools.find(t => t.name === toolName)
    if (!tool) return c.json(err(id, -32602, `Unknown tool: ${toolName}`))

    const toolArgs = args(params)

    try {
      const result = await tool.handler(toolArgs, c.env)
      return c.json(ok(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }))
    } catch (e) {
      console.error(`[mcp] tool ${toolName} failed:`, e)
      return c.json(err(id, -32603, 'Internal error'))
    }
  }

  return c.json(err(id, -32601, `Method not found: ${rpc.method}`))
})

export { mcpRoutes }
