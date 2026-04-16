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

// Static page serving for tenant subdomains
// Catches all non-API requests and serves pre-rendered HTML from KV
app.get('*', async (c) => {
  const tenantSlug = c.get('tenant_slug')

  // No tenant = not a subdomain request, return the default page or 404
  if (!tenantSlug) {
    return c.json({ error: 'not_found', message: 'No tenant resolved for this hostname' }, 404)
  }

  // Build the KV key from the request path
  let path = new URL(c.req.url).pathname

  // Normalize: / → index.html, /about → about/index.html or about.html
  if (path === '/') {
    path = 'index.html'
  } else {
    // Remove trailing slash
    path = path.replace(/\/$/, '')
    // Remove leading slash
    path = path.replace(/^\//, '')
  }

  // Try multiple key patterns (Astro generates various file structures)
  const keysToTry = [
    `${tenantSlug}:page:${path}`,
    `${tenantSlug}:page:${path}/index.html`,
    `${tenantSlug}:page:${path}.html`,
  ]

  for (const key of keysToTry) {
    const content = await c.env.CONTENT.get(key)
    if (content) {
      // Determine content type from the key/path
      const contentType = getContentType(key)
      return new Response(content, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=300', // 5 min cache
          'X-Tenant': tenantSlug,
        },
      })
    }
  }

  // Try serving a custom 404 page
  const custom404 = await c.env.CONTENT.get(`${tenantSlug}:page:404.html`)
  if (custom404) {
    return new Response(custom404, {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  return c.html(
    `<!DOCTYPE html>
<html><head><title>Coming Soon</title>
<style>body{font-family:system-ui;background:#0A0A10;color:#EDEDF0;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}
.c{text-align:center;max-width:400px;padding:2rem}h1{color:#D4A017}a{color:#06B6D4}</style>
</head><body><div class="c">
<h1>${tenantSlug}</h1>
<p>This site is being set up. Check back soon.</p>
<p><a href="https://mumega.com">Powered by Mumega</a></p>
</div></body></html>`,
    200,
  )
})

function getContentType(path: string): string {
  if (path.endsWith('.html')) return 'text/html; charset=utf-8'
  if (path.endsWith('.css')) return 'text/css'
  if (path.endsWith('.js')) return 'application/javascript'
  if (path.endsWith('.json')) return 'application/json'
  if (path.endsWith('.svg')) return 'image/svg+xml'
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  if (path.endsWith('.ico')) return 'image/x-icon'
  if (path.endsWith('.xml')) return 'application/xml'
  if (path.endsWith('.txt')) return 'text/plain'
  if (path.endsWith('.woff2')) return 'font/woff2'
  if (path.endsWith('.woff')) return 'font/woff'
  return 'text/html; charset=utf-8' // Default to HTML
}

export default {
  fetch: app.fetch,
  scheduled,
}
