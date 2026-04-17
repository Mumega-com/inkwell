import { Hono } from 'hono'
import type { AppBindings } from '../types'

export const contractRoutes = new Hono<AppBindings>()

// ── Helpers ─────────────────────────────────────────────────────────────────

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function generateId(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function generateReference(): string {
  const now = new Date()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const year = now.getUTCFullYear()
  const rnd = Math.floor(Math.random() * 900) + 100
  return `VM-${year}-${mm}${dd}-${rnd}`
}

type ContractRow = {
  id: string
  reference: string
  status: string
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  vehicle_description: string | null
  origin: string | null
  destination: string | null
  service_type: string | null
  rate: number | null
  currency: string | null
  payment_terms: string | null
  service_inclusions: string | null
  insurance_type: string | null
  insurance_rate: number | null
  insurance_cost: number | null
  signed_by: string | null
  signed_at: string | null
  signed_ip: string | null
  created_at: string
  sent_at: string | null
  viewed_at: string | null
  delivered_at: string | null
}

type MilestoneRow = {
  id: string
  contract_id: string
  step: number
  label: string
  status: string
  completed_at: string | null
  note: string | null
}

// Default milestones for a new contract
const DEFAULT_MILESTONES = [
  { step: 1, label: 'Contract Signed' },
  { step: 2, label: 'Documents Submitted' },
  { step: 3, label: 'Vehicle Pickup' },
  { step: 4, label: 'At Port / Warehouse' },
  { step: 5, label: 'Loaded on Vessel' },
  { step: 6, label: 'In Transit' },
  { step: 7, label: 'Arrived at Destination Port' },
  { step: 8, label: 'Customs Clearance' },
  { step: 9, label: 'Delivered' },
]

// ── POST /api/contracts/create ────────────────────────────────────────────

contractRoutes.post('/create', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  if (!body || typeof body !== 'object') {
    return c.json({ error: 'invalid_body' }, 400)
  }

  const p = body as Record<string, unknown>

  if (!isNonEmptyString(p.customer_name)) {
    return c.json({ error: 'customer_name required' }, 400)
  }

  const id = generateId()
  const reference = generateReference()
  const now = new Date().toISOString()

  const currency = isNonEmptyString(p.currency) ? p.currency : 'CAD'
  const validCurrencies = new Set(['CAD', 'USD'])
  if (!validCurrencies.has(currency)) {
    return c.json({ error: 'currency must be CAD or USD' }, 400)
  }

  const serviceType = isNonEmptyString(p.service_type) ? p.service_type.toLowerCase() : null
  const validServiceTypes = new Set(['shared', 'container', 'roro', 'domestic_moving'])
  if (serviceType && !validServiceTypes.has(serviceType)) {
    return c.json({ error: 'service_type must be shared, container, roro, or domestic_moving' }, 400)
  }

  const insuranceType = isNonEmptyString(p.insurance_type) ? p.insurance_type.toLowerCase() : null
  const validInsuranceTypes = new Set(['all_risk', 'total_loss', 'declined'])
  if (insuranceType && !validInsuranceTypes.has(insuranceType)) {
    return c.json({ error: 'insurance_type must be all_risk, total_loss, or declined' }, 400)
  }

  const rate = typeof p.rate === 'number' ? p.rate : (typeof p.rate === 'string' ? parseFloat(p.rate) : null)
  const insuranceRate = typeof p.insurance_rate === 'number' ? p.insurance_rate : (typeof p.insurance_rate === 'string' ? parseFloat(p.insurance_rate) : null)
  const insuranceCost = typeof p.insurance_cost === 'number' ? p.insurance_cost : (typeof p.insurance_cost === 'string' ? parseFloat(p.insurance_cost) : null)

  await c.env.DB_CORE.prepare(
    `INSERT INTO contracts (
      id, reference, status,
      customer_name, customer_email, customer_phone,
      vehicle_description, origin, destination, service_type,
      rate, currency, payment_terms, service_inclusions,
      insurance_type, insurance_rate, insurance_cost,
      created_at
    ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, reference,
    p.customer_name,
    isNonEmptyString(p.customer_email) ? p.customer_email : null,
    isNonEmptyString(p.customer_phone) ? p.customer_phone : null,
    isNonEmptyString(p.vehicle_description) ? p.vehicle_description : null,
    isNonEmptyString(p.origin) ? p.origin : null,
    isNonEmptyString(p.destination) ? p.destination : null,
    serviceType,
    rate ?? null,
    currency,
    isNonEmptyString(p.payment_terms) ? p.payment_terms : null,
    isNonEmptyString(p.service_inclusions) ? p.service_inclusions : null,
    insuranceType,
    insuranceRate ?? null,
    insuranceCost ?? null,
    now,
  ).run()

  // Seed default milestones
  const stmts = DEFAULT_MILESTONES.map((m) =>
    c.env.DB_CORE.prepare(
      'INSERT INTO contract_milestones (id, contract_id, step, label, status) VALUES (?, ?, ?, ?, ?)'
    ).bind(generateId(), id, m.step, m.label, 'pending')
  )
  await c.env.DB_CORE.batch(stmts)

  const siteUrl = c.env.SITE_URL ?? ''
  const portalUrl = `${siteUrl}/portal/contract/${reference}`

  // Send SMS to customer if phone number provided
  const phone = isNonEmptyString(p.customer_phone) ? p.customer_phone : null
  if (phone && c.env.TWILIO_ACCOUNT_SID && c.env.TWILIO_AUTH_TOKEN && c.env.TWILIO_FROM_NUMBER) {
    const customerName = (p.customer_name as string).split(' ')[0]
    const businessName = c.env.BUSINESS_NAME || 'Your Business'
    const smsBody = `Hi ${customerName}, your shipping contract from ${businessName} is ready. Review and sign here: ${portalUrl}`
    try {
      await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${c.env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(c.env.TWILIO_ACCOUNT_SID + ':' + c.env.TWILIO_AUTH_TOKEN)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: c.env.TWILIO_FROM_NUMBER,
            To: phone,
            Body: smsBody,
          }),
        }
      )
    } catch { /* SMS is non-critical — don't fail the contract creation */ }
  }

  // Send email to customer if email provided
  const email = isNonEmptyString(p.customer_email) ? p.customer_email : null
  if (email && c.env.RESEND_API_KEY) {
    const customerName = (p.customer_name as string).split(' ')[0]
    const fromEmail = c.env.RESEND_FROM_EMAIL || `${c.env.BUSINESS_NAME || 'Inkwell'} <onboarding@resend.dev>`
    const dest = isNonEmptyString(p.destination) ? p.destination : 'your destination'
    const vehicle = isNonEmptyString(p.vehicle_description) ? p.vehicle_description : 'your vehicle'
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject: `Your ${c.env.BUSINESS_NAME || 'Shipping'} Contract — ${dest}`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <h2 style="color:#1a1a1a;">Your Shipping Contract is Ready</h2>
              <p>Hi ${customerName},</p>
              <p>Your contract for shipping <strong>${vehicle}</strong> to <strong>${dest}</strong> is ready for review.</p>
              <p style="margin:24px 0;">
                <a href="${portalUrl}" style="background:#D4A017;color:#000;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
                  Review & Sign Contract
                </a>
              </p>
              <p style="color:#666;font-size:14px;">This quote is valid for 30 days.</p>
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
              <p style="color:#999;font-size:12px;">
                ${c.env.BUSINESS_NAME || 'Your Business'}<br>
                ${c.env.BUSINESS_PHONE ? c.env.BUSINESS_PHONE + ' | ' : ''}${c.env.BUSINESS_EMAIL || ''}
              </p>
            </div>`,
        }),
      })
    } catch { /* Email is non-critical */ }
  }

  return c.json({ id, reference, portalUrl }, 201)
})

// ── GET /api/contracts/:reference ────────────────────────────────────────

contractRoutes.get('/:reference', async (c) => {
  const reference = c.req.param('reference')

  const contract = await c.env.DB_CORE.prepare(
    'SELECT * FROM contracts WHERE reference = ? LIMIT 1'
  ).bind(reference).first<ContractRow>()

  if (!contract) return c.json({ error: 'not_found' }, 404)

  // Mark as viewed if still in sent state
  if (contract.status === 'sent') {
    await c.env.DB_CORE.prepare(
      "UPDATE contracts SET status = 'viewed', viewed_at = ? WHERE id = ?"
    ).bind(new Date().toISOString(), contract.id).run()
    contract.status = 'viewed'
    contract.viewed_at = new Date().toISOString()
  }

  return c.json({ contract })
})

// ── POST /api/contracts/:reference/sign ──────────────────────────────────

contractRoutes.post('/:reference/sign', async (c) => {
  const reference = c.req.param('reference')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  if (!body || typeof body !== 'object') {
    return c.json({ error: 'invalid_body' }, 400)
  }

  const p = body as Record<string, unknown>
  if (!isNonEmptyString(p.signed_by)) {
    return c.json({ error: 'signed_by required' }, 400)
  }

  const contract = await c.env.DB_CORE.prepare(
    'SELECT id, status FROM contracts WHERE reference = ? LIMIT 1'
  ).bind(reference).first<{ id: string; status: string }>()

  if (!contract) return c.json({ error: 'not_found' }, 404)
  if (contract.status === 'signed') return c.json({ error: 'already_signed' }, 409)

  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown'
  const userAgent = c.req.header('user-agent') ?? 'unknown'
  const now = new Date().toISOString()

  // Hash IP for privacy
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(ip + reference))
  const ipHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)

  await c.env.DB_CORE.prepare(
    `UPDATE contracts SET
      status = 'signed',
      signed_by = ?,
      signed_at = ?,
      signed_ip = ?
    WHERE id = ?`
  ).bind(p.signed_by, now, `${ipHash}|ua:${userAgent.slice(0, 120)}`, contract.id).run()

  // Mark the "Contract Signed" milestone as completed
  await c.env.DB_CORE.prepare(
    "UPDATE contract_milestones SET status = 'completed', completed_at = ? WHERE contract_id = ? AND step = 1"
  ).bind(now, contract.id).run()

  const siteUrl = c.env.SITE_URL ?? ''
  const trackUrl = `${siteUrl}/portal/track/${reference}`

  return c.json({ ok: true, reference, signed_at: now, trackUrl })
})

// ── POST /api/contracts/:reference/insurance ─────────────────────────────

contractRoutes.post('/:reference/insurance', async (c) => {
  const reference = c.req.param('reference')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  if (!body || typeof body !== 'object') {
    return c.json({ error: 'invalid_body' }, 400)
  }

  const p = body as Record<string, unknown>
  const insuranceType = isNonEmptyString(p.insurance_type) ? p.insurance_type.toLowerCase() : null
  const validInsuranceTypes = new Set(['all_risk', 'total_loss', 'declined'])

  if (!insuranceType || !validInsuranceTypes.has(insuranceType)) {
    return c.json({ error: 'insurance_type must be all_risk, total_loss, or declined' }, 400)
  }

  const contract = await c.env.DB_CORE.prepare(
    'SELECT id, status FROM contracts WHERE reference = ? LIMIT 1'
  ).bind(reference).first<{ id: string; status: string }>()

  if (!contract) return c.json({ error: 'not_found' }, 404)
  if (contract.status === 'signed') return c.json({ error: 'contract_already_signed' }, 409)

  const insuranceRate = typeof p.insurance_rate === 'number' ? p.insurance_rate : null
  const insuranceCost = typeof p.insurance_cost === 'number' ? p.insurance_cost : null

  await c.env.DB_CORE.prepare(
    'UPDATE contracts SET insurance_type = ?, insurance_rate = ?, insurance_cost = ? WHERE id = ?'
  ).bind(insuranceType, insuranceRate, insuranceCost, contract.id).run()

  return c.json({ ok: true, insurance_type: insuranceType })
})

// ── GET /api/contracts/:reference/timeline ───────────────────────────────

contractRoutes.get('/:reference/timeline', async (c) => {
  const reference = c.req.param('reference')

  const contract = await c.env.DB_CORE.prepare(
    'SELECT id FROM contracts WHERE reference = ? LIMIT 1'
  ).bind(reference).first<{ id: string }>()

  if (!contract) return c.json({ error: 'not_found' }, 404)

  const milestones = await c.env.DB_CORE.prepare(
    'SELECT * FROM contract_milestones WHERE contract_id = ? ORDER BY step ASC'
  ).bind(contract.id).all<MilestoneRow>()

  return c.json({ milestones: milestones.results })
})

// ── POST /api/contracts/:reference/milestone ─────────────────────────────

contractRoutes.post('/:reference/milestone', async (c) => {
  // Auth check
  const authToken = c.env.CONTRACT_AUTH_TOKEN
  if (authToken) {
    const auth = c.req.header('Authorization')
    if (auth !== `Bearer ${authToken}`) {
      return c.json({ error: 'unauthorized' }, 401)
    }
  }

  const reference = c.req.param('reference')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  if (!body || typeof body !== 'object') {
    return c.json({ error: 'invalid_body' }, 400)
  }

  const p = body as Record<string, unknown>
  const step = typeof p.step === 'number' ? p.step : (typeof p.step === 'string' ? parseInt(p.step, 10) : null)
  if (!step || step < 1 || step > 9) {
    return c.json({ error: 'step must be 1-9' }, 400)
  }

  const validStatuses = new Set(['pending', 'active', 'completed'])
  const status = isNonEmptyString(p.status) ? p.status : 'completed'
  if (!validStatuses.has(status)) {
    return c.json({ error: 'status must be pending, active, or completed' }, 400)
  }

  const contract = await c.env.DB_CORE.prepare(
    'SELECT id FROM contracts WHERE reference = ? LIMIT 1'
  ).bind(reference).first<{ id: string }>()

  if (!contract) return c.json({ error: 'not_found' }, 404)

  const now = new Date().toISOString()
  const note = isNonEmptyString(p.note) ? p.note : null
  const completedAt = status === 'completed' ? now : null

  await c.env.DB_CORE.prepare(
    'UPDATE contract_milestones SET status = ?, completed_at = ?, note = ? WHERE contract_id = ? AND step = ?'
  ).bind(status, completedAt, note, contract.id, step).run()

  // If step 9 (Delivered) is completed, update contract status
  if (step === 9 && status === 'completed') {
    await c.env.DB_CORE.prepare(
      "UPDATE contracts SET status = 'delivered', delivered_at = ? WHERE id = ?"
    ).bind(now, contract.id).run()
  }

  return c.json({ ok: true, step, status })
})
