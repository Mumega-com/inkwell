import { Hono } from 'hono'
import type { AppBindings } from '../types'

export const chatRoutes = new Hono<AppBindings>()

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: string
  content: string
}

interface ChatRequestBody {
  message: string
  reference?: string
  history?: ChatMessage[]
}

interface ContractRow {
  reference: string
  status: string
  customer_name: string
  origin: string | null
  destination: string | null
  vehicle_description: string | null
  service_type: string | null
  rate: number | null
  currency: string | null
  insurance_type: string | null
}

interface MilestoneRow {
  step: number
  label: string
  status: string
  completed_at: string | null
}

// ── FAQ fallback ──────────────────────────────────────────────────────────────

function buildFallbackReply(message: string, contract: ContractRow | null, milestones: MilestoneRow[]): string {
  const lower = message.toLowerCase()

  // Tracking / status
  if (/track|where is|status|location|update/.test(lower)) {
    if (contract) {
      const done = milestones.filter((m) => m.status === 'completed')
      const pending = milestones.find((m) => m.status === 'pending' || m.status === 'in_progress')
      const lastDone = done[done.length - 1]
      let reply = `Your vehicle (${contract.vehicle_description ?? 'shipment'}) is currently **${contract.status}**.`
      if (lastDone) {
        reply += ` Last update: ${lastDone.label}`
        if (lastDone.completed_at) reply += ` on ${new Date(lastDone.completed_at).toLocaleDateString('en-CA')}`
        reply += '.'
      }
      if (pending) {
        reply += ` Next step: ${pending.label}.`
      }
      return reply
    }
    return "To track your shipment, please provide your contract reference number (e.g. VM-2025-0101-123) and I'll pull up your status right away."
  }

  // Quote / pricing
  if (/quote|price|cost|rate|how much|fee/.test(lower)) {
    if (contract?.rate) {
      return `Your contract rate is **${contract.currency ?? 'CAD'} ${contract.rate.toFixed(2)}** for ${contract.service_type ?? 'standard service'}. For a new quote on a different route, call 1-800-277-7570 or email us and we'll respond within 2 hours.`
    }
    return "Our rates depend on route, vehicle size, and service level. For a fast quote: call **1-800-277-7570** or reply with your origin city, destination, and vehicle type and I'll get you a number."
  }

  // Documents
  if (/document|what do i need|paperwork|title|ownership|id/.test(lower)) {
    return `Here's the standard document checklist:

• **Vehicle title / proof of ownership**
• **Government-issued photo ID** (driver, passport)
• **Bill of sale** (if recently purchased)
• **Customs form B3** (cross-border shipments)
• **Insurance certificate** (for the transport period)

If you're shipping to the US, you'll also need the EPA/DOT compliance form. Need help with any of these? Just ask.`
  }

  // Insurance
  if (/insur/.test(lower)) {
    return `We offer three insurance options:

1. **Basic Carrier Liability** — included at no extra cost; covers up to $0.60/lb
2. **Declared Value Coverage** — you declare the vehicle value; premiums ~1.2% of declared value
3. **Full Comprehensive** — door-to-door coverage including mechanical and weather damage; ~2.5% of value

Most customers choose option 2 or 3. Want me to calculate a cost for your vehicle?`
  }

  // Transit time
  if (/how long|transit|time|days|week|delivery|arrive|eta/.test(lower)) {
    return `Typical transit times from major Canadian hubs:

• **Toronto → Vancouver**: 7–10 business days
• **Toronto → Calgary**: 5–7 business days
• **Toronto → Halifax**: 4–6 business days
• **Any Canadian city → USA**: add 2–4 days for customs clearance
• **Canada → Europe**: 18–25 days (via container)

Door-to-door pickup adds 1–2 days to these estimates. Need a more specific ETA? Share your route and I'll check live availability.`
  }

  // Default
  return "I'll connect you with our team right away. Call **1-800-277-7570** (Mon–Fri 8am–6pm ET) or leave your question here and we'll follow up within 2 hours."
}

// ── Route ─────────────────────────────────────────────────────────────────────

chatRoutes.post('/', async (c) => {
  let body: ChatRequestBody
  try {
    body = await c.req.json<ChatRequestBody>()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  const { message, reference, history = [] } = body

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return c.json({ error: 'message required' }, 400)
  }

  const trimmedMessage = message.trim().slice(0, 2000)

  // ── Load contract context if reference provided ────────────────────────────
  let contract: ContractRow | null = null
  let milestones: MilestoneRow[] = []

  if (reference && typeof reference === 'string' && /^VM-\d{4}-\d{4}-\d{3}$/.test(reference)) {
    try {
      const row = await c.env.DB_CORE.prepare(
        `SELECT reference, status, customer_name, origin, destination,
                vehicle_description, service_type, rate, currency, insurance_type
         FROM contracts WHERE reference = ? LIMIT 1`
      ).bind(reference).first<ContractRow>()

      if (row) {
        contract = row

        const msResult = await c.env.DB_CORE.prepare(
          `SELECT step, label, status, completed_at FROM milestones
           WHERE contract_id = (SELECT id FROM contracts WHERE reference = ? LIMIT 1)
           ORDER BY step ASC`
        ).bind(reference).all<MilestoneRow>()

        milestones = msResult.results
      }
    } catch {
      // DB unavailable or table missing — fall through to FAQ
    }
  }

  // ── Forward to SOS agent bus if configured ────────────────────────────────
  if (c.env.SOS_BUS_URL) {
    try {
      const contextLines: string[] = []
      if (contract) {
        contextLines.push(`Contract: ${contract.reference} (${contract.status})`)
        contextLines.push(`Customer: ${contract.customer_name}`)
        if (contract.origin && contract.destination) {
          contextLines.push(`Route: ${contract.origin} → ${contract.destination}`)
        }
        if (contract.vehicle_description) contextLines.push(`Vehicle: ${contract.vehicle_description}`)
        if (milestones.length > 0) {
          const latest = milestones.filter((m) => m.status === 'completed').slice(-1)[0]
          if (latest) contextLines.push(`Last milestone: ${latest.label}`)
        }
      }

      const systemContext = contextLines.length > 0
        ? `You are Viamar Assistant, a helpful shipping assistant. Context:\n${contextLines.join('\n')}`
        : 'You are Viamar Assistant, a helpful vehicle shipping assistant for Viamar Canada.'

      const busRes = await fetch(`${c.env.SOS_BUS_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: systemContext,
          message: trimmedMessage,
          history: history.slice(-20),
        }),
        // Worker timeout is max 30s; give bus 25s
        signal: AbortSignal.timeout(25_000),
      })

      if (busRes.ok) {
        // Response.json() returns unknown in DOM lib — cast after parse
        const busData = await busRes.json() as { reply?: string; message?: string }
        const reply = busData.reply ?? busData.message ?? buildFallbackReply(trimmedMessage, contract, milestones)
        return c.json({ reply, timestamp: new Date().toISOString() })
      }
    } catch {
      // Bus unreachable — fall through to FAQ
    }
  }

  // ── FAQ fallback ──────────────────────────────────────────────────────────
  const reply = buildFallbackReply(trimmedMessage, contract, milestones)
  return c.json({ reply, timestamp: new Date().toISOString() })
})
