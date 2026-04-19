/**
 * Inkwell Scheduled Worker — The Weekly Flywheel
 *
 * Cron trigger: runs every 6 hours (or weekly for full cycle)
 * 1. INGEST — pull data from all enabled connectors
 * 2. STORE — normalize and save snapshots to D1 marketing
 * 3. SCORE — compare week-over-week, find what moved
 * 4. DECIDE — generate task recommendations
 *
 * This is what makes the organism alive. Without it, Inkwell is passive.
 */

import type { Env } from './types'
import type { D1Database, ScheduledEvent, ExecutionContext } from '@cloudflare/workers-types'
import { createContentSources } from './middleware/adapters'
import { compileMdx } from '../../../kernel/processors/mdx-compiler'
import { D1DatabaseAdapter } from '../../../kernel/adapters/d1'
import { D1GraphAdapter } from '../../../kernel/adapters/d1-graph'
import { KVContentAdapter } from '../../../kernel/adapters/kv-content'
import { CfFeedbackAdapter } from '../../../kernel/adapters/cf-feedback'
import { config } from '../../../inkwell.config'

interface NormalizedMetric {
  source: string
  metric: string
  value: number
  dimensions: string // JSON
  period: string
}

// ── GSC Connector ──────────────────────────────────────────────────────

async function ingestGSC(env: Env): Promise<NormalizedMetric[]> {
  // GSC uses OAuth refresh token flow
  const creds = env.GSC_CREDENTIALS ? JSON.parse(env.GSC_CREDENTIALS) : null
  if (!creds) return []

  try {
    // Refresh the access token
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: creds.refresh_token,
        client_id: creds.client_id,
        client_secret: creds.client_secret,
      }),
    })
    const { access_token } = await tokenResp.json() as { access_token: string }

    // Pull last 7 days of search data
    const end = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]
    const start = new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0]

    const siteUrl = env.GSC_SITE_URL
    if (!siteUrl) return []

    const resp = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: start,
          endDate: end,
          dimensions: ['query'],
          rowLimit: 25,
        }),
      }
    )

    const data = await resp.json() as { rows?: Array<{ keys: string[], clicks: number, impressions: number, ctr: number, position: number }> }
    const metrics: NormalizedMetric[] = []

    let totalClicks = 0
    let totalImpressions = 0

    for (const row of data.rows || []) {
      totalClicks += row.clicks
      totalImpressions += row.impressions
      metrics.push({
        source: 'gsc',
        metric: 'query',
        value: row.clicks,
        dimensions: JSON.stringify({
          query: row.keys[0],
          impressions: row.impressions,
          ctr: Math.round(row.ctr * 1000) / 10,
          position: Math.round(row.position * 10) / 10,
        }),
        period: end,
      })
    }

    // Summary metrics
    metrics.push({
      source: 'gsc', metric: 'total_clicks', value: totalClicks,
      dimensions: '{}', period: end,
    })
    metrics.push({
      source: 'gsc', metric: 'total_impressions', value: totalImpressions,
      dimensions: '{}', period: end,
    })

    return metrics
  } catch (e) {
    console.error('[flywheel] GSC ingestion failed:', e)
    return []
  }
}

// ── GA4 Connector ──────────────────────────────────────────────────────

async function ingestGA4(env: Env): Promise<NormalizedMetric[]> {
  const creds = env.GA4_CREDENTIALS ? JSON.parse(env.GA4_CREDENTIALS) : null
  const propertyId = env.GA4_PROPERTY_ID
  if (!creds || !propertyId) return []

  try {
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: creds.refresh_token,
        client_id: creds.client_id,
        client_secret: creds.client_secret,
      }),
    })
    const { access_token } = await tokenResp.json() as { access_token: string }

    const resp = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
          metrics: [
            { name: 'sessions' },
            { name: 'conversions' },
            { name: 'totalUsers' },
            { name: 'bounceRate' },
          ],
        }),
      }
    )

    const data = await resp.json() as { rows?: Array<{ metricValues: Array<{ value: string }> }> }
    const row = data.rows?.[0]
    if (!row) return []

    const end = new Date().toISOString().split('T')[0]
    return [
      { source: 'ga4', metric: 'sessions', value: parseInt(row.metricValues[0].value), dimensions: '{}', period: end },
      { source: 'ga4', metric: 'conversions', value: parseInt(row.metricValues[1].value), dimensions: '{}', period: end },
      { source: 'ga4', metric: 'total_users', value: parseInt(row.metricValues[2].value), dimensions: '{}', period: end },
      { source: 'ga4', metric: 'bounce_rate', value: parseFloat(row.metricValues[3].value), dimensions: '{}', period: end },
    ]
  } catch (e) {
    console.error('[flywheel] GA4 ingestion failed:', e)
    return []
  }
}

// ── Store to D1 ────────────────────────────────────────────────────────

async function storeSnapshots(db: D1Database, metrics: NormalizedMetric[]): Promise<number> {
  let stored = 0
  for (const m of metrics) {
    try {
      await db.prepare(
        `INSERT INTO marketing_snapshots (id, source, metric, value, dimensions, period, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        `${m.source}-${m.metric}-${m.period}-${Date.now()}`,
        m.source, m.metric, m.value, m.dimensions, m.period
      ).run()
      stored++
    } catch {
      // duplicate or error — skip
    }
  }
  return stored
}

// ── Score (week-over-week) ─────────────────────────────────────────────

async function scoreWeekOverWeek(db: D1Database): Promise<string> {
  try {
    const thisWeek = await db.prepare(
      `SELECT metric, SUM(value) as total FROM marketing_snapshots
       WHERE source = 'gsc' AND metric IN ('total_clicks', 'total_impressions')
       AND fetched_at > datetime('now', '-7 days')
       GROUP BY metric`
    ).all()

    const lastWeek = await db.prepare(
      `SELECT metric, SUM(value) as total FROM marketing_snapshots
       WHERE source = 'gsc' AND metric IN ('total_clicks', 'total_impressions')
       AND fetched_at > datetime('now', '-14 days')
       AND fetched_at <= datetime('now', '-7 days')
       GROUP BY metric`
    ).all()

    const current: Record<string, number> = {}
    const previous: Record<string, number> = {}
    for (const r of thisWeek.results as any[]) current[r.metric] = r.total
    for (const r of lastWeek.results as any[]) previous[r.metric] = r.total

    const clicksDelta = previous.total_clicks
      ? ((current.total_clicks - previous.total_clicks) / previous.total_clicks * 100).toFixed(1)
      : 'n/a'
    const imprDelta = previous.total_impressions
      ? ((current.total_impressions - previous.total_impressions) / previous.total_impressions * 100).toFixed(1)
      : 'n/a'

    return `Clicks: ${current.total_clicks || 0} (${clicksDelta}% WoW) | Impressions: ${current.total_impressions || 0} (${imprDelta}% WoW)`
  } catch {
    return 'Scoring unavailable — not enough data yet'
  }
}

// ── Content Sync ──────────────────────────────────────────────────────

interface SyncResult {
  source: string
  synced: number
  errors: string[]
}

async function syncContentSources(env: Env): Promise<SyncResult[]> {
  const sources = createContentSources(env)
  if (sources.length === 0) return []

  const dbCore = new D1DatabaseAdapter(env.DB_CORE)
  const content = new KVContentAdapter(env.CONTENT)
  const graph = new D1GraphAdapter(dbCore)
  const results: SyncResult[] = []

  for (const source of sources) {
    const errors: string[] = []
    let synced = 0

    try {
      const items = await source.sync()

      for (const item of items) {
        try {
          const compiled = compileMdx(item.content, { basePath: '/' })
          const fm = compiled.frontmatter
          const slug = item.slug
          const title = typeof fm.title === 'string' ? fm.title : item.title
          const tags = Array.isArray(fm.tags)
            ? fm.tags.filter((t): t is string => typeof t === 'string')
            : []
          const contentType = typeof fm.type === 'string' ? fm.type : 'page'
          const author = typeof fm.author === 'string' ? fm.author : 'sync'
          const date = item.updatedAt.slice(0, 10)

          // Store compiled HTML
          const kvKey = `page:${slug}.html`
          await content.putPage(kvKey, compiled.html)

          // Upsert graph node
          await graph.upsertNode({
            slug,
            title,
            type: contentType,
            tags,
            visibility: 'public',
            author,
            date,
          })

          // Create wikilink edges
          for (const target of compiled.wikilinks) {
            await graph.upsertEdge({
              source: slug,
              target,
              type: 'wikilink',
              weight: 1,
            })
          }

          synced++
        } catch (err) {
          errors.push(`${item.slug}: ${err instanceof Error ? err.message : 'unknown error'}`)
        }
      }
    } catch (err) {
      errors.push(`source error: ${err instanceof Error ? err.message : 'unknown error'}`)
    }

    results.push({ source: source.name, synced, errors })
  }

  return results
}

// ── Main Scheduled Handler ─────────────────────────────────────────────

export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  console.log(`[flywheel] Starting scheduled run at ${new Date().toISOString()}`)

  const allMetrics: NormalizedMetric[] = []

  // Ingest from all enabled connectors
  const gscMetrics = await ingestGSC(env)
  allMetrics.push(...gscMetrics)
  console.log(`[flywheel] GSC: ${gscMetrics.length} metrics`)

  const ga4Metrics = await ingestGA4(env)
  allMetrics.push(...ga4Metrics)
  console.log(`[flywheel] GA4: ${ga4Metrics.length} metrics`)

  // Store snapshots
  const stored = await storeSnapshots(env.DB_MARKETING, allMetrics)
  console.log(`[flywheel] Stored ${stored} snapshots to D1`)

  // Score week-over-week
  const score = await scoreWeekOverWeek(env.DB_MARKETING)
  console.log(`[flywheel] Score: ${score}`)

  // Sync content from configured sources (GitHub, Notion, Google Drive)
  try {
    const syncResults = await syncContentSources(env)
    const totalSynced = syncResults.reduce((sum, r) => sum + r.synced, 0)
    const totalErrors = syncResults.reduce((sum, r) => sum + r.errors.length, 0)
    if (syncResults.length > 0) {
      console.log(`[flywheel] Content sync: ${totalSynced} items from ${syncResults.length} sources, ${totalErrors} errors`)
      for (const r of syncResults) {
        if (r.errors.length > 0) {
          console.error(`[flywheel] Sync errors for ${r.source}:`, r.errors.join('; '))
        }
      }
    }
  } catch (e) {
    console.error('[flywheel] Content sync failed:', e)
  }

  // ── Feedback classification — LLM-powered auto-tagging ──────────────
  let feedbackDigest = ''
  const fbConfig = (config as Record<string, unknown>).feedback as
    | { classifyEnabled?: boolean }
    | undefined

  if (fbConfig?.classifyEnabled && env.AI) {
    try {
      const dbAnalytics = new D1DatabaseAdapter(env.DB_ANALYTICS)
      const feedbackAdapter = new CfFeedbackAdapter({ db: dbAnalytics })
      const unclassified = await feedbackAdapter.getUnclassified(20)

      if (unclassified.length > 0) {
        let classified = 0
        for (const response of unclassified) {
          const text = response.freetext || JSON.stringify(response.answers)
          if (!text || text.length < 5) continue

          try {
            const result = await (env.AI as { run(model: string, inputs: Record<string, unknown>): Promise<{ response?: string }> }).run(
              '@cf/meta/llama-3.1-8b-instruct',
              {
                messages: [
                  {
                    role: 'system',
                    content: 'Classify this customer feedback. Respond with ONLY valid JSON: {"category":"bug|friction|feature_request|praise|other","sentiment":"positive|neutral|negative","confidence":0.0-1.0,"summary":"one line summary"}',
                  },
                  { role: 'user', content: text },
                ],
                max_tokens: 100,
              }
            )

            const raw = result?.response ?? ''
            const jsonMatch = raw.match(/\{[^}]+\}/)
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]) as {
                category: string
                sentiment: string
                confidence: number
                summary: string
              }

              await feedbackAdapter.storeClassification({
                responseId: response.id,
                category: parsed.category as 'bug' | 'friction' | 'feature_request' | 'praise' | 'other',
                sentiment: parsed.sentiment as 'positive' | 'neutral' | 'negative',
                confidence: parsed.confidence,
                summary: parsed.summary,
                classifiedAt: new Date().toISOString(),
              })
              classified++
            }
          } catch {
            // Individual classification failure — continue with rest
          }
        }
        feedbackDigest = `Feedback: ${classified}/${unclassified.length} classified`
        console.log(`[flywheel] ${feedbackDigest}`)
      }
    } catch (e) {
      console.error('[flywheel] Feedback classification failed:', e)
    }
  }

  // Log the run
  try {
    await env.DB_MARKETING.prepare(
      `INSERT INTO connector_runs (id, connector, status, rows_synced, started_at, finished_at)
       VALUES (?, 'flywheel', 'completed', ?, datetime('now'), datetime('now'))`
    ).bind(`run-${Date.now()}`, stored).run()
  } catch { /* ignore */ }

  // Report to SOS bus
  if (env.SOS_BUS_URL) {
    try {
      const recipient = env.SOS_REPORT_RECIPIENT || 'owner'
      await fetch(env.SOS_BUS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', method: 'tools/call', id: Date.now(),
          params: {
            name: 'send',
            arguments: {
              to: recipient,
              text: `[Flywheel Daily Report]\n${score}\nGA4: ${ga4Metrics.find(m => m.metric === 'sessions')?.value || '?'} sessions\nStored: ${stored} snapshots${feedbackDigest ? `\n${feedbackDigest}` : ''}`,
            },
          },
        }),
      })
    } catch { /* non-critical */ }
  }

  // ── Auto-Publish — publish scheduled content whose time has come ─────
  try {
    const dbAnalytics = new D1DatabaseAdapter(env.DB_ANALYTICS)
    const contentKv = new KVContentAdapter(env.CONTENT)
    const now = new Date().toISOString()

    const scheduled = await dbAnalytics.query<{ slug: string; title: string; tenant_slug: string | null }>(
      `SELECT slug, title, tenant_slug FROM content_index
       WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?`,
      [now],
    )

    for (const entry of scheduled) {
      await dbAnalytics.execute(
        `UPDATE content_index SET status = 'published', published_at = datetime('now'), scheduled_at = NULL, updated_at = datetime('now')
         WHERE slug = ?`,
        [entry.slug],
      )

      // Update KV metadata status
      const metaKey = entry.tenant_slug ? `${entry.tenant_slug}:meta:${entry.slug}` : `meta:${entry.slug}`
      const metaRaw = await contentKv.getPage(metaKey)
      if (metaRaw) {
        try {
          const meta = JSON.parse(metaRaw) as Record<string, unknown>
          meta.status = 'published'
          meta.published_at = now
          await contentKv.putPage(metaKey, JSON.stringify(meta))
        } catch { /* meta parse failed — non-critical */ }
      }

      console.log(`[auto-publish] Published: ${entry.title} (${entry.slug})`)
    }

    if (scheduled.length > 0) {
      console.log(`[auto-publish] ${scheduled.length} entries published`)
    }
  } catch (e) {
    console.error('[auto-publish] Failed:', e)
  }

  // ── Event Aggregates — daily rollup ──────────────────────────────────
  try {
    const dbAnalytics = new D1DatabaseAdapter(env.DB_ANALYTICS)
    const today = new Date().toISOString().split('T')[0]

    // Aggregate events by name for today
    const eventCounts = await dbAnalytics.query<{
      event_name: string
      tenant: string | null
      count: number
      unique_visitors: number
    }>(
      `SELECT event_name, tenant, COUNT(*) as count, COUNT(DISTINCT visitor_hash) as unique_visitors
       FROM events WHERE DATE(created_at) = ?
       GROUP BY event_name, tenant`,
      [today]
    )

    let aggregated = 0
    for (const row of eventCounts) {
      await dbAnalytics.execute(
        `INSERT INTO event_aggregates (date, event_name, tenant, count, unique_visitors)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(date, event_name, tenant) DO UPDATE SET
           count = excluded.count,
           unique_visitors = excluded.unique_visitors`,
        [today, row.event_name, row.tenant ?? '', row.count, row.unique_visitors]
      )
      aggregated++
    }

    if (aggregated > 0) {
      console.log(`[flywheel] Event aggregates: ${aggregated} event types rolled up for ${today}`)
    }
  } catch (e) {
    console.error('[flywheel] Event aggregation failed:', e)
  }

  // ── Glass: publish daily snapshot to KV ──────────────────────────────
  try {
    const today = new Date().toISOString().split('T')[0]

    // Build snapshot data
    const gscSummary = gscMetrics.find(m => m.metric === 'total_clicks')
    const ga4Sessions = ga4Metrics.find(m => m.metric === 'sessions')
    const ga4Users = ga4Metrics.find(m => m.metric === 'total_users')
    const ga4Conversions = ga4Metrics.find(m => m.metric === 'conversions')
    const ga4Bounce = ga4Metrics.find(m => m.metric === 'bounce_rate')

    // Get top queries from this run
    const topQueries = gscMetrics
      .filter(m => m.metric === 'query')
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map(m => {
        const dims = JSON.parse(m.dimensions)
        return { query: dims.query, clicks: m.value, impressions: dims.impressions, ctr: dims.ctr, position: dims.position }
      })

    // Get recent connector runs
    const recentRuns = await env.DB_MARKETING.prepare(
      `SELECT connector, status, rows_synced, finished_at FROM connector_runs ORDER BY finished_at DESC LIMIT 5`
    ).all()

    const glassPage = {
      date: today,
      generated_at: new Date().toISOString(),
      kpis: {
        organic_clicks: gscSummary?.value ?? 0,
        sessions: ga4Sessions?.value ?? 0,
        users: ga4Users?.value ?? 0,
        conversions: ga4Conversions?.value ?? 0,
        bounce_rate: ga4Bounce?.value ?? 0,
      },
      score,
      top_queries: topQueries,
      connector_runs: recentRuns.results ?? [],
      metrics_ingested: allMetrics.length,
      snapshots_stored: stored,
    }

    // Write to KV — accessible at /api/glass/daily and /api/glass/:date
    await env.CONTENT.put(`glass:daily`, JSON.stringify(glassPage), { expirationTtl: 86400 * 7 })
    await env.CONTENT.put(`glass:${today}`, JSON.stringify(glassPage))
    console.log(`[glass] Daily snapshot published to KV: glass:${today}`)
  } catch (e) {
    console.error('[glass] Failed to publish snapshot:', e)
  }

  console.log(`[flywheel] Completed. ${allMetrics.length} metrics ingested, ${stored} stored.`)
}
