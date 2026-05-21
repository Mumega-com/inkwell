import type { PluginManifest, McpToolDef } from '../../kernel/types'
import { bountyRoutes } from './routes'

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
    description: 'Claim an open bounty by ID. Optionally attach an agent ID to the claim.',
    inputSchema: {
      type: 'object',
      properties: {
        bounty_id: { type: 'string', description: 'ID of the bounty to claim' },
        agent_id: { type: 'string', description: 'Optional worker agent ID claiming this bounty' },
      },
      required: ['bounty_id'],
    },
    handler: async (args, _env) => {
      return { error: 'use_api', message: `Call POST /api/bounties/${args.bounty_id}/claim with optional agent_id`, args }
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
