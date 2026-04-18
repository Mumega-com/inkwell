# Inkwell Roadmap

## v5.2 (current) — Microkernel Wired

Shipped 2026-04-18.

- Kernel contracts: 5 files, 430 lines (types, plugin-loader, adapter-registry, roles, theme)
- 16 plugins with manifests, mountRoutes, mcpTools, requiredRole
- RBAC enforcement per-plugin with system token bypass
- D1DatabaseAdapter: all 90 call sites migrated to hexagonal ports
- 12 MCP tools decentralized to plugin ownership
- Fork tested: Digid fork passes build with config change only

## v5.3 — Test Suite + CI

- `kernel/__tests__/` — unit tests for plugin-loader, adapter-registry, roles, D1DatabaseAdapter
- `plugins/__tests__/` — plugin route tests using mock DatabasePort
- `scripts/fork-smoke.sh` — automated fork test (clone, swap config, build, assert)
- `.github/workflows/ci.yml` — PR gate: typecheck + tests + fork smoke
- Output: any contributor can PR safely

## v5.4 — Full Port Isolation

- KVSessionAdapter (AuthPort wrapping c.env.SESSIONS)
- KVContentAdapter (wrapping c.env.CONTENT)
- StripeAdapter (PaymentPort)
- NotificationAdapter (Twilio SMS + Telegram)
- Zero c.env.* references in any plugin
- Output: swap any infrastructure vendor, zero plugin changes

## v5.5 — SOS Integration Ports

- BusPort — send(), broadcast(), subscribe()
- MemoryPort — remember(), recall(), search()
- EconomyPort — recordUsage(), getBalance(), charge()
- SOS adapters (Redis bus, Mirror API, Economy service)
- Standalone adapters (no-op bus, KV memory, Stripe direct)
- Config: `mode: 'sos' | 'standalone'`
- Output: Inkwell works on Cloudflare alone OR plugs into SOS

## v6.0 — Multi-Tenant + Marketplace

- Tenant-scoped adapters (auto WHERE tenant_id = ?)
- Plugin marketplace schema (installed plugins per tenant in DB)
- Dynamic plugin activation per tenant (DB, not static config)
- POST /api/marketplace/install, GET /api/marketplace/catalog
- Tenant dashboard for plugin management
- Output: customer signs up, picks plugins, gets working site — no fork needed

## v6.1 — Plugin SDK + Developer Portal

- `npx create-inkwell-plugin` CLI scaffolding
- `@inkwell/sdk` package — typed helpers, manifest builder, test harness
- `npx inkwell validate-plugin` — checks manifest, types, forbidden imports
- Developer docs site + plugin authoring guide
- Plugin submission flow → review queue → marketplace
- Output: external dev builds a plugin in an afternoon

## v7.0 — Agent-Native Platform

- Per-tenant MCP server (serves only installed plugins' tools)
- Agent memory per tenant (MemoryPort scoped)
- Agent task queue (TaskPort)
- Scheduled agent loops (cron → agent acts on data)
- Agent audit log (every action logged with reasoning)
- Output: customer connects Claude/GPT, agent runs their business
