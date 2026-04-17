/**
 * Inkwell Plugin Architecture — Core Type Definitions
 *
 * This file defines the contracts for Inkwell's plugin system.
 * Plugins are self-contained vertical modules (dashboard, commerce, topics, geo)
 * that integrate with Inkwell via the manifest interface and hexagonal port adapters.
 *
 * NOTE: HonoApp is declared locally as a structural interface so this file
 * compiles at the repo root without requiring hono in root node_modules.
 * When consumed inside workers/inkwell-api/ (where hono is installed),
 * the real `Hono<any>` satisfies this interface automatically.
 */

// Structural stand-in for Hono — matches the subset plugins need.
// Use `import type { Hono } from 'hono'` inside the worker package instead.
export interface HonoApp {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  route(path: string, router: any): this
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(path: string, ...handlers: any[]): this
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post(path: string, ...handlers: any[]): this
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  put(path: string, ...handlers: any[]): this
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete(path: string, ...handlers: any[]): this
}

// ---------------------------------------------------------------------------
// Plugin Manifest
// ---------------------------------------------------------------------------

/**
 * The interface every Inkwell plugin exports as its default.
 * Plugins declare their capabilities here — routes, MCP tools, widgets, config.
 */
export interface PluginManifest {
  name: string
  version: string
  description: string

  /** Worker routes this plugin adds — mounts routes on the shared Hono app */
  mountRoutes?: (app: HonoApp) => void

  /** MCP tools this plugin registers on the /mcp endpoint */
  mcpTools?: McpToolDef[]

  /** Dashboard widget component names this plugin contributes */
  dashboardWidgets?: string[]

  /** Config key defaults — merged into inkwell.config.ts at startup */
  configDefaults?: Record<string, unknown>

  /** D1 migration file paths relative to the plugin directory */
  migrations?: string[]

  /** Minimum role required to access this plugin's pages and routes. Default: 'viewer' */
  requiredRole?: InkwellRole
}

/**
 * A single MCP tool definition registered by a plugin.
 */
export interface McpToolDef {
  name: string
  description: string
  /** JSON Schema describing the tool's input */
  inputSchema: Record<string, unknown>
  /** The tool handler — receives validated args + the Worker env */
  handler: (args: Record<string, unknown>, env: unknown) => Promise<unknown>
}

// ---------------------------------------------------------------------------
// Port Interfaces — Hexagonal Architecture Adapters
// ---------------------------------------------------------------------------

/**
 * Database port — wraps D1 (or any relational store) behind a stable interface.
 * Plugins receive this via dependency injection, never access D1 bindings directly.
 */
export interface DatabasePort {
  /** Execute a SELECT query, returning typed rows */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  /** Execute an INSERT / UPDATE / DELETE, returning affected rows */
  execute(sql: string, params?: unknown[]): Promise<{ changes: number }>
  /** Run multiple statements atomically */
  batch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<void>
}

/**
 * Auth port — session resolution for incoming Worker requests.
 */
export interface AuthPort {
  /** Resolve the authenticated user from a request, or null if unauthenticated */
  getUser(request: Request): Promise<AuthUser | null>
  /** Resolve the authenticated user or throw a 401 Response */
  requireUser(request: Request): Promise<AuthUser>
}

/**
 * Authenticated user shape returned by AuthPort.
 */
export interface AuthUser {
  email: string
  tenant_slug?: string
  role?: 'owner' | 'admin' | 'manager' | 'member' | 'viewer'
}

/**
 * CRM port — contact and opportunity management.
 * Plugins use this to write leads without knowing the underlying CRM.
 */
export interface CRMPort {
  /** Create a new contact, returns the CRM contact ID */
  createContact(data: {
    email: string
    name?: string
    phone?: string
    [key: string]: unknown
  }): Promise<string>
  /** Update an existing contact by CRM ID */
  updateContact(id: string, data: Record<string, unknown>): Promise<void>
  /** Create an opportunity linked to a contact, returns the CRM opportunity ID */
  createOpportunity(data: {
    contact_id: string
    title: string
    value_cents: number
  }): Promise<string>
}

/**
 * Search port — full-text and vector search over plugin content.
 */
export interface SearchPort {
  /** Index a document by ID with optional metadata */
  index(id: string, content: string, metadata?: Record<string, unknown>): Promise<void>
  /** Search, returning ranked results with scores */
  search(query: string, limit?: number): Promise<Array<{ id: string; score: number }>>
}

// ── RBAC ──────────────────────────────────────────────────────────────────────

/** Standard roles — every Inkwell instance ships with these. */
export type InkwellRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer'

/** Role hierarchy — higher number = more access */
export const ROLE_HIERARCHY: Record<InkwellRole, number> = {
  viewer: 1,
  member: 2,
  manager: 3,
  admin: 4,
  owner: 5,
}

/** Permission check: does userRole have at least requiredRole's level? */
export function hasRole(userRole: InkwellRole, requiredRole: InkwellRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0)
}
