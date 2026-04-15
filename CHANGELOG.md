# Changelog

All notable changes to Inkwell. Format: [Keep a Changelog](https://keepachangelog.com/).

## [5.0.0-alpha.1] — 2026-04-15
### Added
- **Route gate middleware** — `ENABLED_ROUTES` env var controls which route groups are active. Analytics + content always enabled, all others gated.
- **Content route module** — extracted publish, posts, drafts handlers from index.ts
- **Analytics route module** — extracted view, reaction, subscribe, feedback, stats handlers from index.ts
- **Vitest test suite** — health, content, analytics, route-gate tests with @cloudflare/vitest-pool-workers
- **Documentation** — FORK-GUIDE.md, CONFIG-REFERENCE.md, API-REFERENCE.md
- **Git tags** — historical releases tagged (v3.0.0, v3.1.0, v3.2.0, v4.0.0)
- **6 new env vars** — BUSINESS_NAME, BUSINESS_PHONE, BUSINESS_EMAIL, CHAT_SYSTEM_PROMPT, SOS_REPORT_RECIPIENT, ENABLED_ROUTES

### Changed
- **index.ts refactored** — 401 lines → 76 lines. Clean router with imports, CORS, health check, 14 route mounts, and export.
- **Fork-hostile references removed** — zero Viamar/Mumega/Kasra hardcodes remain in worker code. All business-specific values now configurable via env vars.
- **wrangler.toml** — SITE_URL changed from hardcoded domain to example.com placeholder
- **Version bumped** to 5.0.0-alpha.1 (was 0.1.0)

### Architecture
- 14 route groups in separate files under workers/inkwell-api/src/routes/
- Route gate middleware at workers/inkwell-api/src/middleware/route-gate.ts
- Feature flags via ENABLED_ROUTES env var (default: all enabled)

## [Unreleased] — Gemini's WIP (on v4 branch)
### Added
- CONTRIBUTING.md — contributor guide for humans + agents
- ROADMAP.md — full feature checklist across P1-P4
- Troubleshooting FAQ page
- Docs collection wired into Command Palette (Cmd+K)
- Digital publishing commerce architecture doc

### Changed
- Refactored `graph.ts` to use `content-directory` module, simplified node/edge types
- Rewrote `site-config.md` — CSS variable map, typography section, mermaid diagrams
- Improved `getting-started.md` — added "Why Inkwell?" comparison table
- Rewrote `deployment.md` — actual wrangler commands, D1 migration steps, KV caching
- Updated `system-design.md` — evolutionary blueprint timeline (P1→P4)
- Fixed course lessons 3, 7, 8

### Removed
- Team profile pages (moved to mumega-site — Inkwell is forkable)
- Topic pages (agentic-economy, sovereign-worker — Mumega-specific)
- TROP product page (internal project)
- graphify-out/cache/ from git tracking (now gitignored)

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
