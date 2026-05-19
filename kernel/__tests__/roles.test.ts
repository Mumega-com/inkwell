import { describe, it, expect, beforeEach } from 'vitest'
import { hasRole, ROLE_HIERARCHY } from '../types'
import { canAccessPlugin, filterNavByRole, resolveRole } from '../roles'
import { registerPlugin, clearPlugins } from '../plugin-loader'
import type { InkwellRole } from '../types'

describe('ROLE_HIERARCHY', () => {
  it('has correct ordering', () => {
    expect(ROLE_HIERARCHY.viewer).toBeLessThan(ROLE_HIERARCHY.member)
    expect(ROLE_HIERARCHY.member).toBeLessThan(ROLE_HIERARCHY.manager)
    expect(ROLE_HIERARCHY.manager).toBeLessThan(ROLE_HIERARCHY.admin)
    expect(ROLE_HIERARCHY.admin).toBeLessThan(ROLE_HIERARCHY.owner)
  })
})

describe('hasRole', () => {
  it('owner has all roles', () => {
    const roles: InkwellRole[] = ['owner', 'admin', 'manager', 'member', 'viewer']
    for (const r of roles) {
      expect(hasRole('owner', r)).toBe(true)
    }
  })

  it('viewer only has viewer', () => {
    expect(hasRole('viewer', 'viewer')).toBe(true)
    expect(hasRole('viewer', 'member')).toBe(false)
    expect(hasRole('viewer', 'admin')).toBe(false)
  })

  it('manager has manager, member, viewer', () => {
    expect(hasRole('manager', 'manager')).toBe(true)
    expect(hasRole('manager', 'member')).toBe(true)
    expect(hasRole('manager', 'viewer')).toBe(true)
    expect(hasRole('manager', 'admin')).toBe(false)
    expect(hasRole('manager', 'owner')).toBe(false)
  })
})

describe('resolveRole', () => {
  it('returns valid role unchanged', () => {
    expect(resolveRole('admin')).toBe('admin')
    expect(resolveRole('owner')).toBe('owner')
  })

  it('returns viewer for null/undefined', () => {
    expect(resolveRole(null)).toBe('viewer')
    expect(resolveRole(undefined)).toBe('viewer')
  })

  it('returns viewer for invalid strings', () => {
    expect(resolveRole('superadmin')).toBe('viewer')
    expect(resolveRole('')).toBe('viewer')
  })
})

describe('canAccessPlugin', () => {
  beforeEach(() => {
    clearPlugins()
  })

  it('returns true when user role meets plugin requirement', () => {
    registerPlugin({
      name: 'payments',
      version: '1.0.0',
      description: 'Payments',
      requiredRole: 'manager',
    })
    expect(canAccessPlugin('owner', 'payments', ['payments'])).toBe(true)
    expect(canAccessPlugin('admin', 'payments', ['payments'])).toBe(true)
    expect(canAccessPlugin('manager', 'payments', ['payments'])).toBe(true)
  })

  it('returns false when user role is below requirement', () => {
    registerPlugin({
      name: 'payments',
      version: '1.0.0',
      description: 'Payments',
      requiredRole: 'manager',
    })
    expect(canAccessPlugin('member', 'payments', ['payments'])).toBe(false)
    expect(canAccessPlugin('viewer', 'payments', ['payments'])).toBe(false)
  })

  it('defaults to viewer when no requiredRole set', () => {
    registerPlugin({
      name: 'analytics',
      version: '1.0.0',
      description: 'Analytics',
    })
    expect(canAccessPlugin('viewer', 'analytics', ['analytics'])).toBe(true)
  })

  it('returns false for inactive plugin', () => {
    registerPlugin({
      name: 'secret',
      version: '1.0.0',
      description: 'Secret',
    })
    expect(canAccessPlugin('owner', 'secret', [])).toBe(false)
  })
})

describe('filterNavByRole', () => {
  it('filters items by role', () => {
    const items = [
      { name: 'Dashboard', requiredRole: 'viewer' as InkwellRole },
      { name: 'Payments', requiredRole: 'owner' as InkwellRole },
      { name: 'Content', requiredRole: 'member' as InkwellRole },
    ]

    const visible = filterNavByRole(items, 'member')
    expect(visible.map(i => i.name)).toEqual(['Dashboard', 'Content'])
  })

  it('shows all items for owner', () => {
    const items = [
      { name: 'A', requiredRole: 'owner' as InkwellRole },
      { name: 'B', requiredRole: 'admin' as InkwellRole },
    ]
    expect(filterNavByRole(items, 'owner')).toHaveLength(2)
  })
})
