import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

export const paymentsMcpTools: McpToolDef[] = [
  {
    name: 'create_checkout',
    description: 'Create a Stripe checkout session for a subscription plan',
    inputSchema: {
      type: 'object',
      properties: {
        plan: { type: 'string', enum: ['seo', 'seo-ads', 'full'], description: 'Plan identifier' },
        email: { type: 'string', description: 'Customer email address' },
      },
      required: ['plan', 'email'],
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env

      const plan = typeof a.plan === 'string' ? a.plan : ''
      const email = typeof a.email === 'string' ? a.email.trim() : ''

      if (!['seo', 'seo-ads', 'full'].includes(plan)) return { error: 'invalid_plan' }
      if (!email || !email.includes('@')) return { error: 'valid_email_required' }
      if (!env.STRIPE_SECRET_KEY) return { error: 'stripe_not_configured' }

      const priceMap: Record<string, string | undefined> = {
        seo: env.STRIPE_PRICE_SEO,
        'seo-ads': env.STRIPE_PRICE_SEO_ADS,
        full: env.STRIPE_PRICE_FULL,
      }
      const priceId = priceMap[plan]
      if (!priceId) return { error: 'plan_not_configured' }

      const siteUrl = env.SITE_URL ?? ''
      const params = new URLSearchParams()
      params.append('mode', 'subscription')
      params.append('payment_method_types[]', 'card')
      params.append('line_items[0][price]', priceId)
      params.append('line_items[0][quantity]', '1')
      params.append('customer_email', email.toLowerCase())
      params.append('metadata[plan]', plan)
      params.append('success_url', `${siteUrl}/portal/welcome?session_id={CHECKOUT_SESSION_ID}`)
      params.append('cancel_url', `${siteUrl}/pricing`)
      params.append('allow_promotion_codes', 'true')

      try {
        const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
        })
        const data = await res.json() as { id?: string; url?: string; error?: { message: string } }
        if (!res.ok || data.error) return { error: 'checkout_failed', detail: data.error?.message }
        return { ok: true, url: data.url }
      } catch {
        return { error: 'stripe_unreachable' }
      }
    },
  },
  {
    name: 'subscription_status',
    description: 'Check the current subscription status',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (_a, rawEnv) => {
      const env = rawEnv as Env

      const account = await env.DB_CORE.prepare(
        `SELECT status, metadata_json
         FROM portal_accounts
         WHERE json_extract(metadata_json, '$.stripe_subscription') IS NOT NULL
         ORDER BY created_at DESC
         LIMIT 1`
      ).first<{ status: string; metadata_json: string | null }>()

      if (!account) {
        return { status: 'free', message: 'No active subscription.' }
      }

      let metadata: Record<string, unknown> = {}
      if (account.metadata_json) {
        try { metadata = JSON.parse(account.metadata_json) as Record<string, unknown> } catch { /* empty */ }
      }

      const stripeSubscriptionId = typeof metadata.stripe_subscription === 'string'
        ? metadata.stripe_subscription : null

      if (!stripeSubscriptionId || !env.STRIPE_SECRET_KEY) {
        return {
          plan: metadata.plan ?? null,
          status: account.status,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        }
      }

      try {
        const res = await fetch(`https://api.stripe.com/v1/subscriptions/${stripeSubscriptionId}`, {
          headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
        })

        if (!res.ok) {
          return { plan: metadata.plan ?? null, status: account.status, currentPeriodEnd: null, cancelAtPeriodEnd: false }
        }

        const sub = await res.json() as {
          status: string; current_period_end: number; cancel_at_period_end: boolean
          items: { data: Array<{ price: { id: string; nickname: string | null } }> }
        }

        return {
          plan: metadata.plan ?? null,
          status: sub.status,
          currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        }
      } catch {
        return { plan: metadata.plan ?? null, status: account.status, currentPeriodEnd: null, cancelAtPeriodEnd: false }
      }
    },
  },
]
