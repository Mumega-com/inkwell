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

async function handleApprove(env: AppBindings['Bindings'], draftId: string): Promise<string> {
  if (!draftId || !/^[\w-]{1,64}$/.test(draftId)) {
    return '⚠️ Invalid draft ID. Usage: `/approve {id}`'
  }

  const result = await env.DB_CORE.prepare(
    `UPDATE content_drafts SET status = 'approved', approved_at = datetime('now') WHERE id = ? AND status = 'pending'`
  ).bind(draftId).run()

  if (result.meta.changes === 0) {
    return `⚠️ Draft \`${draftId}\` not found or already approved.`
  }

  return `✅ Draft \`${draftId}\` approved.`
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
    '`/status` — KPI summary (clicks, leads, spend)',
    '`/report` — Weekly report (last 7 days)',
    '`/approve {id}` — Approve a content draft',
    '`/leads` — Recent leads',
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
      case 'status':
        reply = await handleStatus(c.env)
        break
      case 'report':
        reply = await handleReport(c.env)
        break
      case 'approve':
        reply = await handleApprove(c.env, args)
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
