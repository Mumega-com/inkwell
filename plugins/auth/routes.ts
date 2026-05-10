import { Hono } from 'hono'

import type { DatabasePort } from '../../kernel/types'
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
  role: string | null
  password_hash: string | null
  password_salt: string | null
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
  db: DatabasePort,
  customerSlug: string,
  channel: AuthChannel,
  contactNormalized: string,
): Promise<AuthIdentityRow | null> {
  return db.queryOne<AuthIdentityRow>(
    `SELECT id, customer_slug, channel, contact_value, contact_normalized, status, verified_at, last_login_at
     FROM auth_identities
     WHERE customer_slug = ? AND channel = ? AND contact_normalized = ?
     LIMIT 1`,
    [customerSlug, channel, contactNormalized],
  )
}

async function ensureIdentity(
  db: DatabasePort,
  customerSlug: string,
  channel: AuthChannel,
  contactValue: string,
  contactNormalized: string,
  metadataJson: string | null,
): Promise<AuthIdentityRow> {
  const existing = await findIdentity(db, customerSlug, channel, contactNormalized)
  const updatedAt = nowIso()

  if (existing) {
    await db.execute(
      `UPDATE auth_identities
       SET contact_value = ?, metadata_json = COALESCE(?, metadata_json), updated_at = ?
       WHERE id = ?`,
      [contactValue, metadataJson, updatedAt, existing.id],
    )

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

  await db.execute(
    `INSERT INTO auth_identities (
      id, customer_slug, channel, contact_value, contact_normalized, status, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      created.id,
      customerSlug,
      channel,
      contactValue,
      contactNormalized,
      created.status,
      metadataJson,
      updatedAt,
      updatedAt,
    ],
  )

  return created
}

async function ensurePortalAccount(
  db: DatabasePort,
  customerSlug: string,
  identity: AuthIdentityRow,
  fullName: string | null,
): Promise<PortalAccountRow> {
  const existing = await db.queryOne<PortalAccountRow>(
    `SELECT id, full_name, email, phone, role
     FROM portal_accounts
     WHERE customer_slug = ? AND identity_id = ?
     LIMIT 1`,
    [customerSlug, identity.id],
  )

  const email = identity.channel === 'email' ? identity.contact_value : null
  const phone = identity.channel === 'phone' ? identity.contact_value : null
  const updatedAt = nowIso()

  if (existing) {
    await db.execute(
      `UPDATE portal_accounts
       SET full_name = COALESCE(?, full_name),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           updated_at = ?
       WHERE id = ?`,
      [fullName, email, phone, updatedAt, existing.id],
    )

    return {
      id: existing.id,
      full_name: fullName ?? existing.full_name,
      email: email ?? existing.email,
      phone: phone ?? existing.phone,
      role: existing.role,
    }
  }

  const purchaselessMatch = await db.queryOne<PortalAccountRow>(
    `SELECT id, full_name, email, phone, role
     FROM portal_accounts
     WHERE customer_slug = ?
       AND identity_id IS NULL
       AND ((? IS NOT NULL AND email = ?) OR (? IS NOT NULL AND phone = ?))
     LIMIT 1`,
    [customerSlug, email, email, phone, phone],
  )

  if (purchaselessMatch) {
    await db.execute(
      `UPDATE portal_accounts
       SET identity_id = ?,
           full_name = COALESCE(?, full_name),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           updated_at = ?
       WHERE id = ?`,
      [identity.id, fullName, email, phone, updatedAt, purchaselessMatch.id],
    )

    return {
      id: purchaselessMatch.id,
      full_name: fullName ?? purchaselessMatch.full_name,
      email: email ?? purchaselessMatch.email,
      phone: phone ?? purchaselessMatch.phone,
      role: purchaselessMatch.role,
    }
  }

  const created: PortalAccountRow = {
    id: crypto.randomUUID(),
    full_name: fullName,
    email,
    phone,
    role: null,
  }

  await db.execute(
    `INSERT INTO portal_accounts (
      id, customer_slug, identity_id, full_name, email, phone, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    [
      created.id,
      customerSlug,
      identity.id,
      fullName,
      email,
      phone,
      updatedAt,
      updatedAt,
    ],
  )

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
  const db = c.get('db_core')
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
    db,
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

  await db.execute(
    `UPDATE auth_login_codes
     SET status = 'superseded'
     WHERE identity_id = ? AND status = 'issued'`,
    [identity.id],
  )

  await db.execute(
    `INSERT INTO auth_login_codes (
      id, identity_id, customer_slug, delivery_channel, code_hash, status, expires_at, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, 'issued', ?, ?, ?)`,
    [
      codeId,
      identity.id,
      customerSlug,
      channel,
      codeHash,
      expiresAt,
      JSON.stringify({ fullName }),
      issuedAt,
    ],
  )

  const sessions = c.get('sessions')
  await sessions.set(
    `login-code:${codeId}`,
    JSON.stringify({
      identityId: identity.id,
      customerSlug,
      channel,
      contactNormalized,
      codeHash,
      expiresAt,
    }),
    codeTtlSeconds,
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
    await db.execute(
      `UPDATE auth_login_codes
       SET status = 'delivery_failed', metadata_json = ?
       WHERE id = ?`,
      [JSON.stringify({ error: error instanceof Error ? error.message : 'delivery_failed' }), codeId],
    )
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
  const db = c.get('db_core')
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
  const identity = await findIdentity(db, customerSlug, channel, contactNormalized)
  if (!identity) {
    return jsonError('identity_not_found', 404)
  }

  const issuedCode = await db.queryOne<{ id: string; code_hash: string; expires_at: string }>(
    `SELECT id, code_hash, expires_at
     FROM auth_login_codes
     WHERE identity_id = ? AND customer_slug = ? AND delivery_channel = ? AND status = 'issued'
     ORDER BY created_at DESC
     LIMIT 1`,
    [identity.id, customerSlug, channel],
  )

  if (!issuedCode) {
    return jsonError('code_not_found', 404)
  }

  if (Date.parse(issuedCode.expires_at) <= Date.now()) {
    await db.execute(
      `UPDATE auth_login_codes SET status = 'expired' WHERE id = ?`,
      [issuedCode.id],
    )
    return jsonError('code_expired', 410)
  }

  const expectedHash = await sha256Hex(`${customerSlug}:${channel}:${contactNormalized}:${code}`)
  if (expectedHash !== issuedCode.code_hash) {
    return jsonError('invalid_code', 401)
  }

  const verifiedAt = nowIso()
  await db.batch([
    {
      sql: `UPDATE auth_login_codes
       SET status = 'consumed', consumed_at = ?
       WHERE id = ?`,
      params: [verifiedAt, issuedCode.id],
    },
    {
      sql: `UPDATE auth_identities
       SET status = 'verified',
           verified_at = COALESCE(verified_at, ?),
           last_login_at = ?,
           updated_at = ?
       WHERE id = ?`,
      params: [verifiedAt, verifiedAt, verifiedAt, identity.id],
    },
  ])

  const portalAccount = await ensurePortalAccount(db, customerSlug, identity, fullName)

  // Assign role: first account for this customer gets 'owner'
  const accountCount = await db.queryOne<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM portal_accounts WHERE customer_slug = ?',
    [customerSlug],
  )
  const role = (accountCount?.cnt ?? 0) <= 1 ? 'owner' : ((portalAccount as Record<string, unknown>).role as string | null) ?? 'member'

  // Update role in DB if it's the first account
  if (role === 'owner') {
    await db.execute(
      'UPDATE portal_accounts SET role = ? WHERE id = ?',
      [role, portalAccount.id],
    )
  }

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
    role,
    createdAt: verifiedAt,
    expiresAt,
  }

  await c.get('sessions').set(`session:${sessionToken}`, JSON.stringify(session), sessionTtlSeconds)

  c.header('Set-Cookie', buildSessionCookie(sessionToken, sessionTtlSeconds, getAuthCookieName(c)))
  return c.json({
    ok: true,
    session: {
      customerSlug: session.customerSlug,
      channel: session.channel,
      contactValue: session.contactValue,
      portalAccountId: session.portalAccountId,
      fullName: session.fullName,
      role,
      expiresAt: session.expiresAt,
    },
    sessionToken,
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
      role: session.role,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    },
  })
})

authRoutes.post('/logout', authSessionMiddleware, async (c) => {
  const token = c.get('authSessionToken')
  if (token) {
    await c.get('sessions').delete(`session:${token}`)
  }

  c.header('Set-Cookie', buildExpiredSessionCookie(getAuthCookieName(c)))
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Password helpers (PBKDF2 via crypto.subtle — CF Workers compatible)
// ---------------------------------------------------------------------------

async function derivePasswordKey(password: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const saltBytes = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)))
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: 100_000 },
    keyMaterial,
    256,
  )
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomHex(16)
  const hash = await derivePasswordKey(password, salt)
  return { hash, salt }
}

async function verifyPassword(password: string, saltHex: string, storedHash: string): Promise<boolean> {
  const derived = await derivePasswordKey(password, saltHex)
  // Constant-time comparison via SHA-256 of both sides
  const [a, b] = await Promise.all([sha256Hex(derived), sha256Hex(storedHash)])
  return a === b
}

// ---------------------------------------------------------------------------
// POST /api/auth/password-login
// Body: { customerSlug, email, password }
// ---------------------------------------------------------------------------

authRoutes.post('/password-login', async (c) => {
  const db = c.get('db_core')
  const parsedBody = await parseJsonBody(c.req.raw)
  if (parsedBody instanceof Response) return parsedBody

  const customerSlug = normalizeCustomerSlug(
    isNonEmptyString(parsedBody.customerSlug) ? parsedBody.customerSlug : '',
  )
  if (!customerSlug) return jsonError('customer_slug_required', 400)

  const emailRaw = isNonEmptyString(parsedBody.email) ? parsedBody.email.trim() : ''
  if (!emailRaw) return jsonError('email_required', 400)
  const email = normalizeEmail(emailRaw)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError('invalid_email', 400)

  const password = isNonEmptyString(parsedBody.password) ? parsedBody.password : ''
  if (!password) return jsonError('password_required', 400)

  // Look up portal account by customer_slug + email
  const account = await db.queryOne<PortalAccountRow>(
    `SELECT id, full_name, email, phone, role, password_hash, password_salt
     FROM portal_accounts
     WHERE customer_slug = ? AND email = ?
     LIMIT 1`,
    [customerSlug, email],
  )

  if (!account || !account.password_hash || !account.password_salt) {
    return jsonError('invalid_credentials', 401)
  }

  const valid = await verifyPassword(password, account.password_salt, account.password_hash)
  if (!valid) {
    return jsonError('invalid_credentials', 401)
  }

  // Record login time on matching identity (best-effort)
  const loginAt = nowIso()
  await db.execute(
    `UPDATE portal_accounts SET updated_at = ? WHERE id = ?`,
    [loginAt, account.id],
  )

  const role = account.role ?? 'member'
  const sessionTtlSeconds = getSessionTtlSeconds(c.env.AUTH_SESSION_TTL_SECONDS)
  const sessionToken = randomHex(24)
  const sessionId = crypto.randomUUID()
  const expiresAt = addSeconds(loginAt, sessionTtlSeconds)

  const session: AuthSession = {
    id: sessionId,
    customerSlug,
    identityId: '',
    portalAccountId: account.id,
    channel: 'email',
    contactValue: email,
    contactNormalized: email,
    fullName: account.full_name,
    role,
    createdAt: loginAt,
    expiresAt,
  }

  await c.get('sessions').set(`session:${sessionToken}`, JSON.stringify(session), sessionTtlSeconds)

  c.header('Set-Cookie', buildSessionCookie(sessionToken, sessionTtlSeconds, getAuthCookieName(c)))
  return c.json({
    ok: true,
    session: {
      customerSlug: session.customerSlug,
      channel: session.channel,
      contactValue: session.contactValue,
      portalAccountId: session.portalAccountId,
      fullName: session.fullName,
      role,
      expiresAt: session.expiresAt,
    },
    sessionToken,
  })
})

// ---------------------------------------------------------------------------
// POST /api/auth/password-register
// Body: { customerSlug, email, password, fullName }
// ---------------------------------------------------------------------------

authRoutes.post('/password-register', async (c) => {
  const db = c.get('db_core')
  const parsedBody = await parseJsonBody(c.req.raw)
  if (parsedBody instanceof Response) return parsedBody

  const customerSlug = normalizeCustomerSlug(
    isNonEmptyString(parsedBody.customerSlug) ? parsedBody.customerSlug : '',
  )
  if (!customerSlug) return jsonError('customer_slug_required', 400)

  const emailRaw = isNonEmptyString(parsedBody.email) ? parsedBody.email.trim() : ''
  if (!emailRaw) return jsonError('email_required', 400)
  const email = normalizeEmail(emailRaw)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError('invalid_email', 400)

  const password = isNonEmptyString(parsedBody.password) ? parsedBody.password : ''
  if (password.length < 8) return jsonError('password_too_short', 400, { hint: 'Minimum 8 characters' })

  const fullName = isNonEmptyString(parsedBody.fullName) ? parsedBody.fullName.trim().slice(0, 120) : null

  // Prevent duplicate registrations for the same email on the same tenant
  const existingAccount = await db.queryOne<{ id: string }>(
    `SELECT id FROM portal_accounts WHERE customer_slug = ? AND email = ? LIMIT 1`,
    [customerSlug, email],
  )
  if (existingAccount) return jsonError('email_already_registered', 409)

  // Create identity
  const identity = await ensureIdentity(db, customerSlug, 'email', emailRaw, email, null)

  // Mark identity as verified immediately (password-based signup)
  const registeredAt = nowIso()
  await db.execute(
    `UPDATE auth_identities
     SET status = 'verified',
         verified_at = COALESCE(verified_at, ?),
         last_login_at = ?,
         updated_at = ?
     WHERE id = ?`,
    [registeredAt, registeredAt, registeredAt, identity.id],
  )

  // Hash password
  const { hash, salt } = await hashPassword(password)

  // Create portal account
  const portalAccountId = crypto.randomUUID()

  // Determine role: owner if first account for this tenant
  const accountCount = await db.queryOne<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM portal_accounts WHERE customer_slug = ?',
    [customerSlug],
  )
  const role = (accountCount?.cnt ?? 0) === 0 ? 'owner' : 'member'

  await db.execute(
    `INSERT INTO portal_accounts (
      id, customer_slug, identity_id, full_name, email, phone, role, password_hash, password_salt, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 'active', ?, ?)`,
    [
      portalAccountId,
      customerSlug,
      identity.id,
      fullName,
      email,
      role,
      hash,
      salt,
      registeredAt,
      registeredAt,
    ],
  )

  // Issue session
  const sessionTtlSeconds = getSessionTtlSeconds(c.env.AUTH_SESSION_TTL_SECONDS)
  const sessionToken = randomHex(24)
  const sessionId = crypto.randomUUID()
  const expiresAt = addSeconds(registeredAt, sessionTtlSeconds)

  const session: AuthSession = {
    id: sessionId,
    customerSlug,
    identityId: identity.id,
    portalAccountId,
    channel: 'email',
    contactValue: email,
    contactNormalized: email,
    fullName,
    role,
    createdAt: registeredAt,
    expiresAt,
  }

  await c.get('sessions').set(`session:${sessionToken}`, JSON.stringify(session), sessionTtlSeconds)

  c.header('Set-Cookie', buildSessionCookie(sessionToken, sessionTtlSeconds, getAuthCookieName(c)))
  return c.json({
    ok: true,
    session: {
      customerSlug: session.customerSlug,
      channel: session.channel,
      contactValue: session.contactValue,
      portalAccountId: session.portalAccountId,
      fullName: session.fullName,
      role,
      expiresAt: session.expiresAt,
    },
    sessionToken,
  })
})

// ---------------------------------------------------------------------------
// POST /api/auth/set-password  (admin only)
// Body: { email, password }
// ---------------------------------------------------------------------------

authRoutes.post('/set-password', authSessionMiddleware, async (c) => {
  const session = c.get('authSession')
  if (!session) return jsonError('unauthorized', 401)
  if (!['admin', 'owner'].includes(session.role)) return jsonError('forbidden', 403)

  const db = c.get('db_core')
  const parsedBody = await parseJsonBody(c.req.raw)
  if (parsedBody instanceof Response) return parsedBody

  const emailRaw = isNonEmptyString(parsedBody.email) ? parsedBody.email.trim() : ''
  if (!emailRaw) return jsonError('email_required', 400)
  const email = normalizeEmail(emailRaw)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError('invalid_email', 400)

  const password = isNonEmptyString(parsedBody.password) ? parsedBody.password : ''
  if (password.length < 8) return jsonError('password_too_short', 400, { hint: 'Minimum 8 characters' })

  const { hash, salt } = await hashPassword(password)
  const now = nowIso()

  const result = await db.execute(
    `UPDATE portal_accounts
     SET password_hash = ?, password_salt = ?, updated_at = ?
     WHERE customer_slug = ? AND email = ?`,
    [hash, salt, now, session.customerSlug, email],
  )

  // result.meta?.changes is the D1 rows-affected count
  const changed = (result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0
  if (changed === 0) return jsonError('account_not_found', 404)

  return c.json({ ok: true })
})

export { authRoutes }
