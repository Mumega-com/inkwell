import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authRoutes } from './routes/auth'
import { contractRoutes } from './routes/contracts'
import { mcpRoutes } from './routes/mcp'
import { paymentRoutes } from './routes/payments'
import { telegramRoutes } from './routes/telegram'
import type { AppBindings } from './types'

const app = new Hono<AppBindings>()

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}))

const allowedPublishStatuses = new Set(['draft', 'published', 'archived'])

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function cleanText(value: string, maxLength: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const tags: string[] = []

  for (const item of value) {
    if (!isNonEmptyString(item)) continue
    const tag = item.trim().slice(0, 48)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag)
  }

  return tags.slice(0, 12)
}

function parsePublishPayload(body: unknown):
  | { ok: true; value: { title: string; content: string; slug?: string; author: string; tags: string[]; description: string; status: 'draft' | 'published' | 'archived'; overwrite: boolean } }
  | { ok: false; status: number; error: string; details?: unknown } {
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, error: 'invalid_json' }
  }

  const payload = body as Record<string, unknown>
  if (!isNonEmptyString(payload.title)) return { ok: false, status: 400, error: 'title required' }
  if (!isNonEmptyString(payload.content)) return { ok: false, status: 400, error: 'content required' }

  const title = cleanText(payload.title, 120)
  const content = payload.content.trim()
  if (title.length < 2) return { ok: false, status: 400, error: 'title too short' }
  if (content.length < 1) return { ok: false, status: 400, error: 'content required' }
  if (content.length > 200_000) return { ok: false, status: 413, error: 'content too large' }

  const slug = isNonEmptyString(payload.slug) ? normalizeSlug(payload.slug) : undefined
  if (slug === '') return { ok: false, status: 400, error: 'invalid_slug' }

  const author = isNonEmptyString(payload.author) ? cleanText(payload.author, 80) : 'agent'
  const tags = parseTags(payload.tags)
  const description = isNonEmptyString(payload.description)
    ? cleanText(payload.description, 220)
    : cleanText(content.replace(/```[\s\S]*?```/g, ' ').replace(/[#*_>\-\[\]`]/g, ' '), 220)
  let status: 'draft' | 'published' | 'archived' = 'published'
  if (isNonEmptyString(payload.status)) {
    if (!allowedPublishStatuses.has(payload.status)) {
      return { ok: false, status: 400, error: 'invalid_status' }
    }
    status = payload.status as 'draft' | 'published' | 'archived'
  }
  const overwrite = payload.overwrite === true

  return {
    ok: true,
    value: { title, content, slug, author, tags, description, status, overwrite },
  }
}

// Health check
app.get('/health', (c) => c.json({ status: 'ok', ts: Date.now() }))

app.route('/api/auth', authRoutes)
app.route('/api/contracts', contractRoutes)
app.route('/api/payments', paymentRoutes)
app.route('/api/telegram', telegramRoutes)
app.route('/mcp', mcpRoutes)

// Record page view
app.post('/api/view', async (c) => {
  const body = await c.req.json<{ slug: string; referrer?: string; scroll_depth?: number }>()
  const { slug, referrer, scroll_depth } = body

  if (!slug) return c.json({ error: 'slug required' }, 400)

  const country = c.req.header('cf-ipcountry') ?? 'unknown'
  const mobile = c.req.header('sec-ch-ua-mobile')
  const device = mobile === '?1' ? 'mobile' : 'desktop'

  await c.env.DB_ANALYTICS.prepare(
    'INSERT INTO page_views (slug, referrer, scroll_depth, country, device, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(slug, referrer ?? null, scroll_depth ?? null, country, device, new Date().toISOString()).run()

  return c.json({ ok: true })
})

// Record reaction
app.post('/api/reaction', async (c) => {
  const body = await c.req.json<{ slug: string; emoji: string }>()
  const { slug, emoji } = body

  if (!slug || !emoji) return c.json({ error: 'slug and emoji required' }, 400)

  const ip = c.req.header('cf-connecting-ip') ?? 'anonymous'
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + slug)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const visitorHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)

  await c.env.DB_ANALYTICS.prepare(
    'INSERT INTO reactions (slug, emoji, visitor_hash, timestamp) VALUES (?, ?, ?, ?)'
  ).bind(slug, emoji, visitorHash, new Date().toISOString()).run()

  const counts = await c.env.DB_ANALYTICS.prepare(
    'SELECT emoji, COUNT(*) as count FROM reactions WHERE slug = ? GROUP BY emoji'
  ).bind(slug).all<{ emoji: string; count: number }>()

  const result: Record<string, number> = {}
  for (const row of counts.results) {
    result[row.emoji] = row.count
  }

  return c.json({ ok: true, counts: result })
})

// Get reaction counts for a slug
app.get('/api/reactions/:slug', async (c) => {
  const slug = c.req.param('slug')

  const counts = await c.env.DB_ANALYTICS.prepare(
    'SELECT emoji, COUNT(*) as count FROM reactions WHERE slug = ? GROUP BY emoji'
  ).bind(slug).all<{ emoji: string; count: number }>()

  const result: Record<string, number> = {}
  for (const row of counts.results) {
    result[row.emoji] = row.count
  }

  return c.json({ counts: result })
})

// Subscribe
app.post('/api/subscribe', async (c) => {
  const body = await c.req.json<{ email: string; name?: string; source?: string }>()
  const { email, name, source } = body

  if (!email) return c.json({ error: 'email required' }, 400)

  await c.env.DB_ANALYTICS.prepare(
    'INSERT OR IGNORE INTO subscribers (email, name, status, source) VALUES (?, ?, ?, ?)'
  ).bind(email, name ?? '', 'active', source ?? 'website').run()

  return c.json({ ok: true, status: 'subscribed' })
})

// Unsubscribe
app.post('/api/unsubscribe', async (c) => {
  const body = await c.req.json<{ email: string }>()
  const { email } = body

  if (!email) return c.json({ error: 'email required' }, 400)

  await c.env.DB_ANALYTICS.prepare(
    'UPDATE subscribers SET status = ? WHERE email = ?'
  ).bind('unsubscribed', email).run()

  return c.json({ ok: true, status: 'unsubscribed' })
})

// Stats for a slug
app.get('/api/stats/:slug', async (c) => {
  const slug = c.req.param('slug')

  const views = await c.env.DB_ANALYTICS.prepare(
    'SELECT COUNT(*) as count, AVG(scroll_depth) as avg_scroll FROM page_views WHERE slug = ?'
  ).bind(slug).first<{ count: number; avg_scroll: number | null }>()

  const reactions = await c.env.DB_ANALYTICS.prepare(
    'SELECT emoji, COUNT(*) as count FROM reactions WHERE slug = ? GROUP BY emoji'
  ).bind(slug).all<{ emoji: string; count: number }>()

  const reactionCounts: Record<string, number> = {}
  for (const row of reactions.results) {
    reactionCounts[row.emoji] = row.count
  }

  return c.json({
    slug,
    views: views?.count ?? 0,
    avg_scroll_depth: views?.avg_scroll ?? null,
    reactions: reactionCounts,
  })
})

// ── Publishing ─────────────────────────────────────────────────────────

app.post('/api/publish', async (c) => {
  // Auth check
  const token = c.env.PUBLISH_TOKEN
  if (token) {
    const auth = c.req.header('Authorization')
    if (auth !== `Bearer ${token}`) {
      return c.json({ error: 'unauthorized' }, 401)
    }
  }

  let rawBody: unknown
  try {
    rawBody = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  const parsed = parsePublishPayload(rawBody)
  if (!parsed.ok) {
    return c.json({ error: parsed.error, details: parsed.details }, parsed.status)
  }

  const { title, content, slug: providedSlug, author, tags, description, status, overwrite } = parsed.value
  const slug = providedSlug || normalizeSlug(title)
  if (!slug) {
    return c.json({ error: 'invalid_slug' }, 400)
  }

  const now = new Date()
  const date = now.toISOString().slice(0, 10)

  // Slug uniqueness check
  if (!overwrite) {
    const [existingMeta, existingIndex] = await Promise.all([
      c.env.CONTENT.get(`meta:${slug}`),
      c.env.DB_ANALYTICS.prepare('SELECT slug FROM content_index WHERE slug = ? LIMIT 1').bind(slug).first<{ slug: string }>(),
    ])
    if (existingMeta || existingIndex) {
      return c.json({ error: 'slug_exists', slug, hint: 'Use overwrite:true to replace, or choose a different slug' }, 409)
    }
  }

  // Build frontmatter
  const frontmatter = [
    `title: "${title}"`,
    `date: "${date}"`,
    `author: "${author}"`,
    `tags: [${tags.map(t => `"${t}"`).join(', ')}]`,
    `description: "${description}"`,
    `status: "${status}"`,
  ].join('\n')

  const markdown = `---\n${frontmatter}\n---\n\n${content}`

  // Store in KV
  await c.env.CONTENT.put(`post:${slug}`, markdown)
  await c.env.CONTENT.put(`meta:${slug}`, JSON.stringify({
    title,
    slug,
    author,
    tags,
    description,
    date,
    status,
  }))

  // Index in D1
  await c.env.DB_ANALYTICS.prepare(
    'INSERT OR REPLACE INTO content_index (slug, title, type, lang, author, tags, description, published_at, updated_at, word_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(slug, title, 'blog', 'en', author, JSON.stringify(tags), description, date, date, content.split(/\s+/).length).run()

  // Trigger CF Pages deploy hook if configured
  let deployState = 'manual'
  if (c.env.CF_PAGES_DEPLOY_HOOK) {
    try {
      const resp = await fetch(c.env.CF_PAGES_DEPLOY_HOOK, { method: 'POST' })
      deployState = resp.ok ? 'triggered' : `trigger_failed_${resp.status}`
    } catch {
      deployState = 'trigger_failed'
    }
  }

  return c.json({
    ok: true,
    slug,
    url: `${c.env.SITE_URL}/blog/${slug}`,
    stored: 'kv',
    deploy: deployState,
  })
})

// List published content (public — no auth needed)
app.get('/api/posts', async (c) => {
  const posts = await c.env.DB_ANALYTICS.prepare(
    "SELECT slug, title, author, tags, description, published_at FROM content_index WHERE type = 'blog' ORDER BY published_at DESC LIMIT 50"
  ).all()

  // Filter out drafts from public listing
  const published = []
  for (const post of posts.results) {
    const meta = await c.env.CONTENT.get(`meta:${post.slug}`, 'json') as Record<string, unknown> | null
    if (!meta || meta.status !== 'draft') published.push(post)
  }

  return c.json({ posts: published })
})

// List drafts (auth required)
app.get('/api/drafts', async (c) => {
  const token = c.env.PUBLISH_TOKEN
  if (token) {
    const auth = c.req.header('Authorization')
    if (auth !== `Bearer ${token}`) {
      return c.json({ error: 'unauthorized' }, 401)
    }
  }

  const all = await c.env.DB_ANALYTICS.prepare(
    "SELECT slug, title, author, tags, description, published_at FROM content_index WHERE type = 'blog' ORDER BY published_at DESC LIMIT 50"
  ).all()

  const drafts = []
  for (const post of all.results) {
    const meta = await c.env.CONTENT.get(`meta:${post.slug}`, 'json') as Record<string, unknown> | null
    if (meta && meta.status === 'draft') drafts.push(post)
  }

  return c.json({ drafts })
})

// Get single post from KV
app.get('/api/posts/:slug', async (c) => {
  const slug = c.req.param('slug')
  const content = await c.env.CONTENT.get(`post:${slug}`)
  if (!content) return c.json({ error: 'not found' }, 404)
  const meta = await c.env.CONTENT.get(`meta:${slug}`, 'json')
  return c.json({ slug, meta, markdown: content })
})

import { scheduled } from './scheduled'

export default {
  fetch: app.fetch,
  scheduled,
}
