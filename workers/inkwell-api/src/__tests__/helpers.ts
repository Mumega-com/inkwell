import { env, exports } from 'cloudflare:workers'

const BASE = 'http://localhost'

/**
 * System token that bypasses RBAC — matches PUBLISH_TOKEN in wrangler.toml [vars].
 * Tests use this so requests are not blocked by role checks.
 */
const SYSTEM_AUTH_HEADER = 'Bearer dev-inkwell-local-test-token-do-not-use-in-prod'

/**
 * Send a request through the worker and return the response.
 */
export async function request(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<Response> {
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': SYSTEM_AUTH_HEADER,
      ...headers,
    },
  }
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
  }
  return exports.default.fetch(new Request(`${BASE}${path}`, init))
}

/**
 * Create the D1 tables needed by tests.
 * Uses individual prepare().run() calls because D1 exec() can be fragile
 * with multi-statement strings.
 */
export async function seedTables(): Promise<void> {
  const db = env.DB_ANALYTICS
  const dbCore = env.DB_CORE

  await db.prepare(
    'CREATE TABLE IF NOT EXISTS page_views (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, referrer TEXT, scroll_depth REAL, country TEXT DEFAULT \'unknown\', device TEXT DEFAULT \'desktop\', timestamp TEXT NOT NULL)'
  ).run()

  await db.prepare(
    'CREATE TABLE IF NOT EXISTS reactions (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, emoji TEXT NOT NULL, visitor_hash TEXT NOT NULL, timestamp TEXT NOT NULL)'
  ).run()

  await db.prepare(
    'CREATE TABLE IF NOT EXISTS subscribers (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, name TEXT DEFAULT \'\', status TEXT DEFAULT \'active\', source TEXT DEFAULT \'website\')'
  ).run()

  await db.prepare(
    'CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, type TEXT NOT NULL, text TEXT, visitor_hash TEXT NOT NULL, timestamp TEXT NOT NULL)'
  ).run()

  await db.prepare(
    'CREATE TABLE IF NOT EXISTS content_index (slug TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT DEFAULT \'blog\', lang TEXT DEFAULT \'en\', author TEXT DEFAULT \'agent\', tags TEXT DEFAULT \'[]\', description TEXT DEFAULT \'\', published_at TEXT, updated_at TEXT, word_count INTEGER DEFAULT 0, tenant_slug TEXT, status TEXT NOT NULL DEFAULT \'published\', scheduled_at TEXT, channel TEXT NOT NULL DEFAULT \'blog\', campaign_id TEXT, priority TEXT NOT NULL DEFAULT \'medium\', seo_keyword TEXT, assignee TEXT)'
  ).run()

  // SEO tables — required by edge-seo middleware on every request
  await dbCore.prepare(
    'CREATE TABLE IF NOT EXISTS seo_redirects (id TEXT PRIMARY KEY, from_path TEXT NOT NULL, to_path TEXT NOT NULL, status_code INTEGER NOT NULL DEFAULT 301, tenant TEXT, created_at TEXT NOT NULL DEFAULT (datetime(\'now\')), UNIQUE(from_path, tenant))'
  ).run()

  await dbCore.prepare(
    'CREATE TABLE IF NOT EXISTS crawl_logs (id TEXT PRIMARY KEY, path TEXT NOT NULL, user_agent TEXT NOT NULL, bot_name TEXT NOT NULL, status_code INTEGER NOT NULL DEFAULT 200, tenant TEXT, timestamp TEXT NOT NULL DEFAULT (datetime(\'now\')))'
  ).run()

  await dbCore.prepare(
    'CREATE TABLE IF NOT EXISTS seo_meta_overrides (path TEXT NOT NULL, title TEXT, description TEXT, og_image TEXT, robots TEXT, canonical TEXT, tenant TEXT, PRIMARY KEY(path, tenant))'
  ).run()

  // MCP tokens — per-tenant token auth
  await dbCore.prepare(
    'CREATE TABLE IF NOT EXISTS mcp_tokens (token TEXT PRIMARY KEY, tenant_slug TEXT NOT NULL, label TEXT NOT NULL DEFAULT \'default\', role TEXT NOT NULL DEFAULT \'admin\', created_at TEXT NOT NULL DEFAULT (datetime(\'now\')), expires_at TEXT, revoked_at TEXT)'
  ).run()

  await dbCore.prepare(
    'CREATE TABLE IF NOT EXISTS bounties (id TEXT PRIMARY KEY, customer_slug TEXT NOT NULL, title TEXT NOT NULL, description TEXT, reward_cents INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT \'USD\', status TEXT NOT NULL DEFAULT \'open\', creator_id TEXT NOT NULL, claimant_id TEXT, agent_id TEXT, assignee_type TEXT, proof_url TEXT, squad_id TEXT, labels_json TEXT DEFAULT \'[]\', expires_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)'
  ).run()

  // Visitor profiles — required by visitor-profile middleware on every request
  await db.prepare(
    'CREATE TABLE IF NOT EXISTS visitor_profiles (visitor_hash TEXT PRIMARY KEY, first_seen TEXT NOT NULL DEFAULT (datetime(\'now\')), last_seen TEXT NOT NULL DEFAULT (datetime(\'now\')), visit_count INTEGER NOT NULL DEFAULT 1, utm_first_source TEXT, utm_first_medium TEXT, utm_first_campaign TEXT, utm_last_source TEXT, utm_last_medium TEXT, utm_last_campaign TEXT, portal_account_id TEXT, email TEXT, total_events INTEGER NOT NULL DEFAULT 0, total_page_views INTEGER NOT NULL DEFAULT 0, last_event_name TEXT, last_path TEXT, country TEXT, device TEXT, tenant TEXT, properties TEXT)'
  ).run()
}
