# Inkwell

A complete business operating system any small business can fork, configure, and run — free on Cloudflare.

Inkwell started as an AI-first CMS. v4 adds a full business layer on top: dashboard, contracts, payments, chat, Telegram steering, and a daily analytics flywheel. The content engine still works exactly as before.

**Fork = customer. Config = their brand. Agent operates it.**

---

## What It Does

### Content Engine (v3 — included)
- 7 content collections: blog, topics, labs, tools, team, products, pages
- Markdown + MDX with Zod validation
- SEO: JSON-LD, sitemap, RSS, llms.txt, Open Graph
- Client-side search via Pagefind (zero cost)
- Dark/light theme from config
- i18n + RTL support
- Inbox publish: drop markdown, run `npm run publish`

### Business Dashboard (v4)
- 5 pages: overview, SEO, leads, campaigns, seasonal calendar
- KPI cards with trend indicators
- Line charts, bar charts, sortable data tables via Recharts
- Sidebar nav on desktop, bottom tabs on mobile
- All data from Worker API — no SSR blocking

### Contract Portal (v4)
- Create contracts via API
- Customer signs with e-signature on their phone — no login needed
- Insurance selection: All Risk / Total Loss / Decline
- 9-step shipment tracking timeline
- SMS via Twilio, email via Resend
- Shareable link works on any device

### Price Estimator (v4)
- Interactive form: destination + vehicle type
- Shows price ranges, transit times, import duties
- "Request exact quote" CTA captures lead to D1

### Payments (v4)
- Stripe Checkout with 3 subscription plans
- Webhook handles auto-provisioning
- Subscription status API

### Telegram Steering (v4)
- Bot commands: `/status`, `/report`, `/leads`, `/approve`, `/help`
- Forwards unknown messages to SOS bus for AI handling
- Rate limiting via KV

### Chat Widget (v4)
- Floating AI assistant on every page
- FAQ fallback for tracking, pricing, documents, insurance, transit times
- Forwards to SOS bus agent when connected
- Chat history in localStorage

### MCP Server (v4)
- 8 tools: `publish_content`, `get_dashboard`, `get_seo_data`, `get_leads`, `create_checkout`, `subscription_status`, `send_telegram`, `site_info`
- Any AI agent connects with one URL
- Streamable HTTP via `POST /mcp`

### Daily Flywheel (v4)
- Cron trigger — configurable, default 6am daily
- Ingests GSC + GA4 data
- Stores normalized snapshots in D1
- Week-over-week scoring
- Reports to SOS bus

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Astro 6 |
| Backend | Cloudflare Workers (Hono) |
| Database | D1 (core + marketing + analytics) |
| Cache/Sessions | KV |
| Media | R2 (optional) |
| Payments | Stripe |
| SMS | Twilio |
| Email | Resend |
| Search | Pagefind |
| Charts | Recharts |
| Hosting | Cloudflare Pages (free tier) |

---

## One Config Drives Everything

```typescript
// inkwell.config.ts
{
  name: "Your Business",
  domain: "yourbusiness.com",
  theme: { colors: { primary: "#D4A017" } },
  features: {
    dashboard: true,
    chat: true,
    newsletter: true,
    contracts: true,
    estimator: true,
    payments: true,
    telegram: true,
    flywheel: true,
    // toggle any feature on or off
  },
  connectors: {
    gsc: { siteUrl: "..." },
    ga4: { propertyId: "..." },
    ghl: { locationId: "..." },
    // add data sources as needed
  }
}
```

---

## Deploy

```bash
git clone https://github.com/Mumega-com/inkwell
npm install
# Edit inkwell.config.ts
npm run build
npx wrangler pages deploy dist
# Done. Free. Forever.
```

Worker secrets (set once, never in code):
```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TELEGRAM_BOT_TOKEN
```

---

## Project Structure

```text
inkwell.config.ts          # All configuration
content/
  inbox/                   # Drop markdown here → npm run ingest
  en/blog/                 # Blog content
  en/pages/                # Static pages
src/
  pages/                   # Astro routes
  components/
    content/               # Callout, figure, author card
    engagement/            # Reactions, newsletter, social proof
    layout/                # Header, footer, nav
    seo/                   # JSON-LD helpers
    dashboard/             # KPI cards, charts, tables
    chat/                  # Floating chat widget
workers/
  inkwell-api/             # Cloudflare Worker (Hono)
    routes/
      dashboard.ts         # Dashboard data API
      contracts.ts         # Contract create/sign/track
      leads.ts             # Lead capture
      checkout.ts          # Stripe Checkout
      mcp.ts               # MCP server (8 tools)
      telegram.ts          # Telegram webhook
      flywheel.ts          # Daily cron ingestion
scripts/
  ingest.ts                # Inbox → content collections
  publish.sh               # Build, commit, push
```

---

## Commands

```bash
npm run dev          # Dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run ingest       # Process content/inbox/
npm run publish      # Ingest + build + commit + push
npm run deploy       # Deploy to Cloudflare Pages
```

---

## Fork Checklist

1. Replace `inkwell.config.ts` — name, domain, theme, analytics
2. Replace content under `content/en/`
3. Replace favicon/logo in `public/`
4. Set Worker secrets via `wrangler secret put`
5. Toggle features on/off in config
6. Deploy

---

## License

MIT
