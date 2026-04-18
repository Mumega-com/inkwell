# Changelog

All notable changes to Inkwell. Format: [Keep a Changelog](https://keepachangelog.com/).

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
- **4 Mumega Network MCP tools** — remember, recall, create_task, browse_marketplace (require MUMEGA_API_URL)
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

### Known Gaps (by design — queued for v5.3+)
- Plugin routes are statically imported in index.ts, not mounted via `plugin.mountRoutes()` — Sprint 3
- MCP tools are hardcoded in mcp/routes.ts, not collected via `collectMcpTools()` — Sprint 3
- Adapter registry (getAdapter/setAdapter) is defined but unused — plugins access env bindings directly — Sprint 4
- RBAC middleware defined but not enforced on routes — Sprint 3
- `config.plugins[]` declared but not gated at runtime — Sprint 3

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
