import type { PluginManifest } from '../../kernel/types'

const dashboardPlugin: PluginManifest = {
  name: 'dashboard',
  version: '1.0.0',
  description: 'Arrow Dashboard — customer business portal with Shadcn UI',

  dashboardWidgets: [
    'ArrowDashboard',
    'TaskBoard',
    'WalletView',
    'SquadPanel',
    'ConnectPanel',
    'AssistantChat',
    'SettingsForm',
  ],

  requiredRole: 'viewer',

  configDefaults: {
    dashboard: {
      enabled: true,
      refreshInterval: 30,
    },
  },
}

export default dashboardPlugin
