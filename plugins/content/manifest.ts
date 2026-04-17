import type { PluginManifest } from '../../kernel/types'

const contentPlugin: PluginManifest = {
  name: 'content',
  version: '1.0.0',
  description: 'Content publishing — KV storage, D1 indexing, deploy hooks',
  configDefaults: {
    content: {
      enabled: true,
    },
  },
}

export default contentPlugin
