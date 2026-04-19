/**
 * CfSeoAdapter — Cloudflare D1 implementation of SeoPort.
 *
 * Crawl intelligence, redirect engine, and meta overrides.
 * Uses D1 for storage. Plugins never import D1 directly — they use SeoPort.
 */
import type {
  CrawlLogEntry,
  DatabasePort,
  MetaOverride,
  RedirectRule,
  SeoPort,
} from '../types'

/** D1 row shape for crawl_logs table. */
interface CrawlLogRow {
  id: string
  path: string
  user_agent: string
  bot_name: string
  status_code: number
  tenant: string | null
  timestamp: string
}

/** D1 row shape for seo_redirects table. */
interface RedirectRow {
  id: string
  from_path: string
  to_path: string
  status_code: number
  tenant: string | null
  created_at: string
}

/** D1 row shape for seo_meta_overrides table. */
interface MetaOverrideRow {
  path: string
  title: string | null
  description: string | null
  og_image: string | null
  robots: string | null
  canonical: string | null
  tenant: string | null
}

/** Crawl stats aggregation row. */
interface CrawlStatsRow {
  bot_name: string
  path: string
  hits: number
  last_seen: string
}

function rowToRedirect(row: RedirectRow): RedirectRule {
  return {
    id: row.id,
    fromPath: row.from_path,
    toPath: row.to_path,
    statusCode: row.status_code as RedirectRule['statusCode'],
    tenant: row.tenant ?? undefined,
    createdAt: row.created_at,
  }
}

function rowToMetaOverride(row: MetaOverrideRow): MetaOverride {
  return {
    path: row.path,
    title: row.title ?? undefined,
    description: row.description ?? undefined,
    ogImage: row.og_image ?? undefined,
    robots: row.robots ?? undefined,
    canonical: row.canonical ?? undefined,
    tenant: row.tenant ?? undefined,
  }
}

interface CfSeoAdapterOptions {
  db: DatabasePort
}

export class CfSeoAdapter implements SeoPort {
  private readonly db: DatabasePort

  constructor(opts: CfSeoAdapterOptions) {
    this.db = opts.db
  }

  async logCrawl(entry: Omit<CrawlLogEntry, 'id'>): Promise<void> {
    const id = crypto.randomUUID()
    // Fire-and-forget — don't await in hot path
    this.db.execute(
      `INSERT INTO crawl_logs (id, path, user_agent, bot_name, status_code, tenant, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, entry.path, entry.userAgent, entry.botName, entry.statusCode, entry.tenant ?? null, entry.timestamp]
    )
  }

  async getCrawlStats(
    tenant?: string,
    days?: number
  ): Promise<Array<{ botName: string; path: string; hits: number; lastSeen: string }>> {
    const conditions: string[] = []
    const params: unknown[] = []

    if (tenant) {
      conditions.push('tenant = ?')
      params.push(tenant)
    }

    if (days) {
      conditions.push("timestamp >= datetime('now', ?)")
      params.push(`-${days} days`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const rows = await this.db.query<CrawlStatsRow>(
      `SELECT bot_name, path, COUNT(*) as hits, MAX(timestamp) as last_seen
       FROM crawl_logs ${where}
       GROUP BY bot_name, path
       ORDER BY hits DESC`,
      params
    )

    return rows.map((row) => ({
      botName: row.bot_name,
      path: row.path,
      hits: row.hits,
      lastSeen: row.last_seen,
    }))
  }

  async upsertRedirect(rule: Omit<RedirectRule, 'id' | 'createdAt'>): Promise<RedirectRule> {
    const tenantVal = rule.tenant ?? null

    // Check for existing rule with same fromPath + tenant
    const existing = await this.db.queryOne<RedirectRow>(
      'SELECT * FROM seo_redirects WHERE from_path = ? AND tenant IS ? LIMIT 1',
      [rule.fromPath, tenantVal]
    )

    if (existing) {
      const now = new Date().toISOString()
      await this.db.execute(
        `UPDATE seo_redirects SET to_path = ?, status_code = ?, created_at = ? WHERE id = ?`,
        [rule.toPath, rule.statusCode, now, existing.id]
      )
      return {
        id: existing.id,
        fromPath: rule.fromPath,
        toPath: rule.toPath,
        statusCode: rule.statusCode,
        tenant: rule.tenant,
        createdAt: now,
      }
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await this.db.execute(
      `INSERT INTO seo_redirects (id, from_path, to_path, status_code, tenant, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, rule.fromPath, rule.toPath, rule.statusCode, tenantVal, now]
    )

    return {
      id,
      fromPath: rule.fromPath,
      toPath: rule.toPath,
      statusCode: rule.statusCode,
      tenant: rule.tenant,
      createdAt: now,
    }
  }

  async listRedirects(tenant?: string): Promise<RedirectRule[]> {
    const conditions: string[] = []
    const params: unknown[] = []

    if (tenant) {
      conditions.push('tenant = ?')
      params.push(tenant)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const rows = await this.db.query<RedirectRow>(
      `SELECT * FROM seo_redirects ${where} ORDER BY created_at DESC`,
      params
    )

    return rows.map(rowToRedirect)
  }

  async deleteRedirect(id: string): Promise<void> {
    await this.db.execute('DELETE FROM seo_redirects WHERE id = ?', [id])
  }

  async matchRedirect(path: string, tenant?: string): Promise<RedirectRule | null> {
    const tenantVal = tenant ?? null

    // Exact match first
    const exact = await this.db.queryOne<RedirectRow>(
      'SELECT * FROM seo_redirects WHERE from_path = ? AND (tenant = ? OR tenant IS NULL) ORDER BY tenant DESC LIMIT 1',
      [path, tenantVal]
    )

    if (exact) return rowToRedirect(exact)

    // Prefix match — find the longest matching prefix
    const prefixes = await this.db.query<RedirectRow>(
      `SELECT * FROM seo_redirects WHERE ? LIKE (from_path || '%') AND (tenant = ? OR tenant IS NULL)
       ORDER BY LENGTH(from_path) DESC, tenant DESC LIMIT 1`,
      [path, tenantVal]
    )

    if (prefixes.length > 0) return rowToRedirect(prefixes[0])

    return null
  }

  async setMetaOverride(override: MetaOverride): Promise<void> {
    const tenantVal = override.tenant ?? null

    await this.db.execute(
      `INSERT INTO seo_meta_overrides (path, title, description, og_image, robots, canonical, tenant)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(path, tenant) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         og_image = excluded.og_image,
         robots = excluded.robots,
         canonical = excluded.canonical`,
      [
        override.path,
        override.title ?? null,
        override.description ?? null,
        override.ogImage ?? null,
        override.robots ?? null,
        override.canonical ?? null,
        tenantVal,
      ]
    )
  }

  async getMetaOverride(path: string, tenant?: string): Promise<MetaOverride | null> {
    const tenantVal = tenant ?? null

    const row = await this.db.queryOne<MetaOverrideRow>(
      'SELECT * FROM seo_meta_overrides WHERE path = ? AND tenant IS ? LIMIT 1',
      [path, tenantVal]
    )

    if (!row) return null
    return rowToMetaOverride(row)
  }

  async listMetaOverrides(tenant?: string): Promise<MetaOverride[]> {
    const conditions: string[] = []
    const params: unknown[] = []

    if (tenant) {
      conditions.push('tenant = ?')
      params.push(tenant)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const rows = await this.db.query<MetaOverrideRow>(
      `SELECT * FROM seo_meta_overrides ${where} ORDER BY path ASC`,
      params
    )

    return rows.map(rowToMetaOverride)
  }

  async deleteMetaOverride(path: string, tenant?: string): Promise<void> {
    const tenantVal = tenant ?? null

    await this.db.execute(
      'DELETE FROM seo_meta_overrides WHERE path = ? AND tenant IS ?',
      [path, tenantVal]
    )
  }
}
