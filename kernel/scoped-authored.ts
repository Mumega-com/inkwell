/**
 * Authored Inkwell pages and the project-scoped graph.
 *
 * Tenant, project, and principal come from the trusted scope. A title, slug,
 * or agent name in the write body does not grant access to another project.
 * Projecting a page records that revision in memory. It does not approve it.
 */
import { createHash } from 'node:crypto'
import type { DatabasePort } from './types'

export interface TrustedIdentity {
  tenantId: string
  projectId: string
  principalId: string
  role?: string
}

export interface TrustedScope {
  tenantId: string
  projectId: string
  principalId: string
  readableProjectIds: readonly string[]
  canReadPrivate: boolean
}

export interface AuthoredInput {
  slug: string
  title: string
  body: string
  visibility: 'public' | 'private'
  links?: string[]
  /** Ignored. Authority comes from the scope. */
  project?: string
  agent?: string
  tenant?: string
  approved?: boolean
}

export interface ProjectionBody {
  slug: string
  text: string
  title: string
  revision: number
  visibility: 'public' | 'private'
  contentHash: string
  idempotencyKey: string
  tenantId: string
  projectId: string
  principalId: string
  synthesized: false
  approved: false
}

export interface ProjectionSink {
  accept(body: ProjectionBody): Promise<{ receiptId: string; status?: 'accepted' | 'rejected_stale' }>
}

export interface ProjectionResult {
  status: 'accepted' | 'failed' | 'pending' | 'rejected_stale'
  error?: string
  receiptId?: string
  revision?: number
  duplicate?: boolean
  approved: false
}

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS authored_pages (
    tenant_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    visibility TEXT NOT NULL,
    revision INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    author_principal TEXT NOT NULL,
    projection_status TEXT NOT NULL DEFAULT 'pending',
    projection_error TEXT,
    accepted_revision INTEGER,
    receipt_id TEXT,
    withdrawn INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (tenant_id, project_id, slug)
  )`,
  `CREATE TABLE IF NOT EXISTS authored_page_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    revision INTEGER NOT NULL,
    action TEXT NOT NULL,
    at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS access_revocations (
    tenant_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    principal_id TEXT NOT NULL,
    revoked_at TEXT NOT NULL,
    PRIMARY KEY (tenant_id, project_id, principal_id)
  )`,
  `CREATE TABLE IF NOT EXISTS graph_nodes (
    slug TEXT NOT NULL,
    tenant TEXT NOT NULL DEFAULT '',
    project TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'page',
    tags TEXT NOT NULL DEFAULT '[]',
    visibility TEXT NOT NULL DEFAULT 'public',
    author TEXT,
    date TEXT,
    url TEXT,
    withdrawn INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (slug, tenant, project)
  )`,
  `CREATE TABLE IF NOT EXISTS graph_edges (
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'wikilink',
    tenant TEXT NOT NULL DEFAULT '',
    project TEXT NOT NULL DEFAULT '',
    weight REAL NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (source, target, type, tenant, project)
  )`,
]

export async function ensureAuthoredSchema(db: DatabasePort): Promise<void> {
  for (const sql of STATEMENTS) await db.execute(sql)
}

function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

function now(): string {
  return new Date().toISOString()
}

function idempotencyKey(scope: TrustedScope, slug: string, revision: number, contentHash: string): string {
  return hash(`${scope.tenantId}|${scope.projectId}|${slug}|${revision}|${contentHash}`)
}

export async function resolveScope(db: DatabasePort, identity: TrustedIdentity): Promise<TrustedScope> {
  const denied = !identity.tenantId || !identity.projectId || !identity.principalId
  const revoked = denied
    ? true
    : Boolean(await db.queryOne(
      `SELECT principal_id FROM access_revocations
       WHERE tenant_id = ? AND project_id = ? AND principal_id = ?`,
      [identity.tenantId, identity.projectId, identity.principalId],
    ))
  const canReadPrivate = identity.role === 'owner' || identity.role === 'admin'
  if (denied || revoked) {
    return {
      tenantId: identity.tenantId,
      projectId: identity.projectId,
      principalId: identity.principalId,
      readableProjectIds: [],
      canReadPrivate: false,
    }
  }
  return {
    tenantId: identity.tenantId,
    projectId: identity.projectId,
    principalId: identity.principalId,
    readableProjectIds: [identity.projectId],
    canReadPrivate,
  }
}

export async function revokeAccess(db: DatabasePort, identity: TrustedIdentity): Promise<void> {
  await db.execute(
    `INSERT INTO access_revocations (tenant_id, project_id, principal_id, revoked_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (tenant_id, project_id, principal_id) DO UPDATE SET revoked_at = excluded.revoked_at`,
    [identity.tenantId, identity.projectId, identity.principalId, now()],
  )
}

interface PageRow {
  tenant_id: string
  project_id: string
  slug: string
  title: string
  body: string
  visibility: 'public' | 'private'
  revision: number
  content_hash: string
  author_principal: string
  projection_status: string
  projection_error: string | null
  accepted_revision: number | null
  receipt_id: string | null
  withdrawn: number
}

async function pageRow(db: DatabasePort, scope: TrustedScope, slug: string): Promise<PageRow | null> {
  return db.queryOne<PageRow>(
    `SELECT * FROM authored_pages WHERE tenant_id = ? AND project_id = ? AND slug = ?`,
    [scope.tenantId, scope.projectId, slug],
  )
}

function canRead(scope: TrustedScope, visibility: string, author: string | null, withdrawn: number): boolean {
  if (!scope.readableProjectIds.includes(scope.projectId)) return false
  if (withdrawn) return false
  if (visibility === 'private' && !scope.canReadPrivate && author !== scope.principalId) return false
  return true
}

async function audit(db: DatabasePort, scope: TrustedScope, slug: string, revision: number, action: string): Promise<void> {
  await db.execute(
    `INSERT INTO authored_page_audit (tenant_id, project_id, slug, revision, action, at) VALUES (?, ?, ?, ?, ?, ?)`,
    [scope.tenantId, scope.projectId, slug, revision, action, now()],
  )
}

export async function authorPage(db: DatabasePort, scope: TrustedScope, input: AuthoredInput): Promise<PageRow> {
  if (!scope.readableProjectIds.includes(scope.projectId)) {
    throw Object.assign(new Error('grant_revoked'), { projectionStatus: 'failed' })
  }
  const contentHash = hash(input.body)
  const stamp = now()
  await db.execute(
    `INSERT INTO authored_pages (
      tenant_id, project_id, slug, title, body, visibility, revision, content_hash,
      author_principal, projection_status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 'pending', ?)`,
    [scope.tenantId, scope.projectId, input.slug, input.title, input.body, input.visibility, contentHash, scope.principalId, stamp],
  )
  await db.execute(
    `INSERT INTO graph_nodes (slug, tenant, project, title, type, tags, visibility, author, url, withdrawn)
     VALUES (?, ?, ?, ?, 'page', '[]', ?, ?, ?, 0)`,
    [input.slug, scope.tenantId, scope.projectId, input.title, input.visibility, scope.principalId, `/${scope.projectId}/${input.slug}`],
  )
  await linkWithinProject(db, scope, input.slug, input.links ?? [])
  await audit(db, scope, input.slug, 1, 'authored')
  const row = await pageRow(db, scope, input.slug)
  if (!row) throw new Error('page_missing')
  return row
}

async function linkWithinProject(db: DatabasePort, scope: TrustedScope, slug: string, links: string[]): Promise<void> {
  for (const target of links) {
    const node = await db.queryOne<{ slug: string }>(
      `SELECT slug FROM graph_nodes WHERE slug = ? AND tenant = ? AND project = ? AND withdrawn = 0`,
      [target, scope.tenantId, scope.projectId],
    )
    if (!node) continue
    await db.execute(
      `INSERT INTO graph_edges (source, target, type, tenant, project, weight) VALUES (?, ?, 'wikilink', ?, ?, 1)
       ON CONFLICT (source, target, type, tenant, project) DO NOTHING`,
      [slug, target, scope.tenantId, scope.projectId],
    )
    await db.execute(
      `INSERT INTO graph_edges (source, target, type, tenant, project, weight) VALUES (?, ?, 'backlink', ?, ?, 1)
       ON CONFLICT (source, target, type, tenant, project) DO NOTHING`,
      [target, slug, scope.tenantId, scope.projectId],
    )
  }
}

export async function updatePage(db: DatabasePort, scope: TrustedScope, slug: string, body: string, title?: string): Promise<PageRow> {
  const current = await pageRow(db, scope, slug)
  if (!current || current.withdrawn || !scope.readableProjectIds.includes(scope.projectId)) {
    throw Object.assign(new Error('not_found'), { projectionStatus: 'failed' })
  }
  const revision = current.revision + 1
  const contentHash = hash(body)
  const nextTitle = title ?? current.title
  await db.execute(
    `UPDATE authored_pages
     SET body = ?, title = ?, revision = ?, content_hash = ?, projection_status = 'pending', updated_at = ?
     WHERE tenant_id = ? AND project_id = ? AND slug = ?`,
    [body, nextTitle, revision, contentHash, now(), scope.tenantId, scope.projectId, slug],
  )
  await db.execute(
    `UPDATE graph_nodes SET title = ?, updated_at = ? WHERE slug = ? AND tenant = ? AND project = ?`,
    [nextTitle, now(), slug, scope.tenantId, scope.projectId],
  )
  await audit(db, scope, slug, revision, 'revised')
  const row = await pageRow(db, scope, slug)
  if (!row) throw new Error('page_missing')
  return row
}

export async function projectRevision(db: DatabasePort, scope: TrustedScope, slug: string, sink: ProjectionSink): Promise<ProjectionResult> {
  if (!scope.readableProjectIds.includes(scope.projectId)) {
    return { status: 'failed', error: 'grant_revoked', approved: false }
  }
  const page = await pageRow(db, scope, slug)
  if (!page || page.withdrawn) return { status: 'failed', error: 'not_found', approved: false }
  const key = idempotencyKey(scope, slug, page.revision, page.content_hash)
  if (page.receipt_id && page.accepted_revision === page.revision && page.projection_status === 'accepted') {
    return { status: 'accepted', duplicate: true, receiptId: page.receipt_id, revision: page.revision, approved: false }
  }
  await db.execute(
    `UPDATE authored_pages SET projection_status = 'pending', projection_error = NULL
     WHERE tenant_id = ? AND project_id = ? AND slug = ?`,
    [scope.tenantId, scope.projectId, slug],
  )
  try {
    const accepted = await sink.accept({
      slug: page.slug,
      text: page.body,
      title: page.title,
      revision: page.revision,
      visibility: page.visibility,
      contentHash: page.content_hash,
      idempotencyKey: key,
      tenantId: scope.tenantId,
      projectId: scope.projectId,
      principalId: scope.principalId,
      synthesized: false,
      approved: false,
    })
    if (accepted.status === 'rejected_stale') {
      return { status: 'rejected_stale', revision: page.revision, approved: false }
    }
    await db.execute(
      `UPDATE authored_pages
       SET projection_status = 'accepted', accepted_revision = ?, receipt_id = ?, projection_error = NULL
       WHERE tenant_id = ? AND project_id = ? AND slug = ?`,
      [page.revision, accepted.receiptId, scope.tenantId, scope.projectId, slug],
    )
    await audit(db, scope, slug, page.revision, 'projected')
    return { status: 'accepted', receiptId: accepted.receiptId, revision: page.revision, duplicate: false, approved: false }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'upstream_failure'
    await db.execute(
      `UPDATE authored_pages SET projection_status = 'failed', projection_error = ?
       WHERE tenant_id = ? AND project_id = ? AND slug = ?`,
      [message, scope.tenantId, scope.projectId, slug],
    )
    return { status: 'failed', error: message, approved: false }
  }
}

export async function replayProjection(
  db: DatabasePort,
  scope: TrustedScope,
  slug: string,
  revision: number,
  sink: ProjectionSink,
): Promise<ProjectionResult> {
  const page = await pageRow(db, scope, slug)
  if (!page) return { status: 'failed', error: 'not_found', approved: false }
  if (page.revision > revision) {
    return { status: 'rejected_stale', revision: page.revision, approved: false }
  }
  return projectRevision(db, scope, slug, sink)
}

export async function withdrawPage(db: DatabasePort, scope: TrustedScope, slug: string): Promise<void> {
  const page = await pageRow(db, scope, slug)
  if (!page || !scope.readableProjectIds.includes(scope.projectId)) {
    throw Object.assign(new Error('not_found'), { projectionStatus: 'failed' })
  }
  await db.execute(
    `UPDATE authored_pages SET withdrawn = 1, projection_status = 'withdrawn', updated_at = ?
     WHERE tenant_id = ? AND project_id = ? AND slug = ?`,
    [now(), scope.tenantId, scope.projectId, slug],
  )
  await db.execute(
    `UPDATE graph_nodes SET withdrawn = 1 WHERE slug = ? AND tenant = ? AND project = ?`,
    [slug, scope.tenantId, scope.projectId],
  )
  await audit(db, scope, slug, page.revision, 'withdrawn')
}

export async function readAudit(db: DatabasePort, scope: TrustedScope, slug: string): Promise<Array<{ action: string; revision: number }>> {
  if (!scope.readableProjectIds.includes(scope.projectId)) return []
  return db.query(
    `SELECT action, revision FROM authored_page_audit
     WHERE tenant_id = ? AND project_id = ? AND slug = ? ORDER BY id`,
    [scope.tenantId, scope.projectId, slug],
  )
}

interface NodeRow {
  slug: string
  tenant: string
  project: string
  title: string
  visibility: 'public' | 'private'
  author: string | null
  withdrawn: number
}

function nodeVisible(scope: TrustedScope, node: NodeRow): boolean {
  if (node.tenant !== scope.tenantId) return false
  if (!scope.readableProjectIds.includes(node.project)) return false
  return canRead(scope, node.visibility, node.author, node.withdrawn)
}

async function visibleNodes(db: DatabasePort, scope: TrustedScope): Promise<NodeRow[]> {
  if (scope.readableProjectIds.length === 0) return []
  const rows = await db.query<NodeRow>(
    `SELECT slug, tenant, project, title, visibility, author, withdrawn
     FROM graph_nodes WHERE tenant = ? AND project = ?`,
    [scope.tenantId, scope.projectId],
  )
  return rows.filter(node => nodeVisible(scope, node))
}

export async function lookupPage(db: DatabasePort, scope: TrustedScope, slug: string): Promise<{ slug: string; title: string; body: string; revision: number; visibility: string } | null> {
  const page = await pageRow(db, scope, slug)
  if (!page || !canRead(scope, page.visibility, page.author_principal, page.withdrawn)) return null
  return { slug: page.slug, title: page.title, body: page.body, revision: page.revision, visibility: page.visibility }
}

export async function searchPages(db: DatabasePort, scope: TrustedScope, query: string): Promise<Array<{ slug: string; title: string }>> {
  if (scope.readableProjectIds.length === 0) return []
  const rows = await db.query<PageRow>(
    `SELECT * FROM authored_pages
     WHERE tenant_id = ? AND project_id = ? AND (title LIKE ? OR body LIKE ?)`,
    [scope.tenantId, scope.projectId, `%${query}%`, `%${query}%`],
  )
  return rows
    .filter(page => canRead(scope, page.visibility, page.author_principal, page.withdrawn))
    .map(page => ({ slug: page.slug, title: page.title }))
}

export async function listPages(db: DatabasePort, scope: TrustedScope): Promise<Array<{ slug: string; title: string }>> {
  return searchPages(db, scope, '')
}

export async function neighborsOf(db: DatabasePort, scope: TrustedScope, slug: string): Promise<{ nodes: NodeRow[]; edges: Array<{ source: string; target: string }> }> {
  const nodes = await visibleNodes(db, scope)
  const allowed = new Set(nodes.map(node => node.slug))
  if (!allowed.has(slug)) return { nodes: [], edges: [] }
  const edges = await db.query<{ source: string; target: string }>(
    `SELECT source, target FROM graph_edges
     WHERE tenant = ? AND project = ? AND (source = ? OR target = ?)`,
    [scope.tenantId, scope.projectId, slug, slug],
  )
  const visibleEdges = edges.filter(edge => allowed.has(edge.source) && allowed.has(edge.target))
  const keep = new Set<string>([slug])
  for (const edge of visibleEdges) {
    keep.add(edge.source)
    keep.add(edge.target)
  }
  return { nodes: nodes.filter(node => keep.has(node.slug)), edges: visibleEdges }
}

export async function backlinksOf(db: DatabasePort, scope: TrustedScope, slug: string): Promise<{ edges: Array<{ source: string; target: string }>; sources: NodeRow[] }> {
  const graph = await neighborsOf(db, scope, slug)
  const edges = graph.edges.filter(edge => edge.target === slug)
  const sources = graph.nodes.filter(node => edges.some(edge => edge.source === node.slug))
  return { edges, sources }
}

export async function visibleCounts(db: DatabasePort, scope: TrustedScope): Promise<{ pages: number; nodes: number; edges: number }> {
  const pages = await listPages(db, scope)
  const nodes = await visibleNodes(db, scope)
  const allowed = new Set(nodes.map(node => node.slug))
  if (allowed.size === 0) return { pages: pages.length, nodes: 0, edges: 0 }
  const edges = await db.query<{ source: string; target: string }>(
    `SELECT source, target FROM graph_edges WHERE tenant = ? AND project = ?`,
    [scope.tenantId, scope.projectId],
  )
  return {
    pages: pages.length,
    nodes: nodes.length,
    edges: edges.filter(edge => allowed.has(edge.source) && allowed.has(edge.target)).length,
  }
}

export async function scopedMcpCall(
  db: DatabasePort,
  scope: TrustedScope,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (!scope.readableProjectIds.includes(scope.projectId)) {
    return { error: 'grant_revoked', results: null, approved: false }
  }
  const slug = typeof args.slug === 'string' ? args.slug : ''
  const query = typeof args.query === 'string' ? args.query : ''
  switch (name) {
    case 'graph_search':
    case 'search':
      return { results: await searchPages(db, scope, query), approved: false }
    case 'graph_lookup':
    case 'lookup':
      return { result: await lookupPage(db, scope, slug), approved: false }
    case 'graph_neighbors':
    case 'neighbors':
      return { ...(await neighborsOf(db, scope, slug)), approved: false }
    case 'graph_backlinks':
    case 'backlinks':
      return { ...(await backlinksOf(db, scope, slug)), approved: false }
    case 'graph_list':
    case 'list': {
      const pages = await listPages(db, scope)
      const counts = await visibleCounts(db, scope)
      return { pages, counts, approved: false }
    }
    default:
      return { error: 'unknown_tool', approved: false }
  }
}
