import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'

import {
  authSessionMiddleware,
  buildExpiredSessionCookie,
  buildSessionCookie,
  getAuthCookieName,
} from '../middleware'
import type { AppBindings, AuthSession } from '../types'

type AuthChannel = 'email' | 'phone'

type AuthIdentityRow = {
  id: string
  customer_slug: string
  channel: AuthChannel
  contact_value: string
  contact_normalized: string
  status: string
  verified_at: string | null
  last_login_at: string | null
}

type PortalAccountRow = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
}

const authRoutes = new Hono<AppBindings>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function jsonError(error: string, status: number, details?: Record<string, unknown>) {
  return Response.json({ error, ...(details ?? {}) }, { status })
}

function normalizeCustomerSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function normalizePhone(value: string): string {
  const trimmed = value.trim()
  const prefix = trimmed.startsWith('+') ? '+' : ''
  const digits = trimmed.replace(/\D+/g, '')
  return prefix ? `+${digits}` : digits
}

function inferChannel(value: string): AuthChannel | null {
  return value.includes('@') ? 'email' : /\d/.test(value) ? 'phone' : null
}

function normalizeContact(channel: AuthChannel, value: string): string {
  return channel === 'email' ? normalizeEmail(value) : normalizePhone(value)
}

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes)
  crypto.getRandomValues(array)
  return Array.from(array, (item) => item.toString(16).padStart(2, '0')).join('')
}

function randomCode(): string {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return String(array[0] % 1_000_000).padStart(6, '0')
}

function nowIso(): string {
  return new Date().toISOString()
}

function addSeconds(timestamp: string, seconds: number): string {
  return new Date(Date.parse(timestamp) + (seconds * 1000)).toISOString()
}

async function sha256Hex(input: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(hash), (item) => item.toString(16).padStart(2, '0')).join('')
}

function getSessionTtlSeconds(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60 * 24 * 30
}

function getCodeTtlSeconds(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 5
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown> | Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('invalid_json', 400)
  }

  if (!isRecord(body)) {
    return jsonError('invalid_json', 400)
  }

  return body
}

async function findIdentity(
  db: D1Database,
  customerSlug: string,
  channel: AuthChannel,
  contactNormalized: string,
): Promise<AuthIdentityRow | null> {
  return db.prepare(
    `SELECT id, customer_slug, channel, contact_value, contact_normalized, status, verified_at, last_login_at
     FROM auth_identities
     WHERE customer_slug = ? AND channel = ? AND contact_normalized = ?
     LIMIT 1`
  ).bind(customerSlug, channel, contactNormalized).first<AuthIdentityRow>()
}

async function ensureIdentity(
  db: D1Database,
  customerSlug: string,
  channel: AuthChannel,
  contactValue: string,
  contactNormalized: string,
  metadataJson: string | null,
): Promise<AuthIdentityRow> {
  const existing = await findIdentity(db, customerSlug, channel, contactNormalized)
  const updatedAt = nowIso()

  if (existing) {
    await db.prepare(
      `UPDATE auth_identities
       SET contact_value = ?, metadata_json = COALESCE(?, metadata_json), updated_at = ?
       WHERE id = ?`
    ).bind(contactValue, metadataJson, updatedAt, existing.id).run()

    return {
      ...existing,
      contact_value: contactValue,
    }
  }

  const created: AuthIdentityRow = {
    id: crypto.randomUUID(),
    customer_slug: customerSlug,
    channel,
    contact_value: contactValue,
    contact_normalized: contactNormalized,
    status: 'pending',
    verified_at: null,
    last_login_at: null,
  }

  await db.prepare(
    `INSERT INTO auth_identities (
      id, customer_slug, channel, contact_value, contact_normalized, status, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    created.id,
    customerSlug,
    channel,
    contactValue,
    contactNormalized,
    created.status,
    metadataJson,
    updatedAt,
    updatedAt,
  ).run()

  return created
}

async function ensurePortalAccount(
  db: D1Database,
  customerSlug: string,
  identity: AuthIdentityRow,
  fullName: string | null,
): Promise<PortalAccountRow> {
  const existing = await db.prepare(
    `SELECT id, full_name, email, phone
     FROM portal_accounts
     WHERE customer_slug = ? AND identity_id = ?
     LIMIT 1`
  ).bind(customerSlug, identity.id).first<PortalAccountRow>()

  const email = identity.channel === 'email' ? identity.contact_value : null
  const phone = identity.channel === 'phone' ? identity.contact_value : null
  const updatedAt = nowIso()

  if (existing) {
    await db.prepare(
      `UPDATE portal_accounts
       SET full_name = COALESCE(?, full_name),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           updated_at = ?
       WHERE id = ?`
    ).bind(fullName, email, phone, updatedAt, existing.id).run()

    return {
      id: existing.id,
      full_name: fullName ?? existing.full_name,
      email: email ?? existing.email,
      phone: phone ?? existing.phone,
    }
  }

  const purchaselessMatch = await db.prepare(
    `SELECT id, full_name, email, phone
     FROM portal_accounts
     WHERE customer_slug = ?
       AND identity_id IS NULL
       AND ((? IS NOT NULL AND email = ?) OR (? IS NOT NULL AND phone = ?))
     LIMIT 1`
  ).bind(customerSlug, email, email, phone, phone).first<PortalAccountRow>()

  if (purchaselessMatch) {
    await db.prepare(
      `UPDATE portal_accounts
       SET identity_id = ?,
           full_name = COALESCE(?, full_name),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           updated_at = ?
       WHERE id = ?`
    ).bind(identity.id, fullName, email, phone, updatedAt, purchaselessMatch.id).run()

    return {
      id: purchaselessMatch.id,
      full_name: fullName ?? purchaselessMatch.full_name,
      email: email ?? purchaselessMatch.email,
      phone: phone ?? purchaselessMatch.phone,
    }
  }

  const created: PortalAccountRow = {
    id: crypto.randomUUID(),
    full_name: fullName,
    email,
    phone,
  }

  await db.prepare(
    `INSERT INTO portal_accounts (
      id, customer_slug, identity_id, full_name, email, phone, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`
  ).bind(
    created.id,
    customerSlug,
    identity.id,
    fullName,
    email,
    phone,
    updatedAt,
    updatedAt,
  ).run()

  return created
}

async function sendCodeDelivery(
  webhookUrl: string | undefined,
  webhookToken: string | undefined,
  payload: Record<string, unknown>,
): Promise<'webhook' | 'noop'> {
  if (!webhookUrl) {
    return 'noop'
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }

  if (webhookToken) {
    headers.authorization = `Bearer ${webhookToken}`
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`delivery_failed_${response.status}`)
  }

  return 'webhook'
}

authRoutes.post('/request-code', async (c) => {
  const parsedBody = await parseJsonBody(c.req.raw)
  if (parsedBody instanceof Response) return parsedBody

  const customerSlugRaw = isNonEmptyString(parsedBody.customerSlug) ? parsedBody.customerSlug : ''
  const customerSlug = normalizeCustomerSlug(customerSlugRaw)
  if (!customerSlug) {
    return jsonError('customer_slug_required', 400)
  }

  const contactValue = isNonEmptyString(parsedBody.contact)
    ? parsedBody.contact.trim()
    : isNonEmptyString(parsedBody.contactValue)
      ? parsedBody.contactValue.trim()
      : ''
  if (!contactValue) {
    return jsonError('contact_required', 400)
  }

  const channel = isNonEmptyString(parsedBody.channel)
    ? parsedBody.channel.trim().toLowerCase()
    : inferChannel(contactValue)
  if (channel !== 'email' && channel !== 'phone') {
    return jsonError('invalid_channel', 400, { hint: 'Use email or phone' })
  }

  const contactNormalized = normalizeContact(channel, contactValue)
  if (channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactNormalized)) {
    return jsonError('invalid_email', 400)
  }
  if (channel === 'phone' && contactNormalized.replace(/\D+/g, '').length < 7) {
    return jsonError('invalid_phone', 400)
  }

  const fullName = isNonEmptyString(parsedBody.fullName) ? parsedBody.fullName.trim().slice(0, 120) : null
  const metadataJson = isRecord(parsedBody.metadata)
    ? JSON.stringify(parsedBody.metadata)
    : null

  const identity = await ensureIdentity(
    c.env.DB_CORE,
    customerSlug,
    channel,
    contactValue,
    contactNormalized,
    metadataJson,
  )

  const issuedAt = nowIso()
  const codeTtlSeconds = getCodeTtlSeconds(c.env.AUTH_CODE_TTL_SECONDS)
  const expiresAt = addSeconds(issuedAt, codeTtlSeconds)
  const code = randomCode()
  const codeHash = await sha256Hex(`${customerSlug}:${channel}:${contactNormalized}:${code}`)
  const codeId = crypto.randomUUID()

  await c.env.DB_CORE.prepare(
    `UPDATE auth_login_codes
     SET status = 'superseded'
     WHERE identity_id = ? AND status = 'issued'`
  ).bind(identity.id).run()

  await c.env.DB_CORE.prepare(
    `INSERT INTO auth_login_codes (
      id, identity_id, customer_slug, delivery_channel, code_hash, status, expires_at, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, 'issued', ?, ?, ?)`
  ).bind(
    codeId,
    identity.id,
    customerSlug,
    channel,
    codeHash,
    expiresAt,
    JSON.stringify({ fullName }),
    issuedAt,
  ).run()

  await c.env.SESSIONS.put(
    `login-code:${codeId}`,
    JSON.stringify({
      identityId: identity.id,
      customerSlug,
      channel,
      contactNormalized,
      codeHash,
      expiresAt,
    }),
    { expirationTtl: codeTtlSeconds },
  )

  let delivery: 'webhook' | 'noop'
  try {
    delivery = await sendCodeDelivery(c.env.AUTH_CODE_WEBHOOK_URL, c.env.AUTH_CODE_WEBHOOK_TOKEN, {
      customerSlug,
      channel,
      contact: contactValue,
      contactNormalized,
      fullName,
      code,
      expiresAt,
      template: 'portal-login-code',
    })
  } catch (error) {
    await c.env.DB_CORE.prepare(
      `UPDATE auth_login_codes
       SET status = 'delivery_failed', metadata_json = ?
       WHERE id = ?`
    ).bind(JSON.stringify({ error: error instanceof Error ? error.message : 'delivery_failed' }), codeId).run()
    return jsonError('delivery_failed', 502)
  }

  return c.json({
    ok: true,
    customerSlug,
    channel,
    delivery,
    expiresAt,
    ...(delivery === 'noop' ? { testCode: code } : {}),
  })
})

authRoutes.post('/verify-code', async (c) => {
  const parsedBody = await parseJsonBody(c.req.raw)
  if (parsedBody instanceof Response) return parsedBody

  const customerSlug = normalizeCustomerSlug(isNonEmptyString(parsedBody.customerSlug) ? parsedBody.customerSlug : '')
  const contactValue = isNonEmptyString(parsedBody.contact)
    ? parsedBody.contact.trim()
    : isNonEmptyString(parsedBody.contactValue)
      ? parsedBody.contactValue.trim()
      : ''
  const code = isNonEmptyString(parsedBody.code) ? parsedBody.code.trim() : ''
  const fullName = isNonEmptyString(parsedBody.fullName) ? parsedBody.fullName.trim().slice(0, 120) : null

  if (!customerSlug || !contactValue || !code) {
    return jsonError('customer_slug_contact_and_code_required', 400)
  }

  const channel = isNonEmptyString(parsedBody.channel)
    ? parsedBody.channel.trim().toLowerCase()
    : inferChannel(contactValue)
  if (channel !== 'email' && channel !== 'phone') {
    return jsonError('invalid_channel', 400)
  }

  const contactNormalized = normalizeContact(channel, contactValue)
  const identity = await findIdentity(c.env.DB_CORE, customerSlug, channel, contactNormalized)
  if (!identity) {
    return jsonError('identity_not_found', 404)
  }

  const issuedCode = await c.env.DB_CORE.prepare(
    `SELECT id, code_hash, expires_at
     FROM auth_login_codes
     WHERE identity_id = ? AND customer_slug = ? AND delivery_channel = ? AND status = 'issued'
     ORDER BY created_at DESC
     LIMIT 1`
  ).bind(identity.id, customerSlug, channel).first<{ id: string; code_hash: string; expires_at: string }>()

  if (!issuedCode) {
    return jsonError('code_not_found', 404)
  }

  if (Date.parse(issuedCode.expires_at) <= Date.now()) {
    await c.env.DB_CORE.prepare(
      `UPDATE auth_login_codes SET status = 'expired' WHERE id = ?`
    ).bind(issuedCode.id).run()
    return jsonError('code_expired', 410)
  }

  const expectedHash = await sha256Hex(`${customerSlug}:${channel}:${contactNormalized}:${code}`)
  if (expectedHash !== issuedCode.code_hash) {
    return jsonError('invalid_code', 401)
  }

  const verifiedAt = nowIso()
  await c.env.DB_CORE.batch([
    c.env.DB_CORE.prepare(
      `UPDATE auth_login_codes
       SET status = 'consumed', consumed_at = ?
       WHERE id = ?`
    ).bind(verifiedAt, issuedCode.id),
    c.env.DB_CORE.prepare(
      `UPDATE auth_identities
       SET status = 'verified',
           verified_at = COALESCE(verified_at, ?),
           last_login_at = ?,
           updated_at = ?
       WHERE id = ?`
    ).bind(verifiedAt, verifiedAt, verifiedAt, identity.id),
  ])

  const portalAccount = await ensurePortalAccount(c.env.DB_CORE, customerSlug, identity, fullName)
  const sessionTtlSeconds = getSessionTtlSeconds(c.env.AUTH_SESSION_TTL_SECONDS)
  const sessionToken = randomHex(24)
  const sessionId = crypto.randomUUID()
  const expiresAt = addSeconds(verifiedAt, sessionTtlSeconds)
  const session: AuthSession = {
    id: sessionId,
    customerSlug,
    identityId: identity.id,
    portalAccountId: portalAccount.id,
    channel,
    contactValue: identity.contact_value,
    contactNormalized,
    fullName: portalAccount.full_name,
    createdAt: verifiedAt,
    expiresAt,
  }

  await c.env.SESSIONS.put(`session:${sessionToken}`, JSON.stringify(session), {
    expirationTtl: sessionTtlSeconds,
  })

  c.header('Set-Cookie', buildSessionCookie(sessionToken, sessionTtlSeconds, getAuthCookieName(c)))
  return c.json({
    ok: true,
    session: {
      customerSlug: session.customerSlug,
      channel: session.channel,
      contactValue: session.contactValue,
      portalAccountId: session.portalAccountId,
      fullName: session.fullName,
      expiresAt: session.expiresAt,
    },
  })
})

authRoutes.get('/session', authSessionMiddleware, async (c) => {
  const session = c.get('authSession')
  if (!session) {
    return c.json({ authenticated: false })
  }

  return c.json({
    authenticated: true,
    session: {
      customerSlug: session.customerSlug,
      channel: session.channel,
      contactValue: session.contactValue,
      portalAccountId: session.portalAccountId,
      fullName: session.fullName,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    },
  })
})

authRoutes.post('/logout', authSessionMiddleware, async (c) => {
  const token = c.get('authSessionToken')
  if (token) {
    await c.env.SESSIONS.delete(`session:${token}`)
  }

  c.header('Set-Cookie', buildExpiredSessionCookie(getAuthCookieName(c)))
  return c.json({ ok: true })
})

export { authRoutes }
