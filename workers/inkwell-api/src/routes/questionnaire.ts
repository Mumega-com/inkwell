import { Hono } from 'hono'
import type { AppBindings } from '../types'

export const questionnaireRoutes = new Hono<AppBindings>()

// ── Question Bank ────────────────────────────────────────────────────────────
// 30 questions rotating monthly (index 0-29)

const QUESTION_BANK: string[] = [
  // Week 1 — Revenue & Pipeline (1-5)
  'How many new quote requests came in this week?',
  "What's your biggest pending deal right now? What's blocking it?",
  'Did any customer pay this week? How much?',
  "What's your target revenue this month? Are you on track?",
  'Which route (country or province) is getting the most inquiries?',

  // Week 2 — Operations & Delivery (6-10)
  "Any shipments delayed right now? What's the reason?",
  'How many vehicles or loads are at the warehouse waiting to ship?',
  'Any customer complaints this week? What happened?',
  'Is your warehouse capacity tight or comfortable right now?',
  'Any new carrier or partner relationships worth exploring?',

  // Week 3 — Marketing & Growth (11-15)
  'Where did your best lead come from this week?',
  'What question do customers ask you most?',
  'Any community events or groups worth joining this month?',
  'What does your best competitor do better than you?',
  'If you could reach 100 people today, what would you tell them?',

  // Week 4 — Strategy & Reflection (16-20)
  "What's the one thing that would double your business?",
  "What service do customers ask for that you don't offer yet?",
  'If a new customer called right now, how fast would you respond?',
  "What's your busiest month? Are you preparing for it?",
  'What did you learn this week that surprised you?',

  // Additional rotating questions (21-30)
  'What seasonal shift is coming up in the next 60 days?',
  'Is there a customer you should call back but haven\'t? What\'s stopping you?',
  'Are your prices still right for today\'s costs? When did you last review them?',
  'Do you have a team member who is underutilized? What could they take on?',
  'What technology or tool is wasting your time right now?',
  'What\'s the most common reason a quote doesn\'t convert to a booking?',
  'Name one thing customers have praised you for recently.',
  'What would you do differently if you were starting your business today?',
  'How is your cash flow this month — healthy, tight, or uncertain?',
  'What\'s one partnership or referral source you haven\'t tapped yet?',
]

// ── Types ────────────────────────────────────────────────────────────────────

interface QuestionnaireRow {
  id: string
  question_index: number
  question_text: string
  answer: string | null
  answered_at: string | null
  sent_at: string
  channel: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function getTodayQuestionIndex(): number {
  // Rotate through 30 questions by day-of-year mod 30
  const now = new Date()
  const start = new Date(now.getUTCFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  const dayOfYear = Math.floor(diff / 86400000)
  return dayOfYear % QUESTION_BANK.length
}

async function sendSms(env: AppBindings['Bindings'], to: string, body: string): Promise<void> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) return

  await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: env.TWILIO_FROM_NUMBER,
        To: to,
        Body: body,
      }),
    }
  )
}

async function sendTelegram(env: AppBindings['Bindings'], text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return

  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'Markdown',
    }),
  })
}

async function pushToMirror(env: AppBindings['Bindings'], question: string, answer: string): Promise<void> {
  if (!env.SOS_BUS_URL) return

  try {
    await fetch(`${env.SOS_BUS_URL}/remember`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.INKWELL_MCP_TOKEN ?? ''}`,
      },
      body: JSON.stringify({
        content: `Business owner answered daily questionnaire.\nQ: ${question}\nA: ${answer}`,
        tags: ['questionnaire', 'business-intelligence'],
        source: 'inkwell-questionnaire',
      }),
    })
  } catch {
    // Mirror is non-critical — don't fail if bus is down
  }
}

// ── POST /api/questionnaire/send ─────────────────────────────────────────────
// Sends today's question via SMS or Telegram, stores in D1

questionnaireRoutes.post('/send', async (c) => {
  const questionIndex = getTodayQuestionIndex()
  const questionText = QUESTION_BANK[questionIndex]
  const now = new Date().toISOString()
  const id = generateId()

  // Determine channel from request body or default to sms
  let body: Record<string, unknown> = {}
  try {
    body = await c.req.json() as Record<string, unknown>
  } catch {
    // body is optional
  }

  const channel = (typeof body.channel === 'string' && ['sms', 'telegram'].includes(body.channel))
    ? body.channel
    : 'sms'

  const phoneOverride = typeof body.phone === 'string' ? body.phone : null
  const businessName = c.env.BUSINESS_NAME || 'Business'
  const smsMessage = `${businessName} Daily Check-In:\n\n${questionText}\n\nReply to this message with your answer.`

  // Send via chosen channel
  if (channel === 'telegram') {
    await sendTelegram(
      c.env,
      `*${businessName} Daily Check-In*\n\n_${questionText}_\n\nReply with your answer.`
    )
  } else {
    const toNumber = phoneOverride ?? c.env.TWILIO_FROM_NUMBER // fallback for manual sends
    if (toNumber) {
      await sendSms(c.env, toNumber, smsMessage)
    }
  }

  // Store question in D1
  await c.env.DB_CORE.prepare(
    `INSERT INTO questionnaire_responses (id, question_index, question_text, sent_at, channel)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, questionIndex, questionText, now, channel).run()

  return c.json({
    ok: true,
    id,
    question_index: questionIndex,
    question_text: questionText,
    channel,
    sent_at: now,
  })
})

// ── POST /api/questionnaire/answer ───────────────────────────────────────────
// Receives an answer (from SMS webhook or Telegram), stores in D1 + Mirror

questionnaireRoutes.post('/answer', async (c) => {
  let body: Record<string, unknown> = {}
  try {
    body = await c.req.json() as Record<string, unknown>
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  const answer = typeof body.answer === 'string' ? body.answer.trim() : null
  if (!answer) return c.json({ error: 'answer required' }, 400)

  const now = new Date().toISOString()

  // Find the most recent unanswered question
  const pending = await c.env.DB_CORE.prepare(
    `SELECT id, question_index, question_text FROM questionnaire_responses
     WHERE answer IS NULL
     ORDER BY sent_at DESC
     LIMIT 1`
  ).first<{ id: string; question_index: number; question_text: string }>()

  if (!pending) {
    // No pending question — store as a new answer with the current question index
    const questionIndex = getTodayQuestionIndex()
    const questionText = QUESTION_BANK[questionIndex]
    const id = generateId()

    await c.env.DB_CORE.prepare(
      `INSERT INTO questionnaire_responses (id, question_index, question_text, answer, answered_at, sent_at, channel)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, questionIndex, questionText, answer, now, now, 'manual').run()

    await pushToMirror(c.env, questionText, answer)

    return c.json({ ok: true, id, question_text: questionText, answer })
  }

  // Update the pending row
  await c.env.DB_CORE.prepare(
    `UPDATE questionnaire_responses SET answer = ?, answered_at = ? WHERE id = ?`
  ).bind(answer, now, pending.id).run()

  // Push to Mirror (SOS bus) as an engram
  await pushToMirror(c.env, pending.question_text, answer)

  return c.json({
    ok: true,
    id: pending.id,
    question_text: pending.question_text,
    answer,
    answered_at: now,
  })
})

// ── GET /api/questionnaire/history ───────────────────────────────────────────
// Returns recent questions and answers for dashboard display

questionnaireRoutes.get('/history', async (c) => {
  const limitParam = c.req.query('limit')
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 30, 100) : 30

  const rows = await c.env.DB_CORE.prepare(
    `SELECT id, question_index, question_text, answer, answered_at, sent_at, channel
     FROM questionnaire_responses
     ORDER BY sent_at DESC
     LIMIT ?`
  ).bind(limit).all<QuestionnaireRow>()

  const total = await c.env.DB_CORE.prepare(
    'SELECT COUNT(*) as count FROM questionnaire_responses'
  ).first<{ count: number }>()

  const answered = await c.env.DB_CORE.prepare(
    'SELECT COUNT(*) as count FROM questionnaire_responses WHERE answer IS NOT NULL'
  ).first<{ count: number }>()

  return c.json({
    history: rows.results,
    meta: {
      total: total?.count ?? 0,
      answered: answered?.count ?? 0,
      pending: (total?.count ?? 0) - (answered?.count ?? 0),
    },
  })
})

// ── GET /api/questionnaire/today ─────────────────────────────────────────────
// Returns today's question (without sending it)

questionnaireRoutes.get('/today', async (c) => {
  const questionIndex = getTodayQuestionIndex()
  const questionText = QUESTION_BANK[questionIndex]

  const existing = await c.env.DB_CORE.prepare(
    `SELECT id, answer, answered_at, sent_at FROM questionnaire_responses
     WHERE question_index = ?
     ORDER BY sent_at DESC
     LIMIT 1`
  ).bind(questionIndex).first<{ id: string; answer: string | null; answered_at: string | null; sent_at: string }>()

  return c.json({
    question_index: questionIndex,
    question_text: questionText,
    already_sent: !!existing,
    answered: existing?.answer != null,
    answer: existing?.answer ?? null,
    answered_at: existing?.answered_at ?? null,
  })
})
