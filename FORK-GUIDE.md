# Fork Guide

Practical setup guide for forking Inkwell. Current version: v7.2.0.

---

## 1. Prerequisites

- **Cloudflare account** (free tier works for production)
- **Node.js 20+** and npm
- **Wrangler CLI**: `npm install -g wrangler` then `wrangler login`
- **Git**

---

## 2. Fork & Clone

```bash
# Fork on GitHub, then:
git clone https://github.com/YOUR-USERNAME/inkwell
cd inkwell
npm install
```

---

## 3. Configure

Everything lives in `inkwell.config.ts`. Open it and edit section by section.

### Identity

```typescript
name: 'Your Business',
domain: 'yourbusiness.com',
tagline: 'One line about what you do.',
```

### Theme

```typescript
theme: {
  colors: {
    primary: '#D4A017',    // Brand color — buttons, links, accents
    secondary: '#06B6D4',  // Secondary accent
    accent: '#10B981',     // Success states, positive indicators
    danger: '#EF4444',     // Error states, destructive actions
    bg:      { dark: '#0A0A10', light: '#FAFBFC' },
    surface: { dark: '#151519', light: '#FFFFFF' },
    text:    { dark: '#EDEDF0', light: '#1A1D23' },
    // muted, dim, border control text hierarchy
  },
  fonts: {
    display: "'Inter', sans-serif",    // Headings
    body: "system-ui, sans-serif",     // Body text
    mono: "'JetBrains Mono', monospace", // Code blocks
  },
  radius: '8px',           // Border radius (0 = sharp, 16px = pill)
  contentWidth: '680px',   // Article column width
  pageWidth: '1200px',     // Max page width
  darkFirst: true,         // true = dark mode default, false = light mode default
}
```

All colors become CSS variables (`--ink-primary`, `--ink-bg`, etc.). Never hardcode colors in components.

### Features

```typescript
features: {
  reactions: true,         // Emoji reactions on content
  newsletter: true,        // Email signup forms
  readingProgress: true,   // Progress bar on articles
  toc: true,               // Table of contents sidebar
  shareButtons: true,      // Social share buttons
  commandPalette: true,    // Cmd+K search
  knowledgeGraph: true,    // Wiki-style knowledge graph
  rss: true,               // RSS feed generation
  search: true,            // Full-text search (Pagefind)
  darkModeToggle: true,    // Dark/light mode toggle
  chat: false,             // Live chat widget
}
```

Set any to `false` and its UI disappears. No dead code ships.

### Plugins

```typescript
plugins: [
  'auth',           // Passwordless OTP login (email/phone)
  'dashboard',      // Business control panel with KPIs
  'content',        // MDX publish engine + knowledge graph
  'commerce',       // Stripe checkout + subscriptions
  'courses',        // Course platform with drip scheduling
  'contracts',      // E-signature creation and tracking
  'payments',       // Stripe Connect webhooks + lifecycle
  'analytics',      // GSC + GA4 flywheel
  'mcp',            // MCP server (16 tools for AI agents)
  'telegram',       // Telegram bot webhook
  'discovery',      // Lead capture + CRM pipeline
  'onboarding',     // Setup wizard
  'notifications',  // In-app notification bell
  'diagnostics',    // Health checks + A/B testing
  'organism',       // Managed AI agent provisioning
  'questionnaire',  // Survey builder
  'chat',           // Live chat widget
  'sync',           // External content sources (GitHub, Notion, etc.)
  'media',          // AI media pipeline (upload, vision, transcription)
]
```

Remove plugins you don't need. Their routes and UI won't load at all.

**Minimum viable set:** `['auth', 'dashboard', 'content', 'mcp']`

### Adapters

```typescript
adapters: {
  bus: 'standalone',      // 'standalone' = no-op bus | 'sos' = SOS Redis bus
  memory: 'standalone',   // 'standalone' = KV memory | 'mirror' = SOS Mirror vectors
  economy: 'standalone',  // 'standalone' = Stripe direct | 'sos' = SOS Economy
  agent: 'd1',            // D1-backed agent provisioning
  graph: 'd1',            // D1-backed knowledge graph
  media: 'cf',            // R2 + Workers AI
}
```

Most forks use `standalone` for everything. Only set `sos` / `mirror` if connecting to a Mumega SOS instance.

### Content Sources

```typescript
// Empty = manual content only (drop markdown in content/en/)
contentSources: []

// Or pull from external systems:
contentSources: [
  { type: 'obsidian', vaultPath: '/path/to/vault' },
  { type: 'github', owner: 'myorg', repo: 'docs', branch: 'main', path: 'content/' },
  { type: 'notion', databaseId: 'abc123def456' },
  { type: 'gdrive', folderId: 'xyz789abc' },
]
```

Each source needs its corresponding secret (see step 5).

### SEO & Analytics

```typescript
seo: {
  organization: {
    name: 'Your Business',
    url: 'https://yourbusiness.com',
    logo: '/logo.svg',
    knowsAbout: ['Your', 'Topics'],
  },
  defaultAuthor: { name: 'Your Name', url: 'https://yourbusiness.com' },
},
analytics: {
  googleAnalytics: 'G-XXXXXXX',   // GA4 measurement ID (optional)
  clarity: '',                      // Microsoft Clarity (optional)
  plausible: '',                    // Plausible domain (optional)
},
```

### Brand

```typescript
brand: {
  voice: 'professional, warm, no jargon',
  logo: '/logo.svg',
  favicon: '/favicon.svg',
  ogImage: '/og-default.png',
  teamNames: { seo: 'Marketing Team', dev: 'Engineering' },
  statusLabels: { claimed: 'In progress', done: 'Completed' },
}
```

Replace `public/favicon.svg`, `public/logo.svg`, and `public/og-default.png` with your assets.

---

## 4. Create Cloudflare Resources

Run these commands. Save each ID that's printed.

### D1 Databases (3)

```bash
npx wrangler d1 create inkwell-core
npx wrangler d1 create inkwell-analytics
npx wrangler d1 create inkwell-marketing
```

### KV Namespaces (2)

```bash
npx wrangler kv namespace create CONTENT
npx wrangler kv namespace create SESSIONS
```

### R2 Bucket (1)

```bash
npx wrangler r2 bucket create inkwell-media
```

### Update wrangler.toml

Open `workers/inkwell-api/wrangler.toml` and replace all `YOUR_*` placeholders:

```toml
account_id = "your-cloudflare-account-id"

[[d1_databases]]
binding = "DB_CORE"
database_name = "inkwell-core"
database_id = "paste-core-id-here"
migrations_dir = "migrations/core"

[[d1_databases]]
binding = "DB_ANALYTICS"
database_name = "inkwell-analytics"
database_id = "paste-analytics-id-here"
migrations_dir = "migrations/analytics"

[[d1_databases]]
binding = "DB_MARKETING"
database_name = "inkwell-marketing"
database_id = "paste-marketing-id-here"
migrations_dir = "migrations/marketing"

[[kv_namespaces]]
binding = "CONTENT"
id = "paste-content-kv-id-here"

[[kv_namespaces]]
binding = "SESSIONS"
id = "paste-sessions-kv-id-here"

[[r2_buckets]]
binding = "MEDIA"
bucket_name = "inkwell-media"
```

Also update `[vars]`:

```toml
[vars]
SITE_URL = "https://yourbusiness.com"
PUBLISH_TOKEN = "generate-a-real-token-here"
```

Generate a publish token: `openssl rand -hex 32`

---

## 5. Set Secrets

Secrets are never stored in code. Set each one interactively:

```bash
cd workers/inkwell-api
```

### Commerce (required if using commerce/payments plugins)

```bash
npx wrangler secret put STRIPE_SECRET_KEY       # Stripe dashboard → API keys
npx wrangler secret put STRIPE_WEBHOOK_SECRET   # Stripe dashboard → Webhooks → signing secret
```

### Notifications (required if using telegram plugin)

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN      # BotFather → /newbot
```

### Email (required if using auth OTP via email)

```bash
npx wrangler secret put RESEND_API_KEY           # resend.com → API Keys
```

### Content Sources (required only for configured sources)

```bash
npx wrangler secret put GITHUB_TOKEN             # GitHub PAT with repo read access
npx wrangler secret put NOTION_TOKEN             # Notion integration → Internal integration token
npx wrangler secret put GDRIVE_TOKEN             # Google service account JSON key
```

### SOS Network (optional, only for SOS-connected instances)

```bash
npx wrangler secret put NETWORK_API_URL          # SOS MCP SSE endpoint URL
npx wrangler secret put NETWORK_TOKEN            # SOS access token
```

Skip any secrets for plugins you removed from `config.plugins[]`.

---

## 6. Migrate

Apply D1 schema migrations to create all tables.

### Local (for development)

```bash
npm run migrate
```

### Production (remote D1)

```bash
npm run migrate:prod
```

This runs migrations for all three databases (core, analytics, marketing).

---

## 7. Content

### Content Structure

Content lives in `content/en/` organized by collection:

```
content/en/
  blog/          # Blog posts
  topics/        # Topic/category pages
  labs/          # Experiments, case studies
  tools/         # Tool pages
  team/          # Team member profiles
  products/      # Product pages
  pages/         # Static pages (about, contact, etc.)
```

Each file is markdown with frontmatter:

```markdown
---
title: "Your First Post"
description: "A short description."
date: 2026-04-18
tags: ["getting-started"]
author: "Your Name"
---

Your content here. Supports `[[wiki-links]]` to other pages.
```

### Inbox Flow

Drop raw markdown files into `content/inbox/`, then:

```bash
npm run ingest     # Processes inbox → moves to correct collection
npm run publish    # Ingest + build + commit + push
```

### Publishing via API / MCP

With the `content` and `mcp` plugins active:

- **API**: `POST /api/ingest` with MDX body
- **MCP**: Use the `publish_content` tool from any AI agent

Both compile MDX, store HTML in KV, and update the knowledge graph.

---

## 8. Deploy

### First Deploy

```bash
npm run deploy
```

This builds the Astro site and deploys to Cloudflare Pages.

### Custom Domain

1. Go to Cloudflare dashboard → Pages → your project → Custom domains
2. Add `yourbusiness.com`
3. Cloudflare handles DNS and TLS automatically

### Wildcard Subdomain (for multi-tenant)

If you're running Inkwell as a platform with tenant subdomains:

1. Update `wrangler.toml`:
   ```toml
   [[routes]]
   pattern = "*.yourbusiness.com/*"
   zone_name = "yourbusiness.com"
   ```
2. Add a wildcard DNS record: `*.yourbusiness.com → CNAME → your-worker.workers.dev`

### Worker Deploy (API separately)

```bash
cd workers/inkwell-api
npx wrangler deploy
```

---

## 9. Connect AI

Any MCP-compatible AI agent can operate your Inkwell instance. Paste the config into your agent's MCP settings.

### Claude Code / Claude Desktop

```json
{
  "mcpServers": {
    "my-business": {
      "url": "https://your-worker.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_PUBLISH_TOKEN"
      }
    }
  }
}
```

For Claude Code, save to `.claude.json` or `~/.claude.json`.

### ChatGPT (with MCP plugin)

```json
{
  "mcpServers": {
    "my-business": {
      "url": "https://your-worker.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_PUBLISH_TOKEN"
      }
    }
  }
}
```

### Cursor / Windsurf

Add to your workspace `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "my-business": {
      "url": "https://your-worker.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_PUBLISH_TOKEN"
      }
    }
  }
}
```

Replace `YOUR_PUBLISH_TOKEN` with the token you set in `wrangler.toml` `[vars]` or via `wrangler secret put PUBLISH_TOKEN`.

The MCP server exposes 16 tools: `publish_content`, `get_dashboard`, `get_seo_data`, `get_leads`, `create_checkout`, `subscription_status`, `send_telegram`, `site_info`, `remember`, `recall`, `create_task`, `browse_marketplace`, `upload_media`, `describe_image`, `generate_image`, `search_media`.

---

## 10. Verify

### Smoke Test

```bash
bash scripts/fork-smoke.sh
```

This temporarily swaps your config with test values, runs a full build, and restores the original. Exit 0 = your fork builds cleanly.

### Health Check

Hit the diagnostics endpoint:

```bash
curl https://your-worker.workers.dev/api/health
```

### First Publish Test

```bash
# Via API:
curl -X POST https://your-worker.workers.dev/api/ingest \
  -H "Authorization: Bearer YOUR_PUBLISH_TOKEN" \
  -H "Content-Type: text/markdown" \
  -d '---
title: "Hello World"
description: "First post."
date: 2026-04-18
tags: ["test"]
collection: blog
---

This is the first post on my Inkwell site.'
```

Or via MCP from your AI agent:

```
publish_content({ title: "Hello World", body: "First post.", collection: "blog" })
```

### Checklist

- [ ] `npm run build` passes
- [ ] `bash scripts/fork-smoke.sh` exits 0
- [ ] `/api/health` returns 200
- [ ] Site loads at your domain
- [ ] Dashboard loads at `/dashboard`
- [ ] MCP tools respond (test `site_info`)
- [ ] First content publishes successfully

---

## Quick Reference

| Command | What it does |
|---------|-------------|
| `npm run dev` | Astro dev server on :4321 |
| `npm run build` | Production build |
| `npm run deploy` | Build + deploy to Cloudflare Pages |
| `npm run ingest` | Process content/inbox/ into collections |
| `npm run publish` | Ingest + build + commit + push |
| `npm run migrate` | Apply D1 migrations (local) |
| `npm run migrate:prod` | Apply D1 migrations (remote) |
| `npm test` | Kernel tests (123 tests) |
| `npm run test:worker` | Worker integration tests |
