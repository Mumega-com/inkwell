import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { analyticsRoutes } from './routes/analytics'
import { authRoutes } from './routes/auth'
import { chatRoutes } from './routes/chat'
import { contentRoutes } from './routes/content'
import { contractRoutes } from './routes/contracts'
import { courseRoutes } from './routes/courses'
import { dashboardRoutes } from './routes/dashboard'
import { diagnosticsRoutes } from './routes/diagnostics'
import { discoveryRoutes } from './routes/discovery'
import { glassRoutes } from './routes/glass'
import { mcpRoutes } from './routes/mcp'
import { paymentRoutes } from './routes/payments'
import { publishingRoutes } from './routes/publishing'
import { questionnaireRoutes } from './routes/questionnaire'
import { telegramRoutes } from './routes/telegram'
import { routeGate } from './middleware/route-gate'
import { tenantResolver } from './middleware/tenant'
import { usageTracker } from './middleware/usage'
import { scheduled } from './scheduled'
import type { AppBindings } from './types'

const app = new Hono<AppBindings>()

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}))

// Tenant resolution (non-breaking: null = single-site mode)
app.use('*', tenantResolver())

// API usage tracking per tenant per day (fire-and-forget, non-blocking)
app.use('*', usageTracker())

app.get('/health', (c) => c.json({ status: 'ok', ts: Date.now(), tenant: c.get('tenant_slug') }))

// Core routes (always enabled)
app.route('/api', analyticsRoutes)
app.route('/api', contentRoutes)

// Feature routes (gated by ENABLED_ROUTES env var)
app.use('/api/auth/*', routeGate('auth'))
app.route('/api/auth', authRoutes)

app.use('/api/chat/*', routeGate('chat'))
app.route('/api/chat', chatRoutes)

app.use('/api/contracts/*', routeGate('contracts'))
app.route('/api/contracts', contractRoutes)

app.use('/api/courses/*', routeGate('courses'))
app.route('/api/courses', courseRoutes)

app.use('/api/dashboard/*', routeGate('dashboard'))
app.route('/api/dashboard', dashboardRoutes)

app.use('/api/diagnostics/*', routeGate('diagnostics'))
app.route('/api/diagnostics', diagnosticsRoutes)

app.use('/api/discovery/*', routeGate('discovery'))
app.route('/api/discovery', discoveryRoutes)

app.use('/api/glass/*', routeGate('glass'))
app.route('/api/glass', glassRoutes)

app.use('/api/payments/*', routeGate('payments'))
app.route('/api/payments', paymentRoutes)

app.use('/api/publishing/*', routeGate('publishing'))
app.route('/api/publishing', publishingRoutes)

app.use('/api/questionnaire/*', routeGate('questionnaire'))
app.route('/api/questionnaire', questionnaireRoutes)

app.use('/api/telegram/*', routeGate('telegram'))
app.route('/api/telegram', telegramRoutes)

app.use('/mcp', routeGate('mcp'))
app.route('/mcp', mcpRoutes)

export default {
  fetch: app.fetch,
  scheduled,
}
