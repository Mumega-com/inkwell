# Inkwell

## What This Is
Forkable SaaS microkernel on Astro 6 + Cloudflare Workers. Config-driven, agent-first. Works standalone (Cloudflare only) or integrates with SOS (Sovereign Operating System). Designed to be forked per customer — one config file, zero code changes.

## Version
v5.2.0 — Microkernel + 12 plugins + RBAC + Shadcn UI + 12 MCP tools

## Architecture: Microkernel

```
inkwell.config.ts          ← ALL configuration (one file)
        |
    kernel/                ← Contracts only (430 lines, 5 files)
    |   types.ts           ← PluginManifest, McpToolDef, Port interfaces, RBAC
    |   plugin-loader.ts   ← Registry, mount routes, collect MCP tools
    |   adapter-registry.ts← Hexagonal ports (database, auth, CRM, search)
    |   roles.ts           ← RBAC hierarchy + permission checks
    |   theme.ts           ← Config → CSS custom properties
        |
    plugins/               ← 12 self-contained vertical modules
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
16. **graphify-out/cache/ is gitignored.** Only `graph.json` and `GRAPH_REPORT.md` are committed.

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
DatabasePort   // query(), execute(), batch() — wraps D1 or any relational store
AuthPort       // getUser(), requireUser() — wraps CF Access, Auth.js, or SOS tokens
CRMPort        // createContact(), updateContact(), createOpportunity()
SearchPort     // index(), search() — wraps D1 full-text or SOS Mirror vectors
```

### Adapter Usage
```typescript
// At startup (index.ts):
setAdapter('database', new D1DatabaseAdapter(env.DB_CORE))
setAdapter('auth', new CFAccessAuthAdapter())

// In plugin routes:
const db = getAdapter('database')
const results = await db.query('SELECT * FROM posts WHERE tenant = ?', [tenant])
```

### RBAC Hierarchy
`owner > admin > manager > member > viewer`

Plugin declares `requiredRole: 'manager'` → only manager, admin, owner can access.

## Plugins (12 active)
| Plugin | Role | Lines | Components |
|--------|------|-------|------------|
| dashboard | viewer | 2630 | ArrowDashboard, TaskBoard, WalletView, SquadPanel, ConnectPanel, SettingsForm, AssistantChat |
| commerce | (default) | 331 | — |
| content | member | 589 | — |
| mcp | admin | 781 | — |
| contracts | manager | 445 | — |
| telegram | (default) | 504 | — |
| chat | (default) | 225 | — |
| diagnostics | (default) | 230 | — |
| discovery | (default) | 793 | — |
| payments | owner | 645 | — |
| onboarding | (default) | 542 | OnboardingWizard |
| notifications | (default) | 237 | NotificationBell |

## MCP Tools (12)
`publish_content`, `get_dashboard`, `get_seo_data`, `get_leads`, `create_checkout`, `subscription_status`, `send_telegram`, `site_info`, `remember`, `recall`, `create_task`, `browse_marketplace`

Last 4 are Mumega Network tools (require `MUMEGA_API_URL` + `MUMEGA_TOKEN` env vars). Without them, standalone Inkwell has 8 tools.

## Commands
```bash
npm run dev          # Astro dev server
npm run build        # Production build
npm run deploy       # Build + deploy to Cloudflare Pages
npm run ingest       # Process content/inbox/ → content/en/
npm run publish      # Ingest + build + commit + push
```

## Bindings (wrangler.toml)
- `DB_CORE` — D1 (contracts, leads, subscriptions, content)
- `MARKETING_DB` — D1 (campaigns, leads pipeline)
- `ANALYTICS_DB` — D1 (flywheel snapshots, usage tracking)
- `KV` / `CONTENT` — KV (sessions, tenant config, static pages)
- `MEDIA` — R2 (file uploads, optional)

## Secrets (never in wrangler.toml)
```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put MUMEGA_API_URL    # optional — SOS integration
npx wrangler secret put MUMEGA_TOKEN      # optional — SOS integration
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

## Known Gaps (v5.3 sprint)
- Routes statically imported in index.ts → migrate to `plugin.mountRoutes()`
- MCP tools hardcoded in mcp/routes.ts → migrate to `plugin.mcpTools[]`
- Adapters defined but unused → plugins still access `c.env.DB_CORE` directly
- RBAC middleware defined but not enforced on routes
- `config.plugins[]` not gated at runtime
- Hardcoded URLs remain in discovery plugin
