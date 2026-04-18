import { Hono } from 'hono'
import { readSessionFromRequest, requireAuth } from '../middleware'
import type { AppBindings } from '../types'

type PublishingResourceRow = {
  external_id: string
  parent_external_id: string | null
  source_system: string
  resource_type: string
  title: string
  slug: string | null
  visibility: string
  release_at: string | null
  preview_url: string | null
  metadata_json: string | null
}

type AccessGrantRow = {
  id: string
  product_id: string | null
  resource_external_id: string | null
  grant_type: string
  status: string
  granted_at: string
  expires_at: string | null
  metadata_json: string | null
}

type ReadingProgressRow = {
  resource_external_id: string
  progress_percent: number
  last_position: string | null
  last_read_at: string
  completed_at: string | null
  metadata_json: string | null
}

const publishingRoutes = new Hono<AppBindings>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function safeParseJson(value: string | null): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function hasGrantExpired(expiresAt: string | null): boolean {
  return expiresAt ? Date.parse(expiresAt) <= Date.now() : false
}

function isResourceReleased(releaseAt: string | null): boolean {
  return !releaseAt || Date.parse(releaseAt) <= Date.now()
}

async function loadResource(db: AppBindings['Bindings']['DB_CORE'], customerSlug: string, externalId: string) {
  return db.prepare(
    `SELECT external_id, parent_external_id, source_system, resource_type, title, slug, visibility, release_at, preview_url, metadata_json
     FROM publishing_resources
     WHERE customer_slug = ? AND external_id = ?
     LIMIT 1`
  ).bind(customerSlug, externalId).first<PublishingResourceRow>()
}

async function loadActiveGrants(
  db: AppBindings['Bindings']['DB_CORE'],
  customerSlug: string,
  portalAccountId: string,
) {
  return db.prepare(
    `SELECT id, product_id, resource_external_id, grant_type, status, granted_at, expires_at, metadata_json
     FROM access_grants
     WHERE customer_slug = ? AND portal_account_id = ? AND status = 'active'
     ORDER BY granted_at DESC`
  ).bind(customerSlug, portalAccountId).all<AccessGrantRow>()
}

publishingRoutes.get('/library', requireAuth, async (c) => {
  const { session } = await readSessionFromRequest(c)
  if (!session?.portalAccountId) {
    return c.json({ error: 'portal_account_required' }, 400)
  }

  const grantsResult = await loadActiveGrants(c.env.DB_CORE, session.customerSlug, session.portalAccountId)
  const grants = grantsResult.results.filter((grant) => !hasGrantExpired(grant.expires_at))

  const resourceIds = Array.from(new Set(grants.map((grant) => grant.resource_external_id).filter(Boolean))) as string[]
  const resources = new Map<string, PublishingResourceRow>()

  for (const resourceId of resourceIds) {
    const resource = await loadResource(c.env.DB_CORE, session.customerSlug, resourceId)
    if (resource) {
      resources.set(resourceId, resource)
    }
  }

  const progressResult = await c.env.DB_CORE.prepare(
    `SELECT resource_external_id, progress_percent, last_position, last_read_at, completed_at, metadata_json
     FROM reading_progress
     WHERE customer_slug = ? AND portal_account_id = ?`
  ).bind(session.customerSlug, session.portalAccountId).all<ReadingProgressRow>()

  const progress = new Map(progressResult.results.map((row) => [row.resource_external_id, row]))

  return c.json({
    items: grants.map((grant) => {
      const resource = grant.resource_external_id ? resources.get(grant.resource_external_id) ?? null : null
      const reading = grant.resource_external_id ? progress.get(grant.resource_external_id) ?? null : null
      return {
        grantId: grant.id,
        grantType: grant.grant_type,
        grantedAt: grant.granted_at,
        expiresAt: grant.expires_at,
        metadata: safeParseJson(grant.metadata_json),
        resource: resource ? {
          externalId: resource.external_id,
          parentExternalId: resource.parent_external_id,
          sourceSystem: resource.source_system,
          resourceType: resource.resource_type,
          title: resource.title,
          slug: resource.slug,
          visibility: resource.visibility,
          releaseAt: resource.release_at,
          previewUrl: resource.preview_url,
          metadata: safeParseJson(resource.metadata_json),
        } : null,
        progress: reading ? {
          percent: reading.progress_percent,
          lastPosition: reading.last_position,
          lastReadAt: reading.last_read_at,
          completedAt: reading.completed_at,
          metadata: safeParseJson(reading.metadata_json),
        } : null,
      }
    }),
  })
})

publishingRoutes.get('/access/:externalId', async (c) => {
  const externalId = c.req.param('externalId')
  const customerSlug = c.req.query('customer')?.trim()

  if (!isNonEmptyString(customerSlug)) {
    return c.json({ error: 'customer_required' }, 400)
  }

  const resource = await loadResource(c.env.DB_CORE, customerSlug, externalId)
  if (!resource) {
    return c.json({ error: 'resource_not_found' }, 404)
  }

  const released = isResourceReleased(resource.release_at)
  const visibility = resource.visibility

  if (visibility === 'public' && released) {
    return c.json({
      access: 'granted',
      reason: 'public',
      resource: {
        externalId: resource.external_id,
        title: resource.title,
        slug: resource.slug,
        previewUrl: resource.preview_url,
        releaseAt: resource.release_at,
      },
    })
  }

  const session = c.get('authSession')
  if (!session || session.customerSlug !== customerSlug || !session.portalAccountId) {
    return c.json({
      access: visibility === 'preview' ? 'preview' : 'login_required',
      reason: visibility === 'preview' ? 'preview' : 'unauthenticated',
      resource: {
        externalId: resource.external_id,
        title: resource.title,
        slug: resource.slug,
        previewUrl: resource.preview_url,
        releaseAt: resource.release_at,
      },
    }, visibility === 'preview' ? 200 : 401)
  }

  const grant = await c.env.DB_CORE.prepare(
    `SELECT id, expires_at
     FROM access_grants
     WHERE customer_slug = ? AND portal_account_id = ? AND resource_external_id = ? AND status = 'active'
     ORDER BY granted_at DESC
     LIMIT 1`
  ).bind(customerSlug, session.portalAccountId, externalId).first<{ id: string; expires_at: string | null }>()

  if (grant && !hasGrantExpired(grant.expires_at) && released) {
    return c.json({
      access: 'granted',
      reason: 'active_grant',
      resource: {
        externalId: resource.external_id,
        title: resource.title,
        slug: resource.slug,
        previewUrl: resource.preview_url,
        releaseAt: resource.release_at,
      },
      grantId: grant.id,
    })
  }

  return c.json({
    access: visibility === 'preview' ? 'preview' : 'purchase_required',
    reason: visibility === 'preview' ? 'preview' : 'missing_grant',
    resource: {
      externalId: resource.external_id,
      title: resource.title,
      slug: resource.slug,
      previewUrl: resource.preview_url,
      releaseAt: resource.release_at,
    },
  }, visibility === 'preview' ? 200 : 402)
})

publishingRoutes.post('/progress', requireAuth, async (c) => {
  const session = c.get('authSession')
  if (!session?.portalAccountId) {
    return c.json({ error: 'portal_account_required' }, 400)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  if (!isRecord(body)) {
    return c.json({ error: 'invalid_body' }, 400)
  }

  const resourceExternalId = body.resourceExternalId
  const progressPercent = body.progressPercent
  const lastPosition = body.lastPosition
  const completed = body.completed === true
  const metadata = isRecord(body.metadata) ? body.metadata : null

  if (!isNonEmptyString(resourceExternalId)) {
    return c.json({ error: 'resource_external_id_required' }, 400)
  }

  if (typeof progressPercent !== 'number' || Number.isNaN(progressPercent) || progressPercent < 0 || progressPercent > 100) {
    return c.json({ error: 'progress_percent_invalid' }, 400)
  }

  if (lastPosition !== undefined && lastPosition !== null && !isNonEmptyString(lastPosition)) {
    return c.json({ error: 'last_position_invalid' }, 400)
  }

  const now = nowIso()
  const resource = await loadResource(c.env.DB_CORE, session.customerSlug, resourceExternalId)
  if (!resource) {
    return c.json({ error: 'resource_not_found' }, 404)
  }

  await c.env.DB_CORE.prepare(
    `INSERT INTO reading_progress (
      id, customer_slug, portal_account_id, resource_external_id, progress_percent, last_position,
      last_read_at, completed_at, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(customer_slug, portal_account_id, resource_external_id) DO UPDATE SET
      progress_percent = excluded.progress_percent,
      last_position = excluded.last_position,
      last_read_at = excluded.last_read_at,
      completed_at = excluded.completed_at,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at`
  ).bind(
    crypto.randomUUID(),
    session.customerSlug,
    session.portalAccountId,
    resourceExternalId,
    progressPercent,
    isNonEmptyString(lastPosition) ? lastPosition.trim().slice(0, 255) : null,
    now,
    completed || progressPercent >= 100 ? now : null,
    metadata ? JSON.stringify(metadata) : null,
    now,
    now,
  ).run()

  return c.json({
    ok: true,
    resourceExternalId,
    progressPercent,
    completedAt: completed || progressPercent >= 100 ? now : null,
  })
})

publishingRoutes.get('/progress/:externalId', requireAuth, async (c) => {
  const session = c.get('authSession')
  if (!session?.portalAccountId) {
    return c.json({ error: 'portal_account_required' }, 400)
  }

  const externalId = c.req.param('externalId')
  const row = await c.env.DB_CORE.prepare(
    `SELECT resource_external_id, progress_percent, last_position, last_read_at, completed_at, metadata_json
     FROM reading_progress
     WHERE customer_slug = ? AND portal_account_id = ? AND resource_external_id = ?
     LIMIT 1`
  ).bind(session.customerSlug, session.portalAccountId, externalId).first<ReadingProgressRow>()

  if (!row) {
    return c.json({ progress: null })
  }

  return c.json({
    progress: {
      resourceExternalId: row.resource_external_id,
      percent: row.progress_percent,
      lastPosition: row.last_position,
      lastReadAt: row.last_read_at,
      completedAt: row.completed_at,
      metadata: safeParseJson(row.metadata_json),
    },
  })
})

export { publishingRoutes }
