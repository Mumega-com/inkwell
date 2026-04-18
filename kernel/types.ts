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
  /** Execute a SELECT query, returning the first row or null */
  queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>
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

/**
 * Session port — key-value session storage (KV, Redis, DynamoDB, Firestore).
 */
export interface SessionPort {
  /** Get a session value by key, or null if not found / expired. */
  get(key: string): Promise<string | null>
  /** Set a session value with optional TTL in seconds. */
  set(key: string, value: string, ttlSeconds?: number): Promise<void>
  /** Delete a session by key. */
  delete(key: string): Promise<void>
}

/**
 * Content port — serves pre-rendered pages (KV, S3, GCS, Firestore).
 */
export interface ContentPort {
  /** Get a page by key, or null if not found. */
  getPage(key: string): Promise<string | null>
  /** Store a page by key. */
  putPage(key: string, html: string): Promise<void>
  /** List page keys matching a prefix. */
  listPages(prefix: string): Promise<string[]>
}

/**
 * Storage port — blob/file storage (R2, S3, GCS).
 */
export interface StoragePort {
  /** Get a file as a ReadableStream, or null if not found. */
  get(key: string): Promise<{ body: ReadableStream; contentType: string } | null>
  /** Upload a file. */
  put(key: string, data: ReadableStream | ArrayBuffer | string, contentType?: string): Promise<void>
  /** Delete a file by key. */
  delete(key: string): Promise<void>
  /** List file keys matching an optional prefix. */
  list(prefix?: string): Promise<string[]>
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

// ─── Graph Port ────────────────────────────────────────────────────────────
export interface GraphNode {
  slug: string
  title: string
  type: string           // 'blog' | 'topic' | 'concept' | 'lab' | etc.
  tags: string[]
  tenant?: string        // Multi-tenant: which organism owns this
  visibility: 'public' | 'private'
  author?: string
  date?: string
  url?: string
}

export interface GraphEdge {
  source: string         // source node slug
  target: string         // target node slug
  type: 'wikilink' | 'tag' | 'series' | 'backlink' | 'cross-tenant'
  tenant?: string        // Which tenant created this edge
  weight?: number        // Edge strength (shared tag count, etc.)
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface GraphPort {
  /** Upsert a node (insert or update by slug+tenant) */
  upsertNode(node: GraphNode): Promise<void>
  /** Upsert an edge */
  upsertEdge(edge: GraphEdge): Promise<void>
  /** Batch upsert nodes and edges (from a content ingest) */
  ingest(data: GraphData): Promise<void>
  /** Get all edges pointing TO this slug */
  getBacklinks(slug: string, tenant?: string): Promise<GraphEdge[]>
  /** Get nodes and edges within N hops of a slug */
  getNeighbors(slug: string, depth?: number, tenant?: string): Promise<GraphData>
  /** Query nodes by filter */
  queryNodes(filter: { tag?: string; type?: string; tenant?: string; visibility?: 'public' | 'private' }): Promise<GraphNode[]>
  /** Get a single node by slug */
  getNode(slug: string, tenant?: string): Promise<GraphNode | null>
}
