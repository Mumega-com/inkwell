import { Hono } from 'hono'
import { requireAuth } from '../middleware'
import type { AppBindings } from '../types'
import { config } from '../../inkwell.config'

const feedbackRoutes = new Hono<AppBindings>()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function visitorHash(ip: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + salt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

// ---------------------------------------------------------------------------
// Public — visitors submit feedback (no auth)
// ---------------------------------------------------------------------------

// POST /api/feedback/respond — submit a survey response
feedbackRoutes.post('/respond', async (c) => {
  const body = await c.req.json<{
    surveyId: string
    answers: Record<string, string | number | boolean>
    score?: number
    freetext?: string
    path?: string
  }>()

  if (!body.surveyId || !body.answers) {
    return c.json({ error: 'surveyId and answers are required' }, 400)
  }

  const ip = c.req.header('cf-connecting-ip') ?? 'anonymous'
  const tenant = c.get('tenant_slug') ?? undefined
  const hash = await visitorHash(ip, body.surveyId)
  const feedback = c.get('feedback')

  const response = await feedback.submitResponse({
    surveyId: body.surveyId,
    answers: body.answers,
    score: body.score,
    freetext: body.freetext,
    path: body.path ?? '/',
    visitorHash: hash,
    tenant,
  })

  return c.json(response)
})

// POST /api/feedback/vote — submit a feature vote (public)
feedbackRoutes.post('/vote', async (c) => {
  const body = await c.req.json<{
    featureId: string
    title: string
    description?: string
  }>()

  if (!body.featureId || !body.title) {
    return c.json({ error: 'featureId and title are required' }, 400)
  }

  const ip = c.req.header('cf-connecting-ip') ?? 'anonymous'
  const tenant = c.get('tenant_slug') ?? undefined
  const hash = await visitorHash(ip, body.featureId)
  const feedback = c.get('feedback')

  const vote = await feedback.submitVote({
    featureId: body.featureId,
    title: body.title,
    description: body.description,
    visitorHash: hash,
    tenant,
  })

  return c.json(vote)
})

// GET /api/feedback/surveys — list available survey definitions
feedbackRoutes.get('/surveys', async (c) => {
  const fbConfig = (config as Record<string, unknown>).feedback as
    | { surveys?: Array<{ id: string; active?: boolean }> }
    | undefined

  const list = fbConfig?.surveys?.filter((s) => s.active !== false) ?? []
  return c.json({ surveys: list })
})

// GET /api/feedback/surveys/:id — get a specific survey definition
feedbackRoutes.get('/surveys/:id', async (c) => {
  const id = c.req.param('id')!
  const fbConfig = (config as Record<string, unknown>).feedback as
    | { surveys?: Array<{ id: string; active?: boolean }> }
    | undefined

  const survey = fbConfig?.surveys?.find((s) => s.id === id)
  if (!survey) return c.json({ error: 'Survey not found' }, 404)
  return c.json(survey)
})

// ---------------------------------------------------------------------------
// Auth required — dashboard users
// ---------------------------------------------------------------------------

// GET /api/feedback/responses/:surveyId — list responses for a survey
feedbackRoutes.get('/responses/:surveyId', requireAuth, async (c) => {
  const surveyId = c.req.param('surveyId')!
  const since = c.req.query('since')
  const tenant = c.get('tenant_slug') ?? undefined
  const feedback = c.get('feedback')

  const responses = await feedback.getResponses(surveyId, tenant, since)
  return c.json({ responses })
})

// GET /api/feedback/aggregates/:surveyId — aggregate stats for a survey
feedbackRoutes.get('/aggregates/:surveyId', requireAuth, async (c) => {
  const surveyId = c.req.param('surveyId')!
  const tenant = c.get('tenant_slug') ?? undefined
  const feedback = c.get('feedback')

  const aggregates = await feedback.getAggregates(surveyId, tenant)
  return c.json(aggregates)
})

// GET /api/feedback/insights — feedback insights across surveys
feedbackRoutes.get('/insights', requireAuth, async (c) => {
  const days = Number(c.req.query('days')) || 30
  const tenant = c.get('tenant_slug') ?? undefined
  const feedback = c.get('feedback')

  const insights = await feedback.getInsights(tenant, days)
  return c.json(insights)
})

// GET /api/feedback/features — list feature requests sorted by votes
feedbackRoutes.get('/features', requireAuth, async (c) => {
  const status = c.req.query('status') as 'open' | 'planned' | 'shipped' | 'declined' | undefined
  const tenant = c.get('tenant_slug') ?? undefined
  const feedback = c.get('feedback')

  const features = await feedback.listFeatures(tenant, status)
  return c.json({ features })
})

// PUT /api/feedback/features/:id/status — update feature status
feedbackRoutes.put('/features/:id/status', requireAuth, async (c) => {
  const id = c.req.param('id')!
  const body = await c.req.json<{ status: string }>()

  if (!body.status) {
    return c.json({ error: 'status is required' }, 400)
  }

  const feedback = c.get('feedback')
  await feedback.updateFeatureStatus(id, body.status as 'open' | 'planned' | 'shipped' | 'declined')
  return c.json({ ok: true, id, status: body.status })
})

// GET /api/feedback/churn-signals — churn risk signals
feedbackRoutes.get('/churn-signals', requireAuth, async (c) => {
  const days = Number(c.req.query('days')) || 30
  const tenant = c.get('tenant_slug') ?? undefined
  const feedback = c.get('feedback')

  // Churn signals: combine negative sentiment trend + declining response volume
  const insights = await feedback.getInsights(tenant, days)
  const negativeCount = insights.categoryBreakdown['friction'] ?? 0
  const bugCount = insights.categoryBreakdown['bug'] ?? 0
  const totalClassified = Object.values(insights.categoryBreakdown).reduce((a, b) => a + b, 0)

  const signals = {
    riskLevel: insights.avgSentiment < -0.3 ? 'high' : insights.avgSentiment < 0 ? 'medium' : 'low',
    negativeSentiment: insights.avgSentiment,
    frictionRate: totalClassified > 0 ? negativeCount / totalClassified : 0,
    bugRate: totalClassified > 0 ? bugCount / totalClassified : 0,
    topIssues: insights.topIssues.filter((i) => i.category === 'friction' || i.category === 'bug'),
    trend: insights.trend,
    totalResponses: insights.totalResponses,
  }

  return c.json(signals)
})

export { feedbackRoutes }
