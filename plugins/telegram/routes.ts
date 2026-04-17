import { Hono } from 'hono'
import type { AppBindings } from '../types'

const telegramRoutes = new Hono<AppBindings>()

// ── Telegram types ──────────────────────────────────────────────────────────

interface TelegramUser {
  id: number
  first_name: string
  username?: string
}

interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: { id: number; type: string }
  text?: string
  date: number
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function tgApiUrl(token: string, method: string): string {
  return `https://api.telegram.org/bot${token}/${method}`
}

async function sendMessage(token: string, chatId: number, text: string, parseMode = 'Markdown'): Promise<void> {
  await fetch(tgApiUrl(token, 'sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    }),
  })
}

function isValidUpdate(update: unknown): update is TelegramUpdate {
  if (!update || typeof update !== 'object') return false
  const u = update as Record<string, unknown>
  if (typeof u.update_id !== 'number') return false
  if (u.message !== undefined) {
    const m = u.message as Record<string, unknown>
    if (!m.chat || typeof (m.chat as Record<string, unknown>).id !== 'number') return false
    if (typeof m.message_id !== 'number') return false
  }
  return true
}

// ── Rate limiting ────────────────────────────────────────────────────────────
// Max 1 response per second per chat_id using KV with 1s TTL

async function isRateLimited(env: AppBindings['Bindings'], chatId: number): Promise<boolean> {
  const key = `tg:rl:${chatId}`
  const existing = await env.SESSIONS.get(key)
  if (existing !== null) return true
  await env.SESSIONS.put(key, '1', { expirationTtl: 1 })
  return false
}

// ── Command handlers ─────────────────────────────────────────────────────────

async function handleStatus(env: AppBindings['Bindings']): Promise<string> {
  // Total views in last 7 days
  const viewsRow = await env.DB_ANALYTICS.prepare(
    `SELECT COALESCE(SUM(page_views), 0) AS total_views
     FROM analytics_snapshots
     WHERE date >= date('now', '-7 days')`
  ).first<{ total_views: number }>()

  const totalViews = viewsRow?.total_views ?? 0

  // Top 3 posts by views
  const topPosts = await env.DB_ANALYTICS.prepare(
    `SELECT path, SUM(page_views) AS views
     FROM analytics_snapshots
     WHERE date >= date('now', '-7 days') AND path IS NOT NULL
     GROUP BY path
     ORDER BY views DESC
     LIMIT 3`
  ).all<{ path: string; views: number }>()

  // Subscriber count from core DB
  let subscriberCount = 0
  try {
    const subRow = await env.DB_CORE.prepare(
      `SELECT COUNT(*) AS count FROM subscribers WHERE status = 'active'`
    ).first<{ count: number }>()
    subscriberCount = subRow?.count ?? 0
  } catch {
    // subscribers table may not exist yet
  }

  const lines = [
    '*📊 Site Stats — Last 7 Days*',
    '',
    `👁 Total views: *${totalViews.toLocaleString()}*`,
    `📬 Subscribers: *${subscriberCount.toLocaleString()}*`,
  ]

  if (topPosts.results.length > 0) {
    lines.push('')
    lines.push('*Top posts:*')
    for (const p of topPosts.results) {
      lines.push(`  • ${p.path} — *${p.views}* views`)
    }
  }

  return lines.join('\n')
}

async function handleKpi(env: AppBindings['Bindings']): Promise<string> {
  const row = await env.DB_MARKETING.prepare(
    `SELECT
       SUM(clicks) AS total_clicks,
       SUM(leads)  AS total_leads,
       SUM(spend)  AS total_spend
     FROM marketing_snapshots
     WHERE date >= date('now', '-30 days')`
  ).first<{ total_clicks: number | null; total_leads: number | null; total_spend: number | null }>()

  const clicks = row?.total_clicks ?? 0
  const leads = row?.total_leads ?? 0
  const spend = row?.total_spend ?? 0

  return [
    '*📊 KPI Summary — Last 30 Days*',
    '',
    `🖱 Clicks: *${clicks.toLocaleString()}*`,
    `🎯 Leads: *${leads.toLocaleString()}*`,
    `💸 Spend: *$${Number(spend).toFixed(2)}*`,
    `📈 CPL: *${leads > 0 ? `$${(spend / leads).toFixed(2)}` : 'N/A'}*`,
  ].join('\n')
}

async function handleReport(env: AppBindings['Bindings']): Promise<string> {
  const rows = await env.DB_MARKETING.prepare(
    `SELECT date, clicks, leads, spend
     FROM marketing_snapshots
     WHERE date >= date('now', '-7 days')
     ORDER BY date DESC`
  ).all<{ date: string; clicks: number; leads: number; spend: number }>()

  if (rows.results.length === 0) {
    return '_No data for the last 7 days._'
  }

  const lines = ['*📅 Weekly Report — Last 7 Days*', '']
  for (const r of rows.results) {
    lines.push(
      `*${r.date}*: ${r.clicks} clicks · ${r.leads} leads · $${Number(r.spend).toFixed(2)}`
    )
  }

  type Totals = { clicks: number; leads: number; spend: number }
  const totals = rows.results.reduce<Totals>(
    (acc: Totals, r: { date: string; clicks: number; leads: number; spend: number }) => ({
      clicks: acc.clicks + r.clicks,
      leads: acc.leads + r.leads,
      spend: acc.spend + r.spend,
    }),
    { clicks: 0, leads: 0, spend: 0 }
  )
  lines.push('')
  lines.push(`*Totals:* ${totals.clicks} clicks · ${totals.leads} leads · $${totals.spend.toFixed(2)}`)

  return lines.join('\n')
}

async function handleDrafts(env: AppBindings['Bindings']): Promise<string> {
  const listed = await env.CONTENT.list({ prefix: 'draft:' })

  if (listed.keys.length === 0) {
    return 'No pending drafts.'
  }

  const lines: string[] = ['*📝 Pending Drafts*', '']
  let idx = 1

  for (const key of listed.keys) {
    const slug = key.name.replace('draft:', '')
    const metaRaw = await env.CONTENT.get(`meta:draft:${slug}`)
    let title = slug
    let author = 'unknown'
    let date = ''

    if (metaRaw) {
      try {
        const meta = JSON.parse(metaRaw) as { title?: string; author?: string; date?: string }
        title = meta.title ?? slug
        author = meta.author ?? 'unknown'
        date = meta.date ? ` — ${meta.date}` : ''
      } catch {
        // metadata parse failed, use defaults
      }
    }

    lines.push(`${idx}. *${title}* by ${author}${date}`)
    lines.push(`   \`/approve ${slug}\` · \`/reject ${slug}\``)
    idx++
  }

  return lines.join('\n')
}

async function handleApprove(env: AppBindings['Bindings'], slug: string): Promise<string> {
  if (!slug || !/^[\w-]{1,128}$/.test(slug)) {
    return '⚠️ Invalid slug. Usage: `/approve {slug}`'
  }

  // Fetch draft content from KV
  const content = await env.CONTENT.get(`draft:${slug}`)
  if (!content) {
    return `⚠️ Draft \`${slug}\` not found.`
  }

  const metaRaw = await env.CONTENT.get(`meta:draft:${slug}`)
  let title = slug
  let meta: Record<string, unknown> = {}

  if (metaRaw) {
    try {
      meta = JSON.parse(metaRaw) as Record<string, unknown>
      title = (meta.title as string) ?? slug
    } catch {
      // metadata parse failed
    }
  }

  // Move content: draft → published post
  await env.CONTENT.put(`post:${slug}`, content)
  await env.CONTENT.put(`meta:post:${slug}`, JSON.stringify({
    ...meta,
    status: 'published',
    published_at: new Date().toISOString(),
  }))

  // Update content_index in D1 if row exists
  try {
    await env.DB_CORE.prepare(
      `UPDATE content_index SET status = 'published', published_at = datetime('now') WHERE slug = ?`
    ).bind(slug).run()
  } catch {
    // D1 update is best-effort — KV is source of truth
  }

  // Remove draft keys
  await env.CONTENT.delete(`draft:${slug}`)
  await env.CONTENT.delete(`meta:draft:${slug}`)

  // Trigger CF Pages deploy hook if configured
  if (env.CF_PAGES_DEPLOY_HOOK) {
    try {
      await fetch(env.CF_PAGES_DEPLOY_HOOK, { method: 'POST' })
    } catch {
      // deploy hook is best-effort
    }
  }

  const siteUrl = env.SITE_URL?.replace(/\/$/, '') ?? ''
  const url = siteUrl ? `${siteUrl}/blog/${slug}` : slug

  return `✅ Published: *${title}* — ${url}`
}

async function handleReject(env: AppBindings['Bindings'], slug: string): Promise<string> {
  if (!slug || !/^[\w-]{1,128}$/.test(slug)) {
    return '⚠️ Invalid slug. Usage: `/reject {slug}`'
  }

  const content = await env.CONTENT.get(`draft:${slug}`)
  if (!content) {
    return `⚠️ Draft \`${slug}\` not found.`
  }

  await env.CONTENT.delete(`draft:${slug}`)
  await env.CONTENT.delete(`meta:draft:${slug}`)

  return `🗑 Rejected: \`${slug}\``
}

async function handleLeads(env: AppBindings['Bindings']): Promise<string> {
  const rows = await env.DB_MARKETING.prepare(
    `SELECT id, email, source, created_at
     FROM lead_events
     ORDER BY created_at DESC
     LIMIT 10`
  ).all<{ id: string; email: string; source: string; created_at: string }>()

  if (rows.results.length === 0) {
    return '_No recent leads found._'
  }

  const lines = ['*🎯 Recent Leads*', '']
  for (const r of rows.results) {
    const date = r.created_at.slice(0, 10)
    lines.push(`• ${r.email} — *${r.source}* (${date})`)
  }

  return lines.join('\n')
}

function handleHelp(): string {
  return [
    '*🤖 Inkwell Bot — Commands*',
    '',
    '*Content:*',
    '`/drafts` — List pending drafts',
    '`/approve {slug}` — Publish a draft',
    '`/reject {slug}` — Reject a draft',
    '',
    '*Analytics:*',
    '`/status` — Site stats (views, top posts, subscribers)',
    '`/kpi` — Marketing KPIs (clicks, leads, spend)',
    '`/report` — Weekly marketing report',
    '`/leads` — Recent leads',
    '',
    '`/help` — This message',
    '',
    '_Any other message is forwarded to the AI team._',
  ].join('\n')
}

async function forwardToSosBus(env: AppBindings['Bindings'], text: string, chatId: number): Promise<string> {
  if (!env.SOS_BUS_URL) {
    return "🤔 I didn't understand that command. Type `/help` to see what I can do."
  }

  try {
    const resp = await fetch(env.SOS_BUS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source: 'telegram', chat_id: chatId }),
    })

    if (!resp.ok) {
      return '⚠️ Could not reach the AI team right now. Try again shortly.'
    }

    const data = (await resp.json()) as { reply?: string }
    return data.reply ?? '✅ Forwarded to the AI team.'
  } catch {
    return '⚠️ Could not reach the AI team right now. Try again shortly.'
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

// POST /api/telegram/webhook — receives Telegram Bot API updates
telegramRoutes.post('/webhook', async (c) => {
  const token = c.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return c.json({ error: 'telegram not configured' }, 503)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  if (!isValidUpdate(body)) {
    return c.json({ error: 'invalid_update' }, 400)
  }

  const update = body
  const message = update.message
  if (!message?.text) {
    // Non-text updates (stickers, photos, etc.) — acknowledge silently
    return c.json({ ok: true })
  }

  const chatId = message.chat.id
  const text = message.text.trim()

  // Restrict to a specific chat if configured
  if (c.env.TELEGRAM_CHAT_ID && String(chatId) !== c.env.TELEGRAM_CHAT_ID) {
    return c.json({ ok: true })
  }

  // Rate limit: 1 response/sec per chat
  if (await isRateLimited(c.env, chatId)) {
    return c.json({ ok: true })
  }

  // Parse command
  const commandMatch = text.match(/^\/(\w+)(?:\s+(.+))?$/)

  let reply: string

  if (commandMatch) {
    const cmd = commandMatch[1].toLowerCase()
    const args = commandMatch[2]?.trim() ?? ''

    switch (cmd) {
      case 'drafts':
        reply = await handleDrafts(c.env)
        break
      case 'approve':
        reply = await handleApprove(c.env, args)
        break
      case 'reject':
        reply = await handleReject(c.env, args)
        break
      case 'status':
        reply = await handleStatus(c.env)
        break
      case 'kpi':
        reply = await handleKpi(c.env)
        break
      case 'report':
        reply = await handleReport(c.env)
        break
      case 'leads':
        reply = await handleLeads(c.env)
        break
      case 'help':
        reply = handleHelp()
        break
      default:
        reply = await forwardToSosBus(c.env, text, chatId)
    }
  } else {
    // Free-form text — forward to SOS bus
    reply = await forwardToSosBus(c.env, text, chatId)
  }

  await sendMessage(token, chatId, reply)

  return c.json({ ok: true })
})

// POST /api/telegram/setup — registers webhook URL with Telegram
telegramRoutes.post('/setup', async (c) => {
  const token = c.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return c.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, 503)
  }

  const siteUrl = c.env.SITE_URL?.replace(/\/$/, '')
  if (!siteUrl) {
    return c.json({ error: 'SITE_URL not configured' }, 503)
  }

  const webhookUrl = `${siteUrl}/api/telegram/webhook`

  const resp = await fetch(tgApiUrl(token, 'setWebhook'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
  })

  const data = (await resp.json()) as { ok: boolean; description?: string }

  if (!data.ok) {
    return c.json({ error: 'telegram_error', description: data.description }, 502)
  }

  return c.json({ ok: true, webhook_url: webhookUrl })
})

// GET /api/telegram/info — returns bot info (getMe)
telegramRoutes.get('/info', async (c) => {
  const token = c.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return c.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, 503)
  }

  const resp = await fetch(tgApiUrl(token, 'getMe'))
  const data = (await resp.json()) as { ok: boolean; result?: { id: number; first_name: string; username?: string } }

  if (!data.ok) {
    return c.json({ error: 'telegram_error' }, 502)
  }

  return c.json({ ok: true, bot: data.result })
})

export { telegramRoutes }
