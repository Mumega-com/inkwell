import { Hono } from 'hono'
import type { AppBindings } from '../types'
import { requireAuth } from '../middleware'
import { tenantFilter, putContent, getContentMeta } from '../lib'

const calendarRoutes = new Hono<AppBindings>()

const validStatuses = new Set(['idea', 'draft', 'review', 'scheduled', 'published', 'archived', 'killed'])
const validChannels = new Set(['blog', 'social', 'email', 'landing-page'])
const validPriorities = new Set(['high', 'medium', 'low'])

// Allowed transitions: from → [to]
const transitions: Record<string, string[]> = {
  idea:      ['draft', 'killed'],
  draft:     ['review', 'scheduled', 'published', 'killed'],
  review:    ['draft', 'scheduled', 'published', 'killed'],
  scheduled: ['draft', 'review', 'published', 'killed'],
  published: ['archived'],
  archived:  ['draft'],
  killed:    ['idea', 'draft'],
}

// ── GET /api/content/calendar ─────────────────────────────────────
// List content entries by date range, filterable by status/channel/campaign
calendarRoutes.get('/calendar', requireAuth, async (c) => {
  const from = c.req.query('from') ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const to = c.req.query('to') ?? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  const status = c.req.query('status')
  const channel = c.req.query('channel')
  const campaign = c.req.query('campaign')
  const tenant = c.get('tenant_slug')
  const db = c.get('db_analytics')

  const tf = tenantFilter(tenant)
  let where = `WHERE (COALESCE(scheduled_at, published_at) >= ? AND COALESCE(scheduled_at, published_at) <= ?)${tf.clause}`
  const params: unknown[] = [from, to + 'T23:59:59', ...tf.bind]

  if (status && validStatuses.has(status)) {
    where += ' AND status = ?'
    params.push(status)
  }
  if (channel && validChannels.has(channel)) {
    where += ' AND channel = ?'
    params.push(channel)
  }
  if (campaign) {
    where += ' AND campaign_id = ?'
    params.push(campaign)
  }

  const rows = await db.query<Record<string, unknown>>(
    `SELECT slug, title, type, author, tags, description, published_at, updated_at,
            status, scheduled_at, channel, campaign_id, priority, seo_keyword, assignee, word_count
     FROM content_index ${where}
     ORDER BY COALESCE(scheduled_at, published_at) ASC
     LIMIT 200`,
    params,
  )

  return c.json({ entries: rows, from, to })
})

// ── GET /api/content/pipeline ─────────────────────────────────────
// Kanban-style view grouped by status
calendarRoutes.get('/pipeline', requireAuth, async (c) => {
  const tenant = c.get('tenant_slug')
  const db = c.get('db_analytics')
  const tf = tenantFilter(tenant)

  const rows = await db.query<Record<string, unknown>>(
    `SELECT slug, title, type, author, status, scheduled_at, channel, campaign_id, priority, seo_keyword, assignee, updated_at
     FROM content_index
     ${tf.clause ? 'WHERE' + tf.clause.replace(' AND', '') : ''}
     ORDER BY
       CASE status
         WHEN 'idea' THEN 1 WHEN 'draft' THEN 2 WHEN 'review' THEN 3
         WHEN 'scheduled' THEN 4 WHEN 'published' THEN 5 WHEN 'archived' THEN 6 WHEN 'killed' THEN 7
       END,
       updated_at DESC
     LIMIT 500`,
    tf.bind,
  )

  const pipeline: Record<string, unknown[]> = { idea: [], draft: [], review: [], scheduled: [], published: [], archived: [], killed: [] }
  for (const row of rows) {
    const s = (row.status as string) ?? 'published'
    if (pipeline[s]) pipeline[s].push(row)
  }

  return c.json({ pipeline })
})

// ── PATCH /api/content/:slug/status ───────────────────────────────
// Transition content status with validation
calendarRoutes.patch('/:slug/status', requireAuth, async (c) => {
  const slug = c.req.param('slug')!
  const tenant = c.get('tenant_slug')
  const db = c.get('db_analytics')
  const tf = tenantFilter(tenant)

  const body = await c.req.json<{ status: string; scheduled_at?: string }>()
  if (!body.status || !validStatuses.has(body.status)) {
    return c.json({ error: 'invalid_status', valid: [...validStatuses] }, 400)
  }

  // Get current status
  const current = await db.queryOne<{ status: string }>(
    `SELECT status FROM content_index WHERE slug = ?${tf.clause} LIMIT 1`,
    [slug, ...tf.bind],
  )
  if (!current) return c.json({ error: 'not_found' }, 404)

  const allowed = transitions[current.status] ?? []
  if (!allowed.includes(body.status)) {
    return c.json({ error: 'invalid_transition', from: current.status, to: body.status, allowed }, 400)
  }

  const updates: string[] = ['status = ?']
  const params: unknown[] = [body.status]

  if (body.status === 'scheduled' && body.scheduled_at) {
    updates.push('scheduled_at = ?')
    params.push(body.scheduled_at)
  }
  if (body.status === 'published') {
    updates.push("published_at = datetime('now')")
    updates.push('scheduled_at = NULL')
    // Also update KV metadata
    const meta = await getContentMeta(c.get('content'), tenant, slug)
    if (meta) {
      await putContent(c.get('content'), tenant, slug, '', {
        ...meta,
        status: 'published',
        published_at: new Date().toISOString(),
      })
    }
  }

  updates.push("updated_at = datetime('now')")
  params.push(slug, ...tf.bind)

  await db.execute(
    `UPDATE content_index SET ${updates.join(', ')} WHERE slug = ?${tf.clause}`,
    params,
  )

  return c.json({ ok: true, slug, status: body.status })
})

// ── POST /api/content/bulk ────────────────────────────────────────
// Bulk operations: create ideas, schedule multiple, change status in batch
calendarRoutes.post('/bulk', requireAuth, async (c) => {
  const tenant = c.get('tenant_slug')
  const db = c.get('db_analytics')
  const tf = tenantFilter(tenant)
  const body = await c.req.json<{ action: string; items: Array<Record<string, unknown>> }>()

  if (!body.action || !body.items || !Array.isArray(body.items)) {
    return c.json({ error: 'action and items[] required' }, 400)
  }

  const results: Array<{ slug: string; ok: boolean; error?: string }> = []

  if (body.action === 'create') {
    // Bulk create ideas/drafts
    for (const item of body.items.slice(0, 50)) {
      const title = typeof item.title === 'string' ? item.title.trim().slice(0, 120) : ''
      if (!title) { results.push({ slug: '', ok: false, error: 'title required' }); continue }

      const slug = typeof item.slug === 'string'
        ? item.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
        : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

      const status = typeof item.status === 'string' && validStatuses.has(item.status) ? item.status : 'idea'
      const channel = typeof item.channel === 'string' && validChannels.has(item.channel) ? item.channel : 'blog'
      const priority = typeof item.priority === 'string' && validPriorities.has(item.priority) ? item.priority : 'medium'
      const now = new Date().toISOString()

      try {
        const insertParams = [
          slug, title, 'blog', 'en',
          typeof item.author === 'string' ? item.author : 'agent',
          JSON.stringify(Array.isArray(item.tags) ? item.tags.slice(0, 12) : []),
          typeof item.description === 'string' ? item.description.slice(0, 220) : '',
          now, now, 0, tenant,
          status, typeof item.scheduled_at === 'string' ? item.scheduled_at : null,
          channel, typeof item.campaign_id === 'string' ? item.campaign_id : null,
          priority, typeof item.seo_keyword === 'string' ? item.seo_keyword : null,
          typeof item.assignee === 'string' ? item.assignee : null,
        ]

        await db.execute(
          `INSERT OR IGNORE INTO content_index
           (slug, title, type, lang, author, tags, description, published_at, updated_at, word_count, tenant_slug,
            status, scheduled_at, channel, campaign_id, priority, seo_keyword, assignee)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          insertParams,
        )
        results.push({ slug, ok: true })
      } catch {
        results.push({ slug, ok: false, error: 'insert_failed' })
      }
    }
  } else if (body.action === 'status') {
    // Bulk status change
    const newStatus = typeof body.items[0]?.status === 'string' ? body.items[0].status : ''
    if (!validStatuses.has(newStatus)) {
      return c.json({ error: 'invalid target status' }, 400)
    }

    for (const item of body.items.slice(0, 100)) {
      const slug = typeof item.slug === 'string' ? item.slug : ''
      if (!slug) { results.push({ slug, ok: false, error: 'slug required' }); continue }

      try {
        await db.execute(
          `UPDATE content_index SET status = ?, updated_at = datetime('now') WHERE slug = ?${tf.clause}`,
          [newStatus, slug, ...tf.bind],
        )
        results.push({ slug, ok: true })
      } catch {
        results.push({ slug, ok: false, error: 'update_failed' })
      }
    }
  } else if (body.action === 'schedule') {
    // Bulk schedule
    for (const item of body.items.slice(0, 50)) {
      const slug = typeof item.slug === 'string' ? item.slug : ''
      const scheduledAt = typeof item.scheduled_at === 'string' ? item.scheduled_at : ''
      if (!slug || !scheduledAt) { results.push({ slug, ok: false, error: 'slug and scheduled_at required' }); continue }

      try {
        await db.execute(
          `UPDATE content_index SET status = 'scheduled', scheduled_at = ?, updated_at = datetime('now') WHERE slug = ?${tf.clause}`,
          [scheduledAt, slug, ...tf.bind],
        )
        results.push({ slug, ok: true })
      } catch {
        results.push({ slug, ok: false, error: 'update_failed' })
      }
    }
  } else {
    return c.json({ error: 'unknown action', valid: ['create', 'status', 'schedule'] }, 400)
  }

  const succeeded = results.filter(r => r.ok).length
  return c.json({ ok: true, action: body.action, total: results.length, succeeded, results })
})

// ── POST /api/content/duplicate ───────────────────────────────────
// Clone entries and shift dates (duplicate-and-shift for template weeks)
calendarRoutes.post('/duplicate', requireAuth, async (c) => {
  const tenant = c.get('tenant_slug')
  const db = c.get('db_analytics')
  const tf = tenantFilter(tenant)
  const body = await c.req.json<{ slugs: string[]; shift_days: number }>()

  if (!body.slugs || !Array.isArray(body.slugs) || !body.shift_days) {
    return c.json({ error: 'slugs[] and shift_days required' }, 400)
  }

  const shiftMs = body.shift_days * 86400000
  const results: Array<{ slug: string; new_slug: string; ok: boolean }> = []

  for (const slug of body.slugs.slice(0, 50)) {
    const original = await db.queryOne<Record<string, unknown>>(
      `SELECT * FROM content_index WHERE slug = ?${tf.clause} LIMIT 1`,
      [slug, ...tf.bind],
    )
    if (!original) { results.push({ slug, new_slug: '', ok: false }); continue }

    const newSlug = `${slug}-${Date.now().toString(36).slice(-4)}`
    const newScheduled = original.scheduled_at
      ? new Date(new Date(original.scheduled_at as string).getTime() + shiftMs).toISOString()
      : new Date(new Date(original.published_at as string).getTime() + shiftMs).toISOString()

    try {
      await db.execute(
        `INSERT INTO content_index
         (slug, title, type, lang, author, tags, description, published_at, updated_at, word_count, tenant_slug,
          status, scheduled_at, channel, campaign_id, priority, seo_keyword, assignee)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, 'idea', ?, ?, ?, ?, ?, ?)`,
        [
          newSlug, original.title, original.type, original.lang, original.assignee ?? original.author,
          original.tags, original.description, newScheduled, original.word_count, tenant,
          newScheduled, original.channel, original.campaign_id, original.priority,
          original.seo_keyword, original.assignee,
        ],
      )
      results.push({ slug, new_slug: newSlug, ok: true })
    } catch {
      results.push({ slug, new_slug: '', ok: false })
    }
  }

  return c.json({ ok: true, shifted_days: body.shift_days, results })
})

// ── GET /api/content/campaigns ────────────────────────────────────
// List campaigns with entry counts
calendarRoutes.get('/campaigns', requireAuth, async (c) => {
  const tenant = c.get('tenant_slug')
  const db = c.get('db_analytics')
  const tf = tenantFilter(tenant)

  const rows = await db.query<{ campaign_id: string; count: number; statuses: string }>(
    `SELECT campaign_id, COUNT(*) as count,
            GROUP_CONCAT(DISTINCT status) as statuses
     FROM content_index
     WHERE campaign_id IS NOT NULL${tf.clause}
     GROUP BY campaign_id
     ORDER BY count DESC
     LIMIT 50`,
    tf.bind,
  )

  return c.json({ campaigns: rows })
})

export { calendarRoutes }
