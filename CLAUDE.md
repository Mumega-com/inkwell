# Inkwell

## What This Is
Full business operating system built on Astro 6 + Cloudflare Workers. Config-driven, agent-first, designed to be forked per customer. v3 = content engine. v4 adds dashboard, contracts, payments, chat, Telegram steering, MCP server, and daily flywheel.

## Commands
```bash
npm run dev          # Dev server
npm run build        # Production build
npm run deploy       # Build + deploy to Cloudflare Pages
npm run ingest       # Process content/inbox/ → content/en/
npm run publish      # Ingest + build + commit + push
```

## Key Files
| File | Purpose |
|------|---------|
| `inkwell.config.ts` | ALL configuration — theme, features, connectors, analytics |
| `src/content.config.ts` | Astro content collection schemas (Zod) |
| `src/lib/theme.ts` | Config → CSS custom properties generator |
| `src/lib/config.ts` | Re-exports config for use in components |
| `src/lib/seo.ts` | JSON-LD generator (14 schema types) |
| `src/layouts/Base.astro` | Root layout (theme, analytics injection) |
| `src/layouts/Post.astro` | Blog post layout (TOC, reactions, share) |
| `workers/inkwell-api/` | Cloudflare Worker (Hono) — all backend routes |

## Worker Routes
| Route | Purpose |
|-------|---------|
| `GET /api/dashboard` | KPI cards, chart data, campaign stats |
| `GET /api/seo` | GSC + GA4 snapshot data |
| `GET /api/leads` | Lead list from D1 |
| `POST /api/leads` | Capture a lead |
| `POST /api/contracts` | Create contract, returns shareable link |
| `GET /api/contracts/:id` | Contract status + tracking timeline |
| `POST /api/contracts/:id/sign` | E-signature submission |
| `POST /api/checkout` | Create Stripe Checkout session |
| `GET /api/subscription` | Subscription status lookup |
| `POST /api/telegram` | Telegram webhook handler |
| `POST /mcp` | MCP server — 8 tools for AI agents |
| Cron | Daily flywheel — GSC/GA4 ingestion + scoring |

## MCP Tools (8)
`publish_content`, `get_dashboard`, `get_seo_data`, `get_leads`, `create_checkout`, `subscription_status`, `send_telegram`, `site_info`

Connect any agent: `POST /mcp` with streamable HTTP transport.

## Bindings (wrangler.toml)
- `DB` — D1 (core data: contracts, leads, subscriptions)
- `MARKETING_DB` — D1 (campaigns, leads pipeline)
- `ANALYTICS_DB` — D1 (flywheel snapshots)
- `KV` — KV (sessions, rate limits, config cache)
- `MEDIA` — R2 (file uploads, optional)

## Secrets (never in wrangler.toml)
```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put SOS_BUS_URL       # optional, for agent forwarding
```

## Rules
1. **NEVER hardcode colors** — use `var(--ink-primary)`, `var(--ink-bg)`, etc.
2. **Config drives everything** — change `inkwell.config.ts`, not component code
3. **React islands** use `client:visible` (lazy) or `client:load` (immediate)
4. **Astro components** are server-rendered, zero JS by default
5. **Content** goes in `content/en/{type}/` as markdown with frontmatter
6. **Worker code** is Web API only — no Node.js built-ins
7. **Feature flags** in config — check `config.features.X` before rendering any v4 component
8. **Inkwell is forkable — no Mumega-specific content in the repo.** Team profiles, internal project pages (TROP, SOS, etc.), Mumega ideology content (agentic-economy, sovereign-worker) belong on mumega.com (mumega-site repo), NOT here. Inkwell ships with generic example content only. A customer forking this should never see our internal team or projects.
9. **graphify-out/cache/ is gitignored.** Only `graph.json` and `GRAPH_REPORT.md` are committed. Cache files are local build artifacts.
10. **No committed graph data over 500KB.** If `graphify-out/graph.json` exceeds 500KB, run `graphify --compact` or exclude it from commits.

## Theme Colors
All from config → CSS vars:
- `--ink-primary` — brand color (default gold #D4A017)
- `--ink-secondary` — accent (default cyan #06B6D4)
- `--ink-bg` — background
- `--ink-surface` — card/panel background
- `--ink-text` — body text
- `--ink-muted` — secondary text
- `--ink-dim` — tertiary text
- `--ink-border` — borders

## Agent Publishing
Drop markdown in `content/inbox/`, run `npm run ingest`. Or POST to Worker API `/api/publish`. Or use MCP tool `publish_content` from any connected agent.

## Dashboard
5 pages under `src/pages/dashboard/`: overview, seo, leads, campaigns, calendar.
All data fetched client-side from Worker API — no SSR blocking. Charts use Recharts (React island, `client:load`).

## Contracts
Create via `POST /api/contracts`. Returns `{ id, signingUrl }`. Customer opens URL on phone, signs, selects insurance, receives SMS + email confirmation. 9-step tracking timeline updates via API.

## Daily Flywheel
Cron trigger in `wrangler.toml`. Fires at configured time (default 6am). Pulls GSC search analytics + GA4 sessions. Normalizes and stores in `ANALYTICS_DB`. Scores week-over-week. Posts summary to SOS bus if `SOS_BUS_URL` is set.
