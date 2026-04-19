/**
 * Automation MCP tools — trigger and list n8n workflows.
 *
 * Two modes for triggering:
 *   1. Webhook mode (webhook_url) — POST data to any webhook endpoint
 *   2. API mode (workflow_id) — use n8n REST API with API key auth
 *
 * Env vars:
 *   N8N_API_URL  — n8n instance base URL (e.g. https://n8n.example.com)
 *   N8N_API_KEY  — n8n API key for authenticated requests
 */
import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

interface WorkflowSummary {
  id: string
  name: string
  active: boolean
  created_at: string
  updated_at: string
}

export const automationMcpTools: McpToolDef[] = [
  {
    name: 'trigger_workflow',
    description:
      'Trigger an n8n workflow via webhook URL or API. Webhook mode: POST data to a webhook endpoint. API mode: trigger by workflow ID using the n8n REST API.',
    inputSchema: {
      type: 'object',
      properties: {
        webhook_url: {
          type: 'string',
          description: 'Direct webhook URL to POST to (webhook mode). Takes priority if both provided.',
        },
        workflow_id: {
          type: 'string',
          description: 'n8n workflow ID to trigger via API (API mode). Requires N8N_API_URL and N8N_API_KEY env vars.',
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
      const envRecord = env as Record<string, string>

      const webhookUrl = typeof args.webhook_url === 'string' ? args.webhook_url.trim() : ''
      const workflowId = typeof args.workflow_id === 'string' ? args.workflow_id.trim() : ''
      const data = (args.data as Record<string, unknown>) ?? {}
      const waitForResult = args.wait_for_result === true

      if (!webhookUrl && !workflowId) {
        return {
          error: 'missing_target',
          message: 'Provide either webhook_url (webhook mode) or workflow_id (API mode)',
        }
      }

      // --- Webhook mode ---
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
            status: res.status,
            ...(responsePreview !== undefined ? { response_preview: responsePreview } : {}),
          }
        } catch {
          return { error: 'webhook_unreachable', message: 'Could not reach webhook endpoint' }
        }
      }

      // --- API mode ---
      const apiUrl = envRecord['N8N_API_URL']
      const apiKey = envRecord['N8N_API_KEY']

      if (!apiUrl || !apiKey) {
        return {
          error: 'n8n_not_configured',
          message: 'Set N8N_API_URL and N8N_API_KEY env vars to use API mode',
          setup_hint: 'npx wrangler secret put N8N_API_URL && npx wrangler secret put N8N_API_KEY',
        }
      }

      const baseUrl = apiUrl.replace(/\/+$/, '')
      const endpoint = `${baseUrl}/api/v1/workflows/${workflowId}/run`

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-N8N-API-KEY': apiKey,
          },
          body: JSON.stringify({ data }),
        })

        let responsePreview: string | undefined
        if (waitForResult) {
          const text = await res.text()
          responsePreview = text.slice(0, 500)
        }

        await logExecution(env, 'api', workflowId, res.status)

        return {
          ok: res.ok,
          mode: 'api' as const,
          status: res.status,
          workflow_id: workflowId,
          ...(responsePreview !== undefined ? { response_preview: responsePreview } : {}),
        }
      } catch {
        return { error: 'api_unreachable', message: `Could not reach n8n API at ${baseUrl}` }
      }
    },
  },

  {
    name: 'list_workflows',
    description:
      'List available n8n workflows. Requires N8N_API_URL and N8N_API_KEY env vars.',
    inputSchema: {
      type: 'object',
      properties: {
        active_only: {
          type: 'boolean',
          description: 'Only show active workflows (default true)',
        },
        search: {
          type: 'string',
          description: 'Filter workflows by name (case-insensitive substring match)',
        },
        limit: {
          type: 'number',
          description: 'Max workflows to return (default 20)',
        },
      },
    },
    handler: async (args, rawEnv) => {
      const env = rawEnv as Env
      const envRecord = env as Record<string, string>

      const apiUrl = envRecord['N8N_API_URL']
      const apiKey = envRecord['N8N_API_KEY']

      if (!apiUrl || !apiKey) {
        return {
          error: 'n8n_not_configured',
          message: 'Set N8N_API_URL and N8N_API_KEY env vars to list workflows',
          setup_hint: 'npx wrangler secret put N8N_API_URL && npx wrangler secret put N8N_API_KEY',
        }
      }

      const activeOnly = args.active_only !== false
      const search = typeof args.search === 'string' ? args.search.toLowerCase().trim() : ''
      const limit = typeof args.limit === 'number' && args.limit > 0 ? args.limit : 20

      const baseUrl = apiUrl.replace(/\/+$/, '')

      try {
        const res = await fetch(`${baseUrl}/api/v1/workflows`, {
          headers: { 'X-N8N-API-KEY': apiKey },
        })

        if (!res.ok) {
          return {
            error: 'api_error',
            status: res.status,
            message: `n8n API returned ${res.status}`,
          }
        }

        const body = (await res.json()) as { data?: unknown[] }
        const raw = Array.isArray(body.data) ? body.data : []

        const workflows: WorkflowSummary[] = raw
          .filter((w): w is Record<string, unknown> => w !== null && typeof w === 'object')
          .filter((w) => {
            if (activeOnly && w.active !== true) return false
            if (search && typeof w.name === 'string' && !w.name.toLowerCase().includes(search)) return false
            return true
          })
          .slice(0, limit)
          .map((w) => ({
            id: String(w.id ?? ''),
            name: String(w.name ?? ''),
            active: w.active === true,
            created_at: String(w.createdAt ?? ''),
            updated_at: String(w.updatedAt ?? ''),
          }))

        return { workflows, total: workflows.length }
      } catch {
        return { error: 'api_unreachable', message: `Could not reach n8n API at ${baseUrl}` }
      }
    },
  },
]

/** Log automation execution to DB_ANALYTICS for tracking */
async function logExecution(env: Env, mode: string, target: string, status: number): Promise<void> {
  try {
    await env.DB_ANALYTICS.prepare(
      'INSERT INTO content_index (slug, title, type, lang, author, tags, description, published_at, updated_at, word_count, channel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(
        `automation-${Date.now()}`,
        `${mode}: ${target.slice(0, 60)}`,
        'automation',
        'en',
        'agent',
        JSON.stringify([mode]),
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
