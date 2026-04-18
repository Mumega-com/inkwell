import type { PluginManifest } from '../../kernel/types'

const authPlugin: PluginManifest = {
  name: 'auth',
  version: '1.0.0',
  description: 'Passwordless authentication — email/phone OTP login, sessions, logout',

  configDefaults: {
    auth: {
      enabled: true,
      codeTtlSeconds: 300,
      sessionTtlSeconds: 2592000,
    },
  },
}

export default authPlugin
