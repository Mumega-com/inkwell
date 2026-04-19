import type { PluginManifest } from '../../kernel/types'
import { automationMcpTools } from './mcp-tools'

const automationPlugin: PluginManifest = {
  name: 'automation',
  version: '1.0.0',
  description: 'Automation bridge — trigger n8n workflows and external automations',
  requiredRole: 'manager',
  mcpTools: automationMcpTools,
  configDefaults: { automation: { enabled: true } },
}

export default automationPlugin
