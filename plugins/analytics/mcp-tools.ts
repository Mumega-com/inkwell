import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

export const analyticsMcpTools: McpToolDef[] = [
  {
    name: 'get_dashboard',
    description:
      'Return marketing KPI summary from DB_MARKETING: clicks, impressions, leads, spend, CPL.',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['7d', '28d', '90d'],
          description: 'Lookback period (default: 28d)',
        },
      },
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env
      const days = a.period === '7d' ? 7 : a.period === '90d' ? 90 : 28

      const row = await env.DB_MARKETING.prepare(
        `SELECT SUM(clicks) AS clicks, SUM(impressions) AS impressions, SUM(leads) AS leads, SUM(spend) AS spend
         FROM marketing_snapshots WHERE date >= date('now', '-${days} days')`,
      ).first<{
        clicks: number | null
        impressions: number | null
        leads: number | null
        spend: number | null
      }>()

      const clicks = row?.clicks ?? 0
      const impressions = row?.impressions ?? 0
      const leads = row?.leads ?? 0
      const spend = Number(row?.spend ?? 0)

      return {
        period: `${days}d`,
        clicks,
        impressions,
        leads,
        spend: Number(spend.toFixed(2)),
        cpl: leads > 0 ? Number((spend / leads).toFixed(2)) : null,
        ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : null,
      }
    },
  },
  {
    name: 'get_seo_data',
    description: 'Return Google Search Console snapshot data from DB_MARKETING.',
    inputSchema: {
      type: 'object',
      properties: {
        metric: {
          type: 'string',
          enum: ['queries', 'pages', 'overview'],
          description: 'Which dimension to return (default: overview)',
        },
      },
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env
      const metric = typeof a.metric === 'string' ? a.metric : 'overview'

      if (metric === 'queries') {
        const rows = await env.DB_MARKETING.prepare(
          `SELECT query, clicks, impressions, ctr, position FROM gsc_queries ORDER BY clicks DESC LIMIT 25`,
        ).all<{
          query: string
          clicks: number
          impressions: number
          ctr: number
          position: number
        }>()
        return { metric: 'queries', rows: rows.results }
      }

      if (metric === 'pages') {
        const rows = await env.DB_MARKETING.prepare(
          `SELECT page, clicks, impressions, ctr, position FROM gsc_pages ORDER BY clicks DESC LIMIT 25`,
        ).all<{
          page: string
          clicks: number
          impressions: number
          ctr: number
          position: number
        }>()
        return { metric: 'pages', rows: rows.results }
      }

      const row = await env.DB_MARKETING.prepare(
        `SELECT SUM(clicks) AS clicks, SUM(impressions) AS impressions, AVG(position) AS avg_position
         FROM marketing_snapshots WHERE date >= date('now', '-28 days')`,
      ).first<{
        clicks: number | null
        impressions: number | null
        avg_position: number | null
      }>()

      return {
        metric: 'overview',
        period: '28d',
        clicks: row?.clicks ?? 0,
        impressions: row?.impressions ?? 0,
        avg_position:
          row?.avg_position != null ? Number(row.avg_position.toFixed(1)) : null,
      }
    },
  },
]
