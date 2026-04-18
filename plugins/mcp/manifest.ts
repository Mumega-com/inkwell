import type { PluginManifest, HonoApp } from '../../kernel/types'
import { mcpRoutes } from './routes'
import { mcpOwnTools } from './mcp-tools'

const mcpPlugin: PluginManifest = {
  name: 'mcp',
  version: '1.0.0',
  description: 'MCP server — 12 tools for AI agent control (8 standalone + 4 network)',
  requiredRole: 'admin',

  mountRoutes: (app: HonoApp) => {
    app.route('/mcp', mcpRoutes)
  },

  mcpTools: mcpOwnTools,

  configDefaults: {
    mcp: {
      enabled: true,
    }
  },
}

export default mcpPlugin
