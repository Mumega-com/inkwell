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
