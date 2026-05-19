import { describe, it, expect, beforeEach } from 'vitest'
import type {
  FeedbackClassification,
  FeedbackPort,
  FeatureRequest,
  FeatureVote,
  SurveyResponse,
} from '../types'

// ── Mock adapter for testing the port contract ──────────────────────────────

class MockFeedbackAdapter implements FeedbackPort {
  private responses: SurveyResponse[] = []
  private features: FeatureRequest[] = []
  private votes: FeatureVote[] = []
  private classifications: FeedbackClassification[] = []
  private idCounter = 0

  private nextId(): string {
    this.idCounter++
    return `mock-${this.idCounter}`
  }

  async submitResponse(
    response: Omit<SurveyResponse, 'id' | 'createdAt'>
  ): Promise<SurveyResponse> {
    const full: SurveyResponse = {
      id: this.nextId(),
      ...response,
      createdAt: new Date().toISOString(),
    }
    this.responses.push(full)
    return full
  }

  async getResponses(
    surveyId: string,
    tenant?: string,
    since?: string
  ): Promise<SurveyResponse[]> {
    let results = this.responses.filter((r) => r.surveyId === surveyId)
    if (tenant) results = results.filter((r) => r.tenant === tenant)
    if (since) results = results.filter((r) => r.createdAt >= since)
    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getAggregates(
    surveyId: string,
    tenant?: string
  ): Promise<{
    responseCount: number
    avgScore: number | null
    scoreDistribution: Record<number, number>
    promoters: number
    passives: number
    detractors: number
    npsScore: number | null
  }> {
    let results = this.responses.filter((r) => r.surveyId === surveyId)
    if (tenant) results = results.filter((r) => r.tenant === tenant)

    const responseCount = results.length
    const scored = results.filter((r) => r.score !== undefined)
    const avgScore =
      scored.length > 0
        ? scored.reduce((sum, r) => sum + (r.score ?? 0), 0) / scored.length
        : null

    const scoreDistribution: Record<number, number> = {}
    let promoters = 0
    let passives = 0
    let detractors = 0

    for (const r of scored) {
      const s = Math.floor(r.score ?? 0)
      scoreDistribution[s] = (scoreDistribution[s] ?? 0) + 1
      if (s >= 9) promoters++
      else if (s >= 7) passives++
      else detractors++
    }

    const totalScored = promoters + passives + detractors
    const npsScore =
      totalScored > 0
        ? Math.round(((promoters - detractors) / totalScored) * 100)
        : null

    return {
      responseCount,
      avgScore,
      scoreDistribution,
      promoters,
      passives,
      detractors,
      npsScore,
    }
  }

  async submitVote(
    vote: Omit<FeatureVote, 'id' | 'createdAt'>
  ): Promise<FeatureVote> {
    // Dedup by visitorHash + featureId
    const existing = this.votes.find(
      (v) => v.featureId === vote.featureId && v.visitorHash === vote.visitorHash
    )
    if (existing) return existing

    const fullVote: FeatureVote = {
      id: this.nextId(),
      ...vote,
      createdAt: new Date().toISOString(),
    }
    this.votes.push(fullVote)

    // Upsert feature
    const feature = this.features.find((f) => f.id === vote.featureId)
    if (feature) {
      feature.voteCount++
    } else {
      this.features.push({
        id: vote.featureId,
        title: vote.title,
        description: vote.description,
        status: 'open',
        voteCount: 1,
        tenant: vote.tenant,
        createdAt: fullVote.createdAt,
      })
    }

    return fullVote
  }

  async listFeatures(
    tenant?: string,
    status?: FeatureRequest['status']
  ): Promise<FeatureRequest[]> {
    let results = [...this.features]
    if (tenant) results = results.filter((f) => f.tenant === tenant)
    if (status) results = results.filter((f) => f.status === status)
    return results.sort((a, b) => b.voteCount - a.voteCount)
  }

  async updateFeatureStatus(
    featureId: string,
    status: FeatureRequest['status']
  ): Promise<void> {
    const feature = this.features.find((f) => f.id === featureId)
    if (feature) feature.status = status
  }

  async storeClassification(classification: FeedbackClassification): Promise<void> {
    const idx = this.classifications.findIndex(
      (c) => c.responseId === classification.responseId
    )
    if (idx >= 0) {
      this.classifications[idx] = classification
    } else {
      this.classifications.push(classification)
    }
  }

  async getUnclassified(limit?: number): Promise<SurveyResponse[]> {
    const classifiedIds = new Set(this.classifications.map((c) => c.responseId))
    const unclassified = this.responses.filter((r) => !classifiedIds.has(r.id))
    return unclassified.slice(0, limit ?? 50)
  }

  async getInsights(
    tenant?: string,
    days?: number
  ): Promise<{
    totalResponses: number
    avgSentiment: number
    categoryBreakdown: Record<string, number>
    topIssues: Array<{ summary: string; count: number; category: string }>
    trend: Array<{ date: string; responses: number; avgScore: number }>
  }> {
    let results = [...this.responses]
    if (tenant) results = results.filter((r) => r.tenant === tenant)
    if (days) {
      const cutoff = new Date(Date.now() - days * 86400000).toISOString()
      results = results.filter((r) => r.createdAt >= cutoff)
    }

    const totalResponses = results.length
    const responseIds = new Set(results.map((r) => r.id))
    const relevantClassifications = this.classifications.filter((c) =>
      responseIds.has(c.responseId)
    )

    // Avg sentiment
    const sentimentMap = { positive: 1, neutral: 0, negative: -1 } as const
    const avgSentiment =
      relevantClassifications.length > 0
        ? relevantClassifications.reduce(
            (sum, c) => sum + (sentimentMap[c.sentiment] ?? 0),
            0
          ) / relevantClassifications.length
        : 0

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {}
    for (const c of relevantClassifications) {
      categoryBreakdown[c.category] = (categoryBreakdown[c.category] ?? 0) + 1
    }

    // Top issues
    const issueMap = new Map<string, { summary: string; count: number; category: string }>()
    for (const c of relevantClassifications) {
      const key = `${c.summary}::${c.category}`
      const existing = issueMap.get(key)
      if (existing) {
        existing.count++
      } else {
        issueMap.set(key, { summary: c.summary, count: 1, category: c.category })
      }
    }
    const topIssues = [...issueMap.values()].sort((a, b) => b.count - a.count).slice(0, 10)

    // Trend
    const trendMap = new Map<string, { responses: number; totalScore: number; scoredCount: number }>()
    for (const r of results) {
      const date = r.createdAt.slice(0, 10)
      const existing = trendMap.get(date)
      if (existing) {
        existing.responses++
        if (r.score !== undefined) {
          existing.totalScore += r.score
          existing.scoredCount++
        }
      } else {
        trendMap.set(date, {
          responses: 1,
          totalScore: r.score ?? 0,
          scoredCount: r.score !== undefined ? 1 : 0,
        })
      }
    }
    const trend = [...trendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        responses: data.responses,
        avgScore: data.scoredCount > 0 ? data.totalScore / data.scoredCount : 0,
      }))

    return { totalResponses, avgSentiment, categoryBreakdown, topIssues, trend }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FeedbackPort contract', () => {
  let fb: MockFeedbackAdapter

  beforeEach(() => {
    fb = new MockFeedbackAdapter()
  })

  // ── submitResponse ──────────────────────────────────────────────────────

  it('submitResponse creates a response with generated id and timestamp', async () => {
    const result = await fb.submitResponse({
      surveyId: 'survey-1',
      visitorHash: 'hash-abc',
      answers: { q1: 9 },
      score: 9,
      path: '/pricing',
    })

    expect(result.id).toBeTruthy()
    expect(result.createdAt).toBeTruthy()
    expect(result.surveyId).toBe('survey-1')
    expect(result.visitorHash).toBe('hash-abc')
    expect(result.score).toBe(9)
  })

  it('submitResponse stores optional freetext', async () => {
    const result = await fb.submitResponse({
      surveyId: 'survey-1',
      visitorHash: 'hash-abc',
      answers: { q1: 'great' },
      freetext: 'Love the product!',
      path: '/home',
    })

    expect(result.freetext).toBe('Love the product!')
  })

  it('submitResponse stores tenant', async () => {
    const result = await fb.submitResponse({
      surveyId: 'survey-1',
      visitorHash: 'hash-abc',
      answers: { q1: 8 },
      score: 8,
      path: '/',
      tenant: 'acme',
    })

    expect(result.tenant).toBe('acme')
  })

  // ── getResponses ────────────────────────────────────────────────────────

  it('getResponses filters by surveyId', async () => {
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h1', answers: { q: 1 }, path: '/' })
    await fb.submitResponse({ surveyId: 's2', visitorHash: 'h2', answers: { q: 2 }, path: '/' })

    const results = await fb.getResponses('s1')
    expect(results.length).toBe(1)
    expect(results[0].surveyId).toBe('s1')
  })

  it('getResponses filters by tenant', async () => {
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h1', answers: {}, path: '/', tenant: 'a' })
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h2', answers: {}, path: '/', tenant: 'b' })

    const results = await fb.getResponses('s1', 'a')
    expect(results.length).toBe(1)
    expect(results[0].tenant).toBe('a')
  })

  it('getResponses filters by since', async () => {
    const old = await fb.submitResponse({ surveyId: 's1', visitorHash: 'h1', answers: {}, path: '/' })
    // Manually backdate — the mock stores createdAt from Date.now()
    old.createdAt = '2020-01-01T00:00:00.000Z'
    // Update the internal array entry
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h2', answers: {}, path: '/' })

    const results = await fb.getResponses('s1', undefined, '2025-01-01T00:00:00.000Z')
    expect(results.length).toBe(1)
  })

  // ── getAggregates ───────────────────────────────────────────────────────

  it('getAggregates calculates NPS correctly', async () => {
    // 3 promoters (9, 10, 9), 2 passives (7, 8), 1 detractor (3)
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h1', answers: {}, score: 9, path: '/' })
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h2', answers: {}, score: 10, path: '/' })
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h3', answers: {}, score: 9, path: '/' })
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h4', answers: {}, score: 7, path: '/' })
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h5', answers: {}, score: 8, path: '/' })
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h6', answers: {}, score: 3, path: '/' })

    const agg = await fb.getAggregates('s1')
    expect(agg.responseCount).toBe(6)
    expect(agg.promoters).toBe(3)
    expect(agg.passives).toBe(2)
    expect(agg.detractors).toBe(1)
    // NPS = (3 - 1) / 6 * 100 = 33.33 → 33
    expect(agg.npsScore).toBe(33)
  })

  it('getAggregates returns null npsScore when no responses', async () => {
    const agg = await fb.getAggregates('nonexistent')
    expect(agg.responseCount).toBe(0)
    expect(agg.avgScore).toBeNull()
    expect(agg.npsScore).toBeNull()
    expect(agg.promoters).toBe(0)
    expect(agg.passives).toBe(0)
    expect(agg.detractors).toBe(0)
  })

  it('getAggregates calculates average score', async () => {
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h1', answers: {}, score: 8, path: '/' })
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h2', answers: {}, score: 6, path: '/' })

    const agg = await fb.getAggregates('s1')
    expect(agg.avgScore).toBe(7)
  })

  it('getAggregates builds score distribution', async () => {
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h1', answers: {}, score: 9, path: '/' })
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h2', answers: {}, score: 9, path: '/' })
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h3', answers: {}, score: 5, path: '/' })

    const agg = await fb.getAggregates('s1')
    expect(agg.scoreDistribution[9]).toBe(2)
    expect(agg.scoreDistribution[5]).toBe(1)
  })

  it('getAggregates filters by tenant', async () => {
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h1', answers: {}, score: 10, path: '/', tenant: 'a' })
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h2', answers: {}, score: 1, path: '/', tenant: 'b' })

    const aggA = await fb.getAggregates('s1', 'a')
    expect(aggA.responseCount).toBe(1)
    expect(aggA.promoters).toBe(1)
    expect(aggA.detractors).toBe(0)
  })

  // ── submitVote ──────────────────────────────────────────────────────────

  it('submitVote creates feature if new', async () => {
    await fb.submitVote({
      featureId: 'feat-1',
      title: 'Dark mode',
      visitorHash: 'h1',
    })

    const features = await fb.listFeatures()
    expect(features.length).toBe(1)
    expect(features[0].title).toBe('Dark mode')
    expect(features[0].voteCount).toBe(1)
    expect(features[0].status).toBe('open')
  })

  it('submitVote increments vote count on existing feature', async () => {
    await fb.submitVote({ featureId: 'feat-1', title: 'Dark mode', visitorHash: 'h1' })
    await fb.submitVote({ featureId: 'feat-1', title: 'Dark mode', visitorHash: 'h2' })

    const features = await fb.listFeatures()
    expect(features[0].voteCount).toBe(2)
  })

  it('submitVote deduplicates by visitorHash+featureId', async () => {
    const first = await fb.submitVote({ featureId: 'feat-1', title: 'Dark mode', visitorHash: 'h1' })
    const second = await fb.submitVote({ featureId: 'feat-1', title: 'Dark mode', visitorHash: 'h1' })

    expect(first.id).toBe(second.id)

    const features = await fb.listFeatures()
    expect(features[0].voteCount).toBe(1) // not double-counted
  })

  // ── listFeatures ────────────────────────────────────────────────────────

  it('listFeatures sorted by vote count descending', async () => {
    await fb.submitVote({ featureId: 'f1', title: 'A', visitorHash: 'h1' })
    await fb.submitVote({ featureId: 'f2', title: 'B', visitorHash: 'h1' })
    await fb.submitVote({ featureId: 'f2', title: 'B', visitorHash: 'h2' })
    await fb.submitVote({ featureId: 'f2', title: 'B', visitorHash: 'h3' })

    const features = await fb.listFeatures()
    expect(features[0].id).toBe('f2')
    expect(features[0].voteCount).toBe(3)
    expect(features[1].id).toBe('f1')
    expect(features[1].voteCount).toBe(1)
  })

  it('listFeatures filters by status', async () => {
    await fb.submitVote({ featureId: 'f1', title: 'A', visitorHash: 'h1' })
    await fb.submitVote({ featureId: 'f2', title: 'B', visitorHash: 'h1' })
    await fb.updateFeatureStatus('f1', 'shipped')

    const open = await fb.listFeatures(undefined, 'open')
    expect(open.length).toBe(1)
    expect(open[0].id).toBe('f2')

    const shipped = await fb.listFeatures(undefined, 'shipped')
    expect(shipped.length).toBe(1)
    expect(shipped[0].id).toBe('f1')
  })

  it('listFeatures filters by tenant', async () => {
    await fb.submitVote({ featureId: 'f1', title: 'A', visitorHash: 'h1', tenant: 't1' })
    await fb.submitVote({ featureId: 'f2', title: 'B', visitorHash: 'h1', tenant: 't2' })

    const t1 = await fb.listFeatures('t1')
    expect(t1.length).toBe(1)
    expect(t1[0].id).toBe('f1')
  })

  // ── updateFeatureStatus ─────────────────────────────────────────────────

  it('updateFeatureStatus changes status', async () => {
    await fb.submitVote({ featureId: 'f1', title: 'A', visitorHash: 'h1' })
    await fb.updateFeatureStatus('f1', 'planned')

    const features = await fb.listFeatures()
    expect(features[0].status).toBe('planned')
  })

  it('updateFeatureStatus supports all status values', async () => {
    await fb.submitVote({ featureId: 'f1', title: 'A', visitorHash: 'h1' })

    for (const status of ['open', 'planned', 'shipped', 'declined'] as const) {
      await fb.updateFeatureStatus('f1', status)
      const features = await fb.listFeatures()
      expect(features[0].status).toBe(status)
    }
  })

  // ── storeClassification + getUnclassified ───────────────────────────────

  it('storeClassification + getUnclassified work together', async () => {
    const r1 = await fb.submitResponse({ surveyId: 's1', visitorHash: 'h1', answers: { q: 'bad' }, path: '/' })
    const r2 = await fb.submitResponse({ surveyId: 's1', visitorHash: 'h2', answers: { q: 'good' }, path: '/' })

    // Both start unclassified
    let unclassified = await fb.getUnclassified()
    expect(unclassified.length).toBe(2)

    // Classify r1
    await fb.storeClassification({
      responseId: r1.id,
      category: 'bug',
      sentiment: 'negative',
      confidence: 0.92,
      summary: 'Report of broken checkout',
      classifiedAt: new Date().toISOString(),
    })

    unclassified = await fb.getUnclassified()
    expect(unclassified.length).toBe(1)
    expect(unclassified[0].id).toBe(r2.id)
  })

  it('getUnclassified respects limit', async () => {
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h1', answers: {}, path: '/' })
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h2', answers: {}, path: '/' })
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h3', answers: {}, path: '/' })

    const limited = await fb.getUnclassified(2)
    expect(limited.length).toBe(2)
  })

  // ── getInsights ─────────────────────────────────────────────────────────

  it('getInsights returns category breakdown', async () => {
    const r1 = await fb.submitResponse({ surveyId: 's1', visitorHash: 'h1', answers: {}, path: '/' })
    const r2 = await fb.submitResponse({ surveyId: 's1', visitorHash: 'h2', answers: {}, path: '/' })
    const r3 = await fb.submitResponse({ surveyId: 's1', visitorHash: 'h3', answers: {}, path: '/' })

    await fb.storeClassification({ responseId: r1.id, category: 'bug', sentiment: 'negative', confidence: 0.9, summary: 'broken', classifiedAt: new Date().toISOString() })
    await fb.storeClassification({ responseId: r2.id, category: 'bug', sentiment: 'negative', confidence: 0.8, summary: 'broken', classifiedAt: new Date().toISOString() })
    await fb.storeClassification({ responseId: r3.id, category: 'praise', sentiment: 'positive', confidence: 0.95, summary: 'great', classifiedAt: new Date().toISOString() })

    const insights = await fb.getInsights()
    expect(insights.totalResponses).toBe(3)
    expect(insights.categoryBreakdown['bug']).toBe(2)
    expect(insights.categoryBreakdown['praise']).toBe(1)
  })

  it('getInsights returns sentiment average', async () => {
    const r1 = await fb.submitResponse({ surveyId: 's1', visitorHash: 'h1', answers: {}, path: '/' })
    const r2 = await fb.submitResponse({ surveyId: 's1', visitorHash: 'h2', answers: {}, path: '/' })

    await fb.storeClassification({ responseId: r1.id, category: 'bug', sentiment: 'negative', confidence: 0.9, summary: 'bad', classifiedAt: new Date().toISOString() })
    await fb.storeClassification({ responseId: r2.id, category: 'praise', sentiment: 'positive', confidence: 0.9, summary: 'good', classifiedAt: new Date().toISOString() })

    const insights = await fb.getInsights()
    // negative=-1, positive=1 → avg=0
    expect(insights.avgSentiment).toBe(0)
  })

  it('getInsights returns top issues grouped by summary', async () => {
    const r1 = await fb.submitResponse({ surveyId: 's1', visitorHash: 'h1', answers: {}, path: '/' })
    const r2 = await fb.submitResponse({ surveyId: 's1', visitorHash: 'h2', answers: {}, path: '/' })
    const r3 = await fb.submitResponse({ surveyId: 's1', visitorHash: 'h3', answers: {}, path: '/' })

    await fb.storeClassification({ responseId: r1.id, category: 'friction', sentiment: 'negative', confidence: 0.9, summary: 'Checkout too slow', classifiedAt: new Date().toISOString() })
    await fb.storeClassification({ responseId: r2.id, category: 'friction', sentiment: 'negative', confidence: 0.85, summary: 'Checkout too slow', classifiedAt: new Date().toISOString() })
    await fb.storeClassification({ responseId: r3.id, category: 'bug', sentiment: 'negative', confidence: 0.9, summary: 'Login fails', classifiedAt: new Date().toISOString() })

    const insights = await fb.getInsights()
    expect(insights.topIssues[0].summary).toBe('Checkout too slow')
    expect(insights.topIssues[0].count).toBe(2)
    expect(insights.topIssues[1].summary).toBe('Login fails')
    expect(insights.topIssues[1].count).toBe(1)
  })

  it('getInsights returns daily trend', async () => {
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h1', answers: {}, score: 8, path: '/' })
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h2', answers: {}, score: 6, path: '/' })

    const insights = await fb.getInsights()
    expect(insights.trend.length).toBeGreaterThanOrEqual(1)
    expect(insights.trend[0].responses).toBe(2)
    expect(insights.trend[0].avgScore).toBe(7)
  })

  it('getInsights returns zero sentiment when no classifications', async () => {
    await fb.submitResponse({ surveyId: 's1', visitorHash: 'h1', answers: {}, path: '/' })

    const insights = await fb.getInsights()
    expect(insights.totalResponses).toBe(1)
    expect(insights.avgSentiment).toBe(0)
    expect(Object.keys(insights.categoryBreakdown).length).toBe(0)
  })
})
