import type { PluginManifest, HonoApp } from '../../kernel/types'
import { authRoutes } from './routes'

const authPlugin: PluginManifest = {
  name: 'auth',
  version: '1.0.0',
  description: 'Passwordless authentication — email/phone OTP login, sessions, logout',

  mountRoutes: (app: HonoApp) => {
    app.route('/api/auth', authRoutes)
  },

  configDefaults: {
    auth: {
      enabled: true,
      codeTtlSeconds: 300,
      sessionTtlSeconds: 2592000,
    },
  },
}

export default authPlugin
