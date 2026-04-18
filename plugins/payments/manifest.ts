import type { PluginManifest, HonoApp } from '../../kernel/types'
import { paymentRoutes } from './routes'

const paymentsPlugin: PluginManifest = {
  name: 'payments',
  version: '1.0.0',
  description: 'Stripe checkout and subscription management',
  requiredRole: 'owner',

  mountRoutes: (app: HonoApp) => {
    app.route('/api/payments', paymentRoutes)
  },

  configDefaults: {
    payments: {
      enabled: true,
    },
  },
}

export default paymentsPlugin
