import type { PluginManifest, HonoApp } from '../../kernel/types'
import { dashboardRoutes } from './routes'

const dashboardPlugin: PluginManifest = {
  name: 'dashboard',
  version: '1.0.0',
  description: 'Arrow Dashboard — customer business portal with Shadcn UI',

  mountRoutes: (app: HonoApp) => {
    app.route('/api/dashboard', dashboardRoutes)
  },

  dashboardWidgets: [
    'ArrowDashboard',
    'AdminOverview',
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
