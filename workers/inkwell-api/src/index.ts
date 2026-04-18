import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { registerPlugin, getActivePlugins } from '../../../kernel/plugin-loader'
import { config } from '../../../inkwell.config'

// Plugin manifests (all 16 plugins)
import analyticsManifest from '../../../plugins/analytics/manifest'
import authManifest from '../../../plugins/auth/manifest'
import dashboardManifest from '../../../plugins/dashboard/manifest'
import commerceManifest from '../../../plugins/commerce/manifest'
import contentManifest from '../../../plugins/content/manifest'
import mcpManifest from '../../../plugins/mcp/manifest'
import contractsManifest from '../../../plugins/contracts/manifest'
import coursesManifest from '../../../plugins/courses/manifest'
import telegramManifest from '../../../plugins/telegram/manifest'
import chatManifest from '../../../plugins/chat/manifest'
import diagnosticsManifest from '../../../plugins/diagnostics/manifest'
import discoveryManifest from '../../../plugins/discovery/manifest'
import paymentsManifest from '../../../plugins/payments/manifest'
import questionnaireManifest from '../../../plugins/questionnaire/manifest'
import onboardingManifest from '../../../plugins/onboarding/manifest'
import notificationsManifest from '../../../plugins/notifications/manifest'

// Register all available plugins
const allPlugins = [
  analyticsManifest, authManifest, dashboardManifest, commerceManifest,
  contentManifest, mcpManifest, contractsManifest, coursesManifest,
  telegramManifest, chatManifest, diagnosticsManifest, discoveryManifest,
  paymentsManifest, questionnaireManifest, onboardingManifest, notificationsManifest,
]
for (const manifest of allPlugins) {
  registerPlugin(manifest)
}

import { tenantResolver } from './middleware/tenant'
import { usageTracker } from './middleware/usage'
import { authSessionMiddleware } from './middleware/auth'
import { requireRole } from './middleware/rbac'
import { adapterMiddleware } from './middleware/adapters'
import { scheduled } from './scheduled'
import type { AppBindings } from './types'

const app = new Hono<AppBindings>()

// ── Plugin System ──────────────────────────────────────────────────
// Plugins declare mountRoutes() in their manifests.
// config.plugins[] controls which are active — unlisted plugins
// are registered but their routes are NOT mounted.
// ───────────────────────────────────────────────────────────────────

// ---------------------------------------------------------------------------
// CF Access JWT middleware
// Reads the CF-Access-JWT-Assertion header injected by Cloudflare Access.
// CF has already verified the JWT signature — we just decode the payload.
// Sets cf_access_email and cf_access_tenant on the context if a tenant is found.
// Non-blocking: requests without the header pass through unchanged.
// ---------------------------------------------------------------------------
app.use('*', async (c, next) => {
  const jwt = c.req.header('CF-Access-JWT-Assertion')
  if (!jwt) {
    c.set('cf_access_email', null)
    c.set('cf_access_tenant', null)
    return next()
  }

  try {
    // JWT is three base64url-encoded segments: header.payload.signature
    const parts = jwt.split('.')
    if (parts.length !== 3) throw new Error('malformed jwt')

    // base64url → base64 → decode
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded)) as Record<string, unknown>

    const email = typeof payload['email'] === 'string' ? payload['email'] : null
    if (!email) {
      c.set('cf_access_email', null)
      c.set('cf_access_tenant', null)
      return next()
    }

    c.set('cf_access_email', email)

    // Look up tenant via SaaS API
    const saasUrl = c.env.SOS_SAAS_URL
    if (saasUrl) {
      try {
        const res = await fetch(
          `${saasUrl}/auth/tenant?email=${encodeURIComponent(email)}`,
          { headers: { 'Authorization': `Bearer ${c.env.MUMEGA_TOKEN ?? ''}` } },
        )
        if (res.ok) {
          const data = await res.json() as { tenant_slug?: string }
          c.set('cf_access_tenant', data.tenant_slug ?? null)
        } else {
          c.set('cf_access_tenant', null)
        }
      } catch {
        c.set('cf_access_tenant', null)
      }
    } else {
      c.set('cf_access_tenant', null)
    }
  } catch {
    c.set('cf_access_email', null)
    c.set('cf_access_tenant', null)
  }

  return next()
})

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return null
    // Allow mumega.com and all tenant subdomains
    if (origin === 'https://mumega.com') return origin
    if (/^https:\/\/[a-z0-9-]+\.mumega\.com$/.test(origin)) return origin
    // Allow localhost on any port for local development
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin
    return null
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Tenant resolution (non-breaking: null = single-site mode)
app.use('*', tenantResolver())

// API usage tracking per tenant per day (fire-and-forget, non-blocking)
app.use('*', usageTracker())

// Database adapters — plugins use c.get('db_core') instead of c.env.DB_CORE
app.use('*', adapterMiddleware)

// Session resolution (non-blocking: null = unauthenticated)
app.use('*', authSessionMiddleware)

app.get('/health', (c) => c.json({ status: 'ok', ts: Date.now(), tenant: c.get('tenant_slug') }))

// ── Plugin Routes with RBAC ────────────────────────────────────────
// Each plugin declares mountRoutes() + requiredRole in its manifest.
// The kernel resolves the user's role and gates access per-plugin.
// System tokens (PUBLISH_TOKEN, INKWELL_MCP_TOKEN) bypass RBAC.
// ───────────────────────────────────────────────────────────────────
for (const plugin of getActivePlugins([...config.plugins])) {
  if (!plugin.mountRoutes) continue

  if (plugin.requiredRole && plugin.requiredRole !== 'viewer') {
    const guarded = new Hono<AppBindings>()
    guarded.use('*', requireRole(plugin.requiredRole))
    plugin.mountRoutes(guarded as never)
    app.route('/', guarded)
  } else {
    plugin.mountRoutes(app as never)
  }
}

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
    let content = await c.env.CONTENT.get(key)
    if (content) {
      // Determine content type from the key/path
      const contentType = getContentType(key)

      // If this is a dashboard HTML page and the user arrived via CF Access,
      // inject a script that auto-configures localStorage so the React dashboard
      // components are authenticated immediately — no manual token entry needed.
      if (
        contentType === 'text/html; charset=utf-8' &&
        path.startsWith('dashboard') &&
        c.get('cf_access_email')
      ) {
        const cfTenant = c.get('cf_access_tenant')
        const saasUrl = c.env.SOS_SAAS_URL ?? 'https://api.mumega.com'

        // Look up bus_token for the tenant so the dashboard can authenticate API calls
        let busToken = ''
        if (cfTenant && c.env.SOS_SAAS_URL) {
          try {
            const tokenRes = await fetch(
              `${c.env.SOS_SAAS_URL}/auth/tenant?email=${encodeURIComponent(c.get('cf_access_email') ?? '')}`,
              { headers: { 'Authorization': `Bearer ${c.env.MUMEGA_TOKEN ?? ''}` } },
            )
            if (tokenRes.ok) {
              const tokenData = await tokenRes.json() as { bus_token?: string }
              busToken = tokenData.bus_token ?? ''
            }
          } catch {
            // Proceed without bus_token — dashboard will fall back to manual auth
          }
        }

        const autoConfigScript = `<script>
  (function(){
    if (!localStorage.getItem('mumega_auth_token') && ${JSON.stringify(busToken)}) {
      localStorage.setItem('mumega_auth_token', ${JSON.stringify(busToken)});
      localStorage.setItem('mumega_tenant_slug', ${JSON.stringify(cfTenant ?? '')});
      localStorage.setItem('mumega_api_url', ${JSON.stringify(saasUrl)});
    }
  })();
<\/script>`

        // Inject before </head> — graceful fallback: append before </body> if no </head>
        if (content.includes('</head>')) {
          content = content.replace('</head>', `${autoConfigScript}\n</head>`)
        } else if (content.includes('</body>')) {
          content = content.replace('</body>', `${autoConfigScript}\n</body>`)
        }
      }

      // Inject noindex for tenant subdomains (staging — not the customer's real domain)
      if (
        contentType === 'text/html; charset=utf-8' &&
        tenantSlug &&
        new URL(c.req.url).hostname.endsWith('.mumega.com')
      ) {
        const noindexTag = '<meta name="robots" content="noindex, nofollow">'
        if (!content.includes('noindex') && content.includes('</head>')) {
          content = content.replace('</head>', `${noindexTag}\n</head>`)
        }
      }

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
