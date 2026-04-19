/**
 * marketing_report MCP tool — generate marketing performance reports.
 *
 * Aggregates data across DB_CORE (contacts, deals, activities) and
 * DB_ANALYTICS (content_index) for a given time period.
 */
import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

interface CountResult { count: number }
interface SumResult { count: number; total: number | null }
interface GroupRow { [key: string]: string | number }

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
  if (period === '1w') return 7
  if (period === '1m') return 30
  if (period === '3m') return 90
  return 7
}

/** Build human-readable highlight strings from report data. */
function buildHighlights(
  contactsAdded: number,
  dealsCreated: number,
  dealsWon: number,
  wonValue: number,
  pipelineValue: number,
  activitiesTotal: number,
  contentPublished: number,
  socialPosts: number,
  outreachSent: number,
  periodLabel: string,
): string[] {
  const highlights: string[] = []

  if (contactsAdded > 0) {
    highlights.push(`Added ${contactsAdded} new lead${contactsAdded === 1 ? '' : 's'} in the last ${periodLabel}`)
  }
  if (dealsWon > 0) {
    highlights.push(
      `Won ${dealsWon} deal${dealsWon === 1 ? '' : 's'} worth $${wonValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`,
    )
  }
  if (dealsCreated > 0 && dealsCreated !== dealsWon) {
    highlights.push(
      `${dealsCreated} new deal${dealsCreated === 1 ? '' : 's'} in pipeline ($${pipelineValue.toLocaleString('en-US', { minimumFractionDigits: 0 })} total value)`,
    )
  }
  if (activitiesTotal > 0) {
    highlights.push(`${activitiesTotal} activit${activitiesTotal === 1 ? 'y' : 'ies'} logged`)
  }
  if (contentPublished > 0) {
    highlights.push(`Published ${contentPublished} piece${contentPublished === 1 ? '' : 's'} of content`)
  }
  if (socialPosts > 0) {
    highlights.push(`${socialPosts} social post${socialPosts === 1 ? '' : 's'} shared`)
  }
  if (outreachSent > 0) {
    highlights.push(`${outreachSent} outreach message${outreachSent === 1 ? '' : 's'} sent`)
  }
  if (highlights.length === 0) {
    highlights.push(`No activity recorded in the last ${periodLabel}`)
  }

  return highlights
}

export const reportMcpTools: McpToolDef[] = [
  {
    name: 'marketing_report',
    description:
      'Generate a marketing performance report covering leads, deals, activities, content, and outreach for a given time period. Returns structured data with human-readable highlights.',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          description: "Time period: '7d', '30d', '90d' (default '7d')",
          default: '7d',
        },
        tenant_slug: {
          type: 'string',
          description: "Tenant slug (default 'default')",
          default: 'default',
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

      const period = typeof a.period === 'string' ? a.period : '7d'
      const tenantSlug = typeof a.tenant_slug === 'string' ? a.tenant_slug : 'default'
      const format = a.format === 'detailed' ? 'detailed' : 'summary'

      const days = parsePeriodDays(period)
      const startDate = daysAgo(days)
      const endDate = new Date().toISOString().slice(0, 10)
      const periodLabel = `${days} day${days === 1 ? '' : 's'}`

      // --- DB_CORE queries ---

      // Contacts added
      const contactsAddedRow = await env.DB_CORE.prepare(
        'SELECT COUNT(*) as count FROM contacts WHERE created_at >= ? AND tenant_slug = ?',
      ).bind(startDate, tenantSlug).first<CountResult>()
      const contactsAdded = contactsAddedRow?.count ?? 0

      // Contacts by stage
      const stageRows = await env.DB_CORE.prepare(
        'SELECT stage, COUNT(*) as count FROM contacts WHERE created_at >= ? AND tenant_slug = ? GROUP BY stage',
      ).bind(startDate, tenantSlug).all<GroupRow>()
      const byStage: Record<string, number> = {}
      for (const row of stageRows.results ?? []) {
        const stageName = String(row.stage ?? 'unknown')
        byStage[stageName] = Number(row.count ?? 0)
      }

      // Deals created
      const dealsCreatedRow = await env.DB_CORE.prepare(
        'SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as total FROM deals WHERE created_at >= ? AND tenant_slug = ?',
      ).bind(startDate, tenantSlug).first<SumResult>()
      const dealsCreated = dealsCreatedRow?.count ?? 0
      const pipelineValue = dealsCreatedRow?.total ?? 0

      // Deals won
      const dealsWonRow = await env.DB_CORE.prepare(
        "SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as total FROM deals WHERE status = 'won' AND updated_at >= ? AND tenant_slug = ?",
      ).bind(startDate, tenantSlug).first<SumResult>()
      const dealsWon = dealsWonRow?.count ?? 0
      const wonValue = dealsWonRow?.total ?? 0

      // Activities by type
      const activityRows = await env.DB_CORE.prepare(
        'SELECT type, COUNT(*) as count FROM activities WHERE performed_at >= ? AND tenant_slug = ? GROUP BY type',
      ).bind(startDate, tenantSlug).all<GroupRow>()
      const byType: Record<string, number> = {}
      let activitiesTotal = 0
      for (const row of activityRows.results ?? []) {
        const typeName = String(row.type ?? 'unknown')
        const c = Number(row.count ?? 0)
        byType[typeName] = c
        activitiesTotal += c
      }

      // --- DB_ANALYTICS queries ---
      let contentPublished = 0
      let socialPosts = 0
      let outreachSent = 0

      try {
        const blogRow = await env.DB_ANALYTICS.prepare(
          "SELECT COUNT(*) as count FROM content_index WHERE type = 'blog' AND published_at >= ?",
        ).bind(startDate).first<CountResult>()
        contentPublished = blogRow?.count ?? 0

        const socialRow = await env.DB_ANALYTICS.prepare(
          "SELECT COUNT(*) as count FROM content_index WHERE type = 'social' AND published_at >= ?",
        ).bind(startDate).first<CountResult>()
        socialPosts = socialRow?.count ?? 0

        const outreachRow = await env.DB_ANALYTICS.prepare(
          "SELECT COUNT(*) as count FROM content_index WHERE type = 'outreach' AND published_at >= ?",
        ).bind(startDate).first<CountResult>()
        outreachSent = outreachRow?.count ?? 0
      } catch {
        // DB_ANALYTICS tables may not exist yet — degrade gracefully
      }

      // Build highlights
      const highlights = buildHighlights(
        contactsAdded, dealsCreated, dealsWon, wonValue, pipelineValue,
        activitiesTotal, contentPublished, socialPosts, outreachSent, periodLabel,
      )

      // Base report
      const report: Record<string, unknown> = {
        period,
        start_date: startDate,
        end_date: endDate,
        contacts: { added: contactsAdded, by_stage: byStage },
        deals: {
          created: dealsCreated,
          won: dealsWon,
          pipeline_value: pipelineValue,
          won_value: wonValue,
        },
        activities: { total: activitiesTotal, by_type: byType },
        content: { published: contentPublished, social_posts: socialPosts },
        outreach: { emails_sent: outreachSent },
        highlights,
      }

      // Detailed format: include top contacts, top deals, recent activities
      if (format === 'detailed') {
        const topContacts = await env.DB_CORE.prepare(
          'SELECT id, first_name, last_name, email, company, stage, created_at FROM contacts WHERE created_at >= ? AND tenant_slug = ? ORDER BY created_at DESC LIMIT 10',
        ).bind(startDate, tenantSlug).all<GroupRow>()

        const topDeals = await env.DB_CORE.prepare(
          'SELECT id, title, value, status, created_at FROM deals WHERE created_at >= ? AND tenant_slug = ? ORDER BY value DESC LIMIT 10',
        ).bind(startDate, tenantSlug).all<GroupRow>()

        const recentActivities = await env.DB_CORE.prepare(
          'SELECT id, contact_id, type, subject, performed_at FROM activities WHERE performed_at >= ? AND tenant_slug = ? ORDER BY performed_at DESC LIMIT 20',
        ).bind(startDate, tenantSlug).all<GroupRow>()

        report.top_contacts = topContacts.results ?? []
        report.top_deals = topDeals.results ?? []
        report.recent_activities = recentActivities.results ?? []
      }

      return report
    },
  },
]
