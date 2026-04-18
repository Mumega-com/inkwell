import type { PluginManifest, HonoApp } from '../../kernel/types'
import { discoveryRoutes } from './routes'

const discoveryPlugin: PluginManifest = {
  name: 'discovery',
  version: '1.0.0',
  description: 'Business maturity questionnaire',
  requiredRole: 'viewer',

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
