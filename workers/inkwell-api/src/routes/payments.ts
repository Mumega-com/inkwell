import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import type { AppBindings } from '../types'

type Plan = 'seo' | 'seo-ads' | 'full'

interface CreateCheckoutBody {
  plan: Plan
  email: string
  customerName?: string
}

interface StripeSession {
  id?: string
  url?: string
  error?: { message: string }
}

interface StripeSubscription {
  id: string
  status: string
  current_period_end: number
  cancel_at_period_end: boolean
  items: {
    data: Array<{
      price: {
        id: string
        nickname: string | null
        product: string
      }
    }>
  }
}

interface StripeEvent {
  type: string
  data: {
    object: Record<string, unknown>
  }
}

const VALID_PLANS = new Set<Plan>(['seo', 'seo-ads', 'full'])

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function getPriceId(env: AppBindings['Bindings'], plan: Plan): string | undefined {
  switch (plan) {
    case 'seo': return env.STRIPE_PRICE_SEO
    case 'seo-ads': return env.STRIPE_PRICE_SEO_ADS
    case 'full': return env.STRIPE_PRICE_FULL
  }
}

function getPlanFromPriceId(env: AppBindings['Bindings'], priceId: string): Plan | null {
  if (priceId === env.STRIPE_PRICE_SEO) return 'seo'
  if (priceId === env.STRIPE_PRICE_SEO_ADS) return 'seo-ads'
  if (priceId === env.STRIPE_PRICE_FULL) return 'full'
  return null
}

async function stripeGet(secretKey: string, path: string): Promise<Response> {
  return fetch(`https://api.stripe.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  })
}

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  const parts: Record<string, string> = {}
  for (const part of sigHeader.split(',')) {
    const [k, v] = part.split('=')
    if (k && v) parts[k] = v
  }

  const timestamp = parts['t']
  const signature = parts['v1']

  if (!timestamp || !signature) return false

  // Reject old timestamps (5 min tolerance)
  const ts = Number.parseInt(timestamp, 10)
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false

  const signedPayload = `${timestamp}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
  const computed = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('')

  // Constant-time comparison
  if (computed.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return diff === 0
}

const paymentRoutes = new Hono<AppBindings>()

// POST /api/payments/create-checkout
paymentRoutes.post('/create-checkout', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, error: 'invalid_json' }, 400)
  }

  if (!body || typeof body !== 'object') {
    return c.json({ success: false, error: 'invalid_body' }, 400)
  }

  const payload = body as Record<string, unknown>
  const plan = payload.plan
  const email = payload.email
  const customerName = payload.customerName

  if (!isNonEmptyString(plan) || !VALID_PLANS.has(plan as Plan)) {
    return c.json({ success: false, error: 'invalid_plan', hint: 'Use seo, seo-ads, or full' }, 400)
  }

  if (!isNonEmptyString(email) || !email.includes('@')) {
    return c.json({ success: false, error: 'valid_email_required' }, 400)
  }

  const validPlan = plan as Plan
  const priceId = getPriceId(c.env, validPlan)
  if (!priceId) {
    console.error(`[payments] price ID not configured for plan: ${validPlan}`)
    return c.json({ success: false, error: 'plan_not_configured' }, 503)
  }

  if (!c.env.STRIPE_SECRET_KEY) {
    console.error('[payments] STRIPE_SECRET_KEY not configured')
    return c.json({ success: false, error: 'payment_not_configured' }, 503)
  }

  const siteUrl = c.env.SITE_URL ?? ''
  const params = new URLSearchParams()
  params.append('mode', 'subscription')
  params.append('payment_method_types[]', 'card')
  params.append('line_items[0][price]', priceId)
  params.append('line_items[0][quantity]', '1')
  params.append('customer_email', email.toLowerCase().trim())
  params.append('metadata[plan]', validPlan)
  if (isNonEmptyString(customerName)) {
    params.append('metadata[customerName]', customerName.trim().slice(0, 200))
  }
  params.append('success_url', `${siteUrl}/portal/welcome?session_id={CHECKOUT_SESSION_ID}`)
  params.append('cancel_url', `${siteUrl}/pricing`)
  params.append('allow_promotion_codes', 'true')

  let stripeRes: Response
  try {
    stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })
  } catch (err) {
    console.error('[payments] Stripe fetch failed:', err)
    return c.json({ success: false, error: 'payment_gateway_unreachable' }, 502)
  }

  const session = await stripeRes.json() as StripeSession

  if (!stripeRes.ok || session.error) {
    console.error('[payments] Stripe error:', session.error?.message)
    return c.json({ success: false, error: 'checkout_creation_failed' }, 502)
  }

  return c.json({ success: true, url: session.url })
})

// POST /api/payments/webhook
paymentRoutes.post('/webhook', async (c) => {
  const sig = c.req.header('stripe-signature')
  if (!sig) {
    return c.json({ error: 'missing_signature' }, 400)
  }

  if (!c.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[payments/webhook] STRIPE_WEBHOOK_SECRET not configured')
    return c.json({ error: 'webhook_not_configured' }, 503)
  }

  const rawBody = await c.req.text()

  const valid = await verifyStripeSignature(rawBody, sig, c.env.STRIPE_WEBHOOK_SECRET)
  if (!valid) {
    return c.json({ error: 'invalid_signature' }, 400)
  }

  let event: StripeEvent
  try {
    event = JSON.parse(rawBody) as StripeEvent
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as {
          id: string
          customer: string | null
          customer_email: string | null
          metadata: Record<string, string>
          subscription: string | null
        }

        const email = session.customer_email
        const plan = session.metadata?.plan as Plan | undefined
        const customerName = session.metadata?.customerName ?? null
        const now = new Date().toISOString()
        const id = crypto.randomUUID()

        await c.env.DB_CORE.prepare(
          `INSERT OR IGNORE INTO portal_accounts
           (id, customer_slug, full_name, email, status, metadata_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`
        ).bind(
          id,
          'inkwell',
          customerName,
          email ?? null,
          JSON.stringify({
            plan: plan ?? null,
            stripe_customer: session.customer,
            stripe_subscription: session.subscription,
            source: 'stripe_checkout',
          }),
          now,
          now,
        ).run()
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as {
          id: string
          customer: string
          status: string
        }

        await c.env.DB_CORE.prepare(
          `UPDATE portal_accounts
           SET metadata_json = json_set(COALESCE(metadata_json, '{}'), '$.subscription_status', ?, '$.updated_at', ?),
               updated_at = ?,
               status = CASE WHEN ? IN ('active', 'trialing') THEN 'active' ELSE 'inactive' END
           WHERE json_extract(metadata_json, '$.stripe_customer') = ?`
        ).bind(
          sub.status,
          new Date().toISOString(),
          new Date().toISOString(),
          sub.status,
          sub.customer,
        ).run()
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as {
          id: string
          customer: string
        }

        await c.env.DB_CORE.prepare(
          `UPDATE portal_accounts
           SET status = 'inactive',
               metadata_json = json_set(COALESCE(metadata_json, '{}'), '$.subscription_status', 'canceled', '$.canceled_at', ?),
               updated_at = ?
           WHERE json_extract(metadata_json, '$.stripe_customer') = ?`
        ).bind(
          new Date().toISOString(),
          new Date().toISOString(),
          sub.customer,
        ).run()
        break
      }

      default:
        // Unhandled event — return 200 to avoid Stripe retries
        break
    }
  } catch (err) {
    console.error(`[payments/webhook] Handler failed for ${event.type}:`, err)
    // Still return 200 — don't let Stripe retry on DB errors
  }

  return c.json({ received: true })
})

// GET /api/payments/subscription-status
paymentRoutes.get('/subscription-status', requireAuth, async (c) => {
  const session = c.get('authSession')
  if (!session?.portalAccountId) {
    return c.json({ error: 'no_portal_account' }, 404)
  }

  const account = await c.env.DB_CORE.prepare(
    `SELECT status, metadata_json FROM portal_accounts WHERE id = ? LIMIT 1`
  ).bind(session.portalAccountId).first<{ status: string; metadata_json: string | null }>()

  if (!account) {
    return c.json({ error: 'account_not_found' }, 404)
  }

  let metadata: Record<string, unknown> = {}
  if (account.metadata_json) {
    try {
      metadata = JSON.parse(account.metadata_json) as Record<string, unknown>
    } catch {
      // ignore parse failure
    }
  }

  const stripeSubscriptionId = typeof metadata.stripe_subscription === 'string'
    ? metadata.stripe_subscription
    : null

  if (!stripeSubscriptionId || !c.env.STRIPE_SECRET_KEY) {
    return c.json({
      plan: metadata.plan ?? null,
      status: account.status,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    })
  }

  // Fetch live subscription data from Stripe
  let currentPeriodEnd: string | null = null
  let cancelAtPeriodEnd = false
  let livePlan: Plan | string | null = typeof metadata.plan === 'string' ? metadata.plan : null

  try {
    const stripeRes = await stripeGet(c.env.STRIPE_SECRET_KEY, `/subscriptions/${stripeSubscriptionId}`)
    if (stripeRes.ok) {
      const sub = await stripeRes.json() as StripeSubscription
      currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString()
      cancelAtPeriodEnd = sub.cancel_at_period_end

      const priceId = sub.items.data[0]?.price?.id
      if (priceId) {
        livePlan = getPlanFromPriceId(c.env, priceId) ?? livePlan
      }
    }
  } catch (err) {
    console.error('[payments/subscription-status] Stripe fetch failed:', err)
    // Return cached data on Stripe failure
  }

  return c.json({
    plan: livePlan,
    status: account.status,
    currentPeriodEnd,
    cancelAtPeriodEnd,
  })
})

export { paymentRoutes }
