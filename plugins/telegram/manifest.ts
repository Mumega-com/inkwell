import type { PluginManifest, HonoApp } from '../../kernel/types'
import { telegramRoutes } from './routes'

const telegramPlugin: PluginManifest = {
  name: 'telegram',
  version: '1.0.0',
  description: 'Telegram bot webhook handler',
  requiredRole: 'admin',

  mountRoutes: (app: HonoApp) => {
    app.route('/api/telegram', telegramRoutes)
  },

  configDefaults: {
    telegram: {
      enabled: true,
    },
  },
}

export default telegramPlugin
