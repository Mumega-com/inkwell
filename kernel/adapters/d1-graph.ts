import type { GraphPort, GraphNode, GraphEdge, GraphData, DatabasePort } from '../types'

export class D1GraphAdapter implements GraphPort {
  constructor(private readonly db: DatabasePort) {}

  async upsertNode(node: GraphNode): Promise<void> {
    await this.db.execute(
      `INSERT INTO graph_nodes (slug, tenant, title, type, tags, visibility, author, date, url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (slug, tenant) DO UPDATE SET
         title = excluded.title, type = excluded.type, tags = excluded.tags,
         visibility = excluded.visibility, author = excluded.author,
         date = excluded.date, url = excluded.url`,
      [node.slug, node.tenant ?? '', node.title, node.type,
       JSON.stringify(node.tags), node.visibility,
       node.author ?? null, node.date ?? null, node.url ?? null]
    )
  }

  async upsertEdge(edge: GraphEdge): Promise<void> {
    await this.db.execute(
      `INSERT INTO graph_edges (source, target, type, tenant, weight)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (source, target, type, tenant) DO UPDATE SET
         weight = excluded.weight`,
      [edge.source, edge.target, edge.type, edge.tenant ?? '', edge.weight ?? 1]
    )
  }

  async ingest(data: GraphData): Promise<void> {
    for (const node of data.nodes) {
      await this.upsertNode(node)
    }
    for (const edge of data.edges) {
      await this.upsertEdge(edge)
    }
  }

  async getBacklinks(slug: string, tenant?: string): Promise<GraphEdge[]> {
    const params: unknown[] = [slug]
    let sql = 'SELECT source, target, type, tenant, weight FROM graph_edges WHERE target = ?'
    if (tenant) {
      sql += ' AND tenant = ?'
      params.push(tenant)
    }
    const rows = await this.db.query<{ source: string; target: string; type: string; tenant: string; weight: number }>(sql, params)
    return rows.map(r => ({ source: r.source, target: r.target, type: r.type as GraphEdge['type'], tenant: r.tenant, weight: r.weight }))
  }

  async getNeighbors(slug: string, depth = 1, tenant?: string): Promise<GraphData> {
    // BFS traversal up to `depth` hops
    const visitedSlugs = new Set<string>([slug])
    const allEdges: GraphEdge[] = []
    let frontier = [slug]

    for (let d = 0; d < depth; d++) {
      if (frontier.length === 0) break
      const placeholders = frontier.map(() => '?').join(',')
      const params: unknown[] = [...frontier, ...frontier]
      let sql = `SELECT source, target, type, tenant, weight FROM graph_edges
                 WHERE (source IN (${placeholders}) OR target IN (${placeholders}))`
      if (tenant) {
        sql += ' AND tenant = ?'
        params.push(tenant)
      }
      const edges = await this.db.query<{ source: string; target: string; type: string; tenant: string; weight: number }>(sql, params)

      const nextFrontier: string[] = []
      for (const e of edges) {
        allEdges.push({ source: e.source, target: e.target, type: e.type as GraphEdge['type'], tenant: e.tenant, weight: e.weight })
        if (!visitedSlugs.has(e.source)) { visitedSlugs.add(e.source); nextFrontier.push(e.source) }
        if (!visitedSlugs.has(e.target)) { visitedSlugs.add(e.target); nextFrontier.push(e.target) }
      }
      frontier = nextFrontier
    }

    // Fetch all visited nodes
    const slugs = [...visitedSlugs]
    const placeholders = slugs.map(() => '?').join(',')
    const nodeParams: unknown[] = [...slugs]
    let nodeSql = `SELECT slug, tenant, title, type, tags, visibility, author, date, url FROM graph_nodes WHERE slug IN (${placeholders})`
    if (tenant) {
      nodeSql += ' AND tenant = ?'
      nodeParams.push(tenant)
    }
    const nodeRows = await this.db.query<{ slug: string; tenant: string; title: string; type: string; tags: string; visibility: string; author: string | null; date: string | null; url: string | null }>(nodeSql, nodeParams)

    const nodes: GraphNode[] = nodeRows.map(r => ({
      slug: r.slug, tenant: r.tenant, title: r.title, type: r.type,
      tags: JSON.parse(r.tags || '[]') as string[], visibility: r.visibility as 'public' | 'private',
      author: r.author ?? undefined, date: r.date ?? undefined, url: r.url ?? undefined,
    }))

    return { nodes, edges: allEdges }
  }

  async queryNodes(filter: { tag?: string; type?: string; tenant?: string; visibility?: 'public' | 'private' }): Promise<GraphNode[]> {
    const conditions: string[] = []
    const params: unknown[] = []

    if (filter.tenant) { conditions.push('tenant = ?'); params.push(filter.tenant) }
    if (filter.type) { conditions.push('type = ?'); params.push(filter.type) }
    if (filter.visibility) { conditions.push('visibility = ?'); params.push(filter.visibility) }
    if (filter.tag) { conditions.push("tags LIKE ?"); params.push(`%"${filter.tag}"%`) }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const rows = await this.db.query<{ slug: string; tenant: string; title: string; type: string; tags: string; visibility: string; author: string | null; date: string | null; url: string | null }>(
      `SELECT slug, tenant, title, type, tags, visibility, author, date, url FROM graph_nodes ${where} ORDER BY date DESC LIMIT 100`, params
    )

    return rows.map(r => ({
      slug: r.slug, tenant: r.tenant, title: r.title, type: r.type,
      tags: JSON.parse(r.tags || '[]') as string[], visibility: r.visibility as 'public' | 'private',
      author: r.author ?? undefined, date: r.date ?? undefined, url: r.url ?? undefined,
    }))
  }

  async getNode(slug: string, tenant?: string): Promise<GraphNode | null> {
    const params: unknown[] = [slug]
    let sql = 'SELECT slug, tenant, title, type, tags, visibility, author, date, url FROM graph_nodes WHERE slug = ?'
    if (tenant) { sql += ' AND tenant = ?'; params.push(tenant) }
    sql += ' LIMIT 1'
    const row = await this.db.queryOne<{ slug: string; tenant: string; title: string; type: string; tags: string; visibility: string; author: string | null; date: string | null; url: string | null }>(sql, params)
    if (!row) return null
    return {
      slug: row.slug, tenant: row.tenant, title: row.title, type: row.type,
      tags: JSON.parse(row.tags || '[]') as string[], visibility: row.visibility as 'public' | 'private',
      author: row.author ?? undefined, date: row.date ?? undefined, url: row.url ?? undefined,
    }
  }
}
