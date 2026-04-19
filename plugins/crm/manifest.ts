import type { PluginManifest, HonoApp } from '../../kernel/types'
import { crmRoutes } from './routes'
import { crmMcpTools } from './mcp-tools'
import { outreachMcpTools } from './mcp-tools-outreach'
import { reportMcpTools } from './mcp-tools-report'

const crmPlugin: PluginManifest = {
  name: 'crm',
  version: '1.0.0',
  description: 'CRM — contacts, pipeline, deals, outreach, reporting',
  requiredRole: 'member',
  mcpTools: [...crmMcpTools, ...outreachMcpTools, ...reportMcpTools],
  mountRoutes: (app: HonoApp) => {
    app.route('/api/crm', crmRoutes)
  },
  configDefaults: { crm: { enabled: true } },
}

export default crmPlugin
