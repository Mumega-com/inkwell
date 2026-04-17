import type { PluginManifest } from '../../kernel/types'

const diagnosticsPlugin: PluginManifest = {
  name: 'diagnostics',
  version: '1.0.0',
  description: 'Squad health narratives and alerts',
  configDefaults: {
    diagnostics: {
      enabled: true,
    },
  },
}

export default diagnosticsPlugin
