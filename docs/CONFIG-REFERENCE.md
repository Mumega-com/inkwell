# Inkwell Config Reference

Version: 5.0.0-alpha.1

All site configuration lives in `inkwell.config.ts` at the project root. Copy from `inkwell.config.example.ts` to get started.

---

## Site Identity

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `string` | `'Inkwell Site'` | Site name. Appears in header, meta tags, and SEO schema. |
| `domain` | `string` | `'example.com'` | Primary domain without protocol. Used for canonical URLs. |
| `tagline` | `string` | `'Publish with agents, not busywork.'` | One-liner description. Appears in header and meta description fallback. |

## Theme

All theme values are injected as CSS custom properties. Use `var(--ink-primary)`, `var(--ink-bg)`, etc. in components. Never hardcode colors.

### theme.colors

| Field | Type | Default | CSS Variable |
|-------|------|---------|-------------|
| `primary` | `string` | `'#D4A017'` | `--ink-primary` -- Brand color. Buttons, links, accents. |
| `secondary` | `string` | `'#06B6D4'` | `--ink-secondary` -- Secondary accent. Tags, badges. |
| `accent` | `string` | `'#10B981'` | `--ink-accent` -- Tertiary accent. Success states, highlights. |
| `danger` | `string` | `'#EF4444'` | `--ink-danger` -- Error and destructive action color. |
| `bg.dark` | `string` | `'#0A0A10'` | `--ink-bg` (dark mode) -- Page background. |
| `bg.light` | `string` | `'#FAFBFC'` | `--ink-bg` (light mode) -- Page background. |
| `surface.dark` | `string` | `'#151519'` | `--ink-surface` (dark mode) -- Card/panel background. |
| `surface.light` | `string` | `'#FFFFFF'` | `--ink-surface` (light mode) -- Card/panel background. |
| `text.dark` | `string` | `'#EDEDF0'` | `--ink-text` (dark mode) -- Primary body text. |
| `text.light` | `string` | `'#1A1D23'` | `--ink-text` (light mode) -- Primary body text. |
| `muted.dark` | `string` | `'rgba(255,255,255,0.55)'` | `--ink-muted` (dark mode) -- Secondary text, captions. |
| `muted.light` | `string` | `'rgba(0,0,0,0.55)'` | `--ink-muted` (light mode) -- Secondary text, captions. |
| `dim.dark` | `string` | `'rgba(255,255,255,0.35)'` | `--ink-dim` (dark mode) -- Tertiary text, placeholders. |
| `dim.light` | `string` | `'rgba(0,0,0,0.35)'` | `--ink-dim` (light mode) -- Tertiary text, placeholders. |
| `border.dark` | `string` | `'rgba(255,255,255,0.10)'` | `--ink-border` (dark mode) -- Borders, dividers. |
| `border.light` | `string` | `'rgba(0,0,0,0.10)'` | `--ink-border` (light mode) -- Borders, dividers. |

### theme.fonts

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `display` | `string` | `"'JetBrains Mono', monospace"` | Headings and display text. |
| `body` | `string` | `"system-ui, -apple-system, sans-serif"` | Body text and paragraphs. |
| `mono` | `string` | `"'JetBrains Mono', monospace"` | Code blocks and inline code. |

### theme (other)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `radius` | `string` | `'6px'` | Default border radius for cards, buttons, inputs. |
| `contentWidth` | `string` | `'680px'` | Max width of article content area. |
| `pageWidth` | `string` | `'1200px'` | Max width of the page container. |
| `darkFirst` | `boolean` | `true` | When `true`, dark mode is the default. When `false`, light mode. |

## i18n

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `defaultLang` | `string` | `'en'` | Default language code. Content under `content/{lang}/`. |
| `languages` | `string[]` | `['en']` | Supported language codes. Add `'fr'`, `'es'`, etc. for multilingual. |
| `rtl` | `string[]` | `['fa', 'ar']` | Languages that use right-to-left text direction. |
| `fallback` | `string` | `'en'` | Fallback language when a translation is missing. |

## Features

Toggle front-end features. Components check `config.features.X` before rendering.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `reactions` | `boolean` | `true` | Emoji reaction buttons on blog posts. Stored in D1. |
| `newsletter` | `boolean` | `true` | Email subscription form. Subscribers stored in D1. |
| `readingProgress` | `boolean` | `true` | Progress bar at top of articles showing scroll position. |
| `toc` | `boolean` | `true` | Auto-generated table of contents sidebar on articles. |
| `shareButtons` | `boolean` | `true` | Social share buttons (Twitter, LinkedIn, copy link). |
| `commandPalette` | `boolean` | `true` | Cmd+K / Ctrl+K search palette for quick navigation. |
| `knowledgeGraph` | `boolean` | `true` | Interactive knowledge graph visualization of content. |
| `rss` | `boolean` | `true` | RSS feed at `/rss.xml`. |
| `search` | `boolean` | `true` | Full-text search across all content. |
| `darkModeToggle` | `boolean` | `true` | Light/dark mode toggle in header. |
| `chat` | `boolean` | `false` | Live chat widget. Requires `chat` route enabled and optionally `SOS_BUS_URL` for AI-powered responses. |

## Analytics

Third-party analytics integrations. Leave empty strings to disable.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `googleAnalytics` | `string` | `''` | Google Analytics 4 measurement ID (e.g. `'G-XXXXXXX'`). |
| `clarity` | `string` | `''` | Microsoft Clarity project ID. |
| `hotjar` | `string` | `''` | Hotjar site ID. |
| `tagManager` | `string` | `''` | Google Tag Manager container ID (e.g. `'GTM-XXXXX'`). |
| `plausible` | `string` | `''` | Plausible Analytics domain. |

## SEO

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `seo.organization.name` | `string` | `'Inkwell Site'` | Organization name for JSON-LD schema. |
| `seo.organization.url` | `string` | `'https://example.com'` | Organization URL for JSON-LD schema. |
| `seo.organization.logo` | `string` | `'/logo.svg'` | Path to logo for JSON-LD schema. |
| `seo.organization.knowsAbout` | `string[]` | `[...]` | Topics the organization is known for. Used in JSON-LD. |
| `seo.defaultAuthor.name` | `string` | `'Site Author'` | Default author name for posts without an author. |
| `seo.defaultAuthor.url` | `string` | `'https://example.com'` | Default author URL. |

## Worker URL

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `workerUrl` | `string` | `''` | Base URL of your deployed Cloudflare Worker. Used by front-end components to call the API. Set to your Worker URL (e.g. `'https://inkwell-api.your-account.workers.dev'`). |

## Publish

Controls which publishing channels are enabled.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `publish.inbox` | `boolean` | `true` | Enable file inbox publishing (`content/inbox/` + `npm run ingest`). |
| `publish.api` | `boolean` | `true` | Enable API publishing (`POST /api/publish`). |
| `publish.mcp` | `boolean` | `true` | Enable MCP publishing (`POST /mcp` with `publish_content` tool). |

---

## Worker Environment Variables

These are set in `workers/inkwell-api/wrangler.toml` (non-sensitive) or via `npx wrangler secret put` (sensitive). They configure the Cloudflare Worker backend.

### Core

| Variable | Required | Description |
|----------|----------|-------------|
| `SITE_URL` | Yes | Your site's full URL with protocol (e.g. `https://yourbusiness.com`). Used for absolute URLs in emails, contracts, and API responses. |
| `PUBLISH_TOKEN` | No | Bearer token for the `/api/publish` and `/api/drafts` endpoints. If not set, publishing is unauthenticated. |
| `ENABLED_ROUTES` | No | Comma-separated list of enabled route groups (e.g. `auth,mcp,payments`). Omit or set to `all` to enable everything. |
| `CF_PAGES_DEPLOY_HOOK` | No | Cloudflare Pages deploy hook URL. When set, publishing content triggers a site rebuild. |

### Business Identity

| Variable | Required | Description |
|----------|----------|-------------|
| `BUSINESS_NAME` | No | Your business name. Used in SMS/email templates and questionnaire check-ins. |
| `BUSINESS_PHONE` | No | Business phone number. Displayed in contract emails and chat fallback. |
| `BUSINESS_EMAIL` | No | Business email. Displayed in contract email footers. |
| `CHAT_SYSTEM_PROMPT` | No | Custom system prompt for the chat assistant. Overrides the default `"You are a helpful assistant for this website."` |
| `SOS_REPORT_RECIPIENT` | No | Agent bus recipient for flywheel reports. Default: `"owner"`. |

### Auth

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_COOKIE_NAME` | No | Session cookie name. Default: `inkwell_session`. |
| `AUTH_SESSION_TTL_SECONDS` | No | Session lifetime in seconds. Default: 30 days (2592000). |
| `AUTH_CODE_TTL_SECONDS` | No | Login code validity in seconds. Default: 5 minutes (300). |
| `AUTH_CODE_WEBHOOK_URL` | No | Webhook URL to receive login codes for delivery (email/SMS). If not set, codes are returned in the API response (`testCode` field) for development. |
| `AUTH_CODE_WEBHOOK_TOKEN` | No | Bearer token for the code delivery webhook. |

### Stripe

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | For payments | Stripe API secret key. |
| `STRIPE_WEBHOOK_SECRET` | For payments | Stripe webhook signing secret. |
| `STRIPE_PRICE_SEO` | No | Stripe Price ID for the SEO plan. |
| `STRIPE_PRICE_SEO_ADS` | No | Stripe Price ID for the SEO + Ads plan. |
| `STRIPE_PRICE_FULL` | No | Stripe Price ID for the Full plan. |

### Twilio (SMS)

| Variable | Required | Description |
|----------|----------|-------------|
| `TWILIO_ACCOUNT_SID` | For SMS | Twilio Account SID. |
| `TWILIO_AUTH_TOKEN` | For SMS | Twilio Auth Token. |
| `TWILIO_FROM_NUMBER` | For SMS | Twilio phone number to send from (e.g. `+15551234567`). |

### Resend (Email)

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | For email | Resend API key. |
| `RESEND_FROM_EMAIL` | No | From address for emails (e.g. `"Your Business <contracts@example.com>"`). Requires a verified domain in Resend. |

### Telegram

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | For Telegram | Telegram Bot API token from @BotFather. |
| `TELEGRAM_CHAT_ID` | No | Restrict the bot to a specific chat. If not set, the bot responds to all chats. |

### Google Search Console / GA4 (Flywheel)

| Variable | Required | Description |
|----------|----------|-------------|
| `GSC_CREDENTIALS` | For flywheel | JSON string: `{"client_id": "...", "client_secret": "...", "refresh_token": "..."}` |
| `GSC_SITE_URL` | For flywheel | Your site URL as registered in GSC (e.g. `"https://example.com/"`). |
| `GA4_CREDENTIALS` | For flywheel | JSON string: `{"client_id": "...", "client_secret": "...", "refresh_token": "..."}` |
| `GA4_PROPERTY_ID` | For flywheel | GA4 property ID (e.g. `"123456789"`). |

### Contracts

| Variable | Required | Description |
|----------|----------|-------------|
| `CONTRACT_AUTH_TOKEN` | No | Bearer token for the milestone update endpoint (`POST /api/contracts/:ref/milestone`). |

### MCP / Agent Bus

| Variable | Required | Description |
|----------|----------|-------------|
| `INKWELL_MCP_TOKEN` | No | Bearer token for the MCP endpoint (`POST /mcp`). If not set, MCP is unauthenticated. |
| `SOS_BUS_URL` | No | URL of the SOS agent bus. When set, chat messages are forwarded to AI agents and flywheel reports are posted to the bus. |

### Bindings (wrangler.toml)

These are Cloudflare resource bindings, not env vars. Configured in `wrangler.toml`:

| Binding | Type | Description |
|---------|------|-------------|
| `DB_ANALYTICS` | D1 | Analytics database: page views, reactions, subscribers, content index, flywheel snapshots. |
| `DB_CORE` | D1 | Core database: contracts, milestones, portal accounts, auth, courses, questionnaires, business profiles. |
| `DB_MARKETING` | D1 | Marketing database: GSC/GA4 snapshots, lead events, campaign data, connector runs. |
| `CONTENT` | KV | Content storage: published posts (markdown), post metadata, glass snapshots. |
| `SESSIONS` | KV | Session storage: auth sessions, login codes, rate limit keys. |
