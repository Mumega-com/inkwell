import type { PluginManifest, HonoApp } from '../../kernel/types'
import { questionnaireRoutes } from './routes'

const questionnairePlugin: PluginManifest = {
  name: 'questionnaire',
  version: '1.0.0',
  description: 'Daily business check-in questions via SMS or Telegram with Mirror integration',
  requiredRole: 'member',

  mountRoutes: (app: HonoApp) => {
    app.route('/api/questionnaire', questionnaireRoutes)
  },

  configDefaults: {
    questionnaire: {
      enabled: true,
    },
  },
}

export default questionnairePlugin
