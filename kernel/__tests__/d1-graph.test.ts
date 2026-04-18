import { describe, it, expect, vi } from 'vitest'
import { D1GraphAdapter } from '../adapters/d1-graph'

function mockDb() {
  return {
    query: vi.fn().mockResolvedValue([]),
    queryOne: vi.fn().mockResolvedValue(null),
    execute: vi.fn().mockResolvedValue({ changes: 0 }),
    batch: vi.fn().mockResolvedValue(undefined),
  }
}

describe('D1GraphAdapter', () => {
  describe('upsertNode', () => {
    it('calls execute with INSERT ... ON CONFLICT SQL', async () => {
      const db = mockDb()
      const adapter = new D1GraphAdapter(db)

      await adapter.upsertNode({
        slug: 'hello-world',
        tenant: 'acme',
        title: 'Hello World',
        type: 'blog',
        tags: ['intro', 'test'],
        visibility: 'public',
        author: 'alice',
        date: '2026-01-01',
        url: '/hello-world',
      })

      expect(db.execute).toHaveBeenCalledTimes(1)
      const [sql, params] = db.execute.mock.calls[0]
      expect(sql).toContain('INSERT INTO graph_nodes')
      expect(sql).toContain('ON CONFLICT')
      expect(params).toContain('hello-world')
      expect(params).toContain('acme')
      expect(params).toContain('Hello World')
      expect(params).toContain('blog')
      expect(params).toContain(JSON.stringify(['intro', 'test']))
      expect(params).toContain('public')
    })
  })

  describe('upsertEdge', () => {
    it('calls execute with INSERT into graph_edges', async () => {
      const db = mockDb()
      const adapter = new D1GraphAdapter(db)

      await adapter.upsertEdge({
        source: 'page-a',
        target: 'page-b',
        type: 'wikilink',
        tenant: 'acme',
        weight: 2,
      })

      expect(db.execute).toHaveBeenCalledTimes(1)
      const [sql, params] = db.execute.mock.calls[0]
      expect(sql).toContain('INSERT INTO graph_edges')
      expect(params).toEqual(['page-a', 'page-b', 'wikilink', 'acme', 2])
    })

    it('defaults weight to 1 when not provided', async () => {
      const db = mockDb()
      const adapter = new D1GraphAdapter(db)

      await adapter.upsertEdge({
        source: 'a',
        target: 'b',
        type: 'tag',
      })

      const [, params] = db.execute.mock.calls[0]
      expect(params[4]).toBe(1)
    })
  })

  describe('ingest', () => {
    it('calls execute for each node and edge', async () => {
      const db = mockDb()
      const adapter = new D1GraphAdapter(db)

      await adapter.ingest({
        nodes: [
          { slug: 'a', title: 'A', type: 'blog', tags: [], visibility: 'public' },
          { slug: 'b', title: 'B', type: 'blog', tags: [], visibility: 'public' },
        ],
        edges: [
          { source: 'a', target: 'b', type: 'wikilink' },
        ],
      })

      expect(db.execute).toHaveBeenCalledTimes(3)
    })
  })

  describe('getBacklinks', () => {
    it('queries edges WHERE target = slug', async () => {
      const db = mockDb()
      db.query.mockResolvedValue([
        { source: 'page-a', target: 'page-b', type: 'wikilink', tenant: '', weight: 1 },
      ])
      const adapter = new D1GraphAdapter(db)

      const result = await adapter.getBacklinks('page-b')

      expect(db.query).toHaveBeenCalledTimes(1)
      const [sql, params] = db.query.mock.calls[0]
      expect(sql).toContain('WHERE target = ?')
      expect(params).toEqual(['page-b'])
      expect(result).toHaveLength(1)
      expect(result[0].source).toBe('page-a')
    })

    it('adds tenant filter when tenant is passed', async () => {
      const db = mockDb()
      db.query.mockResolvedValue([])
      const adapter = new D1GraphAdapter(db)

      await adapter.getBacklinks('page-b', 'acme')

      const [sql, params] = db.query.mock.calls[0]
      expect(sql).toContain('AND tenant = ?')
      expect(params).toEqual(['page-b', 'acme'])
    })
  })

  describe('getNode', () => {
    it('returns null when queryOne returns null', async () => {
      const db = mockDb()
      const adapter = new D1GraphAdapter(db)

      const result = await adapter.getNode('nonexistent')

      expect(result).toBeNull()
    })

    it('returns parsed node with JSON tags', async () => {
      const db = mockDb()
      db.queryOne.mockResolvedValue({
        slug: 'hello',
        tenant: 'acme',
        title: 'Hello',
        type: 'blog',
        tags: '["intro","test"]',
        visibility: 'public',
        author: 'alice',
        date: '2026-01-01',
        url: '/hello',
      })
      const adapter = new D1GraphAdapter(db)

      const result = await adapter.getNode('hello', 'acme')

      expect(result).not.toBeNull()
      expect(result!.slug).toBe('hello')
      expect(result!.tags).toEqual(['intro', 'test'])
      expect(result!.author).toBe('alice')
    })

    it('adds tenant filter when tenant is passed', async () => {
      const db = mockDb()
      const adapter = new D1GraphAdapter(db)

      await adapter.getNode('hello', 'acme')

      const [sql, params] = db.queryOne.mock.calls[0]
      expect(sql).toContain('AND tenant = ?')
      expect(params).toEqual(['hello', 'acme'])
    })
  })

  describe('queryNodes', () => {
    it('filters by tag using LIKE', async () => {
      const db = mockDb()
      db.query.mockResolvedValue([])
      const adapter = new D1GraphAdapter(db)

      await adapter.queryNodes({ tag: 'intro' })

      const [sql, params] = db.query.mock.calls[0]
      expect(sql).toContain('tags LIKE ?')
      expect(params).toEqual(['%"intro"%'])
    })

    it('filters by type', async () => {
      const db = mockDb()
      db.query.mockResolvedValue([])
      const adapter = new D1GraphAdapter(db)

      await adapter.queryNodes({ type: 'blog' })

      const [sql, params] = db.query.mock.calls[0]
      expect(sql).toContain('type = ?')
      expect(params).toEqual(['blog'])
    })

    it('filters by tenant and visibility together', async () => {
      const db = mockDb()
      db.query.mockResolvedValue([])
      const adapter = new D1GraphAdapter(db)

      await adapter.queryNodes({ tenant: 'acme', visibility: 'public' })

      const [sql, params] = db.query.mock.calls[0]
      expect(sql).toContain('tenant = ?')
      expect(sql).toContain('visibility = ?')
      expect(params).toEqual(['acme', 'public'])
    })

    it('returns parsed nodes with tags array', async () => {
      const db = mockDb()
      db.query.mockResolvedValue([
        { slug: 'a', tenant: 'acme', title: 'A', type: 'blog', tags: '["x"]', visibility: 'public', author: null, date: null, url: null },
      ])
      const adapter = new D1GraphAdapter(db)

      const result = await adapter.queryNodes({ tenant: 'acme' })

      expect(result).toHaveLength(1)
      expect(result[0].tags).toEqual(['x'])
      expect(result[0].author).toBeUndefined()
    })
  })

  describe('getNeighbors', () => {
    it('performs BFS and returns edges from first hop', async () => {
      const db = mockDb()
      // First call: edge query for BFS
      db.query
        .mockResolvedValueOnce([
          { source: 'a', target: 'b', type: 'wikilink', tenant: '', weight: 1 },
        ])
        // Second call: node query for visited slugs
        .mockResolvedValueOnce([
          { slug: 'a', tenant: '', title: 'A', type: 'blog', tags: '[]', visibility: 'public', author: null, date: null, url: null },
          { slug: 'b', tenant: '', title: 'B', type: 'blog', tags: '[]', visibility: 'public', author: null, date: null, url: null },
        ])

      const adapter = new D1GraphAdapter(db)
      const result = await adapter.getNeighbors('a', 1)

      expect(result.edges).toHaveLength(1)
      expect(result.edges[0].source).toBe('a')
      expect(result.edges[0].target).toBe('b')
      expect(result.nodes).toHaveLength(2)
    })

    it('returns empty graph when no edges found', async () => {
      const db = mockDb()
      // BFS edge query returns empty
      db.query
        .mockResolvedValueOnce([])
        // Node query for just the seed slug
        .mockResolvedValueOnce([])

      const adapter = new D1GraphAdapter(db)
      const result = await adapter.getNeighbors('lonely')

      expect(result.edges).toEqual([])
      expect(result.nodes).toEqual([])
    })
  })
})
