import type { PluginManifest } from '../../kernel/types'

const paymentsPlugin: PluginManifest = {
  name: 'payments',
  version: '1.0.0',
  description: 'Stripe checkout and subscription management',
  requiredRole: 'owner',

  configDefaults: {
    payments: {
      enabled: true,
    },
  },
}

export default paymentsPlugin
