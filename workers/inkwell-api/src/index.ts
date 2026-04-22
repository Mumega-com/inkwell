import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { registerPlugin, getActivePlugins } from '../../../kernel/plugin-loader'
import { config } from '../../../inkwell.config'

// Plugin manifests (all 19 plugins)
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
import syncManifest from '../../../plugins/sync/manifest'
import mediaManifest from '../../../plugins/media/manifest'
import seoManifest from '../../../plugins/seo/manifest'
import feedbackManifest from '../../../plugins/feedback/manifest'
import crmManifest from '../../../plugins/crm/manifest'
import automationManifest from '../../../plugins/automation/manifest'
import bountyManifest from '../../../plugins/bounty/manifest'
import organismManifest from '../../../plugins-pro/organism/manifest'
import agencyManifest from '../../../plugins-pro/agency/manifest'

// Register all available plugins
const allPlugins = [
  analyticsManifest, authManifest, dashboardManifest, commerceManifest,
  contentManifest, mcpManifest, contractsManifest, coursesManifest,
  telegramManifest, chatManifest, diagnosticsManifest, discoveryManifest,
  paymentsManifest, questionnaireManifest, onboardingManifest, notificationsManifest,
  organismManifest, syncManifest, mediaManifest, seoManifest, feedbackManifest,
  crmManifest, automationManifest, bountyManifest, agencyManifest,
]
for (const manifest of allPlugins) {
  registerPlugin(manifest)
}

import { cfAccessMiddleware } from './middleware/cf-access'
import { autoMigrate } from './middleware/auto-migrate'
import { tenantResolver } from './middleware/tenant'
import { usageTracker } from './middleware/usage'
import { authSessionMiddleware } from './middleware/auth'
import { requireRole } from './middleware/rbac'
import { adapterMiddleware } from './middleware/adapters'
import { edgeSeoRedirects, edgeSeoCrawlLogger, dynamicRobotsTxt } from './middleware/edge-seo'
import { utmMiddleware } from './middleware/utm'
import { visitorProfileMiddleware } from './middleware/visitor-profile'
import { scheduled } from './scheduled'
import { trackerSnippet } from './snippets/tracker'
import { feedbackTriggerSnippet } from './snippets/feedback-trigger'
import { recommendationsSnippet } from './snippets/recommendations'
import type { AppBindings } from './types'

const app = new Hono<AppBindings>()

// ── Plugin System ──────────────────────────────────────────────────
// Plugins declare mountRoutes() in their manifests.
// config.plugins[] controls which are active — unlisted plugins
// are registered but their routes are NOT mounted.
// ───────────────────────────────────────────────────────────────────

// CF Access Zero Trust middleware — service tokens, JWT signature verification, tenant resolution
app.use('*', cfAccessMiddleware)

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return null
    // Allow the configured SITE_URL origin and all tenant subdomains
    const siteUrl = config.domain ? `https://${config.domain}` : ''
    if (siteUrl && origin === siteUrl) return origin
    // Allow tenant subdomains (*.domain)
    if (config.domain) {
      const pattern = new RegExp(`^https://[a-z0-9-]+\\.${config.domain.replace('.', '\\.')}$`)
      if (pattern.test(origin)) return origin
    }
    // Allow localhost on any port for local development
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin
    return null
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Auto-migrate — apply D1 migrations on first request (cold start only)
app.use('*', autoMigrate)

// Adapters — plugins use c.get('db_core'), c.get('sessions'), c.get('content') instead of c.env.*
app.use('*', adapterMiddleware)

// Tenant resolution (non-breaking: null = single-site mode)
app.use('*', tenantResolver())

// API usage tracking per tenant per day (fire-and-forget, non-blocking)
app.use('*', usageTracker())

// Session resolution (non-blocking: null = unauthenticated)
app.use('*', authSessionMiddleware)

// UTM attribution parsing
app.use('*', utmMiddleware)

// Visitor profile — first-party identity (fire-and-forget, after auth for stitching)
app.use('*', visitorProfileMiddleware)

// Edge SEO — dynamic robots.txt, redirect engine, crawl logging
app.use('*', dynamicRobotsTxt)
app.use('*', edgeSeoRedirects)
app.use('*', edgeSeoCrawlLogger)

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
    let content = await c.get('content').getPage(key)
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
        const saasUrl = c.env.SOS_SAAS_URL ?? ''
        const keyPrefix = config.network.storageKeyPrefix

        // Look up bus_token for the tenant so the dashboard can authenticate API calls
        let busToken = ''
        if (cfTenant && c.env.SOS_SAAS_URL) {
          try {
            const tokenRes = await fetch(
              `${c.env.SOS_SAAS_URL}/auth/tenant?email=${encodeURIComponent(c.get('cf_access_email') ?? '')}`,
              { headers: { 'Authorization': `Bearer ${c.env.NETWORK_TOKEN ?? ''}` } },
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
    if (!localStorage.getItem('${keyPrefix}_auth_token') && ${JSON.stringify(busToken)}) {
      localStorage.setItem('${keyPrefix}_auth_token', ${JSON.stringify(busToken)});
      localStorage.setItem('${keyPrefix}_tenant_slug', ${JSON.stringify(cfTenant ?? '')});
      localStorage.setItem('${keyPrefix}_api_url', ${JSON.stringify(saasUrl)});
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
        config.domain && new URL(c.req.url).hostname.endsWith(`.${config.domain}`)
      ) {
        const noindexTag = '<meta name="robots" content="noindex, nofollow">'
        if (!content.includes('noindex') && content.includes('</head>')) {
          content = content.replace('</head>', `${noindexTag}\n</head>`)
        }
      }

      // Inject client-side snippets into HTML pages (tracker, feedback, recommendations)
      if (contentType === 'text/html; charset=utf-8' && !path.startsWith('dashboard')) {
        const snippets = [
          trackerSnippet(),
          feedbackTriggerSnippet(config.feedback?.surveys ?? []),
          recommendationsSnippet(),
        ].filter(Boolean).join('\n')

        if (snippets && content.includes('</body>')) {
          content = content.replace('</body>', `${snippets}\n</body>`)
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
  const custom404 = await c.get('content').getPage(`${tenantSlug}:page:404.html`)
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
<p><a href="${config.network.poweredByUrl}">${config.network.brandName ? `Powered by ${config.network.brandName}` : ''}</a></p>
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
