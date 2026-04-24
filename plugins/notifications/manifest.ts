import type { PluginManifest } from '../../kernel/types'

const notificationsPlugin: PluginManifest = {
  name: 'notifications',
  version: '1.0.0',
  description: 'In-app notification center with bell icon',
  requiredRole: 'member',
  dashboardWidgets: ['NotificationBell'],
  configDefaults: { notifications: { enabled: true } },
}

export default notificationsPlugin
