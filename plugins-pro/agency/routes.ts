import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { AppBindings } from '../types'

export const agencyRoutes = new Hono<AppBindings>()

const ENSURE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS agency_clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  contact_name TEXT,
  contact_email TEXT,
  status TEXT DEFAULT 'active',
  config TEXT DEFAULT '{}',
  pages_created INTEGER DEFAULT 0,
  onboarded_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`

async function ensureTable(db: D1Database): Promise<void> {
  try {
    await db.prepare(ENSURE_TABLE_SQL).run()
  } catch {
    // table already exists — ignore
  }
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

// ── GET /clients — list all agency clients ───────────────────────────────────
agencyRoutes.get('/clients', async (c) => {
  await ensureTable(c.env.DB_CORE)

  const status = c.req.query('status')
  const limit = Math.min(Number(c.req.query('limit')) || 50, 200)
  const offset = Math.max(Number(c.req.query('offset')) || 0, 0)

  const conditions: string[] = []
  const params: unknown[] = []

  if (status) {
    conditions.push('status = ?')
    params.push(status)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countResult = await c.env.DB_CORE.prepare(
    `SELECT COUNT(*) as total FROM agency_clients ${where}`
  )
    .bind(...params)
    .first<{ total: number }>()

  const rows = await c.env.DB_CORE.prepare(
    `SELECT id, slug, name, industry, contact_name, contact_email, status, config, pages_created, onboarded_at, created_at, updated_at
     FROM agency_clients ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(...params, limit, offset)
    .all()

  const clients = (rows.results ?? []).map((row) => ({
    ...row,
    config: typeof row.config === 'string' ? JSON.parse(row.config as string) : {},
  }))

  return c.json({ clients, total: countResult?.total ?? 0, limit, offset })
})

// ── POST /clients — create a new agency client ──────────────────────────────
agencyRoutes.post('/clients', async (c) => {
  await ensureTable(c.env.DB_CORE)

  const body = (await c.req.json()) as Record<string, unknown>

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return c.json({ error: 'name is required' }, 400)
  }

  const slug = typeof body.slug === 'string' ? slugify(body.slug) : slugify(name)
  const industry = typeof body.industry === 'string' ? body.industry.trim() : null
  const contactName = typeof body.contact_name === 'string' ? body.contact_name.trim() : null
  const contactEmail = typeof body.contact_email === 'string' ? body.contact_email.trim().toLowerCase() : null
  const status = typeof body.status === 'string' ? body.status.trim() : 'active'
  const config = typeof body.config === 'object' && body.config !== null && !Array.isArray(body.config)
    ? JSON.stringify(body.config)
    : '{}'

  const result = await c.env.DB_CORE.prepare(
    `INSERT INTO agency_clients (slug, name, industry, contact_name, contact_email, status, config)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     RETURNING id, slug, name, status`
  )
    .bind(slug, name, industry, contactName, contactEmail, status, config)
    .first()

  if (!result) {
    return c.json({ error: 'Failed to create client — slug may already exist' }, 500)
  }

  return c.json({ ok: true, id: result.id, slug: result.slug, name: result.name, status: result.status }, 201)
})

// ── GET /clients/:slug — get single client with stats ────────────────────────
agencyRoutes.get('/clients/:slug', async (c) => {
  await ensureTable(c.env.DB_CORE)

  const slug = c.req.param('slug')

  const client = await c.env.DB_CORE.prepare(
    `SELECT id, slug, name, industry, contact_name, contact_email, status, config, pages_created, onboarded_at, created_at, updated_at
     FROM agency_clients WHERE slug = ?`
  )
    .bind(slug)
    .first()

  if (!client) {
    return c.json({ error: 'Client not found' }, 404)
  }

  // Content stats from analytics
  const contentTag = `%${slug}%`
  const contentCount = await c.env.DB_ANALYTICS.prepare(
    `SELECT COUNT(*) as total FROM content_index WHERE tags LIKE ?`
  )
    .bind(contentTag)
    .first<{ total: number }>()

  // Contact stats from CRM
  const contactCount = await c.env.DB_CORE.prepare(
    `SELECT COUNT(*) as total FROM contacts WHERE tenant_slug = ?`
  )
    .bind(slug)
    .first<{ total: number }>()

  return c.json({
    ...client,
    config: typeof client.config === 'string' ? JSON.parse(client.config as string) : {},
    stats: {
      content_pages: contentCount?.total ?? 0,
      contacts: contactCount?.total ?? 0,
    },
  })
})

// ── PUT /clients/:slug — update client ───────────────────────────────────────
agencyRoutes.put('/clients/:slug', async (c) => {
  await ensureTable(c.env.DB_CORE)

  const slug = c.req.param('slug')
  const body = (await c.req.json()) as Record<string, unknown>

  const updates: Array<{ column: string; value: unknown }> = []

  if (typeof body.name === 'string') updates.push({ column: 'name', value: body.name.trim() })
  if (typeof body.industry === 'string') updates.push({ column: 'industry', value: body.industry.trim() })
  if (typeof body.contact_name === 'string') updates.push({ column: 'contact_name', value: body.contact_name.trim() })
  if (typeof body.contact_email === 'string') updates.push({ column: 'contact_email', value: body.contact_email.trim().toLowerCase() })
  if (typeof body.status === 'string') updates.push({ column: 'status', value: body.status.trim() })
  if (typeof body.config === 'object' && body.config !== null && !Array.isArray(body.config)) {
    updates.push({ column: 'config', value: JSON.stringify(body.config) })
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }

  const setClauses = updates.map((u) => `${u.column} = ?`).join(', ')
  const values = updates.map((u) => u.value)

  await c.env.DB_CORE.prepare(
    `UPDATE agency_clients SET ${setClauses}, updated_at = datetime('now') WHERE slug = ?`
  )
    .bind(...values, slug)
    .run()

  return c.json({ ok: true, slug, updated_fields: updates.map((u) => u.column) })
})

// ── DELETE /clients/:slug — soft-delete (archive) ────────────────────────────
agencyRoutes.delete('/clients/:slug', async (c) => {
  await ensureTable(c.env.DB_CORE)

  const slug = c.req.param('slug')

  const existing = await c.env.DB_CORE.prepare(
    `SELECT id FROM agency_clients WHERE slug = ?`
  )
    .bind(slug)
    .first()

  if (!existing) {
    return c.json({ error: 'Client not found' }, 404)
  }

  await c.env.DB_CORE.prepare(
    `UPDATE agency_clients SET status = 'archived', updated_at = datetime('now') WHERE slug = ?`
  )
    .bind(slug)
    .run()

  return c.json({ ok: true, slug, status: 'archived' })
})

// ── GET /clients/:slug/stats — aggregated stats ─────────────────────────────
agencyRoutes.get('/clients/:slug/stats', async (c) => {
  await ensureTable(c.env.DB_CORE)

  const slug = c.req.param('slug')

  const client = await c.env.DB_CORE.prepare(
    `SELECT id, slug, name FROM agency_clients WHERE slug = ?`
  )
    .bind(slug)
    .first()

  if (!client) {
    return c.json({ error: 'Client not found' }, 404)
  }

  // Content count from DB_ANALYTICS content_index where tags contain the client slug
  const contentTag = `%${slug}%`
  const contentCount = await c.env.DB_ANALYTICS.prepare(
    `SELECT COUNT(*) as total FROM content_index WHERE tags LIKE ?`
  )
    .bind(contentTag)
    .first<{ total: number }>()

  // Contacts count from DB_CORE contacts where tenant_slug matches
  const contactCount = await c.env.DB_CORE.prepare(
    `SELECT COUNT(*) as total FROM contacts WHERE tenant_slug = ?`
  )
    .bind(slug)
    .first<{ total: number }>()

  return c.json({
    slug,
    name: client.name,
    content_pages: contentCount?.total ?? 0,
    contacts: contactCount?.total ?? 0,
  })
})
