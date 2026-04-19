import type { PluginManifest, HonoApp } from '../../kernel/types'
import { diagnosticsRoutes } from './routes'

const diagnosticsPlugin: PluginManifest = {
  name: 'diagnostics',
  version: '1.0.0',
  description: 'Squad health narratives and alerts',
  requiredRole: 'admin',
  dashboardWidgets: ['HealthPanel'],

  mountRoutes: (app: HonoApp) => {
    app.route('/api/diagnostics', diagnosticsRoutes)
  },

  configDefaults: {
    diagnostics: {
      enabled: true,
    },
  },
}

export default diagnosticsPlugin
