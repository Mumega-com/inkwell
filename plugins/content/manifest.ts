import type { PluginManifest, HonoApp } from '../../kernel/types'
import { contentRoutes } from './routes-content'
import { publishingRoutes } from './routes-publishing'

const contentPlugin: PluginManifest = {
  name: 'content',
  version: '1.0.0',
  description: 'Content publishing — KV storage, D1 indexing, deploy hooks',
  requiredRole: 'member',

  mountRoutes: (app: HonoApp) => {
    app.route('/api', contentRoutes)
    app.route('/api/publishing', publishingRoutes)
  },

  configDefaults: {
    content: {
      enabled: true,
    },
  },
}

export default contentPlugin
