/**
 * Automation MCP tools — trigger and list workflows from any provider.
 *
 * Provider auto-detection (checked in order):
 *   1. INKWELL_WORKFLOW binding → CF Workflows (native edge, durable execution)
 *   2. TORIVERS_API_URL         → ToRivers (torivers.com) — pay-per-execution marketplace
 *   3. N8N_API_URL              → n8n — self-hosted workflow automation
 *   4. ZAPIER_WEBHOOK_URL       → Zapier — webhook trigger (no list API)
 *   5. webhook_url arg          → Generic HTTP POST (any endpoint)
 *
 * CF Workflows runs natively at the edge — steps, retries, sleep, durable
 * execution. Zero external dependencies. Other providers work via HTTP.
 *
 * Env vars / bindings:
 *   INKWELL_WORKFLOW    — CF Workflow binding (wrangler.toml [[workflows]])
 *   TORIVERS_API_URL    — ToRivers API base
 *   TORIVERS_API_KEY    — ToRivers API key
 *   N8N_API_URL         — n8n instance base
 *   N8N_API_KEY         — n8n API key
 *   ZAPIER_WEBHOOK_URL  — Zapier catch hook URL
 */
import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

type Provider = 'cf_workflows' | 'torivers' | 'n8n' | 'zapier' | 'webhook'

interface ProviderConfig {
  provider: Provider
  apiUrl: string
  apiKey: string
}

interface WorkflowSummary {
  id: string
  name: string
  active: boolean
  provider: Provider
  created_at: string
  updated_at: string
}

/** Check if CF Workflows binding exists */
function hasCfWorkflows(env: Env): boolean {
  const e = env as Record<string, unknown>
  return e['INKWELL_WORKFLOW'] != null && typeof e['INKWELL_WORKFLOW'] === 'object'
}

function detectProvider(env: Env): ProviderConfig | null {
  const e = env as Record<string, string>

  // CF Workflows is detected via binding, not env var
  if (hasCfWorkflows(env)) {
    return { provider: 'cf_workflows', apiUrl: '', apiKey: '' }
  }

  if (e['TORIVERS_API_URL'] && e['TORIVERS_API_KEY']) {
    return { provider: 'torivers', apiUrl: e['TORIVERS_API_URL'].replace(/\/+$/, ''), apiKey: e['TORIVERS_API_KEY'] }
  }

  if (e['N8N_API_URL'] && e['N8N_API_KEY']) {
    return { provider: 'n8n', apiUrl: e['N8N_API_URL'].replace(/\/+$/, ''), apiKey: e['N8N_API_KEY'] }
  }

  if (e['ZAPIER_WEBHOOK_URL']) {
    return { provider: 'zapier', apiUrl: e['ZAPIER_WEBHOOK_URL'].replace(/\/+$/, ''), apiKey: '' }
  }

  return null
}

function buildHeaders(provider: Provider, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (provider === 'torivers') {
    headers['Authorization'] = `Bearer ${apiKey}`
  } else if (provider === 'n8n') {
    headers['X-N8N-API-KEY'] = apiKey
  }

  return headers
}

/** Detect provider from a webhook URL for logging */
function detectProviderFromUrl(url: string): Provider {
  if (url.includes('hooks.zapier.com')) return 'zapier'
  if (url.includes('torivers.com')) return 'torivers'
  if (url.includes('n8n')) return 'n8n'
  return 'webhook'
}

/** CF Workflow binding interface (subset we use) */
interface WorkflowBinding {
  create(options: { id?: string; params: unknown }): Promise<{ id: string }>
  get(id: string): Promise<{ id: string; status: { status: string }; output?: unknown }>
}

export const automationMcpTools: McpToolDef[] = [
  {
    name: 'trigger_workflow',
    description:
      'Trigger a workflow execution. Auto-detects provider: CF Workflows (native edge), ToRivers (marketplace), n8n (self-hosted), Zapier (webhook), or any HTTP endpoint.',
    inputSchema: {
      type: 'object',
      properties: {
        webhook_url: {
          type: 'string',
          description: 'Direct webhook URL to POST to. Works with any provider. Takes priority over workflow_id.',
        },
        workflow_id: {
          type: 'string',
          description: 'Workflow/automation ID to trigger via API.',
        },
        data: {
          type: 'object',
          description: 'Payload to send to the workflow',
        },
        wait_for_result: {
          type: 'boolean',
          description: 'If true, waits for execution result (default false).',
        },
      },
    },
    handler: async (args, rawEnv) => {
      const env = rawEnv as Env

      const webhookUrl = typeof args.webhook_url === 'string' ? args.webhook_url.trim() : ''
      const workflowId = typeof args.workflow_id === 'string' ? args.workflow_id.trim() : ''
      const data = (args.data as Record<string, unknown>) ?? {}
      const waitForResult = args.wait_for_result === true

      if (!webhookUrl && !workflowId) {
        return {
          error: 'missing_target',
          message: 'Provide either webhook_url (direct HTTP) or workflow_id (API mode)',
        }
      }

      // --- Webhook mode (provider-agnostic) ---
      if (webhookUrl) {
        const detectedProvider = detectProviderFromUrl(webhookUrl)

        try {
          const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })

          let responsePreview: string | undefined
          if (waitForResult && detectedProvider !== 'zapier') {
            const text = await res.text()
            responsePreview = text.slice(0, 500)
          }

          await logExecution(env, detectedProvider, webhookUrl, res.status)

          return {
            ok: res.ok,
            mode: 'webhook' as const,
            provider: detectedProvider,
            status: res.status,
            ...(responsePreview !== undefined ? { response_preview: responsePreview } : {}),
          }
        } catch {
          return { error: 'webhook_unreachable', message: 'Could not reach webhook endpoint' }
        }
      }

      // --- API mode (auto-detect provider) ---
      const config = detectProvider(env)
      if (!config) {
        return {
          error: 'automation_not_configured',
          message: 'No automation provider configured.',
          providers: {
            cf_workflows: 'Add [[workflows]] binding to wrangler.toml (zero external deps)',
            torivers: 'npx wrangler secret put TORIVERS_API_URL && npx wrangler secret put TORIVERS_API_KEY',
            n8n: 'npx wrangler secret put N8N_API_URL && npx wrangler secret put N8N_API_KEY',
            zapier: 'npx wrangler secret put ZAPIER_WEBHOOK_URL',
          },
        }
      }

      const { provider, apiUrl, apiKey } = config

      // --- CF Workflows (native edge execution) ---
      if (provider === 'cf_workflows') {
        try {
          const binding = (env as Record<string, unknown>)['INKWELL_WORKFLOW'] as WorkflowBinding
          const instanceId = workflowId || crypto.randomUUID()

          const instance = await binding.create({
            id: instanceId,
            params: data,
          })

          await logExecution(env, 'cf_workflows', instance.id, 200)

          const result: Record<string, unknown> = {
            ok: true,
            mode: 'api' as const,
            provider: 'cf_workflows' as const,
            instance_id: instance.id,
            workflow_id: workflowId || null,
            note: 'Workflow running at the edge. Use instance_id to check status.',
          }

          // If wait_for_result, poll for completion (with timeout)
          if (waitForResult) {
            try {
              const status = await binding.get(instance.id)
              result.status = status.status?.status ?? 'running'
              if (status.output) {
                result.response_preview = JSON.stringify(status.output).slice(0, 500)
              }
            } catch {
              result.status = 'running'
              result.note = 'Workflow started but status check failed. It is still running.'
            }
          }

          return result
        } catch (err) {
          return { error: 'cf_workflow_failed', message: `CF Workflow creation failed: ${err instanceof Error ? err.message : 'unknown'}` }
        }
      }

      // --- Zapier (webhook-based, fire-and-forget) ---
      if (provider === 'zapier') {
        try {
          const payload = { ...data, workflow_id: workflowId }
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

          await logExecution(env, 'zapier', workflowId, res.status)

          return {
            ok: res.ok,
            mode: 'api' as const,
            provider: 'zapier' as const,
            status: res.status,
            workflow_id: workflowId,
            note: 'Zapier webhooks are fire-and-forget. Check Zap history at zapier.com.',
          }
        } catch {
          return { error: 'webhook_unreachable', message: 'Could not reach Zapier webhook' }
        }
      }

      // --- ToRivers and n8n (full API) ---
      const headers = buildHeaders(provider, apiKey)

      let endpoint: string
      let body: string

      if (provider === 'torivers') {
        endpoint = `${apiUrl}/automations/${workflowId}/execute`
        body = JSON.stringify({ input: data, wait: waitForResult })
      } else {
        endpoint = `${apiUrl}/api/v1/workflows/${workflowId}/run`
        body = JSON.stringify({ data })
      }

      try {
        const res = await fetch(endpoint, { method: 'POST', headers, body })

        let responsePreview: string | undefined
        if (waitForResult) {
          const text = await res.text()
          responsePreview = text.slice(0, 500)
        }

        await logExecution(env, provider, workflowId, res.status)

        return {
          ok: res.ok,
          mode: 'api' as const,
          provider,
          status: res.status,
          workflow_id: workflowId,
          ...(responsePreview !== undefined ? { response_preview: responsePreview } : {}),
        }
      } catch {
        return { error: 'api_unreachable', message: `Could not reach ${provider} API at ${apiUrl}` }
      }
    },
  },

  {
    name: 'list_workflows',
    description:
      'List available workflows/automations. Supports CF Workflows (native), ToRivers, and n8n. Zapier has no public list API.',
    inputSchema: {
      type: 'object',
      properties: {
        active_only: {
          type: 'boolean',
          description: 'Only show active workflows (default true)',
        },
        search: {
          type: 'string',
          description: 'Filter by name (case-insensitive substring)',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 20)',
        },
      },
    },
    handler: async (args, rawEnv) => {
      const env = rawEnv as Env

      const config = detectProvider(env)
      if (!config) {
        return {
          error: 'automation_not_configured',
          message: 'No automation provider configured.',
          providers: {
            cf_workflows: 'Add [[workflows]] binding to wrangler.toml',
            torivers: 'npx wrangler secret put TORIVERS_API_URL && npx wrangler secret put TORIVERS_API_KEY',
            n8n: 'npx wrangler secret put N8N_API_URL && npx wrangler secret put N8N_API_KEY',
            zapier: 'Zapier has no public list API. Manage Zaps at zapier.com.',
          },
        }
      }

      const { provider, apiUrl, apiKey } = config

      // CF Workflows — return the bound workflows
      if (provider === 'cf_workflows') {
        return {
          provider: 'cf_workflows' as const,
          workflows: [
            { id: 'inkwell-generic', name: 'Generic Workflow', active: true, provider: 'cf_workflows' as const, created_at: '', updated_at: '' },
            { id: 'inkwell-outreach', name: 'Outreach Sequence', active: true, provider: 'cf_workflows' as const, created_at: '', updated_at: '' },
          ],
          total: 2,
          note: 'CF Workflows run natively at the edge. Add more by defining WorkflowEntrypoint classes.',
        }
      }

      // Zapier — no list API
      if (provider === 'zapier') {
        return {
          provider: 'zapier' as const,
          workflows: [],
          total: 0,
          note: 'Zapier has no public list API. Manage Zaps at zapier.com/app/zaps.',
        }
      }

      // ToRivers and n8n — full list API
      const activeOnly = args.active_only !== false
      const search = typeof args.search === 'string' ? args.search.toLowerCase().trim() : ''
      const limit = typeof args.limit === 'number' && args.limit > 0 ? args.limit : 20

      const headers = buildHeaders(provider, apiKey)

      try {
        let endpoint: string
        if (provider === 'torivers') {
          const params = new URLSearchParams()
          params.set('limit', String(limit))
          if (search) params.set('search', search)
          if (activeOnly) params.set('active', 'true')
          endpoint = `${apiUrl}/automations?${params.toString()}`
        } else {
          endpoint = `${apiUrl}/api/v1/workflows`
        }

        const res = await fetch(endpoint, { headers })

        if (!res.ok) {
          return { error: 'api_error', status: res.status, message: `${provider} API returned ${res.status}` }
        }

        const responseBody = (await res.json()) as { data?: unknown[]; results?: unknown[] }
        const raw = Array.isArray(responseBody.data) ? responseBody.data : Array.isArray(responseBody.results) ? responseBody.results : []

        const workflows: WorkflowSummary[] = raw
          .filter((w): w is Record<string, unknown> => w !== null && typeof w === 'object')
          .filter((w) => {
            if (provider === 'n8n') {
              if (activeOnly && w.active !== true) return false
              if (search && typeof w.name === 'string' && !w.name.toLowerCase().includes(search)) return false
            }
            return true
          })
          .slice(0, limit)
          .map((w) => ({
            id: String(w.id ?? ''),
            name: String(w.name ?? w.title ?? ''),
            active: w.active === true || w.status === 'active',
            provider,
            created_at: String(w.createdAt ?? w.created_at ?? ''),
            updated_at: String(w.updatedAt ?? w.updated_at ?? ''),
          }))

        return { provider, workflows, total: workflows.length }
      } catch {
        return { error: 'api_unreachable', message: `Could not reach ${provider} API at ${apiUrl}` }
      }
    },
  },
]

/** Log automation execution to DB_ANALYTICS for tracking */
async function logExecution(env: Env, provider: string, target: string, status: number): Promise<void> {
  try {
    await env.DB_ANALYTICS.prepare(
      'INSERT INTO content_index (slug, title, type, lang, author, tags, description, published_at, updated_at, word_count, channel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(
        `automation-${Date.now()}`,
        `${provider}: ${target.slice(0, 60)}`,
        'automation',
        'en',
        'agent',
        JSON.stringify([provider]),
        `status=${status}`,
        new Date().toISOString().slice(0, 10),
        new Date().toISOString().slice(0, 10),
        0,
        'automation',
      )
      .run()
  } catch {
    // Non-critical — don't fail the tool if logging fails
  }
}
