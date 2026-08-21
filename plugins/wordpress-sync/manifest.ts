import type { PluginManifest, HonoApp } from '../../kernel/types'
import type { Env } from '../types'
import { wordpressSyncMcpTools } from './mcp-tools'
import { wordpressSyncRoutes } from './routes'
import { syncWordPressContent } from './sync'

const wordpressSyncPlugin: PluginManifest = {
  name: 'wordpress-sync',
  version: '1.0.0',
  description: 'Mirror published WordPress content into Inkwell CONTENT and content_index.',
  requiredRole: 'admin',
  mcpTools: wordpressSyncMcpTools,

  mountRoutes: (app: HonoApp) => {
    app.route('/api/wordpress-sync', wordpressSyncRoutes)
  },

  scheduled: async (_event, env) => syncWordPressContent(env as Env),

  configDefaults: {
    wordpressSync: {
      enabled: true,
    },
  },
}

export default wordpressSyncPlugin

