import type { PluginManifest, HonoApp } from '../../kernel/types'
import { agencyRoutes } from './routes'
import { onboardMcpTools } from './mcp-tools-onboard'
import { dashboardMcpTools } from './mcp-tools-dashboard'
import { clientReportMcpTools } from './mcp-tools-report'

const agencyPlugin: PluginManifest = {
  name: 'agency',
  version: '1.0.0',
  description: 'Agency management — client registry, onboarding pipeline, cross-client dashboard, per-client reports',
  requiredRole: 'admin',
  mcpTools: [...onboardMcpTools, ...dashboardMcpTools, ...clientReportMcpTools],
  mountRoutes: (app: HonoApp) => {
    app.route('/api/agency', agencyRoutes)
  },
}

export default agencyPlugin
