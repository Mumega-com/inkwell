import type { PluginManifest, McpToolDef } from '../../kernel/types'
import { seoRoutes } from './routes'

const seoTools: McpToolDef[] = [
  {
    name: 'seo_crawl_stats',
    description: 'Get crawl analytics — bot visits, top pages, status codes. Returns aggregated data for the specified time window.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of days to look back (default 7)' },
      },
    },
    handler: async (args, _env) => {
      return { error: 'use_api', message: 'Call GET /api/seo/crawl-stats?days=N', args }
    },
  },
  {
    name: 'manage_redirects',
    description: 'Add, list, or delete redirect rules. Supports 301 (permanent) and 302 (temporary) redirects.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: "'add' | 'list' | 'delete'" },
        from_path: { type: 'string', description: 'Source path (required for add)' },
        to_path: { type: 'string', description: 'Destination path (required for add)' },
        id: { type: 'string', description: 'Redirect ID (required for delete)' },
      },
      required: ['action'],
    },
    handler: async (args, _env) => {
      return { error: 'use_api', message: 'Call GET/POST/DELETE /api/seo/redirects', args }
    },
  },
  {
    name: 'seo_audit',
    description: 'Quick SEO health check — missing meta tags, broken redirects, crawl errors. Returns actionable issues.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (args, _env) => {
      return { error: 'use_api', message: 'Call GET /api/seo/audit', args }
    },
  },
]

const manifest: PluginManifest = {
  name: 'seo',
  version: '1.0.0',
  description: 'SEO autopilot — crawl analytics, redirects, meta overrides, geo pages, AI search optimization',
  requiredRole: 'manager',
  mountRoutes: (app) => {
    app.route('/api/seo', seoRoutes)
  },
  mcpTools: seoTools,
}

export default manifest
