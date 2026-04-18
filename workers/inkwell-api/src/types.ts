import type { D1Database, KVNamespace } from '@cloudflare/workers-types'
import type { DatabasePort, SessionPort, ContentPort, StoragePort, GraphPort } from '../../../kernel/types'

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
  GSC_SITE_URL?: string       // e.g. "https://example.com/"
  GA4_CREDENTIALS?: string    // JSON: {client_id, client_secret, refresh_token}
  GA4_PROPERTY_ID?: string    // e.g. "370995758"
  CONTRACT_AUTH_TOKEN?: string // Bearer token for milestone update endpoint
  // Twilio SMS
  TWILIO_ACCOUNT_SID?: string
  TWILIO_AUTH_TOKEN?: string
  TWILIO_FROM_NUMBER?: string
  RESEND_API_KEY?: string
  RESEND_FROM_EMAIL?: string  // e.g. "Your Business <contracts@example.com>" — needs verified domain
  // Business identity
  BUSINESS_NAME?: string       // e.g. "Acme Corp"
  BUSINESS_PHONE?: string      // e.g. "1-800-555-0199"
  BUSINESS_EMAIL?: string      // e.g. "info@example.com"
  CHAT_SYSTEM_PROMPT?: string  // Custom system prompt for chat assistant
  SOS_REPORT_RECIPIENT?: string // Agent bus recipient for flywheel reports (default: "owner")
  ENABLED_ROUTES?: string      // Comma-separated list of enabled route groups
  SOS_SAAS_URL?: string        // Origin SaaS service URL for tenant resolution (e.g. "https://saas.mumega.com")
  MUMEGA_API_URL?: string      // Mumega SaaS API URL for network tools (default: "https://api.mumega.com")
  MUMEGA_TOKEN?: string        // Bearer token for authenticating with Mumega SaaS API
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
  role?: string
  createdAt: string
  expiresAt: string
}

export type AppBindings = {
  Bindings: Env
  Variables: {
    authSession: AuthSession | null
    authSessionToken: string | null
    tenant_slug: string | null
    tenant_config: Record<string, unknown> | null
    cf_access_email: string | null
    cf_access_tenant: string | null
    cf_access_role: string | null
    // Adapters — plugins use these instead of c.env.*
    db_core: DatabasePort
    db_analytics: DatabasePort
    db_marketing: DatabasePort
    sessions: SessionPort
    content: ContentPort
    storage: StoragePort
    graph: GraphPort
  }
}
