import type { Env } from '../types'

type WordPressKind = 'post' | 'page'

interface WordPressText {
  rendered?: string
}

interface WordPressEmbeddedAuthor {
  name?: string
}

interface WordPressEmbeddedMedia {
  source_url?: string
}

interface WordPressEmbeddedTerm {
  name?: string
}

interface WordPressItem {
  id: number
  slug: string
  link: string
  title?: WordPressText
  content?: WordPressText
  excerpt?: WordPressText
  date?: string
  modified?: string
  _embedded?: {
    author?: WordPressEmbeddedAuthor[]
    'wp:featuredmedia'?: WordPressEmbeddedMedia[]
    'wp:term'?: WordPressEmbeddedTerm[][]
  }
}

interface SyncedWordPressItem {
  slug: string
  title: string
  type: 'wordpress-post' | 'wordpress-page'
  author: string
  tags: string[]
  description: string
  publishedAt: string
  updatedAt: string
  wordCount: number
  sourceUrl: string
  sourceId: number
  sourceKind: WordPressKind
  sourceSlug: string
  featuredImage?: string
  markdown: string
  meta: Record<string, unknown>
}

export interface WordPressSyncSummary {
  ok: boolean
  skipped?: boolean
  reason?: string
  sourceUrl?: string
  customerSlug?: string
  posts?: number
  pages?: number
  upserted?: number
  deleted?: number
  connectorRunId?: string
  error?: string
  warnings?: string[]
}

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function yamlString(value: string): string {
  return JSON.stringify(value)
}

function wordCount(value: string): number {
  const text = stripHtml(value)
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}

function collectTerms(item: WordPressItem): string[] {
  const values = new Set<string>()
  for (const group of item._embedded?.['wp:term'] ?? []) {
    for (const term of group) {
      const cleaned = term.name?.trim()
      if (cleaned) values.add(cleaned)
    }
  }
  return Array.from(values).slice(0, 12)
}

function collectAuthor(item: WordPressItem): string {
  return item._embedded?.author?.[0]?.name?.trim() || 'WordPress'
}

function buildSourceSlug(hostname: string, kind: WordPressKind, id: number, slug: string): string {
  const prefix = normalizeSlug(hostname.replace(/^www\./, ''))
  return normalizeSlug(`wp-${prefix}-${kind}-${id}-${slug}`)
}

function buildFrontmatter(item: SyncedWordPressItem): string {
  const tags = item.tags.map((tag) => yamlString(tag)).join(', ')
  const lines = [
    `title: ${yamlString(item.title)}`,
    `date: ${yamlString(item.publishedAt)}`,
    `updated: ${yamlString(item.updatedAt)}`,
    `author: ${yamlString(item.author)}`,
    `tags: [${tags}]`,
    `description: ${yamlString(item.description)}`,
    `status: ${yamlString('published')}`,
    `source_system: ${yamlString('wordpress')}`,
    `source_url: ${yamlString(item.sourceUrl)}`,
    `source_id: ${yamlString(String(item.sourceId))}`,
    `source_kind: ${yamlString(item.sourceKind)}`,
    `source_slug: ${yamlString(item.sourceSlug)}`,
  ]

  if (item.featuredImage) {
    lines.push(`featured_image: ${yamlString(item.featuredImage)}`)
  }

  return `---\n${lines.join('\n')}\n---`
}

function normalizeWordPressItem(hostname: string, kind: WordPressKind, item: WordPressItem): SyncedWordPressItem {
  const title = stripHtml(item.title?.rendered ?? item.slug)
  const body = item.content?.rendered ?? ''
  const excerpt = item.excerpt?.rendered ? stripHtml(item.excerpt.rendered) : ''
  const description = (excerpt || stripHtml(body) || title).slice(0, 240)
  const publishedAt = item.date || item.modified || new Date().toISOString()
  const updatedAt = item.modified || item.date || publishedAt
  const tags = collectTerms(item)
  const author = collectAuthor(item)
  const sourceUrl = item.link
  const featuredImage = item._embedded?.['wp:featuredmedia']?.[0]?.source_url?.trim() || undefined
  const wordTotal = wordCount(body)

  const itemBase: Omit<SyncedWordPressItem, 'markdown' | 'meta'> = {
    slug: buildSourceSlug(hostname, kind, item.id, item.slug),
    title,
    type: kind === 'post' ? 'wordpress-post' : 'wordpress-page',
    author,
    tags,
    description,
    publishedAt,
    updatedAt,
    wordCount: wordTotal,
    sourceUrl,
    sourceId: item.id,
    sourceKind: kind,
    sourceSlug: item.slug,
    featuredImage,
  }

  const meta: Record<string, unknown> = {
    title,
    slug: itemBase.slug,
    author,
    tags,
    description,
    date: publishedAt.slice(0, 10),
    updated: updatedAt,
    status: 'published',
    source_system: 'wordpress',
    source_url: sourceUrl,
    source_id: item.id,
    source_kind: kind,
    source_slug: item.slug,
    word_count: wordTotal,
  }

  if (featuredImage) {
    meta.featured_image = featuredImage
  }

  const markdown = `${buildFrontmatter({ ...itemBase, markdown: '', meta: {} })}\n\n${body.trim() || `<!-- Empty WordPress content for ${title} -->`}`
  return { ...itemBase, markdown, meta }
}

function buildAuthHeader(env: Env): string | null {
  const rawHeader = env.WORDPRESS_AUTH_HEADER?.trim()
  if (rawHeader) return rawHeader

  const username = env.WORDPRESS_USERNAME?.trim()
  const appPassword = env.WORDPRESS_APP_PASSWORD?.trim()
  if (!username || !appPassword) return null

  return `Basic ${btoa(`${username}:${appPassword}`)}`
}

async function fetchWordPressCollection(
  siteUrl: string,
  kind: WordPressKind,
  authHeader: string | null,
  fetchImpl: typeof fetch,
): Promise<WordPressItem[]> {
  const items: WordPressItem[] = []
  let page = 1
  let totalPages = 1
  const fields = [
    'id',
    'slug',
    'link',
    'title',
    'content',
    'excerpt',
    'date',
    'modified',
    '_embedded',
  ].join(',')

  do {
    const url = new URL(`/wp-json/wp/v2/${kind}s`, siteUrl)
    url.searchParams.set('context', 'view')
    url.searchParams.set('status', 'publish')
    url.searchParams.set('orderby', 'modified')
    url.searchParams.set('order', 'asc')
    url.searchParams.set('per_page', '100')
    url.searchParams.set('page', String(page))
    url.searchParams.set('_embed', '1')
    url.searchParams.set('_fields', fields)

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; InkwellWordPressSync/1.0)',
    }
    if (authHeader) headers.Authorization = authHeader

    const response = await fetchImpl(url, { headers })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`WordPress ${kind} sync failed (${response.status}): ${text || response.statusText}`)
    }

    items.push(...await response.json() as WordPressItem[])
    const headerPages = Number.parseInt(response.headers.get('X-WP-TotalPages') ?? '1', 10)
    totalPages = Number.isFinite(headerPages) && headerPages > 0 ? headerPages : 1
    page += 1
  } while (page <= totalPages)

  return items
}

async function seedConnectorAccount(env: Env, customerSlug: string, connectorAccountId: string, siteUrl: string): Promise<void> {
  await env.DB_MARKETING.prepare(
    `INSERT INTO connector_accounts (id, customer_slug, connector_type, external_account_id, status, config_json, last_synced_at)
     VALUES (?, ?, 'wordpress', ?, 'active', ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       customer_slug = excluded.customer_slug,
       connector_type = excluded.connector_type,
       external_account_id = excluded.external_account_id,
       status = excluded.status,
       config_json = excluded.config_json,
       last_synced_at = excluded.last_synced_at,
       updated_at = CURRENT_TIMESTAMP`,
  ).bind(connectorAccountId, customerSlug, siteUrl, JSON.stringify({ siteUrl })).run()
}

async function createConnectorRun(env: Env, id: string, customerSlug: string, connectorAccountId: string, startedAt: string): Promise<void> {
  await env.DB_MARKETING.prepare(
    `INSERT INTO connector_runs (
       id, customer_slug, connector_type, connector_account_id, status, started_at, records_written, cursor_json, metadata_json
     ) VALUES (?, ?, 'wordpress', ?, 'running', ?, 0, ?, ?)`,
  ).bind(
    id,
    customerSlug,
    connectorAccountId,
    startedAt,
    JSON.stringify({ started_at: startedAt }),
    JSON.stringify({ site: 'wordpress' }),
  ).run()
}

async function finalizeConnectorRun(
  env: Env,
  id: string,
  status: 'completed' | 'failed',
  recordsWritten: number,
  cursor: Record<string, unknown>,
  metadata: Record<string, unknown>,
  errorMessage?: string,
): Promise<void> {
  await env.DB_MARKETING.prepare(
    `UPDATE connector_runs
     SET status = ?, records_written = ?, finished_at = ?, cursor_json = ?, metadata_json = ?, error_message = ?
     WHERE id = ?`,
  ).bind(status, recordsWritten, new Date().toISOString(), JSON.stringify(cursor), JSON.stringify(metadata), errorMessage ?? null, id).run()
}

async function upsertWordPressContent(env: Env, customerSlug: string, item: SyncedWordPressItem, connectorRunId: string): Promise<void> {
  await env.CONTENT.put(`post:${item.slug}`, item.markdown)
  await env.CONTENT.put(`meta:${item.slug}`, JSON.stringify(item.meta))

  await env.DB_ANALYTICS.prepare(
    `INSERT OR REPLACE INTO content_index (
      slug, title, type, lang, author, tags, description, published_at, updated_at, word_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    item.slug,
    item.title,
    item.type,
    'en',
    item.author,
    JSON.stringify(item.tags),
    item.description,
    item.publishedAt,
    item.updatedAt,
    item.wordCount,
  ).run()

  try {
    await env.DB_MARKETING.prepare(
      `INSERT OR REPLACE INTO marketing_snapshots (
        id, customer_slug, connector_type, metric_scope, metric_name, dimension_key, dimension_value,
        period_start, period_end, value_numeric, value_text, payload_json, observed_at, connector_run_id
      ) VALUES (?, ?, 'wordpress', 'content', 'sync_item', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      `wp-${customerSlug}-${item.slug}`,
      customerSlug,
      item.slug,
      item.sourceUrl,
      item.publishedAt,
      item.updatedAt,
      item.wordCount,
      item.title,
      JSON.stringify(item.meta),
      new Date().toISOString(),
      connectorRunId,
    ).run()
  } catch {
    // Best-effort telemetry only.
  }
}

async function deleteWordPressContent(env: Env, slug: string): Promise<void> {
  await env.CONTENT.delete(`post:${slug}`)
  await env.CONTENT.delete(`meta:${slug}`)
  await env.DB_ANALYTICS.prepare(
    `DELETE FROM content_index WHERE slug = ? AND type IN ('wordpress-post', 'wordpress-page')`,
  ).bind(slug).run()
}

async function listExistingWordPressSlugs(env: Env): Promise<string[]> {
  try {
    const rows = await env.DB_ANALYTICS.prepare(
      `SELECT slug FROM content_index WHERE type IN ('wordpress-post', 'wordpress-page')`,
    ).all<{ slug: string }>()
    return (rows.results ?? []).map((row) => row.slug)
  } catch {
    return []
  }
}

export async function syncWordPressContent(env: Env, fetchImpl: typeof fetch = fetch): Promise<WordPressSyncSummary> {
  const siteUrl = env.WORDPRESS_SITE_URL?.trim()
  if (!siteUrl) return { ok: false, skipped: true, reason: 'WORDPRESS_SITE_URL not configured' }

  const startedAt = new Date().toISOString()
  const customerSlug = env.WORDPRESS_CUSTOMER_SLUG?.trim() || normalizeSlug(new URL(env.SITE_URL).hostname.split('.')[0] ?? 'default')
  const connectorAccountId = `wordpress:${new URL(siteUrl).hostname}`
  const connectorRunId = `wp-sync-${crypto.randomUUID()}`
  const authHeader = buildAuthHeader(env)

  try {
    await seedConnectorAccount(env, customerSlug, connectorAccountId, siteUrl)
    await createConnectorRun(env, connectorRunId, customerSlug, connectorAccountId, startedAt)

    const warnings: string[] = []
    let posts: WordPressItem[] = []
    let pages: WordPressItem[] = []

    try {
      posts = await fetchWordPressCollection(siteUrl, 'post', authHeader, fetchImpl)
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : `post sync failed: ${String(error)}`)
    }

    try {
      pages = await fetchWordPressCollection(siteUrl, 'page', authHeader, fetchImpl)
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : `page sync failed: ${String(error)}`)
    }

    if (posts.length === 0 && pages.length === 0) {
      throw new Error(warnings[0] || 'WordPress sync returned no content')
    }

    const hostname = new URL(siteUrl).hostname
    const normalized = [
      ...posts.map((item) => normalizeWordPressItem(hostname, 'post', item)),
      ...pages.map((item) => normalizeWordPressItem(hostname, 'page', item)),
    ]

    let upserted = 0
    for (const item of normalized) {
      await upsertWordPressContent(env, customerSlug, item, connectorRunId)
      upserted += 1
    }

    const existingSlugs = await listExistingWordPressSlugs(env)
    const currentSlugs = new Set(normalized.map((item) => item.slug))
    let deleted = 0
    for (const slug of existingSlugs) {
      if (currentSlugs.has(slug)) continue
      await deleteWordPressContent(env, slug)
      deleted += 1
    }

    await finalizeConnectorRun(
      env,
      connectorRunId,
      'completed',
      upserted,
      { last_synced_at: new Date().toISOString(), source: siteUrl, posts: posts.length, pages: pages.length, upserted, deleted, warnings },
      { sync_scope: 'published-content', source: siteUrl, posts: posts.length, pages: pages.length, deleted, warnings },
    )

    await env.DB_MARKETING.prepare(
      `UPDATE connector_accounts SET last_synced_at = datetime('now'), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(connectorAccountId).run()

    return {
      ok: true,
      sourceUrl: siteUrl,
      customerSlug,
      posts: posts.length,
      pages: pages.length,
      upserted,
      deleted,
      connectorRunId,
      warnings: warnings.length ? warnings : undefined,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try {
      await finalizeConnectorRun(
        env,
        connectorRunId,
        'failed',
        0,
        { source: siteUrl, failed_at: new Date().toISOString() },
        { sync_scope: 'published-content', source: siteUrl, error: message },
        message,
      )
    } catch {
      // Best-effort logging only.
    }

    return { ok: false, sourceUrl: siteUrl, customerSlug, error: message, connectorRunId }
  }
}

