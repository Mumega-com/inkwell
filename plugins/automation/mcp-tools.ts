/**
 * Automation MCP tools — trigger and list workflows from any provider.
 *
 * Provider auto-detection (checked in order):
 *   1. TORIVERS_API_URL → ToRivers (torivers.com) — pay-per-execution marketplace
 *   2. N8N_API_URL      → n8n — self-hosted workflow automation
 *   3. webhook_url arg  → Generic webhook (any HTTP endpoint)
 *
 * The microkernel is provider-agnostic. Tools work the same regardless of backend.
 *
 * Env vars:
 *   TORIVERS_API_URL  — ToRivers API base URL (e.g. https://torivers.com/api/v1)
 *   TORIVERS_API_KEY  — ToRivers API key
 *   N8N_API_URL       — n8n instance base URL (e.g. https://n8n.example.com)
 *   N8N_API_KEY       — n8n API key
 */
import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

type Provider = 'torivers' | 'n8n' | 'webhook'

interface WorkflowSummary {
  id: string
  name: string
  active: boolean
  provider: Provider
  created_at: string
  updated_at: string
}

function detectProvider(env: Env): { provider: Provider; apiUrl: string; apiKey: string } | null {
  const envRecord = env as Record<string, string>

  if (envRecord['TORIVERS_API_URL'] && envRecord['TORIVERS_API_KEY']) {
    return {
      provider: 'torivers',
      apiUrl: envRecord['TORIVERS_API_URL'].replace(/\/+$/, ''),
      apiKey: envRecord['TORIVERS_API_KEY'],
    }
  }

  if (envRecord['N8N_API_URL'] && envRecord['N8N_API_KEY']) {
    return {
      provider: 'n8n',
      apiUrl: envRecord['N8N_API_URL'].replace(/\/+$/, ''),
      apiKey: envRecord['N8N_API_KEY'],
    }
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

export const automationMcpTools: McpToolDef[] = [
  {
    name: 'trigger_workflow',
    description:
      'Trigger a workflow execution. Auto-detects provider: ToRivers (pay-per-execution marketplace), n8n (self-hosted), or raw webhook. Provide workflow_id for API mode or webhook_url for direct HTTP POST.',
    inputSchema: {
      type: 'object',
      properties: {
        webhook_url: {
          type: 'string',
          description: 'Direct webhook URL to POST to (any provider). Takes priority over workflow_id.',
        },
        workflow_id: {
          type: 'string',
          description: 'Workflow/automation ID to trigger via API (ToRivers or n8n).',
        },
        data: {
          type: 'object',
          description: 'Payload to send to the workflow',
        },
        wait_for_result: {
          type: 'boolean',
          description: 'If true, waits for execution result (default false)',
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
        try {
          const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })

          let responsePreview: string | undefined
          if (waitForResult) {
            const text = await res.text()
            responsePreview = text.slice(0, 500)
          }

          await logExecution(env, 'webhook', webhookUrl, res.status)

          return {
            ok: res.ok,
            mode: 'webhook' as const,
            provider: 'webhook' as const,
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
          message: 'No automation provider configured. Set TORIVERS_API_URL + TORIVERS_API_KEY or N8N_API_URL + N8N_API_KEY.',
          setup_hint: 'npx wrangler secret put TORIVERS_API_URL && npx wrangler secret put TORIVERS_API_KEY',
        }
      }

      const { provider, apiUrl, apiKey } = config
      const headers = buildHeaders(provider, apiKey)

      // Build endpoint per provider
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
      'List available workflows/automations. Auto-detects provider: ToRivers or n8n.',
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
          setup_hint: 'npx wrangler secret put TORIVERS_API_URL && npx wrangler secret put TORIVERS_API_KEY',
        }
      }

      const { provider, apiUrl, apiKey } = config
      const activeOnly = args.active_only !== false
      const search = typeof args.search === 'string' ? args.search.toLowerCase().trim() : ''
      const limit = typeof args.limit === 'number' && args.limit > 0 ? args.limit : 20

      const headers = buildHeaders(provider, apiKey)

      try {
        let endpoint: string
        if (provider === 'torivers') {
          endpoint = `${apiUrl}/automations?limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}${activeOnly ? '&active=true' : ''}`
        } else {
          endpoint = `${apiUrl}/api/v1/workflows`
        }

        const res = await fetch(endpoint, { headers })

        if (!res.ok) {
          return { error: 'api_error', status: res.status, message: `${provider} API returned ${res.status}` }
        }

        const body = (await res.json()) as { data?: unknown[]; results?: unknown[] }
        const raw = Array.isArray(body.data) ? body.data : Array.isArray(body.results) ? body.results : []

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
