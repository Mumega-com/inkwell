import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { DatabasePort } from '../types'
import { StandaloneMemoryAdapter } from '../adapters/standalone-memory'
import { SOSMemoryAdapter } from '../adapters/sos-memory'
import { selectMirrorMemoryAdapter, UnavailableMirrorMemoryAdapter } from '../adapters/select-mirror-memory'
import {
  authorPage,
  backlinksOf,
  ensureAuthoredSchema,
  listPages,
  lookupPage,
  neighborsOf,
  projectRevision,
  readAudit,
  replayProjection,
  resolveScope,
  revokeAccess,
  scopedMcpCall,
  searchPages,
  updatePage,
  visibleCounts,
  withdrawPage,
  type ProjectionBody,
  type TrustedIdentity,
} from '../scoped-authored'

const ALPHA_PUBLIC = 'What Mirror is: a working memory of the actual work. ALPHA-PUBLIC'
const BETA_PUBLIC = 'What Mirror is inside Beta. BETA-SECRET-TITLE BETA-SECRET-BODY'
const ALPHA_PRIVATE = 'How this business works at Alpha. ALPHA-PRIVATE'
const BETA_PRIVATE = 'How this business works at Beta. BETA-PRIVATE'

function openDb(path: string): DatabasePort & { close(): void } {
  const sqlite = new DatabaseSync(path)
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      return sqlite.prepare(sql).all(...(params as never[])) as T[]
    },
    async queryOne<T>(sql: string, params: unknown[] = []) {
      return (sqlite.prepare(sql).get(...(params as never[])) as T | undefined) ?? null
    },
    async execute(sql: string, params: unknown[] = []) {
      const result = sqlite.prepare(sql).run(...(params as never[]))
      return { changes: Number(result.changes) }
    },
    async batch(statements) {
      for (const statement of statements) await this.execute(statement.sql, statement.params)
    },
    close() {
      sqlite.close()
    },
  }
}

function identity(projectId: string, principalId: string, role: TrustedIdentity['role'] = 'owner'): TrustedIdentity {
  return { tenantId: 'tenant-synth', projectId, principalId, role }
}

describe('scoped authored memory', () => {
  it('keeps two projects distinct, durable, and hidden from each other', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'inkwell-scoped-'))
    const path = join(dir, 'pages.sqlite')
    const db = openDb(path)
    await ensureAuthoredSchema(db)
    const ada = await resolveScope(db, identity('alpha', 'ada', 'owner'))
    const bea = await resolveScope(db, identity('beta', 'bea', 'owner'))
    const vic = await resolveScope(db, identity('alpha', 'vic', 'viewer'))

    await authorPage(db, ada, {
      slug: 'how-this-business-works',
      title: 'How Alpha works',
      body: ALPHA_PRIVATE,
      visibility: 'private',
      project: 'beta',
      agent: 'bea',
    })
    await authorPage(db, bea, {
      slug: 'how-this-business-works',
      title: 'BETA-PRIVATE',
      body: BETA_PRIVATE,
      visibility: 'private',
    })
    await authorPage(db, ada, {
      slug: 'what-mirror-is',
      title: 'What Mirror is',
      body: ALPHA_PUBLIC,
      visibility: 'public',
      links: ['how-this-business-works'],
      approved: true,
    })
    await authorPage(db, bea, {
      slug: 'what-mirror-is',
      title: 'BETA-SECRET-TITLE',
      body: BETA_PUBLIC,
      visibility: 'public',
      links: ['how-this-business-works'],
    })

    const calls: ProjectionBody[] = []
    const sink = {
      async accept(body: ProjectionBody) {
        calls.push(body)
        return { receiptId: `receipt-${body.projectId}-${body.slug}-${body.revision}` }
      },
    }
    const projected = await projectRevision(db, ada, 'what-mirror-is', sink)
    expect(projected.status).toBe('accepted')
    expect(projected.approved).toBe(false)
    expect(calls[0].text).toBe(ALPHA_PUBLIC)
    expect(calls[0].synthesized).toBe(false)
    expect(calls[0].approved).toBe(false)
    expect(calls[0].projectId).toBe('alpha')

    db.close()
    const reopened = openDb(path)
    const again = await lookupPage(reopened, ada, 'what-mirror-is')
    expect(again?.body).toBe(ALPHA_PUBLIC)
    expect(again?.revision).toBe(1)
    const sameSlug = await reopened.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM authored_pages WHERE slug = ?`,
      ['what-mirror-is'],
    )
    expect(sameSlug[0].n).toBe(2)

    await updatePage(reopened, ada, 'what-mirror-is', 'revision two ALPHA-CURRENT')
    const second = await projectRevision(reopened, ada, 'what-mirror-is', sink)
    expect(second.status).toBe('accepted')
    expect(second.revision).toBe(2)
    const stale = await replayProjection(reopened, ada, 'what-mirror-is', 1, sink)
    expect(stale.status).toBe('rejected_stale')
    expect(calls.some(call => call.revision === 1 && call.text !== ALPHA_PUBLIC)).toBe(false)
    expect((await lookupPage(reopened, ada, 'what-mirror-is'))?.body).toBe('revision two ALPHA-CURRENT')

    const beforeRetry = calls.length
    const retry = await projectRevision(reopened, ada, 'what-mirror-is', sink)
    expect(retry.duplicate).toBe(true)
    expect(retry.receiptId).toBe(second.receiptId)
    expect(calls.length).toBe(beforeRetry)
    const projectedAudits = await reopened.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM authored_page_audit WHERE slug = ? AND project_id = ? AND action = 'projected'`,
      ['what-mirror-is', 'alpha'],
    )
    expect(projectedAudits[0].n).toBe(2)

    await withdrawPage(reopened, ada, 'how-this-business-works')
    expect(await lookupPage(reopened, ada, 'how-this-business-works')).toBeNull()
    const audit = await readAudit(reopened, ada, 'how-this-business-works')
    expect(audit.some(item => item.action === 'authored')).toBe(true)
    expect(audit.some(item => item.action === 'withdrawn')).toBe(true)
    const raw = await reopened.queryOne(`SELECT slug FROM authored_pages WHERE slug = ? AND project_id = ?`, ['how-this-business-works', 'alpha'])
    expect(raw).not.toBeNull()

    const ownerNeighbors = await neighborsOf(reopened, ada, 'what-mirror-is')
    expect(ownerNeighbors.nodes.some(node => node.title === 'How Alpha works')).toBe(false)
    const viewerNeighbors = await neighborsOf(reopened, vic, 'what-mirror-is')
    const viewerBacklinks = await backlinksOf(reopened, vic, 'what-mirror-is')
    const viewerList = await listPages(reopened, vic)
    const viewerSearch = await searchPages(reopened, vic, 'BETA-SECRET')
    const viewerCounts = await visibleCounts(reopened, vic)
    const mcp = await scopedMcpCall(reopened, vic, 'graph_search', { query: 'BETA-SECRET', project: 'beta', agent: 'bea' })
    const mcpLookup = await scopedMcpCall(reopened, vic, 'graph_lookup', { slug: 'what-mirror-is', project: 'beta' })
    const mcpList = await scopedMcpCall(reopened, vic, 'graph_list', { project: 'beta', agent: 'bea' })
    const blob = JSON.stringify({ viewerNeighbors, viewerBacklinks, viewerList, viewerSearch, viewerCounts, mcp, mcpLookup, mcpList })
    expect(blob).not.toContain('BETA-SECRET')
    expect(blob).not.toContain('BETA-PRIVATE')
    expect(blob).not.toContain('ALPHA-PRIVATE')
    expect(viewerCounts.pages).toBe(1)
    expect(viewerCounts.nodes).toBe(1)
    expect(viewerCounts.edges).toBe(0)
    expect((mcpLookup as { result: { body: string } }).result.body).toContain('ALPHA-CURRENT')

    await revokeAccess(reopened, identity('alpha', 'vic', 'viewer'))
    const revoked = await resolveScope(reopened, identity('alpha', 'vic', 'viewer'))
    expect(revoked.readableProjectIds).toEqual([])
    const denied = await scopedMcpCall(reopened, revoked, 'graph_list', { project: 'alpha' })
    expect(denied).toMatchObject({ error: 'grant_revoked', results: null })
    expect(JSON.stringify(denied)).not.toContain('ALPHA-CURRENT')
    expect(await lookupPage(reopened, revoked, 'what-mirror-is')).toBeNull()

    reopened.close()
  })

  it('keeps a failed projection visible instead of substituting the in-process map', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'inkwell-failed-'))
    const db = openDb(join(dir, 'pages.sqlite'))
    await ensureAuthoredSchema(db)
    const ada = await resolveScope(db, identity('alpha', 'ada', 'owner'))
    await authorPage(db, ada, {
      slug: 'what-mirror-is',
      title: 'What Mirror is',
      body: ALPHA_PUBLIC,
      visibility: 'public',
    })
    const map = new StandaloneMemoryAdapter()
    const result = await projectRevision(db, ada, 'what-mirror-is', {
      async accept() {
        const pending = await db.queryOne<{ projection_status: string }>(
          `SELECT projection_status FROM authored_pages WHERE slug = ?`,
          ['what-mirror-is'],
        )
        expect(pending?.projection_status).toBe('pending')
        throw new Error('upstream down')
      },
    })
    expect(result.status).toBe('failed')
    expect(result).not.toEqual([])
    expect(await map.search(ALPHA_PUBLIC)).toEqual([])
    const row = await db.queryOne<{ projection_status: string; projection_error: string }>(
      `SELECT projection_status, projection_error FROM authored_pages WHERE slug = ?`,
      ['what-mirror-is'],
    )
    expect(row?.projection_status).toBe('failed')
    expect(row?.projection_error).toBe('upstream down')
    db.close()
  })

  it('does not hide an upstream Mirror failure as an empty recall or a process map', async () => {
    const adapter = selectMirrorMemoryAdapter({}, 'tenant-synth')
    expect(adapter).toBeInstanceOf(UnavailableMirrorMemoryAdapter)
    expect(adapter).not.toBeInstanceOf(StandaloneMemoryAdapter)
    await expect(adapter.recall('what mirror is')).rejects.toMatchObject({ projectionStatus: 'failed' })

    const previous = globalThis.fetch
    globalThis.fetch = async () => new Response('no', { status: 503 })
    try {
      const remote = new SOSMemoryAdapter('http://127.0.0.1:9', 'token', 'inkwell')
      await expect(remote.search('what mirror is')).rejects.toMatchObject({ projectionStatus: 'failed' })
    } finally {
      globalThis.fetch = previous
    }
  })
})
