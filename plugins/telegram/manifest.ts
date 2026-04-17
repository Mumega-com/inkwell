import type { PluginManifest } from '../../kernel/types'

const telegramPlugin: PluginManifest = {
  name: 'telegram',
  version: '1.0.0',
  description: 'Telegram bot webhook handler',
  configDefaults: {
    telegram: {
      enabled: true,
    },
  },
}

export default telegramPlugin
