import type { PluginManifest } from '../../kernel/types'

const analyticsPlugin: PluginManifest = {
  name: 'analytics',
  version: '1.0.0',
  description: 'Page views, reactions, subscribers, and feedback tracking',
  requiredRole: 'viewer',

  configDefaults: {
    analytics: {
      enabled: true,
    },
  },
}

export default analyticsPlugin
