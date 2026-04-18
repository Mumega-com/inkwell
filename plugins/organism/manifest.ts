import type { PluginManifest, HonoApp } from '../../kernel/types'
import { organismRoutes } from './routes'

const organismPlugin: PluginManifest = {
  name: 'organism',
  version: '1.0.0',
  description: 'Managed Agent provisioning, config, budget tracking per tenant',
  requiredRole: 'admin',

  mountRoutes: (app: HonoApp) => {
    app.route('/api', organismRoutes)
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
