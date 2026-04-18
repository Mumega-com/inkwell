import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

export const discoveryMcpTools: McpToolDef[] = [
  {
    name: 'get_leads',
    description: 'Return recent lead events from DB_CORE.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max rows to return (default: 20, max: 100)' },
        status: { type: 'string', description: 'Filter by lead status (optional)' },
      },
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env
      const rawLimit = typeof a.limit === 'number' ? a.limit : 20
      const limit = Math.min(Math.max(1, rawLimit), 100)
      const status = typeof a.status === 'string' ? a.status : null

      const query = status
        ? `SELECT id, email, source, status, created_at FROM lead_events WHERE status = ? ORDER BY created_at DESC LIMIT ${limit}`
        : `SELECT id, email, source, status, created_at FROM lead_events ORDER BY created_at DESC LIMIT ${limit}`

      const stmt = status
        ? env.DB_CORE.prepare(query).bind(status)
        : env.DB_CORE.prepare(query)

      const rows = await stmt.all<{
        id: string
        email: string
        source: string
        status: string
        created_at: string
      }>()

      return { total: rows.results.length, leads: rows.results }
    },
  },
]
