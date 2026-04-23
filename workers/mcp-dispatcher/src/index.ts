import { Hono } from 'hono'

type Env = {
  SESSIONS: KVNamespace
  SOS_ORIGIN: string
}

const app = new Hono<{ Bindings: Env }>()

// ─── Session fingerprinting ────────────────────────────────────────────────

async function fingerprint(token: string, ip: string, ua: string): Promise<string> {
  const raw = `${token}:${ip}:${ua}`
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

function inferPlatform(ua: string, headers: Headers): string {
  const u = ua.toLowerCase()
  if (u.includes('claude-code') || u.includes('claude_code')) return 'claude-code'
  if (u.includes('claude')) return 'claude-desktop'
  if (u.includes('cursor')) return 'cursor'
  if (u.includes('openai') || u.includes('chatgpt')) return 'chatgpt'
  if (u.includes('codex')) return 'codex'
  if (u.includes('perplexity')) return 'perplexity'
  if (u.includes('antigravity')) return 'antigravity'
  const sosClient = headers.get('x-sos-client')
  if (sosClient) return sosClient
  return 'unknown'
}

interface SessionProfile {
  session_id: string
  token_prefix: string      // first 12 chars only — never store full token
  agent: string
  platform: string
  ip: string
  connected_at: string
  last_seen: string
  connection_count: number
}

async function registerSession(
  env: Env,
  sessionId: string,
  agent: string,
  platform: string,
  ip: string,
  tokenPrefix: string
): Promise<SessionProfile> {
  const key = `session:${sessionId}`
  const existing = await env.SESSIONS.get<SessionProfile>(key, 'json')

  const now = new Date().toISOString()
  const profile: SessionProfile = existing
    ? { ...existing, last_seen: now, connection_count: (existing.connection_count || 1) + 1 }
    : {
        session_id: sessionId,
        token_prefix: tokenPrefix,
        agent,
        platform,
        ip,
        connected_at: now,
        last_seen: now,
        connection_count: 1,
      }

  await env.SESSIONS.put(key, JSON.stringify(profile), { expirationTtl: 86400 * 30 })

  // index by agent for lookups — cap at 50 entries
  const agentKey = `agent:${agent}:sessions`
  const agentSessions: string[] = (await env.SESSIONS.get<string[]>(agentKey, 'json')) ?? []
  if (!agentSessions.includes(sessionId)) {
    agentSessions.push(sessionId)
    await env.SESSIONS.put(agentKey, JSON.stringify(agentSessions.slice(-50)))
  }

  return profile
}

// ─── Token → agent name resolution ────────────────────────────────────────
// Token verification stays on the VPS. We only extract the agent name from
// the well-known format:  sk-{agent}-{hex}  or  sk-{project}-{hex}
// The full token is never stored — only the first 12 chars as token_prefix.

function agentFromToken(token: string): string {
  const match = token.match(/^sk-([a-z][a-z0-9-]*)-[0-9a-f]+$/)
  if (match) return match[1]
  return 'unknown'
}

// ─── SSE / HTTP proxy ──────────────────────────────────────────────────────

async function proxySSE(req: Request, env: Env, sessionId: string): Promise<Response> {
  const url = new URL(req.url)
  const originUrl = `${env.SOS_ORIGIN}${url.pathname}${url.search}`

  // Build forwarded headers; add session id and real IP for VPS logging.
  const forwardedHeaders = new Headers(req.headers)
  forwardedHeaders.set('X-Session-Id', sessionId)
  const realIp = req.headers.get('CF-Connecting-IP')
  if (realIp) forwardedHeaders.set('X-Forwarded-For', realIp)

  const originReq = new Request(originUrl, {
    method: req.method,
    headers: forwardedHeaders,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    // preserve duplex for streaming request bodies (POST SSE)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(req.body ? { duplex: 'half' } as any : {}),
  })

  return fetch(originReq)
}

// ─── Routes ────────────────────────────────────────────────────────────────

// Health check — no auth required
app.get('/health', (c) =>
  c.json({ status: 'ok', service: 'mcp-dispatcher', ts: new Date().toISOString() })
)

// Session info — internal tooling
app.get('/sessions/:sessionId', async (c) => {
  const profile = await c.env.SESSIONS.get<SessionProfile>(
    `session:${c.req.param('sessionId')}`,
    'json'
  )
  if (!profile) return c.json({ error: 'not found' }, 404)
  return c.json(profile)
})

// Agent session list — internal tooling
app.get('/agents/:agent/sessions', async (c) => {
  const sessions =
    (await c.env.SESSIONS.get<string[]>(`agent:${c.req.param('agent')}:sessions`, 'json')) ?? []
  return c.json({ agent: c.req.param('agent'), sessions })
})

// ─── MCP SSE endpoint  (primary path used by all clients) ─────────────────
// URL pattern: mcp.mumega.com/sse/{token}
app.all('/sse/:token', async (c) => {
  const token = c.req.param('token')
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const ua = c.req.header('User-Agent') ?? ''
  const platform = inferPlatform(ua, c.req.raw.headers)
  const agent = agentFromToken(token)
  const sessionId = await fingerprint(token, ip, ua)

  await registerSession(c.env, sessionId, agent, platform, ip, token.slice(0, 12))

  return proxySSE(c.req.raw, c.env, sessionId)
})

// ─── MCP JSON-RPC endpoint  (stateless callers, e.g. REST bridges) ────────
// URL pattern: mcp.mumega.com/mcp/{token}/rpc
app.all('/mcp/:token/rpc', async (c) => {
  const token = c.req.param('token')
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const ua = c.req.header('User-Agent') ?? ''
  const platform = inferPlatform(ua, c.req.raw.headers)
  const agent = agentFromToken(token)
  const sessionId = await fingerprint(token, ip, ua)

  await registerSession(c.env, sessionId, agent, platform, ip, token.slice(0, 12))

  return proxySSE(c.req.raw, c.env, sessionId)
})

// ─── Catch-all passthrough  (any other MCP paths, no session tracking) ────
app.all('*', async (c) => proxySSE(c.req.raw, c.env, 'passthrough'))

export default { fetch: app.fetch }
