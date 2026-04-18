import { Hono } from 'hono'
import type { AppBindings } from '../types'
import { getContent, getContentMeta, putContent, tenantFilter } from '../lib'

const contentRoutes = new Hono<AppBindings>()

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

// Publish content
contentRoutes.post('/publish', async (c) => {
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
    return c.json({ error: parsed.error, details: parsed.details }, parsed.status as any)
  }

  const { title, content, slug: providedSlug, author, tags, description, status, overwrite } = parsed.value
  const slug = providedSlug || normalizeSlug(title)
  if (!slug) {
    return c.json({ error: 'invalid_slug' }, 400)
  }

  const tenantSlug = c.get('tenant_slug')
  const now = new Date()
  const date = now.toISOString().slice(0, 10)

  // Slug uniqueness check
  if (!overwrite) {
    const tf = tenantFilter(tenantSlug)
    const [existingMeta, existingIndex] = await Promise.all([
      getContentMeta(c.env.CONTENT, tenantSlug, slug),
      c.env.DB_ANALYTICS.prepare(`SELECT slug FROM content_index WHERE slug = ?${tf.clause} LIMIT 1`).bind(slug, ...tf.bind).first<{ slug: string }>(),
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

  // Store in KV (tenant-scoped)
  await putContent(c.env.CONTENT, tenantSlug, slug, markdown, {
    title,
    slug,
    author,
    tags,
    description,
    date,
    status,
  })

  // Index in D1 (tenant-scoped)
  const tf = tenantFilter(tenantSlug)
  if (tf.clause) {
    await c.env.DB_ANALYTICS.prepare(
      'INSERT OR REPLACE INTO content_index (slug, title, type, lang, author, tags, description, published_at, updated_at, word_count, tenant_slug) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(slug, title, 'blog', 'en', author, JSON.stringify(tags), description, date, date, content.split(/\s+/).length, tenantSlug).run()
  } else {
    await c.env.DB_ANALYTICS.prepare(
      'INSERT OR REPLACE INTO content_index (slug, title, type, lang, author, tags, description, published_at, updated_at, word_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(slug, title, 'blog', 'en', author, JSON.stringify(tags), description, date, date, content.split(/\s+/).length).run()
  }

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

// List published content (public)
contentRoutes.get('/posts', async (c) => {
  const tenantSlug = c.get('tenant_slug')
  const tf = tenantFilter(tenantSlug)
  const posts = await c.env.DB_ANALYTICS.prepare(
    `SELECT slug, title, author, tags, description, published_at FROM content_index WHERE type = 'blog'${tf.clause} ORDER BY published_at DESC LIMIT 50`
  ).bind(...tf.bind).all()

  // Filter out drafts from public listing
  const published = []
  for (const post of posts.results) {
    const meta = await getContentMeta(c.env.CONTENT, tenantSlug, post.slug as string)
    if (!meta || meta.status !== 'draft') published.push(post)
  }

  return c.json({ posts: published })
})

// List drafts (auth required)
contentRoutes.get('/drafts', async (c) => {
  const token = c.env.PUBLISH_TOKEN
  if (token) {
    const auth = c.req.header('Authorization')
    if (auth !== `Bearer ${token}`) {
      return c.json({ error: 'unauthorized' }, 401)
    }
  }

  const tenantSlug = c.get('tenant_slug')
  const tf = tenantFilter(tenantSlug)
  const all = await c.env.DB_ANALYTICS.prepare(
    `SELECT slug, title, author, tags, description, published_at FROM content_index WHERE type = 'blog'${tf.clause} ORDER BY published_at DESC LIMIT 50`
  ).bind(...tf.bind).all()

  const drafts = []
  for (const post of all.results) {
    const meta = await getContentMeta(c.env.CONTENT, tenantSlug, post.slug as string)
    if (meta && meta.status === 'draft') drafts.push(post)
  }

  return c.json({ drafts })
})

// Get single post from KV
contentRoutes.get('/posts/:slug', async (c) => {
  const slug = c.req.param('slug')
  const tenantSlug = c.get('tenant_slug')
  const content = await getContent(c.env.CONTENT, tenantSlug, slug)
  if (!content) return c.json({ error: 'not found' }, 404)
  const meta = await getContentMeta(c.env.CONTENT, tenantSlug, slug)
  return c.json({ slug, meta, markdown: content })
})

export { contentRoutes }
