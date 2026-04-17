import type { InkwellRole, PluginManifest } from './types'
import { hasRole } from './types'
import { getActivePlugins } from './plugin-loader'

/**
 * Check if a role can access a specific plugin.
 * Compares the user's role against the plugin's required role using the hierarchy.
 */
export function canAccessPlugin(
  userRole: InkwellRole,
  pluginName: string,
  activePluginNames: string[]
): boolean {
  const plugins = getActivePlugins(activePluginNames)
  const plugin = plugins.find(p => p.name === pluginName)
  if (!plugin) return false

  const requiredRole = plugin.requiredRole || 'viewer'
  return hasRole(userRole, requiredRole)
}

/**
 * Filter nav items by role.
 * Returns only items that the user's role has permission to access.
 */
export function filterNavByRole<T extends { requiredRole?: InkwellRole }>(
  items: T[],
  userRole: InkwellRole
): T[] {
  return items.filter(item => {
    const required = item.requiredRole || 'viewer'
    return hasRole(userRole, required)
  })
}

/**
 * Resolve a role string to InkwellRole with fallback to 'viewer'.
 * Handles undefined, null, and invalid role strings gracefully.
 */
export function resolveRole(roleStr: string | undefined | null): InkwellRole {
  const validRoles: InkwellRole[] = ['owner', 'admin', 'manager', 'member', 'viewer']
  if (roleStr && validRoles.includes(roleStr as InkwellRole)) {
    return roleStr as InkwellRole
  }
  return 'viewer'
}
