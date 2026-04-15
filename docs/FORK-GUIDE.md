# Inkwell Fork Guide

Version: 5.0.0-alpha.1

Inkwell is a forkable business OS built on Astro 6 + Cloudflare Workers. Fork it, configure it, deploy it as your own site with a full API backend, dashboard, contracts, payments, chat, Telegram bot, MCP server, and daily flywheel.

---

## Quick Start

```bash
# 1. Fork on GitHub
# Go to https://github.com/Mumega-com/inkwell and click "Fork"

# 2. Clone your fork
git clone https://github.com/YOUR-USERNAME/inkwell.git
cd inkwell

# 3. Install dependencies
npm install

# 4. Install worker dependencies
cd workers/inkwell-api && npm install && cd ../..

# 5. Run locally
npm run dev
```

---

## First-Time Setup Checklist

### 1. Copy the config file

```bash
cp inkwell.config.example.ts inkwell.config.ts
```

### 2. Edit your config

Open `inkwell.config.ts` and update:
- `name` -- your business or site name
- `domain` -- your domain (e.g. `yourbusiness.com`)
- `tagline` -- one-liner for your site
- `theme.colors.primary` -- your brand color
- `seo.organization` -- your org details

See [CONFIG-REFERENCE.md](./CONFIG-REFERENCE.md) for every field.

### 3. Create Cloudflare D1 databases

```bash
npx wrangler d1 create inkwell-analytics
npx wrangler d1 create inkwell-core
npx wrangler d1 create inkwell-marketing
```

Each command prints a `database_id`. Copy them for step 5.

### 4. Create Cloudflare KV namespaces

```bash
npx wrangler kv namespace create CONTENT
npx wrangler kv namespace create SESSIONS
```

Each command prints a namespace `id`. Copy them for step 5.

### 5. Update wrangler.toml

Open `workers/inkwell-api/wrangler.toml` and replace the placeholder IDs with your own:

```toml
[[d1_databases]]
binding = "DB_ANALYTICS"
database_name = "inkwell-analytics"
database_id = "YOUR_ANALYTICS_DB_ID"
migrations_dir = "migrations/analytics"

[[d1_databases]]
binding = "DB_CORE"
database_name = "inkwell-core"
database_id = "YOUR_CORE_DB_ID"
migrations_dir = "migrations/core"

[[d1_databases]]
binding = "DB_MARKETING"
database_name = "inkwell-marketing"
database_id = "YOUR_MARKETING_DB_ID"
migrations_dir = "migrations/marketing"

[[kv_namespaces]]
binding = "CONTENT"
id = "YOUR_CONTENT_KV_ID"

[[kv_namespaces]]
binding = "SESSIONS"
id = "YOUR_SESSIONS_KV_ID"
```

Also set `SITE_URL` under `[vars]`:

```toml
[vars]
SITE_URL = "https://yourbusiness.com"
```

### 6. Set secrets

Never put secrets in `wrangler.toml`. Use the Wrangler CLI:

```bash
cd workers/inkwell-api

# Required for payments
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET

# Required for Telegram bot
npx wrangler secret put TELEGRAM_BOT_TOKEN

# Optional -- SMS notifications on contracts
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN

# Optional -- email notifications on contracts
npx wrangler secret put RESEND_API_KEY

# Optional -- content publishing auth
npx wrangler secret put PUBLISH_TOKEN

# Optional -- MCP endpoint auth
npx wrangler secret put INKWELL_MCP_TOKEN

# Optional -- GSC/GA4 flywheel
npx wrangler secret put GSC_CREDENTIALS   # JSON: {client_id, client_secret, refresh_token}
npx wrangler secret put GA4_CREDENTIALS   # JSON: {client_id, client_secret, refresh_token}
```

### 7. Run D1 migrations

Apply schema migrations for each database:

```bash
cd workers/inkwell-api

# Local development
npx wrangler d1 migrations apply inkwell-analytics --local
npx wrangler d1 migrations apply inkwell-core --local
npx wrangler d1 migrations apply inkwell-marketing --local

# Production (after first deploy)
npx wrangler d1 migrations apply inkwell-analytics --remote
npx wrangler d1 migrations apply inkwell-core --remote
npx wrangler d1 migrations apply inkwell-marketing --remote
```

### 8. Deploy

```bash
npm run deploy
```

This builds the Astro site and deploys to Cloudflare Pages. Deploy the worker separately:

```bash
cd workers/inkwell-api
npx wrangler deploy
```

---

## Customization

### Theme

Edit `inkwell.config.ts` to change colors, fonts, and layout:

```ts
theme: {
  colors: {
    primary: '#3B82F6',    // your brand color
    secondary: '#8B5CF6',  // accent color
  },
  fonts: {
    display: "'Inter', sans-serif",
    body: "system-ui, sans-serif",
  },
  radius: '8px',           // border radius
  contentWidth: '720px',   // article max width
  pageWidth: '1280px',     // page max width
  darkFirst: true,          // dark mode default
}
```

All colors are injected as CSS custom properties (`--ink-primary`, `--ink-bg`, etc). Never hardcode colors in components.

### Features

Toggle features in `inkwell.config.ts`:

```ts
features: {
  reactions: true,       // emoji reactions on posts
  newsletter: true,      // email subscription form
  readingProgress: true, // progress bar on articles
  toc: true,             // table of contents sidebar
  shareButtons: true,    // social share buttons
  commandPalette: true,  // Cmd+K search palette
  knowledgeGraph: true,  // knowledge graph visualization
  rss: true,             // RSS feed at /rss.xml
  search: true,          // full-text search
  darkModeToggle: true,  // light/dark mode switch
  chat: false,           // live chat widget
}
```

### Worker Routes

Not every site needs every API route. Use the `ENABLED_ROUTES` env var in `wrangler.toml` to enable only what you need:

```toml
[vars]
ENABLED_ROUTES = "auth,payments,mcp,dashboard"
```

When `ENABLED_ROUTES` is not set or set to `"all"`, all routes are enabled. When set to a comma-separated list, only those route groups are active. Disabled routes return `404 { error: "route_disabled" }`.

Route groups: `auth`, `chat`, `contracts`, `courses`, `dashboard`, `discovery`, `glass`, `mcp`, `payments`, `publishing`, `questionnaire`, `telegram`.

Core routes (`analytics`, `content`) are always enabled and cannot be disabled.

### Content

Add markdown files with YAML frontmatter to the content directories:

```
content/en/blog/    -- blog posts
content/en/docs/    -- documentation pages
content/en/cases/   -- case studies
```

Example post:

```markdown
---
title: "Getting Started"
date: "2026-04-15"
author: "Your Name"
tags: ["guide", "setup"]
description: "How to get started with our platform."
---

Your markdown content here.
```

---

## Pulling Upstream Updates

Add the upstream remote once:

```bash
git remote add upstream https://github.com/Mumega-com/inkwell.git
```

Then pull updates:

```bash
git fetch upstream
git merge upstream/main
```

Two files will always conflict during merge -- keep your versions:
- `inkwell.config.ts` (your configuration)
- `workers/inkwell-api/wrangler.toml` (your database IDs and secrets)

---

## Publishing Content

Three ways to publish:

### File inbox

Drop a `.md` file into `content/inbox/` and run:

```bash
npm run ingest
```

This processes the file, adds it to the right content collection, and prepares it for the next build.

### API

```bash
curl -X POST https://your-worker.workers.dev/api/publish \
  -H "Authorization: Bearer YOUR_PUBLISH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Post",
    "content": "# Hello\n\nMarkdown body here.",
    "tags": ["announcement"],
    "status": "published"
  }'
```

### MCP

Connect any AI agent to the MCP endpoint at `POST /mcp` with streamable HTTP transport. Use the `publish_content` tool:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "publish_content",
    "arguments": {
      "collection": "blog",
      "title": "My Post",
      "content": "Markdown body here."
    }
  }
}
```

See [API-REFERENCE.md](./API-REFERENCE.md) for full endpoint documentation.
