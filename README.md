# Inkwell

**Forkable SaaS framework. One config file. Agent-operated.**

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Astro](https://img.shields.io/badge/Astro-6-BC52EE?logo=astro&logoColor=white)](https://astro.build/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-12_Tools-00D4AA)](https://modelcontextprotocol.io/)
[![MIT](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

Inkwell is a microkernel SaaS framework on Astro 6 + Cloudflare Workers. Fork it, change one config file, deploy. You get a content engine, business dashboard, commerce, auth, contracts, courses, analytics, and an MCP server -- all operated by your AI agent.

```
Fork --> edit inkwell.config.ts --> deploy --> connect your agent
```

---

## Architecture

Inkwell follows a **microkernel + plugin** architecture with hexagonal ports.

```
inkwell.config.ts                 <-- One file drives everything
       |
   kernel/                        <-- Contracts only (5 files, ~430 lines)
   |   types.ts                   <-- Plugin manifests, port interfaces, RBAC
   |   plugin-loader.ts           <-- Registry, route mounting, MCP tool collection
   |   adapter-registry.ts        <-- Hexagonal ports (swap infra, zero code changes)
   |   roles.ts                   <-- Role hierarchy + permission checks
   |   theme.ts                   <-- Config --> CSS custom properties
       |
   plugins/                       <-- 17 self-contained vertical modules
   |   {name}/manifest.ts         <-- Name, version, role, config defaults
   |   {name}/routes.ts           <-- Hono routes (Worker backend)
   |   {name}/components/         <-- React islands (dashboard UI)
       |
   workers/inkwell-api/           <-- Cloudflare Worker entry point
       src/index.ts               <-- Loads plugins, mounts middleware
       src/middleware/             <-- Tenant, auth, RBAC, usage, adapters
```

**Rules:**

- Kernel owns contracts. Plugins own features.
- Plugins never import from other plugins.
- No hardcoded URLs -- everything from config or env vars.
- Adapters are swappable. Change `adapters.bus: 'sos'` to `'standalone'` -- no code changes.
- `config.plugins[]` is the source of truth. Not in the list? Doesn't load.

---

## What's Inside

### 17 Plugins

| Plugin | What it does |
|--------|-------------|
| **auth** | Passwordless OTP login (email/phone). Session cookies via KV. |
| **dashboard** | Business control panel -- KPIs, task board, wallet, squads, settings, AI chat |
| **content** | Publish engine -- MDX with wikilinks, knowledge graph, versioning |
| **commerce** | Digital product sales -- Stripe checkout, subscriptions, royalty splits |
| **courses** | Course platform -- lessons, drip scheduling, progress tracking, certificates |
| **contracts** | E-signature -- create, sign, track shipments, SMS/email confirmation |
| **payments** | Stripe Connect -- webhooks, refunds, subscription lifecycle |
| **analytics** | GSC + GA4 flywheel -- daily ingest, week-over-week scoring |
| **mcp** | MCP server -- 12 tools for AI agent operation |
| **telegram** | Telegram bot -- webhook receiver, message routing |
| **discovery** | Lead capture -- forms, qualification, CRM pipeline |
| **onboarding** | Setup wizard -- business profile, team selection, MCP connection |
| **notifications** | In-app notification system with bell UI |
| **diagnostics** | Health checks, FMAAP safety gate, A/B testing |
| **organism** | Managed AI agent -- provision, budget, usage tracking |
| **questionnaire** | Survey builder with scoring |
| **chat** | Live chat widget |

### 12 Hexagonal Ports

Swap infrastructure without changing plugin code:

| Port | Purpose |
|------|---------|
| `DatabasePort` | D1, Postgres, MySQL -- query, execute, batch |
| `AuthPort` | CF Access, Auth.js, custom -- getUser, requireUser |
| `SessionPort` | KV, Redis -- get, set, delete |
| `ContentPort` | KV, S3 -- getPage, putPage, listPages |
| `StoragePort` | R2, S3, GCS -- blob storage |
| `GraphPort` | D1 -- knowledge graph nodes, edges, backlinks |
| `AgentPort` | D1 -- provision, budget, usage tracking |
| `CRMPort` | Any CRM -- contacts, opportunities |
| `SearchPort` | D1 FTS, vectors -- index, search |
| `BusPort` | Standalone or network -- send, broadcast, subscribe |
| `MemoryPort` | Standalone or vector -- remember, recall |
| `EconomyPort` | Standalone or network -- charge, transfer, balance |

### Content Engine

- 7 collections: blog, topics, labs, tools, team, products, pages
- MDX with `[[wikilinks]]` -- auto-builds a knowledge graph
- 14 custom block types: callout, figure, stats, FAQ, chart, mermaid, timeline, CTA
- SEO-complete: JSON-LD (14 schema types), sitemap, RSS, `llms.txt`, Open Graph
- Full-text search via Pagefind -- zero cost, zero server
- Dark/light theme from config, i18n + RTL ready
- Inbox publish: drop markdown, run `npm run publish`

### Business Dashboard

- Shadcn UI components with Inkwell design token bridge
- Pages: overview, SEO, leads, campaigns, calendar, tasks, squads, wallet, chat, settings
- Mobile-responsive: sidebar on desktop, bottom tabs on mobile
- RBAC: `owner > admin > manager > member > viewer`

### MCP Server -- 12 Tools

Any AI agent connects with one URL:

| Tool | What it does |
|------|-------------|
| `publish_content` | Write markdown directly to the site |
| `get_dashboard` | All KPIs in one call |
| `get_seo_data` | GSC + GA4 snapshot |
| `get_leads` | Lead list from D1 |
| `create_checkout` | Start a Stripe session |
| `subscription_status` | Check subscription by email |
| `send_telegram` | Message your Telegram bot |
| `site_info` | Site config and feature flags |
| `remember` | Store to agent memory |
| `recall` | Retrieve from agent memory |
| `create_task` | Create a task for your team |
| `browse_marketplace` | Discover plugins and services |

---

## Quick Start

```bash
# 1. Fork + clone
git clone https://github.com/YOUR-USERNAME/inkwell
cd inkwell && npm install

# 2. Configure
#    Edit inkwell.config.ts -- name, domain, theme, features, plugins

# 3. Local dev
npm run dev                    # Astro dev server on :4321

# 4. Worker dev (API + MCP)
cd workers/inkwell-api
npm run migrate                # Create local D1 tables
npx wrangler dev               # Worker on :8787

# 5. Deploy
npm run deploy                 # Build + deploy to Cloudflare Pages
```

### Production Setup

```bash
# Create Cloudflare resources
npx wrangler d1 create inkwell-core
npx wrangler d1 create inkwell-analytics
npx wrangler d1 create inkwell-marketing
npx wrangler kv namespace create CONTENT
npx wrangler kv namespace create KV

# Update workers/inkwell-api/wrangler.toml with the IDs

# Set secrets (never in code)
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put RESEND_API_KEY

# Migrate + deploy
npm run migrate:prod
npx wrangler deploy
```

Free. Cloudflare's free tier handles real production workloads.

---

## One Config File

```typescript
// inkwell.config.ts
export const config = {
  name: 'Your Business',
  domain: 'yourbusiness.com',
  tagline: 'Your tagline here.',

  theme: {
    colors: { primary: '#D4A017', secondary: '#06B6D4' },
    fonts: { display: "'Inter', sans-serif" },
    radius: '8px',
  },

  features: {
    reactions: true,
    newsletter: true,
    knowledgeGraph: true,
    search: true,
    chat: false,
  },

  plugins: [
    'auth', 'dashboard', 'content', 'commerce',
    'mcp', 'analytics', 'telegram',
  ],

  adapters: {
    bus: 'standalone',
    memory: 'standalone',
    economy: 'standalone',
  },
}
```

Toggle a feature off -- its routes and UI disappear. Remove a plugin -- its code never loads. Change an adapter -- infrastructure swaps with zero code changes.

---

## Connect Your AI

```json
{
  "mcpServers": {
    "my-business": {
      "url": "https://your-worker.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

Works with Claude Code, Claude Desktop, ChatGPT, Cursor, Windsurf, or any MCP client.

---

## Project Structure

```
inkwell.config.ts              # All configuration
kernel/                        # Contracts: types, plugin loader, adapters, RBAC, theme
plugins/                       # 17 feature modules
  auth/                        #   Passwordless OTP auth
  dashboard/                   #   Business control panel (React islands)
  commerce/                    #   Stripe checkout + subscriptions
  content/                     #   MDX publish engine + knowledge graph
  mcp/                         #   MCP server (12 tools)
  organism/                    #   Managed AI agent provisioning
  ...
workers/inkwell-api/           # Cloudflare Worker (Hono)
  src/middleware/              #   Tenant, auth, RBAC, usage, adapters
  migrations/                  #   D1 schema (core, analytics, marketing)
  wrangler.toml                #   Bindings + config
src/
  pages/                       # Astro routes (site + dashboard)
  components/                  # Astro + React components
  layouts/                     # Base, Dashboard
  styles/base.css              # Design tokens + Shadcn bridge
content/en/                    # Markdown content
scripts/                       # Ingest, publish, fork smoke test
instances/                     # Per-deployment overrides
```

---

## Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Astro dev server |
| `npm run build` | Production build |
| `npm run deploy` | Build + deploy to Cloudflare Pages |
| `npm run ingest` | Process content/inbox/ into collections |
| `npm run publish` | Ingest + build + commit + push |
| `npm run migrate` | Apply D1 migrations (local) |
| `npm run migrate:prod` | Apply D1 migrations (remote) |
| `npm test` | Kernel tests (100 tests) |
| `npm run test:worker` | Worker integration tests (39 tests) |

---

## Fork Checklist

1. Edit `inkwell.config.ts` -- name, domain, theme, features, plugins
2. Replace `content/en/` with your content
3. Replace `public/favicon.svg` and `public/logo.*`
4. Create Cloudflare resources, update `wrangler.toml`
5. Set secrets: `npx wrangler secret put <KEY>`
6. Migrate: `npm run migrate:prod`
7. Deploy: `npm run deploy`
8. Verify: `bash scripts/fork-smoke.sh`

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Astro 6, React 19, Shadcn UI |
| Backend | Cloudflare Workers, Hono |
| Database | D1 (3 databases) |
| Cache | KV |
| Media | R2 |
| Payments | Stripe Connect |
| Auth | Passwordless OTP (built-in) |
| AI | MCP server (12 tools) |
| Hosting | Cloudflare Pages (free tier) |

---

MIT License. Fork freely.

Built by [Digid Inc.](https://digid.ca)
