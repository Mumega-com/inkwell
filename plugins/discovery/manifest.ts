import type { PluginManifest } from '../../kernel/types'

const discoveryPlugin: PluginManifest = {
  name: 'discovery',
  version: '1.0.0',
  description: 'Business maturity questionnaire',
  requiredRole: 'viewer',

  configDefaults: {
    discovery: {
      enabled: true,
    },
  },
}

export default discoveryPlugin
