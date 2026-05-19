import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

// ── Network helpers ──────────────────────────────────────────────────────────

const NETWORK_REQUIRED_ERROR = (feature: string) => ({
  error: 'network_required',
  message: `Connect to a network API for ${feature}. Add NETWORK_API_URL and NETWORK_TOKEN to your Worker env.`,
})

async function networkPost(env: Env, path: string, body: unknown): Promise<unknown> {
  const baseUrl = env.NETWORK_API_URL ?? ''
  if (!baseUrl) return NETWORK_REQUIRED_ERROR('API')
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.NETWORK_TOKEN ?? ''}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { error: 'network_error', status: res.status, detail: text.slice(0, 300) }
    }
    return await res.json()
  } catch {
    return { error: 'network_unreachable', message: 'Could not reach network API. Check NETWORK_API_URL and network connectivity.' }
  }
}

async function networkGet(env: Env, path: string): Promise<unknown> {
  const baseUrl = env.NETWORK_API_URL ?? ''
  if (!baseUrl) return NETWORK_REQUIRED_ERROR('API')
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${env.NETWORK_TOKEN ?? ''}` },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { error: 'network_error', status: res.status, detail: text.slice(0, 300) }
    }
    return await res.json()
  } catch {
    return { error: 'network_unreachable', message: 'Could not reach network API. Check NETWORK_API_URL and network connectivity.' }
  }
}

function tenantSlugFromEnv(env: Env): string {
  return env.SITE_URL
    ? new URL(env.SITE_URL).hostname.replace(/\./g, '-')
    : 'inkwell'
}

// ── Tool definitions ─────────────────────────────────────────────────────────

export const mcpOwnTools: McpToolDef[] = [
  {
    name: 'site_info',
    description: 'Return Inkwell site configuration: name, domain, enabled features and connectors.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (_a, rawEnv) => {
      const env = rawEnv as Env
      return {
        site_url: env.SITE_URL,
        features: {
          analytics: true,
          reactions: true,
          subscriptions: true,
          publishing: true,
          telegram: Boolean(env.TELEGRAM_BOT_TOKEN),
          payments: Boolean(env.STRIPE_SECRET_KEY),
          sos_bus: Boolean(env.SOS_BUS_URL),
          pages_deploy_hook: Boolean(env.CF_PAGES_DEPLOY_HOOK),
        },
      }
    },
  },
  {
    name: 'remember',
    description: '[Network] Store a memory engram for this site. Requires network connection. Returns engram ID.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The memory text to store' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags for categorization' },
      },
      required: ['text'],
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env
      if (!env.NETWORK_API_URL && !env.NETWORK_TOKEN) return NETWORK_REQUIRED_ERROR('memory (remember/recall)')

      const text = typeof a.text === 'string' ? a.text.trim() : ''
      if (!text) return { error: 'text required' }

      const tags = Array.isArray(a.tags)
        ? (a.tags as unknown[]).filter((t): t is string => typeof t === 'string')
        : []

      return networkPost(env, '/mcp/remember', { agent: tenantSlugFromEnv(env), text, tags })
    },
  },
  {
    name: 'recall',
    description: '[Network] Search memories stored for this site. Requires network connection. Returns matching engrams.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Semantic search query to find relevant memories' },
      },
      required: ['query'],
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env
      if (!env.NETWORK_API_URL && !env.NETWORK_TOKEN) return NETWORK_REQUIRED_ERROR('memory (remember/recall)')

      const query = typeof a.query === 'string' ? a.query.trim() : ''
      if (!query) return { error: 'query required' }

      return networkPost(env, '/mcp/recall', { agent: tenantSlugFromEnv(env), query })
    },
  },
  {
    name: 'create_task',
    description: '[Network] Create a task in the squad service for this site. Requires network connection.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description or instructions' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], description: 'Task priority (default: normal)' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Labels for routing (e.g. ["seo", "content"])' },
      },
      required: ['title'],
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env
      if (!env.NETWORK_API_URL && !env.NETWORK_TOKEN) return NETWORK_REQUIRED_ERROR('task management')

      const title = typeof a.title === 'string' ? a.title.trim() : ''
      if (!title) return { error: 'title required' }

      const description = typeof a.description === 'string' ? a.description.trim() : ''
      const priority = ['low', 'normal', 'high', 'urgent'].includes(a.priority as string)
        ? (a.priority as string)
        : 'normal'
      const labels = Array.isArray(a.labels)
        ? (a.labels as unknown[]).filter((l): l is string => typeof l === 'string')
        : []

      return networkPost(env, '/mcp/task', { title, description, priority, labels, source: tenantSlugFromEnv(env) })
    },
  },
  {
    name: 'browse_marketplace',
    description: '[Network] Browse the skill marketplace — available agent skills, integrations, and add-ons. Requires network connection.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category (e.g. seo, content, outreach, ops)' },
      },
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env
      if (!env.NETWORK_API_URL && !env.NETWORK_TOKEN) return NETWORK_REQUIRED_ERROR('marketplace')

      const category = typeof a.category === 'string' ? a.category.trim() : ''
      const path = category ? `/mcp/marketplace?category=${encodeURIComponent(category)}` : '/mcp/marketplace'
      return networkGet(env, path)
    },
  },
]
