import type { PluginManifest, HonoApp } from '../../kernel/types'
import { organismRoutes } from './routes'
import { networkRoutes } from './routes-network'
import { marketplaceRoutes } from './routes-marketplace'

const organismPlugin: PluginManifest = {
  name: 'organism',
  version: '1.0.0',
  description: 'Managed Agent provisioning, network transactions, graph discovery, reputation',
  requiredRole: 'admin',

  mountRoutes: (app: HonoApp) => {
    app.route('/api', organismRoutes)
    app.route('/api', networkRoutes)
    app.route('/api', marketplaceRoutes)
  },

  configDefaults: {
    organism: {
      enabled: true,
      defaultModel: 'haiku',
      defaultBudgetPerDay: 500,
      defaultBudgetPerMonth: 10000,
    },
  },
}

export default organismPlugin
