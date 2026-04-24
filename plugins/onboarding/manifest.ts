import type { PluginManifest } from '../../kernel/types'

const onboardingPlugin: PluginManifest = {
  name: 'onboarding',
  version: '1.0.0',
  description: 'Step-by-step onboarding wizard for new customers',
  requiredRole: 'owner',
  dashboardWidgets: ['OnboardingWizard'],
  configDefaults: {
    onboarding: { enabled: true },
  },
}

export default onboardingPlugin
