import { Hono } from 'hono'
import type { AppBindings } from '../types'

export const glassRoutes = new Hono<AppBindings>()

// GET /api/glass/daily — latest daily snapshot
glassRoutes.get('/daily', async (c) => {
  const data = await c.env.CONTENT.get('glass:daily')
  if (!data) {
    return c.json({ error: 'No daily snapshot yet. Flywheel runs at 6am UTC.' }, 404)
  }
  return c.json(JSON.parse(data))
})

// GET /api/glass/:date — historical snapshot by date (YYYY-MM-DD)
glassRoutes.get('/:date', async (c) => {
  const date = c.req.param('date')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: 'Date format: YYYY-MM-DD' }, 400)
  }
  const data = await c.env.CONTENT.get(`glass:${date}`)
  if (!data) {
    return c.json({ error: `No snapshot for ${date}` }, 404)
  }
  return c.json(JSON.parse(data))
})

// GET /api/glass/history — list available snapshot dates
glassRoutes.get('/history', async (c) => {
  const list = await c.env.CONTENT.list({ prefix: 'glass:2' })
  const dates = list.keys.map(k => k.name.replace('glass:', '')).sort().reverse()
  return c.json({ dates, count: dates.length })
})
