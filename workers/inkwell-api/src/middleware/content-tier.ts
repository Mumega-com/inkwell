/**
 * Content-tier middleware — per-item access control for Inkwell content.
 *
 * This layer sits below route-level RBAC (rbac.ts) and checks access
 * against the content item itself, not just the route. Five tiers:
 *
 *   public  — no auth required
 *   squad   — must have squad_id claim in session
 *   project — must have project_id claim in session
 *   entity  — must have entity_id claim matching the content's entity_id
 *   private — must be the creating agent/user (user_id matches created_by)
 *
 * If permitted_roles is present, the caller's role must appear in that list
 * (in addition to satisfying the tier requirement).
 */

export type ContentTier = 'public' | 'squad' | 'project' | 'entity' | 'private'

export interface ContentTierContext {
  /** The access tier of this content item */
  tier: ContentTier
  /** Required when tier = 'entity' — must match session entity_id */
  entity_id?: string
  /** Required when tier = 'private' — must match session user_id */
  created_by?: string
  /** Optional allowlist of roles that may access this item */
  permitted_roles?: string[]
}

export interface TierSession {
  /** Session user/agent ID (used for 'private' tier) */
  user_id?: string
  /** Squad membership claim (used for 'squad' tier) */
  squad_id?: string
  /** Project membership claim (used for 'project' tier) */
  project_id?: string
  /** Entity association claim (used for 'entity' tier) */
  entity_id?: string
  /** Role string (used when permitted_roles is set) */
  role?: string
}

export interface TierCheckResult {
  allowed: boolean
  reason?: string
}

/**
 * Pure function: check if a session satisfies a content item's tier requirements.
 * Returns { allowed: true } or { allowed: false, reason: "..." }.
 *
 * This is intentionally decoupled from Hono so it can be tested without a
 * full request context and reused in the Astro SSR middleware.
 */
export function checkContentTier(
  ctx: ContentTierContext,
  session: TierSession | null,
): TierCheckResult {
  const { tier, entity_id, created_by, permitted_roles } = ctx

  // ── Tier gate ──────────────────────────────────────────────────────────────
  if (tier === 'public') {
    // Public content: skip tier check, fall through to role check below
  } else {
    if (!session) {
      return { allowed: false, reason: 'unauthenticated' }
    }

    switch (tier) {
      case 'squad':
        if (!session.squad_id) {
          return { allowed: false, reason: 'missing_squad_membership' }
        }
        break

      case 'project':
        if (!session.project_id) {
          return { allowed: false, reason: 'missing_project_membership' }
        }
        break

      case 'entity':
        if (!entity_id) {
          return { allowed: false, reason: 'content_missing_entity_id' }
        }
        if (session.entity_id !== entity_id) {
          return { allowed: false, reason: 'entity_id_mismatch' }
        }
        break

      case 'private':
        if (!created_by) {
          return { allowed: false, reason: 'content_missing_created_by' }
        }
        if (session.user_id !== created_by) {
          return { allowed: false, reason: 'not_creator' }
        }
        break

      default: {
        // Exhaustiveness check — TypeScript will catch unknown tiers at compile time
        const _exhaustive: never = tier
        return { allowed: false, reason: `unknown_tier:${_exhaustive}` }
      }
    }
  }

  // ── Role allowlist gate (applies to ALL tiers, including public) ───────────
  if (permitted_roles && permitted_roles.length > 0) {
    const callerRole = session?.role
    if (!callerRole || !permitted_roles.includes(callerRole)) {
      return { allowed: false, reason: 'role_not_permitted' }
    }
  }

  return { allowed: true }
}

/**
 * Hono middleware factory: reads tier context from `c.get('content_tier')`
 * (set upstream by the route handler after loading the content item), then
 * checks the authenticated session. Returns 403 if denied.
 *
 * Usage in a route:
 *
 *   app.get('/content/:slug', authSessionMiddleware, async (c, next) => {
 *     const item = await loadContent(slug)
 *     c.set('content_tier', {
 *       tier: item.tier ?? 'public',
 *       entity_id: item.entity_id,
 *       created_by: item.created_by,
 *       permitted_roles: item.permitted_roles,
 *     })
 *     await next()
 *   }, contentTierMiddleware, serveContent)
 */
import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../types'

export const contentTierMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  const ctx = c.get('content_tier')

  // If no tier context has been set, treat as public
  if (!ctx) {
    return next()
  }

  const rawSession = c.get('authSession')

  // Map AuthSession → TierSession (the session may have extended claims)
  const session: TierSession | null = rawSession
    ? {
        user_id: rawSession.identityId,
        role: rawSession.role,
        // Extended claims — these come from the session JSON blob stored in KV
        // Casting through unknown is intentional: the base AuthSession type does
        // not declare these fields but plugins can write them at login time.
        squad_id: (rawSession as unknown as Record<string, unknown>)['squad_id'] as string | undefined,
        project_id: (rawSession as unknown as Record<string, unknown>)['project_id'] as string | undefined,
        entity_id: (rawSession as unknown as Record<string, unknown>)['entity_id'] as string | undefined,
      }
    : null

  const result = checkContentTier(ctx, session)

  if (!result.allowed) {
    return c.json(
      {
        error: 'forbidden',
        tier: ctx.tier,
        reason: result.reason,
      },
      403,
    )
  }

  return next()
}
