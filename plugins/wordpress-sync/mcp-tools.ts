import type { McpToolDef } from '../../kernel/types'
import type { Env } from '../types'
import { syncWordPressContent } from './sync'

export const wordpressSyncMcpTools: McpToolDef[] = [
  {
    name: 'sync_wordpress_content',
    description: 'Mirror published WordPress posts and pages into Inkwell content storage.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (_args, rawEnv) => syncWordPressContent(rawEnv as Env),
  },
]

