# Inkwell

**Give your AI a business. Fork → deploy → connect.**

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Astro](https://img.shields.io/badge/Astro-6-BC52EE?logo=astro&logoColor=white)](https://astro.build/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Streamable_HTTP-00D4AA)](https://modelcontextprotocol.io/)
[![MIT](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

Inkwell is a complete, forkable business operating system built on Astro 6 + Cloudflare Workers. One config file drives the whole stack: content engine, business dashboard, commerce, contracts, analytics flywheel, and an MCP server so your AI agent can operate the entire thing.

**Fork = customer. Config = their brand. Agent operates it.**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        INKWELL                              │
│                                                             │
│  ┌──────────────────┐    ┌───────────────────────────────┐  │
│  │  Astro 6 Site    │    │   Cloudflare Worker (Hono)    │  │
│  │                  │    │                               │  │
│  │  • Blog / Pages  │◄───│  • REST API (leads, contracts │  │
│  │  • Dashboard UI  │    │    checkout, dashboard, SEO)  │  │
│  │  • Chat Widget   │    │  • MCP Server (8 tools)       │  │
│  │  • Search        │    │  • Daily flywheel (GSC / GA4) │  │
│  │  • Dark/Light    │    │  • Telegram webhook           │  │
│  └────────┬─────────┘    └───────────────┬───────────────┘  │
│           │                              │                  │
│           │         Cloudflare           │                  │
│  ┌────────▼──────────────────────────────▼───────────────┐  │
│  │   Pages (CDN)    │  D1 (SQL)  │  KV  │  R2 (media)   │  │
│  └───────────────────────────────────────────────────────┘  │
│                              ▲                              │
│                    ┌─────────┴──────────┐                   │
│                    │   MCP Client       │                   │
│                    │  (any AI agent)    │                   │
│                    │                   │                   │
│                    │  POST /mcp         │                   │
│                    │  Authorization:    │                   │
│                    │  Bearer <token>    │                   │
│                    └────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

---

## What You Get

### Content Engine (v3)
- 7 content collections: blog, topics, labs, tools, team, products, pages
- Markdown + MDX with Zod validation
- SEO-complete: JSON-LD (14 schema types), sitemap.xml, RSS, `llms.txt`, Open Graph
- Client-side full-text search via Pagefind — zero cost, zero server
- Dark/light theme from config, i18n + RTL support
- Inbox publish: drop a markdown file, run `npm run publish` — done

### Business Dashboard (v4)
- 5 pages: overview, SEO, leads, campaigns, seasonal calendar
- KPI cards with trend indicators, line/bar charts, sortable tables (Recharts)
- Mobile-responsive: sidebar on desktop, bottom tabs on mobile
- All data served from Worker API — no SSR blocking

### Glass Commerce — Digital Products (v5)
- Sell books, courses, and digital products directly
- Stripe Connect integration — no SaaS intermediary
- Subscription tiers with auto-provisioning via webhook
- Buy / download flow works on any device

### Contracts + E-Signature (v4)
- Create contracts via API, get a shareable signing link
- Customer signs on their phone — no login required
- Insurance selection, 9-step shipment tracking timeline
- SMS confirmation via Twilio, email via Resend

### MCP Server — 8 Tools (v4)
Any AI agent connects with one URL and controls everything:

| Tool | What it does |
|------|-------------|
| `publish_content` | Write a markdown post directly to the site |
| `get_dashboard` | Retrieve all KPI data |
| `get_seo_data` | GSC + GA4 snapshot |
| `get_leads` | Pull lead list from D1 |
| `create_checkout` | Start a Stripe Checkout session |
| `subscription_status` | Check subscription by email |
| `send_telegram` | Send a message to your Telegram bot |
| `site_info` | Return site config and feature flags |

### Daily Flywheel (v4)
- Cron at 6am: ingests GSC + GA4, stores normalized snapshots in D1
- Week-over-week scoring — no LLM, pure SQL math
- Optional: reports to your agent bus if `SOS_BUS_URL` is set

### Diagnostics + Safety Gate (v5)
- FMAAP gate: checks Flow, Metabolism, Alignment, Autonomy, Physics before any agent action
- DIAG-UI: translates routing math into human-readable health narratives
- Adaptive A/B edge testing with chi-squared significance + human approval loop

---

## Deploy in 5 Minutes

```bash
# 1. Fork on GitHub, then clone your fork
git clone https://github.com/YOUR-USERNAME/inkwell
cd inkwell

# 2. Install dependencies
npm install

# 3. Configure your site
cp inkwell.config.example.ts inkwell.config.ts
# Edit inkwell.config.ts — set name, domain, theme, features

# 4. Configure the Worker
# Edit workers/inkwell-api/wrangler.toml:
#   - Set account_id (your Cloudflare account)
#   - Replace database_id values (after running: npx wrangler d1 create inkwell-core, etc.)
#   - Replace kv id values (after running: npx wrangler kv namespace create CONTENT, etc.)
#   - Set SITE_URL to your domain
#   - Update [[routes]] pattern to your domain

# 5. Set Worker secrets (never stored in code)
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put RESEND_API_KEY
# See workers/inkwell-api/.env.example for full list

# 6. Run D1 migrations
npx wrangler d1 migrations apply inkwell-core
npx wrangler d1 migrations apply inkwell-analytics
npx wrangler d1 migrations apply inkwell-marketing

# 7. Deploy
npm run deploy
```

That's it. Free. Forever. Cloudflare Pages + Workers free tier handles a serious production workload.

---

## One Config Drives Everything

```typescript
// inkwell.config.ts
export default {
  name: "Your Business",
  domain: "yourbusiness.com",
  theme: {
    colors: { primary: "#D4A017" }
  },
  features: {
    dashboard: true,
    chat: true,
    newsletter: true,
    contracts: true,
    commerce: true,
    payments: true,
    telegram: true,
    flywheel: true,
    // toggle any feature on or off
  },
  connectors: {
    gsc: { siteUrl: "https://yourbusiness.com/" },
    ga4: { propertyId: "G-XXXXXXXXXX" },
  }
}
```

Toggle a feature off → its routes, UI, and dependencies disappear automatically. No dead code, no conditional clutter.

---

## Connect Your AI

Point any MCP-compatible AI agent at your deployed Worker:

```json
{
  "mcpServers": {
    "my-business": {
      "url": "https://your-worker.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_INKWELL_MCP_TOKEN"
      }
    }
  }
}
```

Set `INKWELL_MCP_TOKEN` as a Worker secret, and your agent gets 8 tools to operate the entire site — publishing content, reading leads, checking analytics, sending messages, and processing payments.

Works with Claude (claude.ai, Claude Code, Claude Desktop), ChatGPT, Cursor, or any client that speaks [MCP streamable HTTP](https://modelcontextprotocol.io/).

---

## Free vs. Mumega SaaS

Inkwell is fully self-contained and free to run. Some tools connect to the Mumega network for extended capabilities:

| Capability | Standalone (free) | Mumega SaaS |
|-----------|-------------------|-------------|
| Content publishing | Yes | Yes |
| Dashboard + analytics | Yes | Yes |
| Commerce + payments | Yes | Yes |
| Contracts + e-signature | Yes | Yes |
| MCP server (8 tools) | Yes | Yes |
| AI memory (Mirror) | No | Yes |
| Task orchestration | No | Yes |
| Multi-tenant routing | No | Yes |
| Agent marketplace | No | Yes |
| Multi-site management | No | Yes |

Network tools require setting `MUMEGA_API_URL` and `MUMEGA_TOKEN`. Get a token at [mumega.com](https://mumega.com). Standalone deployments never phone home.

---

## Project Structure

```text
inkwell.config.ts              # All configuration — name, domain, theme, features
inkwell.config.example.ts      # Copy this to get started

content/
  inbox/                       # Drop markdown here → npm run ingest
  en/blog/                     # Blog posts
  en/pages/                    # Static pages

src/
  pages/                       # Astro routes
  components/
    content/                   # Callout, figure, author card
    engagement/                # Reactions, newsletter, social proof
    layout/                    # Header, footer, nav
    seo/                       # JSON-LD helpers
    dashboard/                 # KPI cards, charts, tables
    chat/                      # Floating chat widget
  lib/                         # Theme, config, SEO utilities

workers/
  inkwell-api/                 # Cloudflare Worker (Hono)
    src/
      routes/                  # dashboard, contracts, leads, checkout, mcp, telegram
      middleware/              # auth, tenant
      types.ts                 # Env interface — all bindings typed
    migrations/                # D1 schema migrations
    wrangler.toml              # Worker config and bindings

scripts/
  ingest.ts                    # Inbox → content collections
  publish.sh                   # Build, commit, push
```

---

## Commands

```bash
npm run dev          # Dev server (Astro)
npm run build        # Production build
npm run preview      # Preview production build locally
npm run ingest       # Process content/inbox/ into collections
npm run publish      # Ingest + build + commit + push
npm run deploy       # Build + deploy to Cloudflare Pages
npm test             # Run Worker tests
```

---

## Fork Checklist

1. Edit `inkwell.config.ts` — name, domain, theme colors, analytics IDs
2. Replace `content/en/` with your content
3. Replace `public/favicon.svg` and `public/logo.*` with your brand
4. Create Cloudflare resources and update `workers/inkwell-api/wrangler.toml`
5. Set Worker secrets via `wrangler secret put`
6. Enable/disable features in config
7. Deploy

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full contributor guide.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Astro 6 |
| Backend | Cloudflare Workers + Hono |
| Database | D1 (SQL, 3 databases) |
| Cache / Sessions | KV |
| Media | R2 (optional) |
| Payments | Stripe |
| SMS | Twilio |
| Email | Resend |
| Search | Pagefind |
| Charts | Recharts (React 19) |
| Hosting | Cloudflare Pages (free tier) |

---

## Built By

[Digid Inc.](https://digid.ca) — Toronto, Canada.  
Crafted by [Hadi Servat](https://github.com/servathadi) and the Mumega agent team.

MIT License. Fork freely.
