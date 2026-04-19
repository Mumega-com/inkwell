import type { PluginManifest, HonoApp } from '../../kernel/types'
import { contentRoutes } from './routes-content'
import { publishingRoutes } from './routes-publishing'
import { graphRoutes } from './routes-graph'
import { calendarRoutes } from './routes-calendar'
import { contentMcpTools } from './mcp-tools'

const contentPlugin: PluginManifest = {
  name: 'content',
  version: '1.0.0',
  description: 'Content publishing — KV storage, D1 indexing, deploy hooks',
  requiredRole: 'member',
  mcpTools: contentMcpTools,

  mountRoutes: (app: HonoApp) => {
    app.route('/api', contentRoutes)
    app.route('/api/publishing', publishingRoutes)
    app.route('/api', graphRoutes)
    app.route('/api/content', calendarRoutes)
  },

  configDefaults: {
    content: {
      enabled: true,
    },
  },
}

export default contentPlugin
