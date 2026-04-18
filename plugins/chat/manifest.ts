import type { PluginManifest, HonoApp } from '../../kernel/types'
import { chatRoutes } from './routes'

const chatPlugin: PluginManifest = {
  name: 'chat',
  version: '1.0.0',
  description: 'AI chat assistant',
  requiredRole: 'member',

  mountRoutes: (app: HonoApp) => {
    app.route('/api/chat', chatRoutes)
  },

  configDefaults: {
    chat: {
      enabled: true,
    },
  },
}

export default chatPlugin
