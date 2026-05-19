/**
 * CfFeedbackAdapter — Cloudflare D1 implementation of FeedbackPort.
 *
 * Structured feedback collection, feature voting, and LLM-powered insights.
 * Uses D1 for storage. Privacy-first: all responses anonymous via visitor hash.
 * Plugins never import D1 directly — they use FeedbackPort.
 */
import type {
  DatabasePort,
  FeedbackClassification,
  FeedbackPort,
  FeatureRequest,
  FeatureVote,
  SurveyResponse,
} from '../types'

/** D1 row shape for survey_responses table. */
interface SurveyResponseRow {
  id: string
  survey_id: string
  visitor_hash: string
  answers: string // JSON
  score: number | null
  freetext: string | null
  path: string
  tenant: string | null
  created_at: string
}

/** D1 row shape for feature_requests table. */
interface FeatureRequestRow {
  id: string
  title: string
  description: string | null
  status: string
  vote_count: number
  tenant: string | null
  created_at: string
}

/** D1 row shape for feature_votes table. */
interface FeatureVoteRow {
  id: string
  feature_id: string
  title: string
  description: string | null
  visitor_hash: string
  tenant: string | null
  created_at: string
}

/** D1 row shape for feedback_classifications table. */
interface FeedbackClassificationRow {
  response_id: string
  category: string
  sentiment: string
  confidence: number
  summary: string
  classified_at: string
}

function rowToResponse(row: SurveyResponseRow): SurveyResponse {
  return {
    id: row.id,
    surveyId: row.survey_id,
    visitorHash: row.visitor_hash,
    answers: JSON.parse(row.answers) as Record<string, string | number | boolean>,
    score: row.score ?? undefined,
    freetext: row.freetext ?? undefined,
    path: row.path,
    tenant: row.tenant ?? undefined,
    createdAt: row.created_at,
  }
}

function rowToFeatureRequest(row: FeatureRequestRow): FeatureRequest {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status as FeatureRequest['status'],
    voteCount: row.vote_count,
    tenant: row.tenant ?? undefined,
    createdAt: row.created_at,
  }
}

function rowToFeatureVote(row: FeatureVoteRow): FeatureVote {
  return {
    id: row.id,
    featureId: row.feature_id,
    title: row.title,
    description: row.description ?? undefined,
    visitorHash: row.visitor_hash,
    tenant: row.tenant ?? undefined,
    createdAt: row.created_at,
  }
}

interface CfFeedbackAdapterOptions {
  db: DatabasePort
}

export class CfFeedbackAdapter implements FeedbackPort {
  private readonly db: DatabasePort

  constructor(opts: CfFeedbackAdapterOptions) {
    this.db = opts.db
  }

  async submitResponse(
    response: Omit<SurveyResponse, 'id' | 'createdAt'>
  ): Promise<SurveyResponse> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await this.db.execute(
      `INSERT INTO survey_responses (id, survey_id, visitor_hash, answers, score, freetext, path, tenant, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        response.surveyId,
        response.visitorHash,
        JSON.stringify(response.answers),
        response.score ?? null,
        response.freetext ?? null,
        response.path,
        response.tenant ?? null,
        now,
      ]
    )

    return { id, ...response, createdAt: now }
  }

  async getResponses(
    surveyId: string,
    tenant?: string,
    since?: string
  ): Promise<SurveyResponse[]> {
    const conditions: string[] = ['survey_id = ?']
    const params: unknown[] = [surveyId]

    if (tenant) {
      conditions.push('tenant = ?')
      params.push(tenant)
    }

    if (since) {
      conditions.push('created_at >= ?')
      params.push(since)
    }

    const where = `WHERE ${conditions.join(' AND ')}`

    const rows = await this.db.query<SurveyResponseRow>(
      `SELECT * FROM survey_responses ${where} ORDER BY created_at DESC`,
      params
    )

    return rows.map(rowToResponse)
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
    const conditions: string[] = ['survey_id = ?']
    const params: unknown[] = [surveyId]

    if (tenant) {
      conditions.push('tenant = ?')
      params.push(tenant)
    }

    const where = `WHERE ${conditions.join(' AND ')}`

    // Get count and avg
    const summary = await this.db.queryOne<{ cnt: number; avg_score: number | null }>(
      `SELECT COUNT(*) as cnt, AVG(score) as avg_score FROM survey_responses ${where}`,
      params
    )

    const responseCount = summary?.cnt ?? 0
    const avgScore = summary?.avg_score ?? null

    // Get score distribution
    const distRows = await this.db.query<{ score: number; cnt: number }>(
      `SELECT CAST(score AS INTEGER) as score, COUNT(*) as cnt
       FROM survey_responses ${where} AND score IS NOT NULL
       GROUP BY CAST(score AS INTEGER)`,
      params
    )

    const scoreDistribution: Record<number, number> = {}
    let promoters = 0
    let passives = 0
    let detractors = 0

    for (const row of distRows) {
      scoreDistribution[row.score] = row.cnt
      if (row.score >= 9) promoters += row.cnt
      else if (row.score >= 7) passives += row.cnt
      else detractors += row.cnt
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
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    // Upsert the feature request (create if not exists)
    const existingFeature = await this.db.queryOne<FeatureRequestRow>(
      'SELECT * FROM feature_requests WHERE id = ?',
      [vote.featureId]
    )

    if (!existingFeature) {
      await this.db.execute(
        `INSERT INTO feature_requests (id, title, description, status, vote_count, tenant, created_at)
         VALUES (?, ?, ?, 'open', 1, ?, ?)`,
        [vote.featureId, vote.title, vote.description ?? null, vote.tenant ?? null, now]
      )
    } else {
      await this.db.execute(
        'UPDATE feature_requests SET vote_count = vote_count + 1 WHERE id = ?',
        [vote.featureId]
      )
    }

    // Insert the vote (UNIQUE constraint on feature_id + visitor_hash handles dedup)
    await this.db.execute(
      `INSERT INTO feature_votes (id, feature_id, title, description, visitor_hash, tenant, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, vote.featureId, vote.title, vote.description ?? null, vote.visitorHash, vote.tenant ?? null, now]
    )

    return { id, ...vote, createdAt: now }
  }

  async listFeatures(
    tenant?: string,
    status?: FeatureRequest['status']
  ): Promise<FeatureRequest[]> {
    const conditions: string[] = []
    const params: unknown[] = []

    if (tenant) {
      conditions.push('tenant = ?')
      params.push(tenant)
    }

    if (status) {
      conditions.push('status = ?')
      params.push(status)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const rows = await this.db.query<FeatureRequestRow>(
      `SELECT * FROM feature_requests ${where} ORDER BY vote_count DESC`,
      params
    )

    return rows.map(rowToFeatureRequest)
  }

  async updateFeatureStatus(
    featureId: string,
    status: FeatureRequest['status']
  ): Promise<void> {
    await this.db.execute(
      'UPDATE feature_requests SET status = ? WHERE id = ?',
      [status, featureId]
    )
  }

  async storeClassification(classification: FeedbackClassification): Promise<void> {
    await this.db.execute(
      `INSERT INTO feedback_classifications (response_id, category, sentiment, confidence, summary, classified_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(response_id) DO UPDATE SET
         category = excluded.category,
         sentiment = excluded.sentiment,
         confidence = excluded.confidence,
         summary = excluded.summary,
         classified_at = excluded.classified_at`,
      [
        classification.responseId,
        classification.category,
        classification.sentiment,
        classification.confidence,
        classification.summary,
        classification.classifiedAt,
      ]
    )
  }

  async getUnclassified(limit?: number): Promise<SurveyResponse[]> {
    const cap = limit ?? 50

    const rows = await this.db.query<SurveyResponseRow>(
      `SELECT sr.* FROM survey_responses sr
       LEFT JOIN feedback_classifications fc ON sr.id = fc.response_id
       WHERE fc.response_id IS NULL
       ORDER BY sr.created_at ASC
       LIMIT ?`,
      [cap]
    )

    return rows.map(rowToResponse)
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
    const conditions: string[] = []
    const params: unknown[] = []

    if (tenant) {
      conditions.push('sr.tenant = ?')
      params.push(tenant)
    }

    if (days) {
      conditions.push("sr.created_at >= datetime('now', ?)")
      params.push(`-${days} days`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Total responses
    const countRow = await this.db.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM survey_responses sr ${where}`,
      params
    )
    const totalResponses = countRow?.cnt ?? 0

    // Average sentiment from classifications
    const sentimentConditions = [...conditions]
    const sentimentParams = [...params]
    const sentimentWhere =
      sentimentConditions.length > 0
        ? `WHERE ${sentimentConditions.join(' AND ')}`
        : ''

    const sentimentRow = await this.db.queryOne<{ avg_sent: number | null }>(
      `SELECT AVG(CASE fc.sentiment
         WHEN 'positive' THEN 1.0
         WHEN 'neutral' THEN 0.0
         WHEN 'negative' THEN -1.0
         END) as avg_sent
       FROM survey_responses sr
       JOIN feedback_classifications fc ON sr.id = fc.response_id
       ${sentimentWhere}`,
      sentimentParams
    )
    const avgSentiment = sentimentRow?.avg_sent ?? 0

    // Category breakdown
    const catRows = await this.db.query<{ category: string; cnt: number }>(
      `SELECT fc.category, COUNT(*) as cnt
       FROM survey_responses sr
       JOIN feedback_classifications fc ON sr.id = fc.response_id
       ${sentimentWhere}
       GROUP BY fc.category`,
      sentimentParams
    )

    const categoryBreakdown: Record<string, number> = {}
    for (const row of catRows) {
      categoryBreakdown[row.category] = row.cnt
    }

    // Top issues — grouped by summary
    const issueRows = await this.db.query<{ summary: string; cnt: number; category: string }>(
      `SELECT fc.summary, COUNT(*) as cnt, fc.category
       FROM survey_responses sr
       JOIN feedback_classifications fc ON sr.id = fc.response_id
       ${sentimentWhere}
       GROUP BY fc.summary, fc.category
       ORDER BY cnt DESC
       LIMIT 10`,
      sentimentParams
    )

    const topIssues = issueRows.map((row) => ({
      summary: row.summary,
      count: row.cnt,
      category: row.category,
    }))

    // Daily trend
    const trendRows = await this.db.query<{ date: string; responses: number; avg_score: number }>(
      `SELECT DATE(sr.created_at) as date, COUNT(*) as responses, AVG(sr.score) as avg_score
       FROM survey_responses sr
       ${where}
       GROUP BY DATE(sr.created_at)
       ORDER BY date ASC`,
      params
    )

    const trend = trendRows.map((row) => ({
      date: row.date,
      responses: row.responses,
      avgScore: row.avg_score ?? 0,
    }))

    return {
      totalResponses,
      avgSentiment,
      categoryBreakdown,
      topIssues,
      trend,
    }
  }
}
