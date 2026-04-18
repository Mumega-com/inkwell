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
  /** After ingesting content for a tenant, check if any wikilink targets match public nodes from OTHER tenants. Creates cross-tenant edges. */
  resolveCrossTenantEdges(slug: string, wikilinks: string[], tenant: string): Promise<GraphEdge[]>
  /** Query public nodes across ALL tenants (the network graph) */
  queryNetwork(filter?: { tag?: string; type?: string; limit?: number }): Promise<GraphData>
}

// ─── Agent Port (v6.2) ──────────────────────────────────────────────────────

/** Configuration for a tenant's managed agent */
export interface AgentConfig {
  tenantId: string
  model: 'haiku' | 'sonnet' | 'opus'
  systemPrompt: string
  mcpServers: Array<{ url: string; token?: string }>
  tools: string[]
  budgetPerDay: number       // max spend per day in cents
  budgetPerMonth: number     // max spend per month in cents
  status: 'active' | 'paused' | 'provisioning' | 'error'
  anthropicAgentId?: string  // ID returned by Anthropic API
  createdAt: string
  updatedAt: string
}

/** Usage record for agent budget tracking */
export interface AgentUsage {
  tenantId: string
  date: string               // YYYY-MM-DD
  sessionHours: number
  inputTokens: number
  outputTokens: number
  costCents: number
}

export interface AgentPort {
  /** Provision a new managed agent for a tenant */
  provision(config: Omit<AgentConfig, 'status' | 'createdAt' | 'updatedAt'>): Promise<AgentConfig>
  /** Get agent config for a tenant */
  getConfig(tenantId: string): Promise<AgentConfig | null>
  /** Update agent config */
  updateConfig(tenantId: string, updates: Partial<Pick<AgentConfig, 'model' | 'systemPrompt' | 'mcpServers' | 'tools' | 'budgetPerDay' | 'budgetPerMonth' | 'status'>>): Promise<AgentConfig>
  /** Record usage for budget tracking */
  recordUsage(usage: AgentUsage): Promise<void>
  /** Get usage for a tenant within a date range */
  getUsage(tenantId: string, from: string, to: string): Promise<AgentUsage[]>
  /** Check if a tenant has budget remaining today */
  checkBudget(tenantId: string): Promise<{ allowed: boolean; remainingCents: number; reason?: string }>
}

// ─── Bus Port (v6.3) ────────────────────────────────────────────────────────

export interface BusMessage {
  from: string
  to?: string
  text: string
  ts: string
  kind?: string
}

export interface BusPort {
  /** Send a message to a specific agent */
  send(to: string, text: string): Promise<void>
  /** Broadcast a message to all agents */
  broadcast(text: string): Promise<void>
  /** Subscribe to incoming messages (returns async unsubscribe handle) */
  subscribe(callback: (msg: BusMessage) => Promise<void>): Promise<{ unsubscribe: () => Promise<void> }>
  /** Read recent inbox messages */
  inbox(limit?: number): Promise<BusMessage[]>
}

// ─── Memory Port (v6.3) ─────────────────────────────────────────────────────

export interface MemoryResult {
  id: string
  content: string
  metadata?: Record<string, unknown>
  score?: number
  createdAt: string
}

export interface MemoryPort {
  /** Store a memory with optional metadata, returns memory ID */
  remember(content: string, metadata?: Record<string, unknown>): Promise<string>
  /** Recall memories by semantic query */
  recall(query: string, limit?: number): Promise<MemoryResult[]>
  /** Search memories with filters */
  search(query: string, filters?: Record<string, unknown>): Promise<MemoryResult[]>
}

// ─── Economy Port (v6.3) ────────────────────────────────────────────────────

export interface ChargeResult {
  charged: boolean
  tx_id: string
  remaining_balance: number
  reason?: string
}

export interface EconomyPort {
  /** Record usage for a tenant */
  recordUsage(tenantId: string, type: string, amount: number): Promise<void>
  /** Get balance for a tenant */
  getBalance(tenantId: string): Promise<{ balance: number; currency: string }>
  /** Charge a tenant */
  charge(tenantId: string, amount: number, reason: string): Promise<ChargeResult>
  /** Transfer between tenants */
  transfer(from: string, to: string, amount: number, reason: string): Promise<ChargeResult>
}

// ─── Content Source Port (v7.1) ─────────────────────────────────────────────

/** A single content item pulled from an external source */
export interface ContentSourceItem {
  /** URL-safe identifier derived from the source (filename, page id, etc.) */
  slug: string
  /** Human-readable title */
  title: string
  /** Raw markdown or MDX content */
  content: string
  /** ISO timestamp of last modification in the source */
  updatedAt: string
  /** Source-specific metadata (file path, notion page id, drive file id, etc.) */
  metadata?: Record<string, unknown>
}

/**
 * Content source port — pulls content from external systems into Inkwell.
 * Each adapter implements one source type (Obsidian vault, Notion database,
 * GitHub repo, Google Drive folder). The sync plugin calls these to feed
 * the /api/ingest pipeline.
 */
export interface ContentSourcePort {
  /** Human-readable name of this source (e.g. 'obsidian', 'notion') */
  name: string
  /** List all available content items from the source */
  list(): Promise<ContentSourceItem[]>
  /** Fetch only items changed since the given ISO timestamp. If omitted, returns all. */
  sync(since?: string): Promise<ContentSourceItem[]>
}

// ─── Media Port (v7.1) ────────────────────────────────────────────────────

/** A media asset stored and analyzed by Inkwell */
export interface MediaAsset {
  id: string
  tenant?: string
  filename: string
  contentType: string
  r2Key: string
  width?: number
  height?: number
  sizeBytes: number
  altText?: string
  description?: string
  tags: string[]
  thumbhash?: string
  nsfwScore?: number
  transcript?: string
  chapters?: Array<{ time: number; title: string }>
  variants: Record<string, string>  // variant name → URL
  graphSlug?: string
  sourceType: 'upload' | 'generate' | 'import'
  createdAt: string
  updatedAt: string
}

/**
 * Media port — AI-powered media pipeline for images and video.
 * Handles upload, AI analysis (vision + transcription), transforms,
 * image generation, and search. Assets become knowledge graph nodes.
 */
export interface MediaPort {
  /** Upload a file, store in R2, run AI analysis, return enriched asset */
  upload(file: ArrayBuffer, filename: string, contentType: string, tenant?: string): Promise<MediaAsset>
  /** Get asset metadata by ID */
  get(id: string): Promise<MediaAsset | null>
  /** Run AI vision analysis on an image asset — returns alt text, description, tags, NSFW score */
  describe(id: string): Promise<{ altText: string; description: string; tags: string[]; nsfwScore: number }>
  /** Transcribe a video/audio asset — returns transcript and auto-generated chapters */
  transcribe(id: string): Promise<{ transcript: string; chapters: Array<{ time: number; title: string }> }>
  /** Get a transformed variant URL (e.g. 'thumbnail', 'hero', 'og') */
  transform(id: string, variant: string): Promise<string>
  /** Search assets by text query (matches alt text, description, tags, transcript) */
  search(query: string, tenant?: string, limit?: number): Promise<MediaAsset[]>
  /** List assets with cursor pagination */
  list(tenant?: string, cursor?: string, limit?: number): Promise<{ assets: MediaAsset[]; cursor?: string }>
  /** Delete an asset and its R2 object */
  delete(id: string): Promise<void>
  /** Generate an image from a text prompt using Workers AI */
  generateImage(prompt: string, tenant?: string): Promise<MediaAsset>
}
