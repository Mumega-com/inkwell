import type { PluginManifest } from '../../kernel/types'

const chatPlugin: PluginManifest = {
  name: 'chat',
  version: '1.0.0',
  description: 'AI chat assistant',
  configDefaults: {
    chat: {
      enabled: true,
    },
  },
}

export default chatPlugin
