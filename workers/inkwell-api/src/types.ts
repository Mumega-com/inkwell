export interface Env {
  DB_ANALYTICS: D1Database
  DB_CORE: D1Database
  DB_MARKETING: D1Database
  CONTENT: KVNamespace
  SESSIONS: KVNamespace
  SITE_URL: string
  PUBLISH_TOKEN?: string
  CF_PAGES_DEPLOY_HOOK?: string
  AUTH_COOKIE_NAME?: string
  AUTH_SESSION_TTL_SECONDS?: string
  AUTH_CODE_TTL_SECONDS?: string
  AUTH_CODE_WEBHOOK_URL?: string
  AUTH_CODE_WEBHOOK_TOKEN?: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  STRIPE_PRICE_SEO: string
  STRIPE_PRICE_SEO_ADS: string
  STRIPE_PRICE_FULL: string
  TELEGRAM_BOT_TOKEN: string
  TELEGRAM_CHAT_ID?: string
  SOS_BUS_URL?: string
  INKWELL_MCP_TOKEN?: string
  // Flywheel connectors
  GSC_CREDENTIALS?: string    // JSON: {client_id, client_secret, refresh_token}
  GSC_SITE_URL?: string       // e.g. "https://www.viamar.ca/"
  GA4_CREDENTIALS?: string    // JSON: {client_id, client_secret, refresh_token}
  GA4_PROPERTY_ID?: string    // e.g. "370995758"
}

export interface AuthSession {
  id: string
  customerSlug: string
  identityId: string
  portalAccountId: string | null
  channel: 'email' | 'phone'
  contactValue: string
  contactNormalized: string
  fullName: string | null
  createdAt: string
  expiresAt: string
}

export type AppBindings = {
  Bindings: Env
  Variables: {
    authSession: AuthSession | null
    authSessionToken: string | null
  }
}
