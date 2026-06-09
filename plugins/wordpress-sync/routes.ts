import { Hono } from 'hono'
import { requireAuth } from '../middleware'
import type { AppBindings } from '../types'
import { syncWordPressContent } from './sync'

const wordpressSyncRoutes = new Hono<AppBindings>()

wordpressSyncRoutes.post('/run', requireAuth, async (c) => {
  const result = await syncWordPressContent(c.env)
  return c.json(result, result.ok ? 200 : 500)
})

wordpressSyncRoutes.get('/runs', requireAuth, async (c) => {
  const rows = await c.env.DB_MARKETING.prepare(
    `SELECT id, customer_slug, connector_type, status, started_at, finished_at, records_written, cursor_json, error_message
     FROM connector_runs
     WHERE connector_type = 'wordpress'
     ORDER BY started_at DESC
     LIMIT 20`,
  ).all()

  return c.json({ runs: rows.results ?? [] })
})

export { wordpressSyncRoutes }

