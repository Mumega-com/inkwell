import { describe, it, expect } from 'vitest'
import type { CrawlLogEntry, MetaOverride, RedirectRule, SeoPort } from '../types'

// ── Mock adapter for testing the port contract ──────────────────────────────

class MockSeoAdapter implements SeoPort {
  private crawlLogs: CrawlLogEntry[] = []
  private redirects: RedirectRule[] = []
  private metaOverrides: MetaOverride[] = []

  async logCrawl(entry: Omit<CrawlLogEntry, 'id'>): Promise<void> {
    const id = `crawl-${this.crawlLogs.length + 1}`
    this.crawlLogs.push({ id, ...entry })
  }

  async getCrawlStats(
    tenant?: string,
    days?: number
  ): Promise<Array<{ botName: string; path: string; hits: number; lastSeen: string }>> {
    let logs = this.crawlLogs
    if (tenant) {
      logs = logs.filter((l) => l.tenant === tenant)
    }
    if (days) {
      const cutoff = new Date(Date.now() - days * 86400000).toISOString()
      logs = logs.filter((l) => l.timestamp >= cutoff)
    }

    const groups = new Map<string, { botName: string; path: string; hits: number; lastSeen: string }>()
    for (const log of logs) {
      const key = `${log.botName}:${log.path}`
      const existing = groups.get(key)
      if (existing) {
        existing.hits++
        if (log.timestamp > existing.lastSeen) existing.lastSeen = log.timestamp
      } else {
        groups.set(key, { botName: log.botName, path: log.path, hits: 1, lastSeen: log.timestamp })
      }
    }

    return [...groups.values()].sort((a, b) => b.hits - a.hits)
  }

  async upsertRedirect(rule: Omit<RedirectRule, 'id' | 'createdAt'>): Promise<RedirectRule> {
    const existing = this.redirects.find(
      (r) => r.fromPath === rule.fromPath && r.tenant === rule.tenant
    )

    if (existing) {
      existing.toPath = rule.toPath
      existing.statusCode = rule.statusCode
      return existing
    }

    const redirect: RedirectRule = {
      id: `redir-${this.redirects.length + 1}`,
      fromPath: rule.fromPath,
      toPath: rule.toPath,
      statusCode: rule.statusCode,
      tenant: rule.tenant,
      createdAt: new Date().toISOString(),
    }
    this.redirects.push(redirect)
    return redirect
  }

  async listRedirects(tenant?: string): Promise<RedirectRule[]> {
    if (tenant) {
      return this.redirects.filter((r) => r.tenant === tenant)
    }
    return [...this.redirects]
  }

  async deleteRedirect(id: string): Promise<void> {
    this.redirects = this.redirects.filter((r) => r.id !== id)
  }

  async matchRedirect(path: string, tenant?: string): Promise<RedirectRule | null> {
    // Exact match first
    const exact = this.redirects.find(
      (r) => r.fromPath === path && (r.tenant === tenant || !r.tenant)
    )
    if (exact) return exact

    // Prefix match — longest first
    const prefixMatches = this.redirects
      .filter((r) => path.startsWith(r.fromPath) && (r.tenant === tenant || !r.tenant))
      .sort((a, b) => b.fromPath.length - a.fromPath.length)

    return prefixMatches[0] ?? null
  }

  async setMetaOverride(override: MetaOverride): Promise<void> {
    const idx = this.metaOverrides.findIndex(
      (m) => m.path === override.path && m.tenant === override.tenant
    )
    if (idx >= 0) {
      this.metaOverrides[idx] = override
    } else {
      this.metaOverrides.push(override)
    }
  }

  async getMetaOverride(path: string, tenant?: string): Promise<MetaOverride | null> {
    return (
      this.metaOverrides.find((m) => m.path === path && m.tenant === tenant) ?? null
    )
  }

  async listMetaOverrides(tenant?: string): Promise<MetaOverride[]> {
    if (tenant) {
      return this.metaOverrides.filter((m) => m.tenant === tenant)
    }
    return [...this.metaOverrides]
  }

  async deleteMetaOverride(path: string, tenant?: string): Promise<void> {
    this.metaOverrides = this.metaOverrides.filter(
      (m) => !(m.path === path && m.tenant === tenant)
    )
  }
}

describe('SeoPort contract', () => {
  it('logCrawl records a bot visit', async () => {
    const seo = new MockSeoAdapter()
    await seo.logCrawl({
      path: '/about',
      userAgent: 'Googlebot/2.1',
      botName: 'googlebot',
      statusCode: 200,
      tenant: 'tenant1',
      timestamp: new Date().toISOString(),
    })

    const stats = await seo.getCrawlStats('tenant1')
    expect(stats.length).toBe(1)
    expect(stats[0].botName).toBe('googlebot')
    expect(stats[0].path).toBe('/about')
    expect(stats[0].hits).toBe(1)
  })

  it('getCrawlStats aggregates multiple visits', async () => {
    const seo = new MockSeoAdapter()
    const now = new Date().toISOString()

    await seo.logCrawl({ path: '/', userAgent: 'Googlebot/2.1', botName: 'googlebot', statusCode: 200, timestamp: now })
    await seo.logCrawl({ path: '/', userAgent: 'Googlebot/2.1', botName: 'googlebot', statusCode: 200, timestamp: now })
    await seo.logCrawl({ path: '/blog', userAgent: 'bingbot/2.0', botName: 'bingbot', statusCode: 200, timestamp: now })

    const stats = await seo.getCrawlStats()
    expect(stats.length).toBe(2)
    expect(stats[0].hits).toBe(2) // googlebot / has more hits
    expect(stats[0].botName).toBe('googlebot')
    expect(stats[1].hits).toBe(1)
  })

  it('getCrawlStats filters by tenant', async () => {
    const seo = new MockSeoAdapter()
    const now = new Date().toISOString()

    await seo.logCrawl({ path: '/', userAgent: 'Googlebot/2.1', botName: 'googlebot', statusCode: 200, tenant: 'a', timestamp: now })
    await seo.logCrawl({ path: '/blog', userAgent: 'bingbot/2.0', botName: 'bingbot', statusCode: 200, tenant: 'b', timestamp: now })

    const statsA = await seo.getCrawlStats('a')
    expect(statsA.length).toBe(1)
    expect(statsA[0].botName).toBe('googlebot')

    const statsAll = await seo.getCrawlStats()
    expect(statsAll.length).toBe(2)
  })

  it('upsertRedirect creates a new redirect', async () => {
    const seo = new MockSeoAdapter()
    const redirect = await seo.upsertRedirect({
      fromPath: '/old',
      toPath: '/new',
      statusCode: 301,
      tenant: 'tenant1',
    })

    expect(redirect.id).toBeTruthy()
    expect(redirect.fromPath).toBe('/old')
    expect(redirect.toPath).toBe('/new')
    expect(redirect.statusCode).toBe(301)
    expect(redirect.createdAt).toBeTruthy()
  })

  it('upsertRedirect updates an existing redirect', async () => {
    const seo = new MockSeoAdapter()
    const first = await seo.upsertRedirect({
      fromPath: '/old',
      toPath: '/new',
      statusCode: 301,
      tenant: 'tenant1',
    })

    const updated = await seo.upsertRedirect({
      fromPath: '/old',
      toPath: '/newer',
      statusCode: 302,
      tenant: 'tenant1',
    })

    expect(updated.id).toBe(first.id)
    expect(updated.toPath).toBe('/newer')
    expect(updated.statusCode).toBe(302)

    const all = await seo.listRedirects('tenant1')
    expect(all.length).toBe(1)
  })

  it('listRedirects returns all redirects for a tenant', async () => {
    const seo = new MockSeoAdapter()
    await seo.upsertRedirect({ fromPath: '/a', toPath: '/b', statusCode: 301, tenant: 't1' })
    await seo.upsertRedirect({ fromPath: '/c', toPath: '/d', statusCode: 302, tenant: 't1' })
    await seo.upsertRedirect({ fromPath: '/e', toPath: '/f', statusCode: 301, tenant: 't2' })

    const t1 = await seo.listRedirects('t1')
    expect(t1.length).toBe(2)

    const all = await seo.listRedirects()
    expect(all.length).toBe(3)
  })

  it('deleteRedirect removes a redirect', async () => {
    const seo = new MockSeoAdapter()
    const redirect = await seo.upsertRedirect({
      fromPath: '/old',
      toPath: '/new',
      statusCode: 301,
    })

    await seo.deleteRedirect(redirect.id)
    const remaining = await seo.listRedirects()
    expect(remaining.length).toBe(0)
  })

  it('matchRedirect finds exact match', async () => {
    const seo = new MockSeoAdapter()
    await seo.upsertRedirect({ fromPath: '/old-page', toPath: '/new-page', statusCode: 301 })

    const match = await seo.matchRedirect('/old-page')
    expect(match).not.toBeNull()
    expect(match!.toPath).toBe('/new-page')
  })

  it('matchRedirect finds prefix match', async () => {
    const seo = new MockSeoAdapter()
    await seo.upsertRedirect({ fromPath: '/blog', toPath: '/articles', statusCode: 301 })

    const match = await seo.matchRedirect('/blog/post-1')
    expect(match).not.toBeNull()
    expect(match!.toPath).toBe('/articles')
  })

  it('matchRedirect returns null when no match', async () => {
    const seo = new MockSeoAdapter()
    await seo.upsertRedirect({ fromPath: '/old', toPath: '/new', statusCode: 301 })

    const match = await seo.matchRedirect('/other')
    expect(match).toBeNull()
  })

  it('matchRedirect prefers exact over prefix', async () => {
    const seo = new MockSeoAdapter()
    await seo.upsertRedirect({ fromPath: '/blog', toPath: '/articles', statusCode: 301 })
    await seo.upsertRedirect({ fromPath: '/blog/special', toPath: '/special-articles', statusCode: 302 })

    const match = await seo.matchRedirect('/blog/special')
    expect(match).not.toBeNull()
    expect(match!.toPath).toBe('/special-articles')
  })

  it('setMetaOverride creates a new override', async () => {
    const seo = new MockSeoAdapter()
    await seo.setMetaOverride({
      path: '/about',
      title: 'About Us',
      description: 'Learn more about us',
      tenant: 'tenant1',
    })

    const override = await seo.getMetaOverride('/about', 'tenant1')
    expect(override).not.toBeNull()
    expect(override!.title).toBe('About Us')
    expect(override!.description).toBe('Learn more about us')
  })

  it('setMetaOverride updates an existing override', async () => {
    const seo = new MockSeoAdapter()
    await seo.setMetaOverride({
      path: '/about',
      title: 'About Us',
      tenant: 'tenant1',
    })

    await seo.setMetaOverride({
      path: '/about',
      title: 'About Our Team',
      description: 'Meet the team',
      tenant: 'tenant1',
    })

    const override = await seo.getMetaOverride('/about', 'tenant1')
    expect(override!.title).toBe('About Our Team')
    expect(override!.description).toBe('Meet the team')

    const all = await seo.listMetaOverrides('tenant1')
    expect(all.length).toBe(1)
  })

  it('getMetaOverride returns null for unknown path', async () => {
    const seo = new MockSeoAdapter()
    const result = await seo.getMetaOverride('/nonexistent')
    expect(result).toBeNull()
  })

  it('listMetaOverrides filters by tenant', async () => {
    const seo = new MockSeoAdapter()
    await seo.setMetaOverride({ path: '/a', title: 'A', tenant: 't1' })
    await seo.setMetaOverride({ path: '/b', title: 'B', tenant: 't1' })
    await seo.setMetaOverride({ path: '/c', title: 'C', tenant: 't2' })

    const t1 = await seo.listMetaOverrides('t1')
    expect(t1.length).toBe(2)

    const all = await seo.listMetaOverrides()
    expect(all.length).toBe(3)
  })

  it('deleteMetaOverride removes an override', async () => {
    const seo = new MockSeoAdapter()
    await seo.setMetaOverride({
      path: '/temp',
      title: 'Temporary',
      tenant: 'tenant1',
    })

    await seo.deleteMetaOverride('/temp', 'tenant1')
    const result = await seo.getMetaOverride('/temp', 'tenant1')
    expect(result).toBeNull()
  })

  it('meta overrides support all optional fields', async () => {
    const seo = new MockSeoAdapter()
    await seo.setMetaOverride({
      path: '/full',
      title: 'Full Override',
      description: 'Complete meta override',
      ogImage: 'https://example.com/og.png',
      robots: 'noindex,nofollow',
      canonical: 'https://example.com/full',
      tenant: 'tenant1',
    })

    const override = await seo.getMetaOverride('/full', 'tenant1')
    expect(override).not.toBeNull()
    expect(override!.title).toBe('Full Override')
    expect(override!.description).toBe('Complete meta override')
    expect(override!.ogImage).toBe('https://example.com/og.png')
    expect(override!.robots).toBe('noindex,nofollow')
    expect(override!.canonical).toBe('https://example.com/full')
  })

  it('redirects support all status codes', async () => {
    const seo = new MockSeoAdapter()
    const codes: Array<301 | 302 | 307 | 308> = [301, 302, 307, 308]

    for (const code of codes) {
      const redirect = await seo.upsertRedirect({
        fromPath: `/path-${code}`,
        toPath: `/dest-${code}`,
        statusCode: code,
      })
      expect(redirect.statusCode).toBe(code)
    }

    const all = await seo.listRedirects()
    expect(all.length).toBe(4)
  })
})
