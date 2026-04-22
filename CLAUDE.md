# Inkwell

## What This Is
Forkable SaaS microkernel on Astro 6 + Cloudflare Workers. Config-driven, agent-first. Works standalone (Cloudflare only) or integrates with SOS (Sovereign Operating System). Designed to be forked per customer — one config file, zero code changes.

## Version
v8.5.0 — Ship-ready platform + Agency layer + CRM + automation + CF Zero Trust + Intelligence (16 ports, 24 plugins, 41 MCP tools)

## Architecture: Microkernel

```
inkwell.config.ts          ← ALL configuration (one file)
        |
    kernel/                ← Contracts only (600 lines, 5 files)
    |   types.ts           ← PluginManifest, McpToolDef, Port interfaces, RBAC
    |   plugin-loader.ts   ← Registry, mount routes, collect MCP tools
    |   adapter-registry.ts← Hexagonal ports (database, auth, CRM, search)
    |   roles.ts           ← RBAC hierarchy + permission checks
    |   theme.ts           ← Config → CSS custom properties
        |
    plugins/               ← 19 self-contained vertical modules
    |   {name}/manifest.ts ← Name, version, requiredRole, configDefaults
    |   {name}/routes.ts   ← Hono router (Worker backend)
    |   {name}/components/ ← React islands (client-side)
        |
    workers/inkwell-api/   ← Cloudflare Worker entry point (Hono)
        src/index.ts       ← Registers plugins, mounts routes, middleware
        src/middleware/     ← tenant, auth, rbac, route-gate, usage
```

## Rules

### Microkernel Rules (CRITICAL)
1. **Kernel owns contracts. Plugins own features.** The kernel defines interfaces — plugins implement them. Never add business logic to kernel/.
2. **Plugins MUST NOT import from other plugins.** Zero cross-plugin dependencies. If two plugins need shared logic, it goes in kernel/types.ts as a port interface.
3. **No hardcoded URLs.** No `digid.ca`, `mumega.com`, `grantandfunding.com`, or any domain in plugin code. All external URLs come from `inkwell.config.ts` or env vars. A fork must never inherit our URLs.
4. **No direct env access in plugins.** Plugins use `getAdapter('database')`, not `c.env.DB_CORE`. The adapter registry is the boundary between plugins and infrastructure. (Migration in progress — new code MUST use adapters.)
5. **MCP tools are declared in plugin manifests.** Use the `mcpTools` property on `PluginManifest`, not a hardcoded array. The kernel collects them via `collectMcpTools()`.
6. **Routes are declared via `mountRoutes`.** Each plugin's manifest declares a `mountRoutes(app)` function. The kernel calls `mountPluginRoutes()` at startup. Do NOT statically import routes in index.ts.
7. **`config.plugins[]` is the source of truth.** If a plugin isn't in the list, it doesn't load. Period.
8. **RBAC is enforced via kernel.** Plugin manifests declare `requiredRole`. The middleware checks it. Don't roll your own auth checks in route handlers.

### General Rules
9. **NEVER hardcode colors** — use `var(--ink-primary)`, `var(--ink-bg)`, etc.
10. **Config drives everything** — change `inkwell.config.ts`, not component code.
11. **React islands** use `client:visible` (lazy) or `client:load` (immediate).
12. **Astro components** are server-rendered, zero JS by default.
13. **Content** goes in `content/en/{type}/` as markdown with frontmatter.
14. **Worker code** is Web API only — no Node.js built-ins.
15. **Inkwell is forkable** — no Mumega/Digid/SOS-specific content in this repo. Generic examples only.
16. **graphify-out/ is gitignored.** Build artifacts, caches, and graph data are local only.

## Kernel Contracts

### Plugin Manifest
```typescript
interface PluginManifest {
  name: string
  version: string
  description: string
  mountRoutes?: (app: HonoApp) => void    // Worker routes
  mcpTools?: McpToolDef[]                  // MCP tool definitions
  dashboardWidgets?: string[]              // React component names
  configDefaults?: Record<string, unknown> // Merged into config
  migrations?: string[]                    // D1 migration paths
  requiredRole?: InkwellRole               // Minimum role for access
}
```

### Port Interfaces (Hexagonal Architecture)
```typescript
DatabasePort   // query(), queryOne(), execute(), batch() — wraps D1 or any relational store
AuthPort       // getUser(), requireUser() — wraps CF Access, Auth.js, or SOS tokens
CRMPort        // createContact(), updateContact(), createOpportunity()
SearchPort     // index(), search() — wraps D1 full-text or SOS Mirror vectors
SessionPort    // get(), set(ttl?), delete() — wraps KV, Redis, or any session store
ContentPort    // getPage(), putPage(), listPages() — wraps KV, S3, or any content store
StoragePort    // get(), put(), delete(), list() — wraps R2, S3, GCS, or any blob store
GraphPort      // upsertNode(), upsertEdge(), getBacklinks(), getNeighbors(), queryNodes()
AgentPort      // provision(), getConfig(), updateConfig(), recordUsage(), checkBudget()
BusPort        // send(), broadcast(), subscribe(), inbox() — SOS or standalone
MemoryPort     // remember(), recall(), search() — Mirror or standalone
EconomyPort    // recordUsage(), getBalance(), charge(), transfer() — SOS or Stripe
ContentSourcePort // list(), sync(since?) — Obsidian, GitHub, Notion, Google Drive (array of adapters)
MediaPort      // upload(), describe(), transcribe(), transform(), generateImage(), search(), list(), delete()
SeoPort        // logCrawl(), getCrawlStats(), upsertRedirect(), matchRedirect(), setMetaOverride(), listMetaOverrides()
FeedbackPort   // submitResponse(), getResponses(), getAggregates(), submitVote(), listFeatures(), getInsights()
```

### SOS Mode
```typescript
// wrangler.toml or env:
SOS_MODE = "sos"         // activates SOS adapters (bus, memory, economy)
SOS_BUS_URL = "..."      // SOS bus endpoint
SOS_MIRROR_URL = "..."   // Mirror memory endpoint
SOS_ECONOMY_URL = "..."  // SOS Economy endpoint

// Without SOS_MODE=sos, standalone adapters are used (no-op bus, in-memory, Stripe)
```

### RBAC Hierarchy
`owner > admin > manager > member > viewer`

Plugin declares `requiredRole: 'manager'` → only manager, admin, owner can access.

## Plugins (24 active)
| Plugin | Role | Description | Components |
|--------|------|-------------|------------|
| analytics | (default) | SEO + flywheel + event tracking + funnels + cohorts + recommendations | FunnelChart, CohortTable |
| auth | (default) | OTP passwordless login (request-code → verify-code → session) | — |
| dashboard | viewer | Home, leads, campaigns, SEO, calendar, tasks, squads, wallet, media, analytics, feedback, commerce, contracts, courses, health, check-in, chat, settings | ArrowDashboard, TaskBoard, WalletView, SquadPanel, ConnectPanel, SettingsForm, AssistantChat, MediaLibrary |
| commerce | manager | Glass Commerce — transactions, royalties, metering | RevenueOverview |
| content | member | MDX ingest, publish, graph, editorial calendar, bulk planning | CalendarView |
| mcp | admin | MCP tool endpoint | — |
| contracts | manager | E-signature contracts with SMS/email delivery, milestones | ContractList |
| courses | member | Course enrollment, progress tracking, drip lessons, certificates | CourseOverview |
| telegram | (default) | Telegram bot bridge | — |
| chat | (default) | Real-time chat | — |
| diagnostics | admin | Squad health narratives, alerts, conductance metrics | HealthPanel |
| discovery | (default) | Network discovery + reputation | — |
| payments | owner | Stripe payments + subscriptions | — |
| questionnaire | member | Daily business check-in questions via SMS/Telegram | QuestionnairePanel |
| onboarding | (default) | First-run wizard | OnboardingWizard |
| notifications | (default) | In-app notifications | NotificationBell |
| organism | admin | Managed agent provisioning | — |
| sync | admin | Content source sync (daily cron) | — |
| media | member | AI media pipeline (upload, describe, transcribe, transform, generate) | MediaLibrary |
| seo | manager | SEO autopilot — crawl analytics, redirects, meta overrides, geo pages, llms.txt | — |
| feedback | viewer | Customer feedback — NPS/CSAT surveys, micro-surveys, feature voting, LLM classification | FeedbackWidget, NpsWidget, FeatureVoteBoard |
| crm | member | CRM — contacts, pipeline, deals, outreach, reporting | — |
| automation | manager | Automation bridge — n8n workflow trigger + list | — |
| agency | admin | Agency management — client registry, onboarding pipeline, dashboard, reports | — |

## MCP Tools (41)
`publish_content`, `get_dashboard`, `get_seo_data`, `get_leads`, `create_checkout`, `subscription_status`, `send_telegram`, `site_info`, `remember`, `recall`, `create_task`, `browse_marketplace`, `upload_media`, `describe_image`, `generate_image`, `search_media`, `seo_crawl_stats`, `manage_redirects`, `seo_audit`, `get_feedback_summary`, `trigger_survey`, `get_churn_signals`, `business_intake`, `post_social`, `content_strategy`, `create_contact`, `update_contact`, `list_contacts`, `manage_pipeline`, `log_activity`, `find_leads`, `run_outreach`, `marketing_report`, `trigger_workflow`, `list_workflows`, `auto_tag_content`, `generate_pages`, `prune_content`, `onboard_client`, `client_dashboard`, `client_report`

Last 4 of the first 12 are Network tools (require `NETWORK_API_URL` + `NETWORK_TOKEN` env vars). Media tools (4) require R2 + Workers AI bindings. SEO tools (3) require D1. Feedback tools (3) require D1. Marketing tools (3): `business_intake` builds customer wiki, `content_strategy` generates marketing plan, `post_social` posts via webhook (requires `SOCIAL_WEBHOOK_URL`). CRM tools (7): contacts CRUD, pipeline/deals, outreach sequences, lead enrichment. Automation tools (2): n8n workflow trigger + list (requires `N8N_API_URL` + `N8N_API_KEY`). Reporting (1): `marketing_report` cross-channel digest. Intelligence tools (3): `auto_tag_content` (Workers AI classification, requires `[ai]` binding), `generate_pages` (template × variable matrix, scale SEO), `prune_content` (thin/stale detection + archive). Agency tools (3): `onboard_client` (full pipeline: register → wiki → strategy → pages → CRM), `client_dashboard` (cross-client metrics + health), `client_report` (per-client performance report).

## Commands
```bash
npm run dev          # Astro dev server
npm run build        # Production build
npm run deploy       # Build + deploy to Cloudflare Pages
npm run ingest       # Process content/inbox/ → content/en/
npm run publish      # Ingest + build + commit + push

# Worker deploy (MUST use --config to avoid Astro's wrangler.json redirect)
cd workers/inkwell-api && npx wrangler deploy --config wrangler.toml
```

## Auto-Publishing
All content-creating MCP tools (`publish_content`, `business_intake`, `content_strategy`, `generate_pages`, `onboard_client`) auto-trigger `CF_PAGES_DEPLOY_HOOK` after writing pages. Set the deploy hook secret via `npx wrangler secret put CF_PAGES_DEPLOY_HOOK` and pages go live without manual builds.

## Bindings (wrangler.toml)
- `DB_CORE` — D1 (contracts, leads, subscriptions, content, portal_accounts, media_assets)
- `DB_MARKETING` — D1 (campaigns, leads pipeline)
- `DB_ANALYTICS` — D1 (flywheel snapshots, usage tracking)
- `CONTENT` — KV (static pages, tenant config)
- `SESSIONS` — KV (session tokens, login codes)
- `MEDIA` — R2 (file uploads, media assets)
- `AI` — Workers AI (vision, whisper, flux)

## Secrets (never in wrangler.toml)
```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put NETWORK_API_URL    # optional — network integration
npx wrangler secret put NETWORK_TOKEN     # optional — network integration
```

## SOS Integration (optional)
Inkwell works standalone on Cloudflare. When connected to SOS:
- `BusPort` adapter → SOS Redis bus (agent messaging)
- `MemoryPort` adapter → SOS Mirror (vector memory)
- `EconomyPort` adapter → SOS Economy (wallets, usage metering)
- Worker registers as SOS service with heartbeat
- Set `mode: 'sos'` in config to activate SOS adapters

Without SOS, these ports use standalone adapters (no-op bus, KV memory, Stripe direct).

## Theme Colors
All from config → CSS vars: `--ink-primary`, `--ink-secondary`, `--ink-bg`, `--ink-surface`, `--ink-text`, `--ink-muted`, `--ink-dim`, `--ink-border`

## Testing
```bash
npm test              # Kernel tests (186 tests, 15 files)
npm run test:worker   # Worker integration tests (Cloudflare pool)
bash scripts/fork-smoke.sh  # Fork smoke test (build with config-only changes)
```

## MDX Knowledge Engine (v6.0)

### Processors (kernel/processors/)
- `remark-wikilinks` — `[[target]]` and `[[target|display]]` → linked HTML + link extraction
- `remark-blocks` — 14 block types: tldr, callout, pullquote, figure, stats, faq, embed, chart, mermaid, comparison, timeline, metric, cta, before-after
- `mdx-compiler` — runtime compiler: frontmatter + wikilinks + blocks → `{ html, wikilinks, frontmatter }`

### Graph API
- `POST /api/ingest` — raw MDX → compile → store in KV → upsert graph nodes/edges
- `GET /api/graph` — tenant graph (public nodes, filter by tag/type)
- `GET /api/graph/node/:slug` — node + neighbors (BFS, depth 1-3)
- `GET /api/graph/backlinks/:slug` — backlinks with enriched source nodes
- Publishing (`POST /publish`) also feeds the graph automatically

### How the graph builds itself
1. Agent writes MDX with `[[wiki-links]]` and posts to `/api/ingest`
2. Compiler extracts frontmatter, links, and block syntax
3. HTML stored in ContentPort, raw MDX preserved for re-compilation
4. Graph node upserted, wikilink + backlink edges created
5. Tag-based edges auto-created between nodes sharing 2+ tags
6. Knowledge graph grows with every published page

## Organism API (v7.0)
- `POST /api/organism/activate` — provision managed agent for tenant
- `GET/PUT /api/organism/config` — agent config (model, tools, MCP servers, budget)
- `GET /api/organism/usage` — usage history (tokens, cost, sessions)
- `GET /api/organism/budget` — check remaining budget (daily + monthly caps)
- `POST /api/network/quote` — request quote from another organism
- `POST /api/network/transact` — execute inter-organism transfer
- `GET /api/network/discover` — graph-driven organism discovery
- `GET /api/network/reputation` — PageRank-style trust score
- `GET /api/marketplace` — browse community plugins
- `POST /api/marketplace/publish` — publish plugin to network graph
- `POST /api/marketplace/install` — install per-tenant

## Auth Flow
OTP passwordless login (no passwords, no OAuth required):
1. `POST /api/auth/request-code` — sends 6-digit code via webhook (or returns testCode in dev)
2. `POST /api/auth/verify-code` — verifies code, creates session, returns `sessionToken` + `role`
3. Dashboard pages write `inkwell_auth_token`, `inkwell_user_role`, `inkwell_api_url`, `inkwell_onboarded` to localStorage
4. RBAC middleware reads session cookie → resolves role → gates per-plugin access
5. First account per tenant automatically gets `owner` role

CF Access is optional — works as an additional auth layer when configured.

## Known Gaps (v7.3+)
- Port registry Step 1.4 — generated barrel has models not port interfaces (GH #29)
- No GC/AWS adapter implementations yet (ports are ready, adapters are CF-only)
- Anthropic Managed Agent API integration (provision call is stubbed — API not yet public)
- Mirror tenant isolation — **resolved** (Mirror v2, 2026-04-22): workspace isolation enforced server-side via Bearer token; prefix workaround removed from `kernel/adapters/sos-memory.ts`
- Bus SSE streaming (SOS v0.8.x — poll-only for now)
- Economy MCP tools (SOS v0.7.3 — using REST)
