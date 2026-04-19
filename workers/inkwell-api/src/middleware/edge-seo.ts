/**
 * Edge SEO middleware — bot detection, redirects, and dynamic robots.txt.
 *
 * Three separate middleware functions for composable use:
 *   1. edgeSeoRedirects — redirect engine (run BEFORE other middleware)
 *   2. edgeSeoCrawlLogger — bot detection + fire-and-forget crawl logging
 *   3. dynamicRobotsTxt — intercepts GET /robots.txt with config-driven response
 */

import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../types'
import { config } from '../../../../inkwell.config'

// ---------------------------------------------------------------------------
// Bot Detection
// ---------------------------------------------------------------------------

type BotName = 'googlebot' | 'bingbot' | 'gptbot' | 'claudebot' | 'perplexitybot' | 'other'

/** Map of UA substring (lowercase) → canonical bot name */
const BOT_PATTERNS: ReadonlyArray<[string, BotName]> = [
  ['googlebot', 'googlebot'],
  ['google-inspectiontool', 'googlebot'],
  ['bingbot', 'bingbot'],
  ['msnbot', 'bingbot'],
  ['gptbot', 'gptbot'],
  ['chatgpt-user', 'gptbot'],
  ['claudebot', 'claudebot'],
  ['anthropic-ai', 'claudebot'],
  ['perplexitybot', 'perplexitybot'],
  ['slurp', 'other'],
  ['duckduckbot', 'other'],
  ['baiduspider', 'other'],
  ['yandexbot', 'other'],
]

function detectBot(userAgent: string | undefined): BotName | null {
  if (!userAgent) return null
  const ua = userAgent.toLowerCase()
  for (const [pattern, name] of BOT_PATTERNS) {
    if (ua.includes(pattern)) return name
  }
  return null
}

// ---------------------------------------------------------------------------
// 1. Redirect Engine
// ---------------------------------------------------------------------------

/**
 * Check redirect rules via SeoPort BEFORE other middleware.
 * Returns early with a redirect response if a rule matches.
 */
export const edgeSeoRedirects: MiddlewareHandler<AppBindings> = async (c, next) => {
  const seo = c.get('seo')
  if (!seo) return next()

  const url = new URL(c.req.url)
  const tenant = c.get('tenant_slug') ?? undefined

  const rule = await seo.matchRedirect(url.pathname, tenant)
  if (rule) {
    const target = rule.toPath.startsWith('http')
      ? rule.toPath
      : `${url.origin}${rule.toPath}`
    return Response.redirect(target, rule.statusCode)
  }

  return next()
}

// ---------------------------------------------------------------------------
// 2. Crawl Logger (fire-and-forget)
// ---------------------------------------------------------------------------

/**
 * Detect bots and log crawl events without blocking the response.
 * Uses waitUntil to ensure the D1 write completes after the response is sent.
 */
export const edgeSeoCrawlLogger: MiddlewareHandler<AppBindings> = async (c, next) => {
  const userAgent = c.req.header('User-Agent')
  const botName = detectBot(userAgent)

  if (botName) {
    const seo = c.get('seo')
    if (seo) {
      const url = new URL(c.req.url)
      const tenant = c.get('tenant_slug') ?? undefined

      // Fire-and-forget: use waitUntil so the log write does not add latency.
      // executionCtx.waitUntil is the Cloudflare-standard way to defer work.
      const logPromise = seo.logCrawl({
        path: url.pathname,
        userAgent: userAgent ?? '',
        botName,
        statusCode: 200, // will be the response status — logged pre-handler for speed
        tenant,
        timestamp: new Date().toISOString(),
      })
      c.executionCtx.waitUntil(logPromise)
    }
  }

  return next()
}

// ---------------------------------------------------------------------------
// 3. Dynamic robots.txt
// ---------------------------------------------------------------------------

/** Pre-built robots.txt body — assembled once at module load from config. */
const ROBOTS_TXT = [
  'User-agent: *',
  'Allow: /',
  'Disallow: /api/',
  'Disallow: /dashboard/',
  '',
  'User-agent: GPTBot',
  'Allow: /',
  'Allow: /llms.txt',
  '',
  'User-agent: ChatGPT-User',
  'Allow: /',
  '',
  'User-agent: Google-Extended',
  'Allow: /',
  '',
  'User-agent: anthropic-ai',
  'Allow: /',
  '',
  'User-agent: ClaudeBot',
  'Allow: /',
  '',
  'User-agent: PerplexityBot',
  'Allow: /',
  '',
  `Sitemap: https://${config.domain}/sitemap.xml`,
  '',
].join('\n')

/**
 * Intercept GET /robots.txt and serve a config-driven response.
 * Mount this on the Hono app BEFORE the catch-all static handler.
 */
export const dynamicRobotsTxt: MiddlewareHandler<AppBindings> = async (c, next) => {
  const url = new URL(c.req.url)
  if (c.req.method === 'GET' && url.pathname === '/robots.txt') {
    return new Response(ROBOTS_TXT, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }

  return next()
}
