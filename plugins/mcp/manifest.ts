import type { PluginManifest } from '../../kernel/types'

const mcpPlugin: PluginManifest = {
  name: 'mcp',
  version: '1.0.0',
  description: 'MCP server — 12 tools for AI agent control (8 standalone + 4 network)',
  configDefaults: {
    mcp: {
      enabled: true,
    }
  },
}

export default mcpPlugin
