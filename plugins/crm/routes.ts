import { Hono } from 'hono'
import type { AppBindings } from '../types'

export const crmRoutes = new Hono<AppBindings>()

// ── GET /contacts — list/search contacts ──────────────────────────────────────
crmRoutes.get('/contacts', async (c) => {
  const stage = c.req.query('stage')
  const source = c.req.query('source')
  const search = c.req.query('search')
  const limit = Math.min(Number(c.req.query('limit')) || 50, 200)
  const offset = Math.max(Number(c.req.query('offset')) || 0, 0)

  const conditions: string[] = ["tenant_slug = 'default'"]
  const params: unknown[] = []

  if (stage) {
    conditions.push('stage = ?')
    params.push(stage)
  }
  if (source) {
    conditions.push('source = ?')
    params.push(source)
  }
  if (search) {
    const term = `%${search}%`
    conditions.push('(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR company LIKE ?)')
    params.push(term, term, term, term)
  }

  const where = conditions.join(' AND ')

  const countResult = await c.env.DB_CORE.prepare(
    `SELECT COUNT(*) as total FROM contacts WHERE ${where}`
  )
    .bind(...params)
    .first<{ total: number }>()

  const rows = await c.env.DB_CORE.prepare(
    `SELECT id, email, phone, first_name, last_name, company, title, source, stage, tags, notes, created_at, updated_at
     FROM contacts WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(...params, limit, offset)
    .all()

  const contacts = (rows.results ?? []).map((row) => ({
    ...row,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags as string) : [],
  }))

  return c.json({ contacts, total: countResult?.total ?? 0, limit, offset })
})

// ── POST /contacts — create contact ───────────────────────────────────────────
crmRoutes.post('/contacts', async (c) => {
  const body = (await c.req.json()) as Record<string, unknown>

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : null
  const phone = typeof body.phone === 'string' ? body.phone.trim() : null

  if (!email && !phone) {
    return c.json({ error: 'At least email or phone is required' }, 400)
  }

  const firstName = typeof body.first_name === 'string' ? body.first_name.trim() : null
  const lastName = typeof body.last_name === 'string' ? body.last_name.trim() : null
  const company = typeof body.company === 'string' ? body.company.trim() : null
  const title = typeof body.title === 'string' ? body.title.trim() : null
  const source = typeof body.source === 'string' ? body.source.trim() : 'manual'
  const stage = typeof body.stage === 'string' ? body.stage.trim() : 'lead'
  const tags = Array.isArray(body.tags)
    ? JSON.stringify((body.tags as unknown[]).filter((t): t is string => typeof t === 'string'))
    : '[]'
  const notes = typeof body.notes === 'string' ? body.notes.trim() : null

  const result = await c.env.DB_CORE.prepare(
    `INSERT INTO contacts (tenant_slug, email, phone, first_name, last_name, company, title, source, stage, tags, notes)
     VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id, email, stage`
  )
    .bind(email, phone, firstName, lastName, company, title, source, stage, tags, notes)
    .first()

  if (!result) {
    return c.json({ error: 'Failed to create contact' }, 500)
  }

  return c.json({ ok: true, id: result.id, email: result.email, stage: result.stage }, 201)
})

// ── GET /contacts/:id — single contact with recent activities ─────────────────
crmRoutes.get('/contacts/:id', async (c) => {
  const id = c.req.param('id')

  const contact = await c.env.DB_CORE.prepare(
    `SELECT id, email, phone, first_name, last_name, company, title, source, stage, tags, custom_fields, notes, created_at, updated_at
     FROM contacts WHERE id = ? AND tenant_slug = 'default'`
  )
    .bind(id)
    .first()

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  const activities = await c.env.DB_CORE.prepare(
    `SELECT id, type, subject, body, deal_id, performed_by, performed_at
     FROM activities WHERE contact_id = ? AND tenant_slug = 'default'
     ORDER BY performed_at DESC LIMIT 20`
  )
    .bind(id)
    .all()

  return c.json({
    ...contact,
    tags: typeof contact.tags === 'string' ? JSON.parse(contact.tags as string) : [],
    custom_fields: typeof contact.custom_fields === 'string' ? JSON.parse(contact.custom_fields as string) : {},
    activities: activities.results ?? [],
  })
})

// ── PUT /contacts/:id — update contact ────────────────────────────────────────
crmRoutes.put('/contacts/:id', async (c) => {
  const id = c.req.param('id')
  const body = (await c.req.json()) as Record<string, unknown>

  const updates: Array<{ column: string; value: unknown }> = []

  if (typeof body.email === 'string') updates.push({ column: 'email', value: body.email.trim().toLowerCase() })
  if (typeof body.phone === 'string') updates.push({ column: 'phone', value: body.phone.trim() })
  if (typeof body.first_name === 'string') updates.push({ column: 'first_name', value: body.first_name.trim() })
  if (typeof body.last_name === 'string') updates.push({ column: 'last_name', value: body.last_name.trim() })
  if (typeof body.company === 'string') updates.push({ column: 'company', value: body.company.trim() })
  if (typeof body.title === 'string') updates.push({ column: 'title', value: body.title.trim() })
  if (typeof body.stage === 'string') updates.push({ column: 'stage', value: body.stage.trim() })
  if (typeof body.notes === 'string') updates.push({ column: 'notes', value: body.notes.trim() })
  if (Array.isArray(body.tags)) {
    updates.push({ column: 'tags', value: JSON.stringify((body.tags as unknown[]).filter((t): t is string => typeof t === 'string')) })
  }
  if (body.custom_fields !== null && typeof body.custom_fields === 'object' && !Array.isArray(body.custom_fields)) {
    updates.push({ column: 'custom_fields', value: JSON.stringify(body.custom_fields) })
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }

  const setClauses = updates.map((u) => `${u.column} = ?`).join(', ')
  const values = updates.map((u) => u.value)

  await c.env.DB_CORE.prepare(
    `UPDATE contacts SET ${setClauses}, updated_at = datetime('now') WHERE id = ? AND tenant_slug = 'default'`
  )
    .bind(...values, id)
    .run()

  return c.json({ ok: true, id, updated_fields: updates.map((u) => u.column) })
})

// ── GET /pipeline — list stages with deal counts ──────────────────────────────
crmRoutes.get('/pipeline', async (c) => {
  const rows = await c.env.DB_CORE.prepare(
    `SELECT ps.id, ps.name, ps.position, ps.color, COUNT(d.id) as deal_count
     FROM pipeline_stages ps
     LEFT JOIN deals d ON d.stage_id = ps.id AND d.status = 'open'
     WHERE ps.tenant_slug = 'default'
     GROUP BY ps.id
     ORDER BY ps.position ASC`
  )
    .all()

  return c.json({ stages: rows.results ?? [] })
})

// ── POST /pipeline/stages — create stage ──────────────────────────────────────
crmRoutes.post('/pipeline/stages', async (c) => {
  const body = (await c.req.json()) as Record<string, unknown>

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return c.json({ error: 'name is required' }, 400)
  }

  const position = typeof body.position === 'number' ? body.position : 0
  const color = typeof body.color === 'string' ? body.color.trim() : '#6366f1'

  const result = await c.env.DB_CORE.prepare(
    `INSERT INTO pipeline_stages (tenant_slug, name, position, color) VALUES ('default', ?, ?, ?) RETURNING id, name, position, color`
  )
    .bind(name, position, color)
    .first()

  return c.json({ ok: true, stage: result }, 201)
})

// ── GET /deals — list deals ───────────────────────────────────────────────────
crmRoutes.get('/deals', async (c) => {
  const status = c.req.query('status')
  const stageId = c.req.query('stage_id')
  const limit = Math.min(Number(c.req.query('limit')) || 50, 200)
  const offset = Math.max(Number(c.req.query('offset')) || 0, 0)

  const conditions: string[] = ["d.tenant_slug = 'default'"]
  const params: unknown[] = []

  if (status) {
    conditions.push('d.status = ?')
    params.push(status)
  }
  if (stageId) {
    conditions.push('d.stage_id = ?')
    params.push(stageId)
  }

  const where = conditions.join(' AND ')

  const rows = await c.env.DB_CORE.prepare(
    `SELECT d.id, d.contact_id, d.title, d.value, d.currency, d.stage_id, d.status, d.assigned_to, d.expected_close, d.notes, d.created_at, d.updated_at,
            c.first_name, c.last_name, c.email as contact_email, c.company as contact_company
     FROM deals d
     LEFT JOIN contacts c ON c.id = d.contact_id
     WHERE ${where}
     ORDER BY d.created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(...params, limit, offset)
    .all()

  return c.json({ deals: rows.results ?? [], limit, offset })
})

// ── POST /deals — create deal ─────────────────────────────────────────────────
crmRoutes.post('/deals', async (c) => {
  const body = (await c.req.json()) as Record<string, unknown>

  const contactId = typeof body.contact_id === 'string' ? body.contact_id.trim() : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!contactId) return c.json({ error: 'contact_id is required' }, 400)
  if (!title) return c.json({ error: 'title is required' }, 400)

  const value = typeof body.value === 'number' ? body.value : 0
  const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : 'CAD'
  const stageId = typeof body.stage_id === 'string' ? body.stage_id.trim() : null
  const assignedTo = typeof body.assigned_to === 'string' ? body.assigned_to.trim() : null
  const expectedClose = typeof body.expected_close === 'string' ? body.expected_close.trim() : null
  const notes = typeof body.notes === 'string' ? body.notes.trim() : null

  const result = await c.env.DB_CORE.prepare(
    `INSERT INTO deals (tenant_slug, contact_id, title, value, currency, stage_id, assigned_to, expected_close, notes)
     VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id, title, value, status`
  )
    .bind(contactId, title, value, currency, stageId, assignedTo, expectedClose, notes)
    .first()

  return c.json({ ok: true, deal: result }, 201)
})

// ── PUT /deals/:id — update deal ──────────────────────────────────────────────
crmRoutes.put('/deals/:id', async (c) => {
  const id = c.req.param('id')
  const body = (await c.req.json()) as Record<string, unknown>

  const updates: Array<{ column: string; value: unknown }> = []

  if (typeof body.stage_id === 'string') updates.push({ column: 'stage_id', value: body.stage_id.trim() })
  if (typeof body.status === 'string') updates.push({ column: 'status', value: body.status.trim() })
  if (typeof body.value === 'number') updates.push({ column: 'value', value: body.value })
  if (typeof body.notes === 'string') updates.push({ column: 'notes', value: body.notes.trim() })
  if (typeof body.assigned_to === 'string') updates.push({ column: 'assigned_to', value: body.assigned_to.trim() })
  if (typeof body.expected_close === 'string') updates.push({ column: 'expected_close', value: body.expected_close.trim() })

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }

  const setClauses = updates.map((u) => `${u.column} = ?`).join(', ')
  const values = updates.map((u) => u.value)

  await c.env.DB_CORE.prepare(
    `UPDATE deals SET ${setClauses}, updated_at = datetime('now') WHERE id = ? AND tenant_slug = 'default'`
  )
    .bind(...values, id)
    .run()

  return c.json({ ok: true, deal_id: id, updated: updates.map((u) => u.column) })
})
