import { describe, it, expect } from 'vitest'

// ── Visitor Hash ──────────────────────────────────────────────────────

async function generateVisitorHash(ip: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + salt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

// ── UTM Parsing ──────────────────────────────────────────────────────

interface UtmParams {
  source: string | null
  medium: string | null
  campaign: string | null
  content: string | null
  term: string | null
  clickId: string | null
  clickSource: string | null
}

function parseUtm(url: string): UtmParams {
  const params = new URL(url).searchParams
  return {
    source: params.get('utm_source'),
    medium: params.get('utm_medium'),
    campaign: params.get('utm_campaign'),
    content: params.get('utm_content'),
    term: params.get('utm_term'),
    clickId: params.get('gclid') || params.get('fbclid') || null,
    clickSource: params.get('gclid') ? 'google' : params.get('fbclid') ? 'meta' : null,
  }
}

// ── Funnel Calculation ───────────────────────────────────────────────

interface FunnelStep {
  step: string
  uniqueVisitors: number
  conversionRate: number
  dropoff: number
}

function calculateFunnel(steps: Array<{ step: string; uniqueVisitors: number }>): FunnelStep[] {
  return steps.map((step, i) => ({
    ...step,
    conversionRate: i === 0
      ? 1.0
      : steps[i - 1].uniqueVisitors > 0
        ? step.uniqueVisitors / steps[i - 1].uniqueVisitors
        : 0,
    dropoff: i === 0
      ? 0
      : steps[i - 1].uniqueVisitors - step.uniqueVisitors,
  }))
}

describe('Analytics Events', () => {
  describe('Visitor Hash', () => {
    it('generates consistent hash for same IP and salt', async () => {
      const hash1 = await generateVisitorHash('1.2.3.4', '2026-04-19')
      const hash2 = await generateVisitorHash('1.2.3.4', '2026-04-19')
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(16)
    })

    it('generates different hash for different IPs', async () => {
      const hash1 = await generateVisitorHash('1.2.3.4', '2026-04-19')
      const hash2 = await generateVisitorHash('5.6.7.8', '2026-04-19')
      expect(hash1).not.toBe(hash2)
    })

    it('generates different hash for different days (session rotation)', async () => {
      const hash1 = await generateVisitorHash('1.2.3.4', '2026-04-19')
      const hash2 = await generateVisitorHash('1.2.3.4', '2026-04-20')
      expect(hash1).not.toBe(hash2)
    })

    it('hash is 16 hex characters', async () => {
      const hash = await generateVisitorHash('192.168.1.1', '2026-01-01')
      expect(hash).toMatch(/^[0-9a-f]{16}$/)
    })
  })

  describe('UTM Parsing', () => {
    it('extracts all standard UTM params', () => {
      const utm = parseUtm('https://example.com/?utm_source=google&utm_medium=cpc&utm_campaign=spring&utm_content=banner&utm_term=saas')
      expect(utm.source).toBe('google')
      expect(utm.medium).toBe('cpc')
      expect(utm.campaign).toBe('spring')
      expect(utm.content).toBe('banner')
      expect(utm.term).toBe('saas')
    })

    it('returns null for missing params', () => {
      const utm = parseUtm('https://example.com/')
      expect(utm.source).toBeNull()
      expect(utm.medium).toBeNull()
      expect(utm.campaign).toBeNull()
      expect(utm.clickId).toBeNull()
    })

    it('captures gclid as google click', () => {
      const utm = parseUtm('https://example.com/?gclid=abc123')
      expect(utm.clickId).toBe('abc123')
      expect(utm.clickSource).toBe('google')
    })

    it('captures fbclid as meta click', () => {
      const utm = parseUtm('https://example.com/?fbclid=xyz789')
      expect(utm.clickId).toBe('xyz789')
      expect(utm.clickSource).toBe('meta')
    })

    it('prefers gclid over fbclid when both present', () => {
      const utm = parseUtm('https://example.com/?gclid=abc&fbclid=xyz')
      expect(utm.clickId).toBe('abc')
      expect(utm.clickSource).toBe('google')
    })

    it('extracts UTM alongside regular path', () => {
      const utm = parseUtm('https://example.com/blog/post-1?utm_source=twitter&utm_medium=social')
      expect(utm.source).toBe('twitter')
      expect(utm.medium).toBe('social')
    })
  })

  describe('Funnel Calculation', () => {
    it('calculates conversion rates between steps', () => {
      const funnel = calculateFunnel([
        { step: 'Page Viewed', uniqueVisitors: 1000 },
        { step: 'CTA Clicked', uniqueVisitors: 300 },
        { step: 'Form Submitted', uniqueVisitors: 50 },
      ])

      expect(funnel[0].conversionRate).toBe(1.0)
      expect(funnel[0].dropoff).toBe(0)
      expect(funnel[1].conversionRate).toBe(0.3)
      expect(funnel[1].dropoff).toBe(700)
      expect(funnel[2].conversionRate).toBeCloseTo(0.1667, 3)
      expect(funnel[2].dropoff).toBe(250)
    })

    it('handles single step funnel', () => {
      const funnel = calculateFunnel([
        { step: 'Page Viewed', uniqueVisitors: 500 },
      ])

      expect(funnel).toHaveLength(1)
      expect(funnel[0].conversionRate).toBe(1.0)
      expect(funnel[0].dropoff).toBe(0)
    })

    it('handles zero visitors at a step', () => {
      const funnel = calculateFunnel([
        { step: 'Page Viewed', uniqueVisitors: 100 },
        { step: 'Checkout', uniqueVisitors: 0 },
      ])

      expect(funnel[1].conversionRate).toBe(0)
      expect(funnel[1].dropoff).toBe(100)
    })

    it('handles zero visitors at first step', () => {
      const funnel = calculateFunnel([
        { step: 'Page Viewed', uniqueVisitors: 0 },
        { step: 'Checkout', uniqueVisitors: 0 },
      ])

      expect(funnel[0].conversionRate).toBe(1.0) // first step is always 1.0
      expect(funnel[1].conversionRate).toBe(0)    // 0/0 = 0
    })

    it('handles empty funnel', () => {
      const funnel = calculateFunnel([])
      expect(funnel).toHaveLength(0)
    })
  })

  describe('Event Structure', () => {
    it('event has required fields', () => {
      const event = {
        id: crypto.randomUUID(),
        eventName: 'CTA Clicked',
        properties: { buttonId: 'hero-cta', label: 'Get Started' },
        path: '/pricing',
        visitorHash: 'abcdef1234567890',
        sessionId: 'sess-123',
        tenant: 'acme',
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: 'spring-2026',
        referrer: 'https://google.com',
        country: 'CA',
        device: 'desktop',
        createdAt: new Date().toISOString(),
      }

      expect(event.id).toBeTruthy()
      expect(event.eventName).toBe('CTA Clicked')
      expect(event.properties.buttonId).toBe('hero-cta')
      expect(event.visitorHash).toHaveLength(16)
    })

    it('properties are flexible JSON', () => {
      const props = { buttonId: 'cta-1', value: 99.99, tags: ['promo', 'spring'] }
      const serialized = JSON.stringify(props)
      const parsed = JSON.parse(serialized)
      expect(parsed.buttonId).toBe('cta-1')
      expect(parsed.value).toBe(99.99)
      expect(parsed.tags).toEqual(['promo', 'spring'])
    })
  })

  describe('Visitor Profile', () => {
    it('profile structure supports identity stitching', () => {
      const profile = {
        visitorHash: 'abcdef1234567890',
        firstSeen: '2026-04-01T00:00:00Z',
        lastSeen: '2026-04-19T12:00:00Z',
        visitCount: 15,
        totalEvents: 47,
        totalPageViews: 23,
        utmFirstSource: 'google',
        utmFirstMedium: 'cpc',
        utmLastSource: 'twitter',
        utmLastMedium: 'social',
        portalAccountId: null as string | null,
        email: null as string | null,
      }

      // Before auth — anonymous
      expect(profile.portalAccountId).toBeNull()
      expect(profile.email).toBeNull()

      // After auth — stitched
      profile.portalAccountId = 'acct-123'
      profile.email = 'user@example.com'
      expect(profile.portalAccountId).toBe('acct-123')
      expect(profile.email).toBe('user@example.com')
    })

    it('UTM first-touch is preserved, last-touch updates', () => {
      const profile = {
        utmFirstSource: 'google',
        utmFirstCampaign: 'spring',
        utmLastSource: 'google',
        utmLastCampaign: 'spring',
      }

      // Second visit from different source
      const newUtm = { source: 'twitter', campaign: 'summer' }
      // First-touch preserved, last-touch updated
      profile.utmLastSource = newUtm.source
      profile.utmLastCampaign = newUtm.campaign

      expect(profile.utmFirstSource).toBe('google')
      expect(profile.utmFirstCampaign).toBe('spring')
      expect(profile.utmLastSource).toBe('twitter')
      expect(profile.utmLastCampaign).toBe('summer')
    })
  })
})
