/**
 * Shared types re-exported for plugin use.
 * Plugins import from '../types' — this file provides the bridge.
 * Source of truth: workers/inkwell-api/src/types.ts
 */
export type { AppBindings, AuthSession, Env } from '../workers/inkwell-api/src/types'
