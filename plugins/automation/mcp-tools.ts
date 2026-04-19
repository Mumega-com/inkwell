/**
 * Automation MCP tools — trigger and list workflows from any provider.
 *
 * Provider auto-detection for API mode (checked in order):
 *   1. TORIVERS_API_URL → ToRivers (torivers.com) — pay-per-execution marketplace
 *   2. N8N_API_URL      → n8n — self-hosted workflow automation
 *   3. ZAPIER_WEBHOOK_URL → Zapier — default catch hook for API-mode triggers
 *
 * Webhook mode (webhook_url arg) works with any provider — ToRivers, n8n,
 * Zapier, Make.com, or any HTTP endpoint. Provider-agnostic by design.
 *
 * Zapier notes:
 *   - Triggering: webhook-only (hooks.zapier.com/hooks/catch/...)
 *   - No public API for listing/managing Zaps
 *   - Zapier NLA / AI Actions available separately via zapier.com/mcp
 *
 * Env vars:
 *   TORIVERS_API_URL   — ToRivers API base (e.g. https://torivers.com/api/v1)
 *   TORIVERS_API_KEY   — ToRivers API key
 *   N8N_API_URL        — n8n instance base (e.g. https://n8n.example.com)
 *   N8N_API_KEY        — n8n API key
 *   ZAPIER_WEBHOOK_URL — Zapier catch hook URL (default hook for API-mode triggers)
 */
import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

type Provider = 'torivers' | 'n8n' | 'zapier' | 'webhook'

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

function detectProvider(env: Env): ProviderConfig | null {
  const e = env as Record<string, string>

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
  // Zapier webhooks require no auth headers

  return headers
}

/** Detect provider from a webhook URL for better logging */
function detectProviderFromUrl(url: string): Provider {
  if (url.includes('hooks.zapier.com')) return 'zapier'
  if (url.includes('torivers.com')) return 'torivers'
  if (url.includes('n8n')) return 'n8n'
  return 'webhook'
}

export const automationMcpTools: McpToolDef[] = [
  {
    name: 'trigger_workflow',
    description:
      'Trigger a workflow execution. Supports ToRivers (pay-per-execution), n8n (self-hosted), Zapier (webhook), or any HTTP endpoint. Provide workflow_id for API mode or webhook_url for direct POST.',
    inputSchema: {
      type: 'object',
      properties: {
        webhook_url: {
          type: 'string',
          description: 'Direct webhook URL to POST to. Works with any provider: Zapier (hooks.zapier.com/...), n8n, ToRivers, Make.com, or any HTTP endpoint. Takes priority over workflow_id.',
        },
        workflow_id: {
          type: 'string',
          description: 'Workflow/automation ID to trigger via API (ToRivers or n8n). For Zapier, use webhook_url instead.',
        },
        data: {
          type: 'object',
          description: 'Payload to send to the workflow',
        },
        wait_for_result: {
          type: 'boolean',
          description: 'If true, waits for execution result (default false). Not supported by Zapier webhooks.',
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

      // --- Webhook mode (works with any provider) ---
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
          message: 'No automation provider configured. Set one of: TORIVERS_API_URL + TORIVERS_API_KEY, N8N_API_URL + N8N_API_KEY, or ZAPIER_WEBHOOK_URL.',
          providers: {
            torivers: 'npx wrangler secret put TORIVERS_API_URL && npx wrangler secret put TORIVERS_API_KEY',
            n8n: 'npx wrangler secret put N8N_API_URL && npx wrangler secret put N8N_API_KEY',
            zapier: 'npx wrangler secret put ZAPIER_WEBHOOK_URL',
          },
        }
      }

      const { provider, apiUrl, apiKey } = config

      // Zapier in API mode uses default webhook URL with workflow_id as routing key
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
            note: 'Zapier webhooks are fire-and-forget. Use Zap history in zapier.com to check execution.',
          }
        } catch {
          return { error: 'webhook_unreachable', message: 'Could not reach Zapier webhook' }
        }
      }

      // ToRivers and n8n — full API mode
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
      'List available workflows/automations. Supports ToRivers and n8n (full API). Zapier has no public list API — use zapier.com dashboard.',
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
          message: 'No automation provider configured. Set TORIVERS_API_URL + TORIVERS_API_KEY or N8N_API_URL + N8N_API_KEY.',
          providers: {
            torivers: 'npx wrangler secret put TORIVERS_API_URL && npx wrangler secret put TORIVERS_API_KEY',
            n8n: 'npx wrangler secret put N8N_API_URL && npx wrangler secret put N8N_API_KEY',
            zapier: 'Zapier has no public workflow list API. Manage Zaps at zapier.com. Use trigger_workflow with webhook_url to trigger individual Zaps.',
          },
        }
      }

      const { provider, apiUrl, apiKey } = config

      // Zapier has no public API for listing Zaps
      if (provider === 'zapier') {
        return {
          provider: 'zapier' as const,
          workflows: [],
          total: 0,
          note: 'Zapier has no public API for listing Zaps. Manage your Zaps at zapier.com/app/zaps. Use trigger_workflow with webhook_url to trigger specific Zaps.',
        }
      }

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
