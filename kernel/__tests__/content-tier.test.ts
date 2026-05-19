/**
 * Tests for content-tier access control logic.
 *
 * Covers the five tiers (public, squad, project, entity, private) and the
 * optional permitted_roles filter. Tests are pure-function — no Worker
 * runtime, no Hono context needed.
 */

import { describe, it, expect } from 'vitest'
import { checkContentTier } from '../../workers/inkwell-api/src/middleware/content-tier'
import type { ContentTierContext, TierSession } from '../../workers/inkwell-api/src/middleware/content-tier'

// ── helpers ──────────────────────────────────────────────────────────────────

function publicCtx(overrides: Partial<ContentTierContext> = {}): ContentTierContext {
  return { tier: 'public', ...overrides }
}

function squadCtx(overrides: Partial<ContentTierContext> = {}): ContentTierContext {
  return { tier: 'squad', ...overrides }
}

function projectCtx(overrides: Partial<ContentTierContext> = {}): ContentTierContext {
  return { tier: 'project', ...overrides }
}

function entityCtx(entity_id = 'org-123', overrides: Partial<ContentTierContext> = {}): ContentTierContext {
  return { tier: 'entity', entity_id, ...overrides }
}

function privateCtx(created_by = 'user-abc', overrides: Partial<ContentTierContext> = {}): ContentTierContext {
  return { tier: 'private', created_by, ...overrides }
}

function session(overrides: Partial<TierSession> = {}): TierSession {
  return {
    user_id: 'user-abc',
    role: 'member',
    squad_id: 'squad-1',
    project_id: 'proj-1',
    entity_id: 'org-123',
    ...overrides,
  }
}

// ── public tier ───────────────────────────────────────────────────────────────

describe('tier: public', () => {
  it('allows with no session', () => {
    expect(checkContentTier(publicCtx(), null).allowed).toBe(true)
  })

  it('allows with any session', () => {
    expect(checkContentTier(publicCtx(), session()).allowed).toBe(true)
  })

  it('allows even when permitted_roles is empty', () => {
    expect(checkContentTier(publicCtx({ permitted_roles: [] }), null).allowed).toBe(true)
  })
})

// ── squad tier ────────────────────────────────────────────────────────────────

describe('tier: squad', () => {
  it('denies unauthenticated request', () => {
    const result = checkContentTier(squadCtx(), null)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('unauthenticated')
  })

  it('denies session without squad_id', () => {
    const result = checkContentTier(squadCtx(), session({ squad_id: undefined }))
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('missing_squad_membership')
  })

  it('allows session with squad_id', () => {
    expect(checkContentTier(squadCtx(), session({ squad_id: 'squad-1' })).allowed).toBe(true)
  })
})

// ── project tier ──────────────────────────────────────────────────────────────

describe('tier: project', () => {
  it('denies unauthenticated request', () => {
    const result = checkContentTier(projectCtx(), null)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('unauthenticated')
  })

  it('denies session without project_id', () => {
    const result = checkContentTier(projectCtx(), session({ project_id: undefined }))
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('missing_project_membership')
  })

  it('allows session with project_id', () => {
    expect(checkContentTier(projectCtx(), session({ project_id: 'proj-1' })).allowed).toBe(true)
  })
})

// ── entity tier ───────────────────────────────────────────────────────────────

describe('tier: entity', () => {
  it('denies unauthenticated request', () => {
    const result = checkContentTier(entityCtx(), null)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('unauthenticated')
  })

  it('denies when content has no entity_id set', () => {
    const result = checkContentTier(
      { tier: 'entity' }, // no entity_id in ctx
      session({ entity_id: 'org-123' }),
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('content_missing_entity_id')
  })

  it('denies when session entity_id does not match content entity_id', () => {
    const result = checkContentTier(entityCtx('org-123'), session({ entity_id: 'org-different' }))
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('entity_id_mismatch')
  })

  it('denies when session has no entity_id', () => {
    const result = checkContentTier(entityCtx('org-123'), session({ entity_id: undefined }))
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('entity_id_mismatch')
  })

  it('allows when entity_id matches exactly', () => {
    const result = checkContentTier(entityCtx('org-123'), session({ entity_id: 'org-123' }))
    expect(result.allowed).toBe(true)
  })
})

// ── private tier ──────────────────────────────────────────────────────────────

describe('tier: private', () => {
  it('denies unauthenticated request', () => {
    const result = checkContentTier(privateCtx(), null)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('unauthenticated')
  })

  it('denies when content has no created_by set', () => {
    const result = checkContentTier(
      { tier: 'private' }, // no created_by
      session({ user_id: 'user-abc' }),
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('content_missing_created_by')
  })

  it('denies when user_id does not match created_by', () => {
    const result = checkContentTier(privateCtx('user-abc'), session({ user_id: 'user-other' }))
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('not_creator')
  })

  it('denies when session has no user_id', () => {
    const result = checkContentTier(privateCtx('user-abc'), session({ user_id: undefined }))
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('not_creator')
  })

  it('allows when user_id matches created_by', () => {
    const result = checkContentTier(privateCtx('user-abc'), session({ user_id: 'user-abc' }))
    expect(result.allowed).toBe(true)
  })
})

// ── permitted_roles filter ────────────────────────────────────────────────────

describe('permitted_roles filter', () => {
  it('public tier: denies when session role not in permitted_roles', () => {
    const result = checkContentTier(
      publicCtx({ permitted_roles: ['admin', 'owner'] }),
      session({ role: 'member' }),
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('role_not_permitted')
  })

  it('public tier: denies when no session (and permitted_roles set)', () => {
    const result = checkContentTier(
      publicCtx({ permitted_roles: ['admin'] }),
      null,
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('role_not_permitted')
  })

  it('public tier: allows when session role is in permitted_roles', () => {
    const result = checkContentTier(
      publicCtx({ permitted_roles: ['member', 'admin'] }),
      session({ role: 'member' }),
    )
    expect(result.allowed).toBe(true)
  })

  it('project tier: allowed by tier but blocked by permitted_roles', () => {
    const result = checkContentTier(
      projectCtx({ permitted_roles: ['owner'] }),
      session({ project_id: 'proj-1', role: 'member' }),
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('role_not_permitted')
  })

  it('project tier: allowed when both tier and role pass', () => {
    const result = checkContentTier(
      projectCtx({ permitted_roles: ['owner', 'admin'] }),
      session({ project_id: 'proj-1', role: 'admin' }),
    )
    expect(result.allowed).toBe(true)
  })

  it('empty permitted_roles array does not block access', () => {
    // permitted_roles: [] means "no role restriction"
    expect(checkContentTier(publicCtx({ permitted_roles: [] }), null).allowed).toBe(true)
    expect(checkContentTier(projectCtx({ permitted_roles: [] }), session()).allowed).toBe(true)
  })

  it('entity tier: combined check — entity match required AND role must be permitted', () => {
    const ctx = entityCtx('org-123', { permitted_roles: ['admin'] })

    // Wrong entity
    expect(
      checkContentTier(ctx, session({ entity_id: 'other', role: 'admin' })).allowed,
    ).toBe(false)

    // Right entity, wrong role
    expect(
      checkContentTier(ctx, session({ entity_id: 'org-123', role: 'member' })).allowed,
    ).toBe(false)

    // Right entity, right role
    expect(
      checkContentTier(ctx, session({ entity_id: 'org-123', role: 'admin' })).allowed,
    ).toBe(true)
  })
})
