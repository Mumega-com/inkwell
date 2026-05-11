import type { PluginManifest, McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'
import { bountyRoutes } from './routes'

type Env = AppBindings['Bindings']

type SquadMemoryConfig = {
  mode: 'mirror' | 'network'
  baseUrl: string
  token: string
}

const NETWORK_REQUIRED_ERROR = (feature: string) => ({
  error: 'network_required',
  message: `Connect to a network API for ${feature}. Add SOS_MIRROR_URL or NETWORK_API_URL, plus NETWORK_TOKEN, to your Worker env.`,
})

function tenantSlugFromEnv(env: Env): string {
  return env.SITE_URL
    ? new URL(env.SITE_URL).hostname.replace(/\./g, '-')
    : 'inkwell'
}

function getSquadMemoryConfig(env: Env): SquadMemoryConfig | null {
  const token = env.NETWORK_TOKEN ?? ''
  const mirrorUrl = env.SOS_MIRROR_URL?.replace(/\/$/, '')
  const networkUrl = env.NETWORK_API_URL?.replace(/\/$/, '')

  if (mirrorUrl && token) return { mode: 'mirror', baseUrl: mirrorUrl, token }
  if (networkUrl && token) return { mode: 'network', baseUrl: networkUrl, token }
  return null
}

async function postJson(config: SquadMemoryConfig, path: string, body: unknown): Promise<unknown> {
  try {
    const res = await fetch(`${config.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { error: 'network_error', status: res.status, detail: text.slice(0, 300) }
    }

    return await res.json()
  } catch {
    return { error: 'network_unreachable', message: 'Could not reach squad memory API. Check the configured URL and network connectivity.' }
  }
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(item => item.trim())
    : []
}

function cleanLimit(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.min(50, Math.floor(value)))
    : 10
}

const bountyTools: McpToolDef[] = [
  {
    name: 'list_bounties',
    description: 'List open bounties for the current tenant. Returns title, reward, status, and description for each bounty.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['open', 'claimed', 'submitted', 'approved', 'paid'],
          description: 'Filter by status. Defaults to open.',
        },
      },
    },
    handler: async (args, _env) => {
      const status = (args.status as string | undefined) ?? 'open'
      return { error: 'use_api', message: `Call GET /api/bounties?status=${status}`, args }
    },
  },
  {
    name: 'create_bounty',
    description: 'Create a new bounty task with a reward. Requires manager role.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short bounty title' },
        description: { type: 'string', description: 'Full description of the task' },
        reward_cents: { type: 'number', description: 'Reward amount in cents (e.g. 5000 = $50.00)' },
        currency: { type: 'string', description: 'ISO currency code, default USD' },
        squad_id: { type: 'string', description: 'Optional squad to associate with this bounty' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Optional labels' },
        expires_at: { type: 'string', description: 'ISO 8601 expiry date' },
      },
      required: ['title', 'reward_cents'],
    },
    handler: async (args, _env) => {
      return { error: 'use_api', message: 'Call POST /api/bounties with the body', args }
    },
  },
  {
    name: 'claim_bounty',
    description: 'Claim an open bounty by ID. The authenticated user becomes the claimant.',
    inputSchema: {
      type: 'object',
      properties: {
        bounty_id: { type: 'string', description: 'ID of the bounty to claim' },
      },
      required: ['bounty_id'],
    },
    handler: async (args, _env) => {
      return { error: 'use_api', message: `Call POST /api/bounties/${args.bounty_id}/claim`, args }
    },
  },
  {
    name: 'squad_remember',
    description: '[Network] Store a memory entry scoped to a squad. Requires SOS Mirror or network API configuration.',
    inputSchema: {
      type: 'object',
      properties: {
        squad_id: { type: 'string', description: 'Squad identifier that owns this memory' },
        text: { type: 'string', description: 'Memory text to store' },
        agent_id: { type: 'string', description: 'Optional agent identifier for attribution' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional memory tags' },
      },
      required: ['squad_id', 'text'],
    },
    handler: async (args, rawEnv) => {
      const env = rawEnv as Env
      const config = getSquadMemoryConfig(env)
      if (!config) return NETWORK_REQUIRED_ERROR('squad memory')

      const squadId = cleanString(args.squad_id)
      const text = cleanString(args.text)
      if (!squadId) return { error: 'squad_id required' }
      if (!text) return { error: 'text required' }

      const agentId = cleanString(args.agent_id) || tenantSlugFromEnv(env)
      const tags = cleanStringArray(args.tags)
      const project = `squad:${squadId}`

      if (config.mode === 'mirror') {
        return postJson(config, '/store', {
          context_id: `${project}:${Date.now()}`,
          agent: agentId,
          text,
          project,
          series: project,
          epistemic_truths: tags,
          core_concepts: [project, ...tags],
          affective_vibe: 'Neutral',
          energy_level: 'Balanced',
          next_attractor: '',
          metadata: { squad_id: squadId, source: 'inkwell_bounty_mcp', tags },
        })
      }

      return postJson(config, `/squads/${encodeURIComponent(squadId)}/memory`, {
        text,
        agent_id: agentId,
        tags,
      })
    },
  },
  {
    name: 'squad_recall',
    description: '[Network] Search memory scoped to a squad. Requires SOS Mirror or network API configuration.',
    inputSchema: {
      type: 'object',
      properties: {
        squad_id: { type: 'string', description: 'Squad identifier to search within' },
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Maximum number of results, default 10' },
      },
      required: ['squad_id', 'query'],
    },
    handler: async (args, rawEnv) => {
      const env = rawEnv as Env
      const config = getSquadMemoryConfig(env)
      if (!config) return NETWORK_REQUIRED_ERROR('squad memory')

      const squadId = cleanString(args.squad_id)
      const query = cleanString(args.query)
      if (!squadId) return { error: 'squad_id required' }
      if (!query) return { error: 'query required' }

      const limit = cleanLimit(args.limit)
      const project = `squad:${squadId}`

      if (config.mode === 'mirror') {
        return postJson(config, '/search', {
          query,
          top_k: limit,
          project,
          filters: { project, squad_id: squadId },
        })
      }

      return postJson(config, `/squads/${encodeURIComponent(squadId)}/memory/search`, {
        query,
        limit,
      })
    },
  },
  {
    name: 'submit_bounty',
    description: 'Submit proof of completion for a claimed bounty. Only the claimant can call this.',
    inputSchema: {
      type: 'object',
      properties: {
        bounty_id: { type: 'string', description: 'ID of the bounty to submit proof for' },
        proof_url: { type: 'string', description: 'URL to proof of work (PR, Loom, doc, etc.)' },
      },
      required: ['bounty_id', 'proof_url'],
    },
    handler: async (args, _env) => {
      return { error: 'use_api', message: `Call POST /api/bounties/${args.bounty_id}/submit`, args }
    },
  },
  {
    name: 'my_bounty_earnings',
    description: 'Get total reward earnings for the current user — sum of all paid bounties.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (args, _env) => {
      return { error: 'use_api', message: 'Call GET /api/bounties/my then sum reward_cents where status=paid', args }
    },
  },
]

export const bountyManifest: PluginManifest = {
  name: 'bounty',
  version: '1.0.0',
  description: 'Bounty board — post tasks with rewards, contractors claim and submit proof',
  requiredRole: 'viewer',
  dashboardWidgets: ['BountyBoard'],
  mountRoutes: (app) => {
    app.route('/api/bounties', bountyRoutes)
  },
  mcpTools: bountyTools,
}

export default bountyManifest
