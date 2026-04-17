import type { PluginManifest } from '../../kernel/types'

const contractsPlugin: PluginManifest = {
  name: 'contracts',
  version: '1.0.0',
  description: 'E-signature contracts with SMS/email delivery',
  configDefaults: {
    contracts: {
      enabled: true,
    },
  },
}

export default contractsPlugin
