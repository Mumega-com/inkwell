import type { PluginManifest, HonoApp } from '../../kernel/types'
import { analyticsRoutes } from './routes'

const analyticsPlugin: PluginManifest = {
  name: 'analytics',
  version: '1.0.0',
  description: 'Page views, reactions, subscribers, and feedback tracking',
  requiredRole: 'viewer',

  mountRoutes: (app: HonoApp) => {
    app.route('/api', analyticsRoutes)
  },

  configDefaults: {
    analytics: {
      enabled: true,
    },
  },
}

export default analyticsPlugin
