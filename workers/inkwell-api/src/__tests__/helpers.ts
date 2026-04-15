import { env, exports } from 'cloudflare:workers'

const BASE = 'http://localhost'

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
    'CREATE TABLE IF NOT EXISTS content_index (slug TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT DEFAULT \'blog\', lang TEXT DEFAULT \'en\', author TEXT DEFAULT \'agent\', tags TEXT DEFAULT \'[]\', description TEXT DEFAULT \'\', published_at TEXT, updated_at TEXT, word_count INTEGER DEFAULT 0)'
  ).run()
}
