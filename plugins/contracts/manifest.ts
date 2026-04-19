import type { PluginManifest, HonoApp } from '../../kernel/types'
import { contractRoutes } from './routes'

const contractsPlugin: PluginManifest = {
  name: 'contracts',
  version: '1.0.0',
  description: 'E-signature contracts with SMS/email delivery',
  requiredRole: 'manager',
  dashboardWidgets: ['ContractList'],

  mountRoutes: (app: HonoApp) => {
    app.route('/api/contracts', contractRoutes)
  },

  configDefaults: {
    contracts: {
      enabled: true,
    },
  },
}

export default contractsPlugin
