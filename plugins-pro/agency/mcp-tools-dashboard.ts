import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

// ── Row shapes for D1 query results ────────────────────────────────────────

interface AgencyClientRow {
  slug: string
  name: string
  industry: string | null
  status: string
  pages_created: number
  onboarded_at: string | null
  created_at: string
}

interface CountRow {
  count: number
}

interface DealRow {
  count: number
  total: number
}

// ── Health classification ──────────────────────────────────────────────────

type ClientHealth = 'healthy' | 'needs_content' | 'needs_onboarding'

function classifyHealth(pagesCreated: number, contentCount: number): ClientHealth {
  if (pagesCreated === 0) return 'needs_onboarding'
  if (contentCount === 0) return 'needs_content'
  return 'healthy'
}

// ── Tool definition ────────────────────────────────────────────────────────

export const dashboardMcpTools: McpToolDef[] = [
  {
    name: 'client_dashboard',
    description:
      'Cross-client agency dashboard — aggregated metrics across all clients',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          description: "Time period: '7d', '30d', or '90d'",
          enum: ['7d', '30d', '90d'],
          default: '30d',
        },
      },
      additionalProperties: false,
    },
    handler: async (
      args: Record<string, unknown>,
      env: unknown,
    ): Promise<unknown> => {
      const e = env as Env
      const period = (args.period as string | undefined) ?? '30d'

      // 1. Ensure agency_clients table exists
      try {
        await e.DB_CORE.prepare(
          `CREATE TABLE IF NOT EXISTS agency_clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            industry TEXT,
            contact_name TEXT,
            contact_email TEXT,
            status TEXT DEFAULT 'active',
            config TEXT DEFAULT '{}',
            pages_created INTEGER DEFAULT 0,
            onboarded_at TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          )`,
        ).run()
      } catch {
        // Table likely already exists — continue
      }

      // 2. Query all non-archived clients
      const clientsResult = await e.DB_CORE.prepare(
        `SELECT slug, name, industry, status, pages_created, onboarded_at, created_at
         FROM agency_clients
         WHERE status != 'archived'
         ORDER BY created_at DESC`,
      ).all<AgencyClientRow>()

      const clients = clientsResult.results ?? []

      // 3. Gather per-client stats in parallel
      const enriched = await Promise.all(
        clients.map(async (client) => {
          // Content count from DB_ANALYTICS
          let contentCount = 0
          try {
            const contentResult = await e.DB_ANALYTICS.prepare(
              `SELECT COUNT(*) as count FROM content_index WHERE tags LIKE ?`,
            )
              .bind(`%${client.slug}%`)
              .first<CountRow>()
            contentCount = contentResult?.count ?? 0
          } catch {
            contentCount = 0
          }

          // Contacts count from DB_CORE
          let contacts = 0
          try {
            const contactsResult = await e.DB_CORE.prepare(
              `SELECT COUNT(*) as count FROM contacts WHERE tenant_slug = ?`,
            )
              .bind(client.slug)
              .first<CountRow>()
            contacts = contactsResult?.count ?? 0
          } catch {
            contacts = 0
          }

          // Deals pipeline from DB_CORE
          let pipelineValue = 0
          let dealCount = 0
          try {
            const dealsResult = await e.DB_CORE.prepare(
              `SELECT COUNT(*) as count, COALESCE(SUM(value),0) as total
               FROM deals
               WHERE tenant_slug = ? AND status != 'lost'`,
            )
              .bind(client.slug)
              .first<DealRow>()
            dealCount = dealsResult?.count ?? 0
            pipelineValue = dealsResult?.total ?? 0
          } catch {
            dealCount = 0
            pipelineValue = 0
          }

          const health = classifyHealth(client.pages_created, contentCount)

          return {
            slug: client.slug,
            name: client.name,
            industry: client.industry,
            status: client.status,
            health,
            pages_created: client.pages_created,
            content_count: contentCount,
            contacts,
            pipeline_value: pipelineValue,
            deal_count: dealCount,
            onboarded_at: client.onboarded_at,
          }
        }),
      )

      // 4. Compute agency totals
      const activeClients = enriched.filter((c) => c.status === 'active')
      const totalPages = enriched.reduce((sum, c) => sum + c.pages_created, 0)
      const totalContacts = enriched.reduce((sum, c) => sum + c.contacts, 0)
      const totalPipelineValue = enriched.reduce(
        (sum, c) => sum + c.pipeline_value,
        0,
      )
      const totalContent = enriched.reduce(
        (sum, c) => sum + c.content_count,
        0,
      )

      // 5. Build response (strip internal fields like deal_count)
      const clientsOutput = enriched.map(
        ({ deal_count: _dealCount, ...rest }) => rest,
      )

      return {
        ok: true,
        period,
        agency: {
          total_clients: enriched.length,
          active_clients: activeClients.length,
          total_pages: totalPages,
          total_contacts: totalContacts,
          total_pipeline_value: totalPipelineValue,
          total_content: totalContent,
        },
        clients: clientsOutput,
      }
    },
  },
]
