import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workflows'

interface Env {
  DB_CORE: D1Database
  DB_ANALYTICS: D1Database
  [key: string]: unknown
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  run(): Promise<unknown>
  all<T = unknown>(): Promise<{ results: T[] }>
  first<T = unknown>(): Promise<T | null>
}

interface GenericParams {
  workflow_name: string
  steps: Array<{
    name: string
    action: 'fetch' | 'sleep' | 'db_query'
    url?: string
    method?: string
    headers?: Record<string, string>
    body?: unknown
    duration?: string
    sql?: string
    params?: unknown[]
    database?: 'DB_CORE' | 'DB_ANALYTICS'
  }>
  callback_url?: string
}

export class GenericWorkflow extends WorkflowEntrypoint<Env, GenericParams> {
  async run(event: WorkflowEvent<GenericParams>, step: WorkflowStep) {
    const { steps, callback_url, workflow_name } = event.payload
    const results: Record<string, unknown> = {}

    for (const s of steps) {
      if (s.action === 'sleep') {
        await step.sleep(s.name, s.duration ?? '1 minute')
        results[s.name] = { slept: s.duration }
        continue
      }

      if (s.action === 'fetch') {
        const result = await step.do(s.name, {
          retries: { limit: 2, delay: '10 seconds', backoff: 'exponential' },
        }, async () => {
          const res = await fetch(s.url!, {
            method: s.method ?? 'POST',
            headers: { 'Content-Type': 'application/json', ...(s.headers ?? {}) },
            ...(s.body ? { body: JSON.stringify(s.body) } : {}),
          })
          const text = await res.text()
          return { status: res.status, ok: res.ok, body: text.slice(0, 1000) }
        })
        results[s.name] = result
        continue
      }

      if (s.action === 'db_query') {
        const result = await step.do(s.name, async () => {
          const db = s.database === 'DB_ANALYTICS' ? this.env.DB_ANALYTICS : this.env.DB_CORE
          let stmt = db.prepare(s.sql!)
          if (s.params?.length) stmt = stmt.bind(...s.params)
          const res = await stmt.all()
          return { rows: res.results?.length ?? 0 }
        })
        results[s.name] = result
      }
    }

    if (callback_url) {
      await step.do('callback', async () => {
        await fetch(callback_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workflow_name, status: 'completed', results }),
        })
      })
    }

    return results
  }
}
