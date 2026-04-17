import type { PluginManifest } from '../../kernel/types'

const commercePlugin: PluginManifest = {
  name: 'commerce',
  version: '1.0.0',
  description: 'Glass Commerce — transactions, royalties, metering with 5% platform fee',
  configDefaults: {
    commerce: {
      enabled: true,
      platformFeePercent: 5,
    },
  },
}

export default commercePlugin
