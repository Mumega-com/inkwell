# Inkwell

**Forkable Astro framework for content + commerce + agent-operated sites. One config file. Cloudflare-native.**

Inkwell is the content layer for the Mumega platform:
- Markdown/MDX content collections
- Config-driven theming and SEO
- Static search via Pagefind
- Optional Worker-backed reactions, newsletter, and publish APIs
- Inbox-style publishing for agents and automation
- Obsidian-friendly vault mode

---

## Quick Start

```bash
npm install
npm run dev
```

Configure in `inkwell.config.ts`, then replace demo content under `content/en/`.

---

# Update workers/inkwell-api/wrangler.toml with the IDs

- **Config, not scattered theme code** — site identity, theme, analytics, and feature flags live in `inkwell.config.ts`
- **Zero-JS by default** — Astro renders HTML; React hydrates only where interactivity matters
- **Agent-friendly publishing** — content can arrive from inbox files, HTTP APIs, or your own tool layer
- **Cloudflare-native optional edge layer** — Pages, Workers, KV, D1, and R2 available when needed

---

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

---

## Project Structure

```text
inkwell.config.ts          # Active site config
inkwell.config.example.ts  # Starter config
content/
  inbox/                   # Drop markdown here for ingest/publish
  en/blog/                 # Blog content
  en/pages/                # Static pages
src/
  pages/                   # Astro routes
  components/
    content/               # Callout, figure, author card, etc.
    engagement/            # Reactions, newsletter, social proof
    layout/                # Header, footer, language switcher
    navigation/            # TOC, command palette, reading progress
    seo/                   # JSON-LD helpers
    visualization/         # Video hero, knowledge graph
workers/
  inkwell-api/             # Optional Cloudflare Worker API
scripts/
  ingest.ts                # Inbox -> content collections
  publish.sh               # Build, commit, push convenience flow
  generate-og.ts           # Open Graph image generator
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
| `npm test` | Kernel tests (123 tests) |
| `npm run test:worker` | Worker integration tests (39 tests) |

---

## Publishing Modes

### 1. Inbox publish

Drop a markdown file into `content/inbox/` and run:

```bash
npm run publish
```

That flow ingests content, builds the site, commits the content changes, and pushes them.

### 2. Direct content authoring

Write markdown directly into `content/en/blog/` or `content/en/pages/`, then build and commit normally.

### 3. API-backed publishing

Deploy the Worker layer to expose `POST /api/publish` — send content from agents or external systems.

---

## Obsidian Vault Mode

The `content/en/` tree is set up as an Obsidian vault. Open it directly in Obsidian, or use:

```bash
bash scripts/open-obsidian-vault.sh
```

---

Built by [Mumega Labs](https://mumega.com)
