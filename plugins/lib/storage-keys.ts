/**
 * Shared localStorage key constants.
 * Derived from inkwell.config.ts network.storageKeyPrefix.
 *
 * React components import these instead of hardcoding keys.
 * When a fork changes config.network.storageKeyPrefix, all keys update.
 *
 * NOTE: React components can't import inkwell.config.ts at runtime
 * (it's a server-side file). These are compile-time constants
 * that must match the prefix set in config. The default is 'inkwell'.
 */

const PREFIX = 'inkwell'

export const STORAGE_KEYS = {
  apiUrl: `${PREFIX}_api_url`,
  authToken: `${PREFIX}_auth_token`,
  tenantSlug: `${PREFIX}_tenant_slug`,
  teamMembers: `${PREFIX}_team_members`,
  onboarded: `${PREFIX}_onboarded`,
  notificationsLastRead: `${PREFIX}_notifications_last_read`,
} as const
