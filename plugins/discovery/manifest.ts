import type { PluginManifest, HonoApp } from '../../kernel/types'
import { discoveryRoutes } from './routes'
import { discoveryMcpTools } from './mcp-tools'

const discoveryPlugin: PluginManifest = {
  name: 'discovery',
  version: '1.0.0',
  description: 'Business maturity questionnaire',
  requiredRole: 'viewer',
  mcpTools: discoveryMcpTools,

  mountRoutes: (app: HonoApp) => {
    app.route('/api/discovery', discoveryRoutes)
  },

  configDefaults: {
    discovery: {
      enabled: true,
    },
  },
}

export default discoveryPlugin
