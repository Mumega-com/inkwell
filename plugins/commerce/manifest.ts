import type { PluginManifest, HonoApp } from '../../kernel/types'
import { glassRoutes } from './routes'

const commercePlugin: PluginManifest = {
  name: 'commerce',
  version: '1.0.0',
  description: 'Glass Commerce — transactions, royalties, metering with 5% platform fee',
  requiredRole: 'manager',
  dashboardWidgets: ['RevenueOverview'],

  mountRoutes: (app: HonoApp) => {
    app.route('/api/glass', glassRoutes)
  },

  configDefaults: {
    commerce: {
      enabled: true,
      platformFeePercent: 5,
    },
  },
}

export default commercePlugin
