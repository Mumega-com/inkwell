import type { PluginManifest } from '../../kernel/types'

const questionnairePlugin: PluginManifest = {
  name: 'questionnaire',
  version: '1.0.0',
  description: 'Daily business check-in questions via SMS or Telegram with Mirror integration',
  requiredRole: 'member',

  configDefaults: {
    questionnaire: {
      enabled: true,
    },
  },
}

export default questionnairePlugin
