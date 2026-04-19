/**
 * client_report MCP tool — generate detailed per-client marketing performance report.
 *
 * Aggregates data across DB_CORE (agency_clients, contacts, deals, activities)
 * and DB_ANALYTICS (content_index) for a specific client over a given period.
 */
import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

// ── Row shapes for D1 query results ────────────────────────────────────────

interface AgencyClientRow {
  slug: string
  name: string
  industry: string | null
  status: string
  onboarded_at: string | null
}

interface CountResult {
  count: number
}

interface SumResult {
  count: number
  total: number | null
}

interface WordCountResult {
  count: number
  total_words: number | null
}

interface GroupRow {
  [key: string]: string | number | null
}

interface ContentRow {
  title: string
  type: string
  published_at: string | null
}

interface ContactRow {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  stage: string | null
  created_at: string
}

interface DealRow {
  id: string
  title: string | null
  value: number | null
  status: string | null
  created_at: string
}

interface WikiRow {
  title: string
  slug: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Compute ISO date string N days ago from now. */
function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/** Parse period string (e.g. '7d', '30d', '90d') into number of days. */
function parsePeriodDays(period: string): number {
  const match = /^(\d+)d$/.exec(period)
  if (match) return parseInt(match[1], 10)
  return 30
}

// ── Tool definition ───────────────────────────────────────────────────────

export const clientReportMcpTools: McpToolDef[] = [
  {
    name: 'client_report',
    description:
      'Generate a detailed per-client marketing performance report covering content, SEO pages, CRM contacts, deals, activities, and wiki pages for a given time period.',
    inputSchema: {
      type: 'object',
      required: ['client_slug'],
      properties: {
        client_slug: {
          type: 'string',
          description: 'Client slug from agency_clients table',
        },
        period: {
          type: 'string',
          description: "Time period: '7d', '30d', '90d' (default '30d')",
          default: '30d',
        },
        format: {
          type: 'string',
          enum: ['summary', 'detailed'],
          description: "Report format: 'summary' or 'detailed' (default 'summary')",
          default: 'summary',
        },
      },
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env

      const clientSlug = typeof a.client_slug === 'string' ? a.client_slug : ''
      if (!clientSlug) {
        return { ok: false, error: 'client_slug is required' }
      }

      const period = typeof a.period === 'string' ? a.period : '30d'
      const format = a.format === 'detailed' ? 'detailed' : 'summary'

      // 1. Look up client
      let client: AgencyClientRow | null = null
      try {
        client = await env.DB_CORE.prepare(
          'SELECT * FROM agency_clients WHERE slug = ?',
        ).bind(clientSlug).first<AgencyClientRow>()
      } catch {
        return { ok: false, error: 'Failed to query agency_clients table' }
      }

      if (!client) {
        return { ok: false, error: `Client not found: ${clientSlug}` }
      }

      // 2. Compute date range
      const days = parsePeriodDays(period)
      const startDate = daysAgo(days)
      const tagPattern = `%${clientSlug}%`

      // 3. Gather metrics — all with try/catch, 0 on failure

      // --- Content metrics (DB_ANALYTICS) ---
      let contentPublished = 0
      let contentTotalWords = 0
      const contentByType: Record<string, number> = {}
      let landingPagesTotal = 0
      let landingPagesInPeriod = 0

      try {
        const contentRow = await env.DB_ANALYTICS.prepare(
          'SELECT COUNT(*) as count, COALESCE(SUM(word_count), 0) as total_words FROM content_index WHERE tags LIKE ? AND published_at >= ?',
        ).bind(tagPattern, startDate).first<WordCountResult>()
        contentPublished = contentRow?.count ?? 0
        contentTotalWords = contentRow?.total_words ?? 0

        const typeRows = await env.DB_ANALYTICS.prepare(
          'SELECT type, COUNT(*) as count FROM content_index WHERE tags LIKE ? AND published_at >= ? GROUP BY type',
        ).bind(tagPattern, startDate).all<GroupRow>()
        for (const row of typeRows.results ?? []) {
          const typeName = String(row.type ?? 'unknown')
          contentByType[typeName] = Number(row.count ?? 0)
        }
      } catch {
        // content_index table may not exist — degrade gracefully
      }

      // --- SEO landing pages (DB_ANALYTICS) ---
      try {
        const lpTotalRow = await env.DB_ANALYTICS.prepare(
          "SELECT COUNT(*) as count FROM content_index WHERE type = 'landing-pages' AND tags LIKE ?",
        ).bind(tagPattern).first<CountResult>()
        landingPagesTotal = lpTotalRow?.count ?? 0

        const lpPeriodRow = await env.DB_ANALYTICS.prepare(
          "SELECT COUNT(*) as count FROM content_index WHERE type = 'landing-pages' AND tags LIKE ? AND published_at >= ?",
        ).bind(tagPattern, startDate).first<CountResult>()
        landingPagesInPeriod = lpPeriodRow?.count ?? 0
      } catch {
        // degrade gracefully
      }

      // --- CRM contacts (DB_CORE) ---
      let contactsAdded = 0
      const contactsByStage: Record<string, number> = {}

      try {
        const contactRow = await env.DB_CORE.prepare(
          'SELECT COUNT(*) as count FROM contacts WHERE tenant_slug = ? AND created_at >= ?',
        ).bind(clientSlug, startDate).first<CountResult>()
        contactsAdded = contactRow?.count ?? 0

        const stageRows = await env.DB_CORE.prepare(
          'SELECT stage, COUNT(*) as count FROM contacts WHERE tenant_slug = ? AND created_at >= ? GROUP BY stage',
        ).bind(clientSlug, startDate).all<GroupRow>()
        for (const row of stageRows.results ?? []) {
          const stageName = String(row.stage ?? 'unknown')
          contactsByStage[stageName] = Number(row.count ?? 0)
        }
      } catch {
        // degrade gracefully
      }

      // --- Deals (DB_CORE) ---
      let dealsCreated = 0
      let dealsWon = 0
      let wonValue = 0
      let pipelineValue = 0

      try {
        const dealsCreatedRow = await env.DB_CORE.prepare(
          'SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as total FROM deals WHERE tenant_slug = ? AND created_at >= ?',
        ).bind(clientSlug, startDate).first<SumResult>()
        dealsCreated = dealsCreatedRow?.count ?? 0
        pipelineValue = dealsCreatedRow?.total ?? 0

        const dealsWonRow = await env.DB_CORE.prepare(
          "SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as total FROM deals WHERE tenant_slug = ? AND status = 'won' AND updated_at >= ?",
        ).bind(clientSlug, startDate).first<SumResult>()
        dealsWon = dealsWonRow?.count ?? 0
        wonValue = dealsWonRow?.total ?? 0
      } catch {
        // degrade gracefully
      }

      // --- Activities (DB_CORE) ---
      let activitiesTotal = 0
      const activitiesByType: Record<string, number> = {}

      try {
        const activityRows = await env.DB_CORE.prepare(
          'SELECT type, COUNT(*) as count FROM activities WHERE tenant_slug = ? AND performed_at >= ? GROUP BY type',
        ).bind(clientSlug, startDate).all<GroupRow>()
        for (const row of activityRows.results ?? []) {
          const typeName = String(row.type ?? 'unknown')
          const c = Number(row.count ?? 0)
          activitiesByType[typeName] = c
          activitiesTotal += c
        }
      } catch {
        // degrade gracefully
      }

      // --- Wiki pages (DB_ANALYTICS) ---
      let wikiPageCount = 0

      try {
        const wikiRow = await env.DB_ANALYTICS.prepare(
          "SELECT COUNT(*) as count FROM content_index WHERE type = 'wiki' AND tags LIKE ?",
        ).bind(tagPattern).first<CountResult>()
        wikiPageCount = wikiRow?.count ?? 0
      } catch {
        // degrade gracefully
      }

      // 4. Build highlights
      const highlights: string[] = []

      if (contentPublished > 0) {
        highlights.push(
          `Published ${contentPublished} piece${contentPublished === 1 ? '' : 's'} of content (${contentTotalWords.toLocaleString('en-US')} total words)`,
        )
      }
      if (landingPagesTotal > 0) {
        const suffix = landingPagesInPeriod > 0
          ? ` (${landingPagesInPeriod} new this period)`
          : ''
        highlights.push(`${landingPagesTotal} landing page${landingPagesTotal === 1 ? '' : 's'} live for SEO${suffix}`)
      }
      if (contactsAdded > 0 || pipelineValue > 0) {
        const pipelineStr = pipelineValue > 0
          ? `, ${dealsCreated} in pipeline worth $${pipelineValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`
          : ''
        highlights.push(`Added ${contactsAdded} new lead${contactsAdded === 1 ? '' : 's'}${pipelineStr}`)
      }
      if (dealsWon > 0) {
        highlights.push(
          `Won ${dealsWon} deal${dealsWon === 1 ? '' : 's'} worth $${wonValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`,
        )
      }
      if (activitiesTotal > 0) {
        highlights.push(`${activitiesTotal} activit${activitiesTotal === 1 ? 'y' : 'ies'} logged`)
      }
      if (wikiPageCount > 0) {
        highlights.push(`${wikiPageCount} wiki page${wikiPageCount === 1 ? '' : 's'} in knowledge base`)
      }
      if (highlights.length === 0) {
        highlights.push(`No activity recorded in the last ${days} day${days === 1 ? '' : 's'}`)
      }

      // 5. Build response
      const report: Record<string, unknown> = {
        ok: true,
        client: {
          name: client.name,
          slug: client.slug,
          industry: client.industry,
          onboarded_at: client.onboarded_at,
        },
        period,
        content: {
          published: contentPublished,
          total_words: contentTotalWords,
          by_type: contentByType,
          landing_pages: landingPagesTotal,
        },
        crm: {
          contacts_added: contactsAdded,
          by_stage: contactsByStage,
        },
        deals: {
          created: dealsCreated,
          won: dealsWon,
          won_value: wonValue,
          pipeline_value: pipelineValue,
        },
        activities: {
          total: activitiesTotal,
          by_type: activitiesByType,
        },
        wiki_pages: wikiPageCount,
        highlights,
      }

      // 6. Detailed format: include recent items
      if (format === 'detailed') {
        try {
          const recentContent = await env.DB_ANALYTICS.prepare(
            'SELECT title, type, published_at FROM content_index WHERE tags LIKE ? AND published_at >= ? ORDER BY published_at DESC LIMIT 10',
          ).bind(tagPattern, startDate).all<ContentRow>()
          report.recent_content = recentContent.results ?? []
        } catch {
          report.recent_content = []
        }

        try {
          const recentContacts = await env.DB_CORE.prepare(
            'SELECT id, first_name, last_name, email, stage, created_at FROM contacts WHERE tenant_slug = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 10',
          ).bind(clientSlug, startDate).all<ContactRow>()
          report.recent_contacts = recentContacts.results ?? []
        } catch {
          report.recent_contacts = []
        }

        try {
          const recentDeals = await env.DB_CORE.prepare(
            'SELECT id, title, value, status, created_at FROM deals WHERE tenant_slug = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 10',
          ).bind(clientSlug, startDate).all<DealRow>()
          report.recent_deals = recentDeals.results ?? []
        } catch {
          report.recent_deals = []
        }

        try {
          const wikiPages = await env.DB_ANALYTICS.prepare(
            "SELECT title, slug FROM content_index WHERE type = 'wiki' AND tags LIKE ? ORDER BY published_at DESC",
          ).bind(tagPattern).all<WikiRow>()
          report.wiki_pages_list = wikiPages.results ?? []
        } catch {
          report.wiki_pages_list = []
        }
      }

      return report
    },
  },
]
