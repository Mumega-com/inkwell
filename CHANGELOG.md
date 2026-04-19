# Changelog

All notable changes to Inkwell. Format: [Keep a Changelog](https://keepachangelog.com/).

## [7.5.0] — 2026-04-19

### Added
- **Event tracking** — `POST /api/analytics/event` public endpoint: append-only event stream with SHA-256 visitor hashing, UTM capture, session IDs, geo/device detection
- **Funnel analysis** — `GET /api/analytics/funnel?steps=Page Viewed,Form Started,Form Submitted&days=30` with conversion rates and dropoff
- **Behavioral cohorts** — `GET /api/analytics/cohorts` groups visitors by engagement (power users, new, returning, at-risk) + UTM source attribution
- **Content recommendations** — `GET /api/analytics/recommendations/:slug` via knowledge graph + engagement weighting
- **UTM middleware** — parses utm_source/medium/campaign/content/term + gclid/fbclid from query strings on every request
- **Visitor profile middleware** — first-party identity stitching: anonymous visitor_hash (daily SHA-256 salt) linked to portal_account_id on auth, fire-and-forget via waitUntil
- **Event aggregate rollups** — flywheel-driven daily rollups into event_aggregates table
- **Migration 0006** — events, visitor_profiles, event_aggregates tables with 8 indexes
- **17 kernel tests** — visitor hash determinism, UTM parsing (6 scenarios), funnel calculation (5 scenarios), event structure, visitor profile stitching

### Design Decisions
- No new port — events/UTMs/profiles are analytics plugin concerns, not a new capability abstraction. Kernel stays lean.
- Server-side only — no cookies, no fingerprinting, no third-party scripts. Privacy-first collection.
- Daily hash salt — gives session-level stitching (same IP = same hash within a day) without persistent tracking.

## [7.4.0] — 2026-04-19

### Added
- **FeedbackPort** — 16th hexagonal port: submitResponse(), getResponses(), getAggregates(), submitVote(), listFeatures(), updateFeatureStatus(), storeClassification(), getUnclassified(), getInsights()
- **CfFeedbackAdapter** — D1 implementation (survey_responses, feature_requests, feature_votes, feedback_classifications tables)
- **Feedback plugin** — 21st plugin: 10 API routes (survey response submission, feature voting, NPS aggregates, insights, churn signals)
- **FeedbackWidget** — React island: contextual multi-question micro-survey (NPS/rating/choice/text/boolean), step-through UX, public submission
- **NpsWidget** — React island: standalone 0-10 NPS scale with optional follow-up text, localStorage dedup
- **FeatureVoteBoard** — React island: feature request voting board with upvotes, status badges, submit form
- **LLM feedback classification** — flywheel integration: auto-classify freetext as bug/friction/feature_request/praise via Workers AI (Llama 3.1)
- **Churn signal scoring** — computed from sentiment trends + friction/bug rates
- **3 MCP tools** — get_feedback_summary, trigger_survey, get_churn_signals
- **Migration 0005** — survey_responses, feature_requests, feature_votes, feedback_classifications tables with indexes
- **27 kernel tests** — full FeedbackPort contract coverage (MockFeedbackAdapter)
- **Feedback config** — inkwell.config.ts feedback.surveys[], votingEnabled, classifyEnabled

## [7.3.0] — 2026-04-19

### Added
- **SeoPort** — 15th hexagonal port: logCrawl(), getCrawlStats(), upsertRedirect(), listRedirects(), deleteRedirect(), matchRedirect(), setMetaOverride(), getMetaOverride(), listMetaOverrides(), deleteMetaOverride()
- **CfSeoAdapter** — D1 implementation of SeoPort (crawl logs, redirect engine, meta overrides)
- **Edge SEO middleware** — dynamic robots.txt, bot detection (13 UA patterns → 6 canonical names), fire-and-forget crawl logging via waitUntil, redirect engine
- **SEO plugin** — 20th plugin: /api/seo/* routes (crawl stats, redirect CRUD, meta override CRUD, llms.txt)
- **Remark autolink** — Wikipedia-style entity linking via knowledge graph (max 3 links per 500 words, first-mention-only, case-insensitive, word boundary checking)
- **llms.txt + llms-full.txt** — machine-readable site summaries for AI crawlers (GEO/AEO optimization)
- **Programmatic geo pages** — Astro getStaticPaths() from config, LocalBusiness + ServiceArea JSON-LD schema, breadcrumbs, nearby location links
- **Geo sitemap** — geo pages auto-added to sitemap.xml when config.seo.geo.enabled is true
- **Migration 0014** — crawl_logs, seo_redirects, seo_meta_overrides tables with indexes
- **3 MCP tools** — seo_crawl_stats, manage_redirects, seo_audit
- **18 kernel tests** — full SeoPort contract coverage (MockSeoAdapter)

## [7.2.1] — 2026-04-19

### Fixed
- **Dashboard OTP auth flow** — verify-code now assigns `owner` role to first account per tenant, returns `sessionToken` + `role` in response
- **Login page** — writes `inkwell_auth_token`, `inkwell_user_role`, `inkwell_api_url`, `inkwell_onboarded` to localStorage after successful verify
- **Signup page** — same localStorage writes, eliminates infinite onboarding redirect loop
- **Migration 0013** — adds `role` column to `portal_accounts` table (default: `member`)

### Added
- **Port registry generated types** — 87 TypeScript modules in `kernel/ports/generated/` from SOS Pydantic models (via `json-schema-to-typescript`)
- **Handoff doc** — `HANDOFF-PORTS-v0.9.0.md` — port registry integration guide from Codex

## [7.2.0] — 2026-04-18

### Added
- **MediaImage component** — Astro component for responsive images from MediaPort (`<MediaImage id="..." />`)
- **MediaVideo component** — Astro component for video embeds with chapters and captions
- **MediaLibrary dashboard** — React island: grid view, search, upload, AI image generation, asset details modal
- **Dashboard media page** — `/dashboard/media` with nav link
- **ThumbHash generation** — CSS gradient placeholders extracted from Workers AI vision analysis on upload
- **Dashboard nav** — added Media tab between Work and Chat

## [7.1.0] — 2026-04-18

### Added
- **MediaPort** — 14th hexagonal port: upload(), get(), describe(), transcribe(), transform(), search(), list(), delete(), generateImage()
- **CfMediaAdapter** — R2 + D1 + Workers AI (llama-3.2-vision, whisper-large-v3-turbo, flux-1-schnell)
- **Media plugin** — 19th plugin, 8 routes at /api/media/* (upload, describe, transcribe, transform, generate, search, list, delete)
- **4 MCP tools** — upload_media, describe_image, generate_image, search_media (16 total)
- **ContentSourcePort** — 13th hexagonal port with 4 adapters (Obsidian, GitHub, Notion, Google Drive)
- **Sync plugin** — 18th plugin, pulls from configured content sources, compiles MDX, stores in KV, upserts graph
- **D1 migration 0012** — media_assets table with tenant/content_type/graph_slug/source_type indexes
- **Workers AI binding** — wrangler.toml AI binding for vision, transcription, image generation
- **11 media port tests + 12 content source tests** — 123 total kernel tests

### Architecture
- 14 port interfaces, 19 plugins, 16 MCP tools
- Media assets auto-upserted as knowledge graph nodes on upload/generate
- Content sources configured via inkwell.config.ts contentSources[] array
- AI analysis optional — adapter degrades gracefully without Workers AI binding
- Framework purification: instance-specific components (ChatWidget, ContractForm, ContractPortal, MovingQuoteForm) moved to instances/

## [7.0.0] — 2026-04-18

### Added
- **Organism Plugin** — managed agent provisioning, config, budget tracking per tenant
- **AgentPort** — 9th hexagonal port: provision(), getConfig(), updateConfig(), recordUsage(), checkBudget()
- **BusPort** — 10th hexagonal port: send(), broadcast(), subscribe(), inbox()
- **MemoryPort** — 11th hexagonal port: remember(), recall(), search()
- **EconomyPort** — 12th hexagonal port (was 11th): recordUsage(), getBalance(), charge(), transfer()
- **D1AgentAdapter** — agent config + usage tracking backed by D1
- **SOSBusAdapter** — SOS bus over HTTP (poll-based, SSE planned for v0.8.x)
- **SOSMemoryAdapter** — Mirror vector memory with tenant prefix isolation
- **SOSEconomyAdapter** — SOS Economy REST API
- **StandaloneBusAdapter** — no-op for Inkwell without SOS
- **StandaloneMemoryAdapter** — in-memory keyword search
- **StandaloneEconomyAdapter** — unlimited balance (Stripe handles billing)
- **Agent-to-agent transactions**: POST /api/network/quote, /quote/respond, /transact
- **Graph-driven discovery**: GET /api/network/discover (BFS + cross-tenant grouping)
- **Reputation scoring**: GET /api/network/reputation (nodes + inbound links × 3)
- **Plugin marketplace**: GET /api/marketplace, POST /publish, /install, DELETE /uninstall
- **D1 migrations 0010-0011** — agent_configs, agent_usage, tenant_plugins
- **10 new tests** — D1AgentAdapter (7), standalone adapters (3) — total 100 tests

### Architecture
- 11 port interfaces: Database, Auth, CRM, Search, Session, Content, Storage, Graph, Agent, Bus, Memory, Economy
- SOS_MODE env var switches between SOS and standalone adapters automatically
- Organisms discover each other through graph proximity, transact via bus + economy
- Plugin marketplace uses graph (type='plugin') — no separate registry needed
- Bundle: 383 KiB / ~90 KiB gzip (within 1MB Worker limit)
- 17 plugins active

## [6.1.0] — 2026-04-18

### Added
- **Cross-tenant edge resolution** — when tenant A's wikilink matches tenant B's public node, bidirectional cross-tenant edges are created automatically
- **GraphPort.resolveCrossTenantEdges()** — finds matching public nodes from other tenants, creates edges
- **GraphPort.queryNetwork()** — query public nodes across ALL tenants with tag/type/limit filters
- **GET /api/graph/network** — the mycelium: public graph across all organisms
- **GET /api/graph/search?q=** — text search across network (title + tags, public nodes only)
- **POST /api/ingest** now auto-resolves cross-tenant edges and reports count in response
- **SOS integration contract** — Codex reviewed and approved, 9 questions answered, port interfaces adjusted

### Architecture
- Cross-tenant edges form the mycorrhizal network — organisms discover each other through documentation
- Privacy boundary enforced: only public nodes visible cross-tenant
- BusPort.subscribe adjusted to return async unsubscribe handle (per Codex review)
- EconomyPort.charge returns structured result with tx_id + remaining_balance (per Codex review)

## [6.0.0] — 2026-04-18

### Added
- **MDX Knowledge Engine** — content becomes a self-building knowledge graph
- **kernel/processors/** — 3 pure AST processors extracted from shabrang-cms:
  - `remark-wikilinks` — `[[target]]` → linked HTML + link extraction (configurable basePath, no global state)
  - `remark-blocks` — 14 custom block types (tldr, callout, chart, timeline, metric, mermaid, etc.)
  - `mdx-compiler` — lightweight runtime compiler for Workers (frontmatter + wikilinks + blocks → HTML)
- **GraphPort** — 8th hexagonal port interface:
  - `upsertNode()`, `upsertEdge()`, `ingest()` — write graph data
  - `getBacklinks()`, `getNeighbors()` (BFS traversal), `queryNodes()`, `getNode()` — query graph
  - `GraphNode` type with tenant + visibility fields for multi-tenant organisms
  - `GraphEdge` types: wikilink, tag, series, backlink, cross-tenant
- **D1GraphAdapter** — GraphPort implementation using DatabasePort
- **D1 migration 0009** — `graph_nodes` (slug+tenant PK) + `graph_edges` (source+target+type+tenant PK) with 5 indexes
- **Content plugin graph endpoints**:
  - `POST /api/ingest` — raw MDX → compile → store HTML + raw in KV → upsert graph
  - `GET /api/graph` — tenant graph (public nodes, filterable by tag/type)
  - `GET /api/graph/node/:slug` — single node + BFS neighbors (depth 1-3)
  - `GET /api/graph/backlinks/:slug` — backlinks with enriched source nodes
- **Publish → graph pipeline** — `POST /publish` now auto-feeds graph (node + wikilink + tag edges)
- **33 new tests** — mdx-compiler (16), d1-graph (17) — total 90 tests

### Architecture
- 8 port interfaces: Database, Auth, CRM, Search, Session, Content, Storage, **Graph**
- Content is the graph: wiki-links ARE edges, documents ARE nodes
- Agents document businesses via `/api/ingest`, graph builds itself
- Bundle: 353 KiB / 84 KiB gzip (within 1MB Worker limit)

## [5.4.0] — 2026-04-18

### Added
- **SessionPort** — `get(key)`, `set(key, value, ttl?)`, `delete(key)` — abstracts session storage
- **ContentPort** — `getPage(key)`, `putPage(key, html)`, `listPages(prefix)` — abstracts HTML content storage
- **StoragePort** — `get(key)`, `put(key, data, contentType?)`, `delete(key)`, `list(prefix?)` — abstracts blob storage
- **KVSessionAdapter** — CloudFlare KV implementation of SessionPort (with expirationTtl)
- **KVContentAdapter** — CloudFlare KV implementation of ContentPort
- **R2StorageAdapter** — CloudFlare R2 implementation of StoragePort
- **Adapter middleware** — creates per-request port instances via Hono context (`c.get('sessions')`, `c.get('content')`, `c.get('storage')`)
- **16 new tests** — kv-session (5), kv-content (4), r2-storage (7) — total 57 tests

### Changed
- All plugins migrated from `c.env.SESSIONS` / `c.env.CONTENT` to `c.get('sessions')` / `c.get('content')`
- `tenant-cache.ts` rewritten to accept `SessionPort` instead of `KVNamespace`
- `tenant-content.ts` rewritten to accept `ContentPort` instead of `KVNamespace`
- Auth middleware uses `SessionPort` for session lookups (manual JSON.parse replaces KV's `get(key, 'json')`)
- Worker index.ts: adapter middleware runs before tenant resolver (ordering fix)

### Architecture
- **Full hexagonal boundary**: 7 port interfaces (Database, Auth, CRM, Search, Session, Content, Storage)
- Zero `c.env.DB_*`, `c.env.SESSIONS`, `c.env.CONTENT` references remain in plugins
- Only `c.env.*` left in plugins: string config vars (STRIPE_SECRET_KEY, etc.) — universal across clouds
- Plugin layer is now cloud-portable: same plugins run on CF, GC, or AWS with different adapters

### Resolved
- Non-DB env access (`c.env.SESSIONS`, `c.env.CONTENT`) fully ported to adapter ports
- Per-request adapter instantiation via Hono context (no concurrent request race conditions)

### Known Gaps (queued for v6.0)
- SOS integration ports (Bus, Memory, Economy) defined in roadmap but not implemented
- No GC/AWS adapter implementations yet (ports are ready, adapters are CF-only)

## [5.2.0] — 2026-04-18

### Added
- **Microkernel architecture** — `kernel/` directory (5 files, 430 lines):
  - `types.ts` — PluginManifest, McpToolDef, hexagonal port interfaces (DatabasePort, AuthPort, CRMPort, SearchPort), RBAC types
  - `plugin-loader.ts` — Plugin registry, route mounting, MCP tool collection, config merging
  - `adapter-registry.ts` — Hexagonal port adapters (setAdapter, getAdapter, tryGetAdapter)
  - `roles.ts` — RBAC hierarchy (owner > admin > manager > member > viewer), canAccessPlugin, filterNavByRole
  - `theme.ts` — CSS var generator from config (moved from src/lib/)
- **12 plugins** extracted as self-contained vertical modules:
  - dashboard (7 React components), commerce (Glass), content, mcp, contracts, telegram, chat, diagnostics, discovery, payments, onboarding (wizard), notifications (bell)
  - Each plugin has: manifest.ts (name, version, requiredRole, configDefaults) + index.ts + routes or components
- **RBAC system** — InkwellRole type, role hierarchy, requiredRole on plugin manifests, middleware defined
- **Onboarding wizard** — 5-step React component (profile → business → discover → goals → invite)
- **Notifications plugin** — floating bell, dropdown, real-time updates
- **Team invite endpoint** — invite members to tenant
- **4 Network MCP tools** — remember, recall, create_task, browse_marketplace (require NETWORK_API_URL)
- **Shadcn UI components** — avatar, badge, button, card, chart, dialog, input, progress, select, separator, table, tabs, textarea
- **MCP tools test suite** — 400 lines, validates all 12 tools
- **Inkwell manual** — 5-chapter book (Logos, Telos, Kairos, Nomos, Threshold)
- **Feature docs** — adaptive pages, glass commerce, transparent diagnostics, glass dashboard
- **D1 migration 0004** — content index with tenant partitioning
- **.env.example** for Worker

### Changed
- **README.md** rewritten — "Give your AI a business" tagline, badges, v5.2 framing
- **CLAUDE.md** updated to v5.2
- **package.json** version bumped to 5.2.0
- **inkwell.config.ts** — brand section added (voice, teamNames, statusLabels, priorityLabels, counterpartyNames), plugins array controls which plugins are active

### Architecture
- Microkernel: kernel/ owns contracts, plugins own features
- 12 plugins in plugins/ with manifest + routes/components
- Plugin loader registers at Worker startup
- Adapter registry defines hexagonal ports (implementations pending — Sprint 3/4)
- RBAC kernel defined (enforcement pending — Sprint 3)
- Config-driven plugin activation via `config.plugins[]`

### Resolved (all former "Known Gaps" closed in this release)
- Plugin routes mounted via `plugin.mountRoutes()` — static imports replaced with kernel loop
- MCP tools collected via `collectMcpTools()` — mcp/routes.ts 765→117 lines
- D1DatabaseAdapter wired — all 90 call sites across 13 plugins migrated from `c.env.DB_*` to `c.get('db_core')` / `c.get('db_analytics')` / `c.get('db_marketing')`
- RBAC enforced per-plugin via Hono sub-app pattern + system token bypass
- `config.plugins[]` gated at runtime — unlisted plugins don't load

### Known Gaps (queued for v5.3+)
- No test suite — adapter boundary makes plugins unit-testable but tests don't exist yet
- Non-DB env access (`c.env.SESSIONS`, `c.env.CONTENT`, Stripe, Twilio) not ported to adapters yet
- SOS integration ports (Bus, Memory, Economy) defined in roadmap but not implemented

## [5.1.0] — 2026-04-16

### Added
- **Multi-tenant system** — hostname-based tenant resolution middleware, KV-cached config (5min TTL)
- **Tenant-scoped content** — all KV keys and D1 queries prefixed with tenant_slug
- **Edge tenant cache** — zero origin roundtrips for repeat requests
- **API usage tracking** — per-tenant, per-day call counting middleware (D1, fire-and-forget)
- **Static page serving** — catch-all route serves pre-rendered HTML from KV per tenant subdomain
- **Wildcard DNS** — `*.mumega.com` routes to Inkwell Worker for tenant subdomains
- **Telegram content approval** — /drafts, /approve, /reject, /status bot commands
- **Glass Commerce engine** — D1 transaction ledger, royalties (5% platform / 95% tenant), metering
- **Transparent Diagnostics engine** — template-based squad health narratives, 30-day history
- **CI/CD deploy workflow** — GitHub Actions for automated deployment

### Changed
- **wrangler.toml** — added account_id for non-interactive deploy

### Migrations
- `0006_digital_publishing.sql` — royalty ledger, content payouts
- `0007_glass_commerce.sql` — Glass Commerce transaction tables
- `0008_diagnostics.sql` — system health metrics

## [5.0.0-alpha.1] — 2026-04-15

### Added
- **Route gate middleware** — `ENABLED_ROUTES` env var controls which route groups are active
- **Content route module** — extracted from index.ts
- **Analytics route module** — extracted from index.ts
- **Vitest test suite** — health, content, analytics, route-gate tests with @cloudflare/vitest-pool-workers
- **Documentation** — FORK-GUIDE.md, CONFIG-REFERENCE.md, API-REFERENCE.md
- **Git tags** — historical releases tagged (v3.0.0, v3.1.0, v3.2.0, v4.0.0)
- **6 new env vars** — BUSINESS_NAME, BUSINESS_PHONE, BUSINESS_EMAIL, CHAT_SYSTEM_PROMPT, SOS_REPORT_RECIPIENT, ENABLED_ROUTES
- CONTRIBUTING.md, ROADMAP.md, troubleshooting FAQ, digital publishing architecture doc

### Changed
- **index.ts refactored** — 401 → 76 lines. 14 route mounts via imports.
- **Fork-hostile references removed** — zero hardcodes remain
- **wrangler.toml** — SITE_URL changed to example.com placeholder
- **Version bumped** to 5.0.0-alpha.1

### Removed
- Team profile pages, topic pages, TROP page (moved to mumega-site)
- graphify-out/cache/ from git tracking

## [4.0.0] — 2026-04-15
### Added
- **Contract portal** — e-signature, insurance selection, 14 exclusion clauses, SMS (Twilio) + email (Resend) notifications
- **Stripe payments** — 3 tiers, webhook handler, subscription status
- **Daily flywheel** — cron at 6am UTC, GSC + GA4 connectors, D1 snapshots, week-over-week scoring
- **MCP server** — 8 tools (publish_content, get_dashboard, get_seo_data, get_leads, create_checkout, subscription_status, send_telegram, site_info), streamable HTTP
- **Dashboard** — 5 pages (overview, SEO, leads, campaigns, calendar), KPI cards, chart components
- **Chat widget** — floating button, FAQ fallback, localStorage history, SOS bus forwarding
- **Business discovery** — 25-question form, 5-dimension scoring, 90-day plan generator, Canadian grant scanner
- **Course engine** — enrollment, drip logic, certificate generation, 8-lesson course
- **Auth system** — email/phone code-based, KV sessions, portal accounts
- **Telegram portal** — bot integration, message forwarding, portal page
- **Questionnaire system** — daily business health checks, D1 storage
- **Domestic moving landing page** with quote form

### Changed
- Split D1 into 3 databases: DB_CORE, DB_ANALYTICS, DB_MARKETING
- Added 2 KV namespaces: CONTENT, SESSIONS
- Worker routes expanded from 3 to 11 route groups
- CLAUDE.md rewritten for v4 architecture

### Architecture
- Astro 6 + Cloudflare Workers (Hono) + 3×D1 + 2×KV + R2
- Stripe + Twilio + Resend + Telegram Bot API
- SOS MCP integration (SSE on :6070)
- inkwell.config.ts drives everything

### Stats
- 189 files changed, +21,394 lines, -2,685 lines
- 17 commits, 3 agents (Kasra, Gemini, Codex)
- $0/month infrastructure (Cloudflare free tier)

## [3.1.0] — 2026-04-10
### Added
- Publish API — POST content via HTTP
- Publishing skill for agents (npm run publish)
- Slug uniqueness check + draft status
- 5 new content blocks + MDX support
- Google Analytics (G-WXKH19HD89) + Clarity (w9k4oxlqz8)
- OG images for all 14 posts
- Tag listing pages with clickable links
- P4 organism layer spec (8 features designed)
- MIT License, .env.example

### Changed
- Made repo fork-ready (genericized branding)
- Separated Inkwell (forkable) from SOS integration (Mumega-specific)

## [3.0.0] — 2026-04-10
### Added
- **P1 Core (8/8)** — wikilinks + backlinks, 9 :: block types, inline charts, TOC sidebar, JSON-LD (14 schemas), reading time, analytics injection, OG + Twitter Card
- **P2 Product (9/10)** — Pagefind search + Cmd+K, D1 analytics Worker, feature flags, Mermaid diagrams, OG image generation, auto-description, Twitter Card verified
- **P3 Differentiators (9/10)** — i18n + RTL + hreflang, KaTeX math, social proof bar, annotations API, content flywheel script, R2 media upload, KV edge cache

### Architecture
- Astro 6 framework, 9 server components + 8 React islands
- Cloudflare Pages + D1 + R2 + KV + Worker (Hono)
- Config-driven via inkwell.config.ts
- Pagefind static search + Mermaid diagrams

### Stats
- 26/28 features completed in ~16 hour session
- ~15 subagents across 4 rounds
- Agent: mumega-com-web

## [1.0.0] — 2026-04-10
### Added
- Initial Astro scaffold with content collections (Zod schemas)
- Config-driven theme (inkwell.config.ts → CSS custom properties)
- Dark/light/system toggle
- Blog listing + individual post pages
- Explore page with knowledge graph
- RSS feed + sitemap
- 404 page
- Ingest script (content/inbox/ → content/en/)
