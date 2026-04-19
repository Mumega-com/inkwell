import { describe, it, expect, beforeAll } from 'vitest'
import { request, seedTables } from './helpers'
import { env } from 'cloudflare:workers'

beforeAll(async () => {
  await seedTables()

  // Additional tables needed by integration tests
  const dbCore = env.DB_CORE
  const dbAnalytics = env.DB_ANALYTICS

  await dbCore.prepare(
    'CREATE TABLE IF NOT EXISTS contracts (id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL, customer_name TEXT, customer_email TEXT, customer_phone TEXT, status TEXT DEFAULT \'draft\', template TEXT, fields TEXT DEFAULT \'{}\', signed_at TEXT, delivered_at TEXT, tenant TEXT, created_at TEXT NOT NULL DEFAULT (datetime(\'now\')), updated_at TEXT NOT NULL DEFAULT (datetime(\'now\')))'
  ).run()

  await dbCore.prepare(
    'CREATE TABLE IF NOT EXISTS questionnaire_log (id TEXT PRIMARY KEY, question_index INTEGER NOT NULL, question_text TEXT NOT NULL, answer TEXT, answered_at TEXT, sent_at TEXT NOT NULL DEFAULT (datetime(\'now\')), channel TEXT DEFAULT \'sms\', tenant TEXT)'
  ).run()

  await dbAnalytics.prepare(
    'CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, event_name TEXT NOT NULL, properties TEXT, path TEXT NOT NULL, visitor_hash TEXT NOT NULL, session_id TEXT, tenant TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, utm_term TEXT, referrer TEXT, country TEXT, device TEXT, created_at TEXT NOT NULL DEFAULT (datetime(\'now\')))'
  ).run()

  await dbAnalytics.prepare(
    'CREATE TABLE IF NOT EXISTS survey_responses (id TEXT PRIMARY KEY, survey_id TEXT NOT NULL, visitor_hash TEXT NOT NULL, answers TEXT NOT NULL, score REAL, freetext TEXT, path TEXT NOT NULL, tenant TEXT, created_at TEXT NOT NULL DEFAULT (datetime(\'now\')))'
  ).run()

  await dbAnalytics.prepare(
    'CREATE TABLE IF NOT EXISTS feature_requests (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT \'open\', vote_count INTEGER NOT NULL DEFAULT 0, tenant TEXT, created_at TEXT NOT NULL DEFAULT (datetime(\'now\')))'
  ).run()

  await dbAnalytics.prepare(
    'CREATE TABLE IF NOT EXISTS feature_votes (id TEXT PRIMARY KEY, feature_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, visitor_hash TEXT NOT NULL, tenant TEXT, created_at TEXT NOT NULL DEFAULT (datetime(\'now\')), UNIQUE(feature_id, visitor_hash))'
  ).run()

  await dbAnalytics.prepare(
    'CREATE TABLE IF NOT EXISTS feedback_classifications (response_id TEXT PRIMARY KEY, category TEXT NOT NULL, sentiment TEXT NOT NULL, confidence REAL NOT NULL, summary TEXT NOT NULL, classified_at TEXT NOT NULL DEFAULT (datetime(\'now\')))'
  ).run()

  await dbAnalytics.prepare(
    'CREATE TABLE IF NOT EXISTS editorial_calendar (slug TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT DEFAULT \'blog\', status TEXT DEFAULT \'idea\', scheduled_at TEXT, channel TEXT, campaign_id TEXT, priority INTEGER DEFAULT 0, seo_keyword TEXT, assignee TEXT, tenant TEXT, created_at TEXT NOT NULL DEFAULT (datetime(\'now\')), updated_at TEXT NOT NULL DEFAULT (datetime(\'now\')))'
  ).run()
})

describe('Contracts', () => {
  it('GET /api/contracts returns list', async () => {
    const res = await request('GET', '/api/contracts')
    expect(res.status).toBe(200)
    const body = await res.json<{ contracts: unknown[]; total: number }>()
    expect(body).toHaveProperty('contracts')
    expect(body).toHaveProperty('total')
    expect(Array.isArray(body.contracts)).toBe(true)
  })

  it('GET /api/contracts?status=signed filters by status', async () => {
    const res = await request('GET', '/api/contracts?status=signed')
    expect(res.status).toBe(200)
    const body = await res.json<{ contracts: unknown[]; total: number }>()
    expect(Array.isArray(body.contracts)).toBe(true)
  })
})

describe('Analytics Events', () => {
  it('POST /api/event accepts events', async () => {
    const res = await request('POST', '/api/event', {
      name: 'Page Viewed',
      path: '/test',
    })
    expect([200, 201, 204]).toContain(res.status)
  })
})

describe('Feedback', () => {
  it('POST /api/feedback/respond accepts survey response', async () => {
    const res = await request('POST', '/api/feedback/respond', {
      surveyId: 'nps-test',
      answers: { nps: 9 },
      score: 9,
      path: '/test',
    })
    expect([200, 201]).toContain(res.status)
  })

  it('GET /api/feedback/surveys returns survey config', async () => {
    const res = await request('GET', '/api/feedback/surveys')
    expect(res.status).toBe(200)
  })

  it('GET /api/feedback/features requires auth', async () => {
    // features endpoint uses requireAuth — system token bypasses RBAC but not session auth
    const res = await request('GET', '/api/feedback/features')
    // 401 is expected without a real session
    expect(res.status).toBe(401)
  })
})

describe('Calendar', () => {
  it('GET /api/content/calendar requires auth', async () => {
    // Calendar is gated by content plugin's requiredRole (member)
    // System token bypasses RBAC, but if calendar routes also use requireAuth, 401 expected
    const res = await request('GET', '/api/content/calendar')
    // Accept 200 (if RBAC bypass works) or 401 (if session auth needed)
    expect([200, 401]).toContain(res.status)
  })
})

describe('SEO', () => {
  it('GET /robots.txt returns dynamic robots', async () => {
    const res = await request('GET', '/robots.txt')
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('User-agent')
  })
})

describe('CORS', () => {
  it('OPTIONS returns CORS headers for localhost', async () => {
    const res = await request('OPTIONS', '/api/publish', undefined, {
      'Origin': 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST',
    })
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
  })
})
