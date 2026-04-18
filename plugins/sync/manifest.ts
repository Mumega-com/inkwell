import type { PluginManifest } from '../../kernel/types'
import { syncRoutes } from './routes'

const manifest: PluginManifest = {
  name: 'sync',
  version: '1.0.0',
  description: 'Sync content from external sources (Obsidian, Notion, GitHub, Google Drive)',
  requiredRole: 'admin',
  mountRoutes: (app) => {
    app.route('/api/sync', syncRoutes)
  },
}

export default manifest
