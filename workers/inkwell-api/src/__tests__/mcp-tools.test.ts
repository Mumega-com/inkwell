import { describe, it, expect, beforeAll } from 'vitest'
import { env, exports } from 'cloudflare:workers'

const BASE = 'http://localhost'

/**
 * System token that bypasses RBAC — matches PUBLISH_TOKEN in wrangler.toml [vars].
 */
const SYSTEM_AUTH_HEADER = 'Bearer dev-inkwell-local-test-token-do-not-use-in-prod'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function mcpRequest(body: unknown): Promise<Response> {
  return exports.default.fetch(
    new Request(`${BASE}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SYSTEM_AUTH_HEADER,
      },
      body: JSON.stringify(body),
    }),
  )
}

async function callTool(name: string, args: Record<string, unknown>): Promise<Response> {
  return mcpRequest({
    jsonrpc: '2.0',
    method: 'tools/call',
    id: 1,
    params: { name, arguments: args },
  })
}

/** Parse the tool result text out of the MCP envelope. */
function toolResult(body: { result?: { content?: Array<{ text?: string }> } }): unknown {
  const text = body.result?.content?.[0]?.text
  if (typeof text !== 'string') return undefined
  return JSON.parse(text) as unknown
}

/** Seed the DB_MARKETING tables required by dashboard queries. */
async function seedMarketingTables(): Promise<void> {
  await env.DB_MARKETING.prepare(
    `CREATE TABLE IF NOT EXISTS marketing_snapshots (
      id TEXT PRIMARY KEY,
      clicks INTEGER DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      leads INTEGER DEFAULT 0,
      spend REAL DEFAULT 0,
      date TEXT DEFAULT CURRENT_DATE
    )`,
  ).run()

  await env.DB_MARKETING.prepare(
    `CREATE TABLE IF NOT EXISTS gsc_queries (
      id TEXT PRIMARY KEY,
      query TEXT,
      clicks INTEGER DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      ctr REAL DEFAULT 0,
      position REAL DEFAULT 0
    )`,
  ).run()

  await env.DB_MARKETING.prepare(
    `CREATE TABLE IF NOT EXISTS gsc_pages (
      id TEXT PRIMARY KEY,
      page TEXT,
      clicks INTEGER DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      ctr REAL DEFAULT 0,
      position REAL DEFAULT 0
    )`,
  ).run()
}

/** Seed the content_index table in DB_ANALYTICS (needed by publish_content). */
async function seedAnalyticsTables(): Promise<void> {
  await env.DB_ANALYTICS.prepare(
    `CREATE TABLE IF NOT EXISTS content_index (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT DEFAULT 'blog',
      lang TEXT DEFAULT 'en',
      author TEXT DEFAULT 'agent',
      tags TEXT DEFAULT '[]',
      description TEXT DEFAULT '',
      published_at TEXT,
      updated_at TEXT,
      word_count INTEGER DEFAULT 0
    )`,
  ).run()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MCP endpoint', () => {
  beforeAll(async () => {
    await seedMarketingTables()
    await seedAnalyticsTables()
    // SEO tables — required by edge-seo middleware on every request
    await env.DB_CORE.prepare(
      'CREATE TABLE IF NOT EXISTS seo_redirects (id TEXT PRIMARY KEY, from_path TEXT NOT NULL, to_path TEXT NOT NULL, status_code INTEGER NOT NULL DEFAULT 301, tenant TEXT, created_at TEXT NOT NULL DEFAULT (datetime(\'now\')), UNIQUE(from_path, tenant))'
    ).run()
    await env.DB_CORE.prepare(
      'CREATE TABLE IF NOT EXISTS crawl_logs (id TEXT PRIMARY KEY, path TEXT NOT NULL, user_agent TEXT NOT NULL, bot_name TEXT NOT NULL, status_code INTEGER NOT NULL DEFAULT 200, tenant TEXT, timestamp TEXT NOT NULL DEFAULT (datetime(\'now\')))'
    ).run()
    await env.DB_CORE.prepare(
      'CREATE TABLE IF NOT EXISTS seo_meta_overrides (path TEXT NOT NULL, title TEXT, description TEXT, og_image TEXT, robots TEXT, canonical TEXT, tenant TEXT, PRIMARY KEY(path, tenant))'
    ).run()
    // MCP tokens — per-tenant token auth
    await env.DB_CORE.prepare(
      'CREATE TABLE IF NOT EXISTS mcp_tokens (token TEXT PRIMARY KEY, tenant_slug TEXT NOT NULL, label TEXT NOT NULL DEFAULT \'default\', role TEXT NOT NULL DEFAULT \'admin\', created_at TEXT NOT NULL DEFAULT (datetime(\'now\')), expires_at TEXT, revoked_at TEXT)'
    ).run()
    // Visitor profiles — required by visitor-profile middleware
    await env.DB_ANALYTICS.prepare(
      'CREATE TABLE IF NOT EXISTS visitor_profiles (visitor_hash TEXT PRIMARY KEY, first_seen TEXT NOT NULL DEFAULT (datetime(\'now\')), last_seen TEXT NOT NULL DEFAULT (datetime(\'now\')), visit_count INTEGER NOT NULL DEFAULT 1, utm_first_source TEXT, utm_first_medium TEXT, utm_first_campaign TEXT, utm_last_source TEXT, utm_last_medium TEXT, utm_last_campaign TEXT, portal_account_id TEXT, email TEXT, total_events INTEGER NOT NULL DEFAULT 0, total_page_views INTEGER NOT NULL DEFAULT 0, last_event_name TEXT, last_path TEXT, country TEXT, device TEXT, tenant TEXT, properties TEXT)'
    ).run()
  })

  // ── 1. tools/list ───────────────────────────────────────────────────────────

  describe('tools/list', () => {
    it('returns an array of 12+ tools with name and description', async () => {
      const res = await mcpRequest({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1,
      })

      expect(res.status).toBe(200)

      const body = await res.json<{
        jsonrpc: string
        id: number
        result: { tools: Array<{ name: string; description: string }> }
      }>()

      expect(body.jsonrpc).toBe('2.0')
      expect(body.id).toBe(1)
      expect(Array.isArray(body.result.tools)).toBe(true)
      expect(body.result.tools.length).toBeGreaterThanOrEqual(12)

      for (const tool of body.result.tools) {
        expect(typeof tool.name).toBe('string')
        expect(tool.name.length).toBeGreaterThan(0)
        expect(typeof tool.description).toBe('string')
        expect(tool.description.length).toBeGreaterThan(0)
      }

      // Check specific expected tool names
      const names = body.result.tools.map((t) => t.name)
      expect(names).toContain('publish_content')
      expect(names).toContain('get_dashboard')
      expect(names).toContain('site_info')
      expect(names).toContain('remember')
      expect(names).toContain('recall')
      expect(names).toContain('squad_remember')
      expect(names).toContain('squad_recall')
      expect(names).toContain('create_task')
      expect(names).toContain('browse_marketplace')
    })
  })

  // ── 2. publish_content ──────────────────────────────────────────────────────

  describe('publish_content', () => {
    it('publishes content and returns ok + slug', async () => {
      const res = await callTool('publish_content', {
        collection: 'blog',
        title: 'MCP Test Post',
        content: 'This is test content written via MCP tool call.',
        author: 'vitest',
      })

      expect(res.status).toBe(200)

      const body = await res.json<{
        result?: { content?: Array<{ text?: string }> }
        error?: unknown
      }>()

      expect(body.error).toBeUndefined()

      const result = toolResult(body) as { ok?: boolean; slug?: string }
      expect(result.ok).toBe(true)
      expect(result.slug).toBe('mcp-test-post')
    })

    it('stores content in KV so it can be retrieved', async () => {
      // Ensure post was actually stored from the test above
      const stored = await env.CONTENT.get('post:mcp-test-post')
      expect(stored).not.toBeNull()
      expect(stored).toContain('MCP Test Post')
    })

    it('returns slug_exists error on duplicate without overwrite', async () => {
      const res = await callTool('publish_content', {
        collection: 'blog',
        title: 'MCP Test Post',
        content: 'Duplicate content attempt.',
      })

      expect(res.status).toBe(200)

      const body = await res.json<{ result?: { content?: Array<{ text?: string }> } }>()
      const result = toolResult(body) as { error?: string }
      expect(result.error).toBe('slug_exists')
    })

    it('succeeds with overwrite:true for existing slug', async () => {
      const res = await callTool('publish_content', {
        collection: 'blog',
        title: 'MCP Test Post',
        content: 'Overwritten content via MCP.',
        overwrite: true,
      })

      expect(res.status).toBe(200)

      const body = await res.json<{ result?: { content?: Array<{ text?: string }> } }>()
      const result = toolResult(body) as { ok?: boolean; slug?: string }
      expect(result.ok).toBe(true)
    })

    it('returns error for missing title', async () => {
      const res = await callTool('publish_content', {
        collection: 'blog',
        content: 'No title provided.',
      })

      expect(res.status).toBe(200)

      const body = await res.json<{ result?: { content?: Array<{ text?: string }> } }>()
      const result = toolResult(body) as { error?: string }
      expect(result.error).toBe('title required')
    })
  })

  // ── 3. site_info ────────────────────────────────────────────────────────────

  describe('site_info', () => {
    it('returns site_url and features object', async () => {
      const res = await callTool('site_info', {})

      expect(res.status).toBe(200)

      const body = await res.json<{ result?: { content?: Array<{ text?: string }> } }>()
      const result = toolResult(body) as {
        site_url?: string
        features?: Record<string, boolean>
      }

      // site_url comes from wrangler.toml SITE_URL var (defaults to "https://example.com")
      expect(typeof result.site_url).toBe('string')

      // features should be a flat object of booleans
      expect(result.features).toBeDefined()
      expect(typeof result.features).toBe('object')

      // Core features that are always true
      expect(result.features!.analytics).toBe(true)
      expect(result.features!.reactions).toBe(true)
      expect(result.features!.publishing).toBe(true)
      expect(result.features!.subscriptions).toBe(true)
    })
  })

  // ── 4. get_dashboard ────────────────────────────────────────────────────────

  describe('get_dashboard', () => {
    it('returns dashboard data without error (empty DB is fine)', async () => {
      const res = await callTool('get_dashboard', {})

      expect(res.status).toBe(200)

      const body = await res.json<{
        result?: { content?: Array<{ text?: string }> }
        error?: unknown
      }>()

      // Should not return a JSON-RPC error
      expect(body.error).toBeUndefined()

      const result = toolResult(body) as {
        period?: string
        clicks?: number
        impressions?: number
        leads?: number
        spend?: number
      }

      // Result should have the KPI fields (zeros are fine for empty DB)
      expect(typeof result.period).toBe('string')
      expect(typeof result.clicks).toBe('number')
      expect(typeof result.impressions).toBe('number')
      expect(typeof result.leads).toBe('number')
      expect(typeof result.spend).toBe('number')
    })

    it('accepts period parameter', async () => {
      const res = await callTool('get_dashboard', { period: '7d' })
      expect(res.status).toBe(200)

      const body = await res.json<{ result?: { content?: Array<{ text?: string }> } }>()
      const result = toolResult(body) as { period?: string }
      expect(result.period).toBe('7d')
    })
  })

  // ── 5. remember without NETWORK_API_URL ─────────────────────────────────────

  describe('network tools without NETWORK_API_URL', () => {
    it('returns network_required error for remember', async () => {
      // In the test environment, NETWORK_API_URL and NETWORK_TOKEN are not set.
      // The tool should reject with the network_required error.
      const res = await callTool('remember', { text: 'Test memory entry' })

      expect(res.status).toBe(200)

      const body = await res.json<{ result?: { content?: Array<{ text?: string }> } }>()
      const result = toolResult(body) as { error?: string; message?: string }

      expect(result.error).toBe('network_required')
      expect(typeof result.message).toBe('string')
      expect(result.message).toContain('network')
    })

    it('returns network_required error for recall', async () => {
      const res = await callTool('recall', { query: 'test query' })
      expect(res.status).toBe(200)

      const body = await res.json<{ result?: { content?: Array<{ text?: string }> } }>()
      const result = toolResult(body) as { error?: string }
      expect(result.error).toBe('network_required')
    })

    it('returns network_required error for squad_remember', async () => {
      const res = await callTool('squad_remember', { squad_id: 'alpha', text: 'Test squad memory entry' })
      expect(res.status).toBe(200)

      const body = await res.json<{ result?: { content?: Array<{ text?: string }> } }>()
      const result = toolResult(body) as { error?: string }
      expect(result.error).toBe('network_required')
    })

    it('returns network_required error for squad_recall', async () => {
      const res = await callTool('squad_recall', { squad_id: 'alpha', query: 'test query' })
      expect(res.status).toBe(200)

      const body = await res.json<{ result?: { content?: Array<{ text?: string }> } }>()
      const result = toolResult(body) as { error?: string }
      expect(result.error).toBe('network_required')
    })

    it('returns network_required error for create_task', async () => {
      const res = await callTool('create_task', { title: 'Test task' })
      expect(res.status).toBe(200)

      const body = await res.json<{ result?: { content?: Array<{ text?: string }> } }>()
      const result = toolResult(body) as { error?: string }
      expect(result.error).toBe('network_required')
    })

    it('returns network_required error for browse_marketplace', async () => {
      const res = await callTool('browse_marketplace', {})
      expect(res.status).toBe(200)

      const body = await res.json<{ result?: { content?: Array<{ text?: string }> } }>()
      const result = toolResult(body) as { error?: string }
      expect(result.error).toBe('network_required')
    })
  })

  // ── 6. remember with NETWORK_API_URL set ─────────────────────────────────────

  describe('network tools with NETWORK_API_URL set', () => {
    beforeAll(() => {
      // Inject fake network credentials into the env used by the worker.
      // The worker will try to fetch but fail since the URL isn't real —
      // that's expected. We just verify it does NOT return network_required.
      ;(env as Record<string, unknown>)['NETWORK_API_URL'] = 'http://127.0.0.1:9999'
      ;(env as Record<string, unknown>)['NETWORK_TOKEN'] = 'test-token-vitest'
    })

    it('does NOT return network_required — returns a connection/fetch error instead', async () => {
      const res = await callTool('remember', { text: 'Test memory with URL set' })

      expect(res.status).toBe(200)

      const body = await res.json<{ result?: { content?: Array<{ text?: string }> } }>()
      const result = toolResult(body) as { error?: string }

      // Must not be the upgrade gate error
      expect(result.error).not.toBe('network_required')

      // Should be a network/connection failure error since 127.0.0.1:9999 isn't listening
      expect(['network_unreachable', 'network_error']).toContain(result.error)
    })

    it('does NOT return network_required for squad_remember when network config is present', async () => {
      const res = await callTool('squad_remember', { squad_id: 'alpha', text: 'Test squad memory with URL set' })

      expect(res.status).toBe(200)

      const body = await res.json<{ result?: { content?: Array<{ text?: string }> } }>()
      const result = toolResult(body) as { error?: string }

      expect(result.error).not.toBe('network_required')
      expect(['network_unreachable', 'network_error']).toContain(result.error)
    })
  })

  // ── Error handling ───────────────────────────────────────────────────────────

  describe('JSON-RPC error handling', () => {
    it('returns parse error for invalid JSON', async () => {
      const res = await exports.default.fetch(
        new Request(`${BASE}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': SYSTEM_AUTH_HEADER,
          },
          body: 'not json{{',
        }),
      )

      expect(res.status).toBe(200)
      const body = await res.json<{ error?: { code?: number; message?: string } }>()
      expect(body.error?.code).toBe(-32700)
    })

    it('returns method not found for unknown method', async () => {
      const res = await mcpRequest({
        jsonrpc: '2.0',
        method: 'nonexistent/method',
        id: 99,
      })

      expect(res.status).toBe(200)
      const body = await res.json<{ error?: { code?: number } }>()
      expect(body.error?.code).toBe(-32601)
    })

    it('returns unknown tool error for invalid tool name', async () => {
      const res = await mcpRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        id: 5,
        params: { name: 'does_not_exist', arguments: {} },
      })

      expect(res.status).toBe(200)
      const body = await res.json<{ error?: { code?: number; message?: string } }>()
      expect(body.error?.code).toBe(-32602)
      expect(body.error?.message).toContain('does_not_exist')
    })
  })
})
