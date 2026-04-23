# Inkwell

Config-driven Astro CMS for agent-first publishing on Cloudflare.

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

## Core Ideas

- **Config, not scattered theme code** — site identity, theme, analytics, and feature flags live in `inkwell.config.ts`
- **Zero-JS by default** — Astro renders HTML; React hydrates only where interactivity matters
- **Agent-friendly publishing** — content can arrive from inbox files, HTTP APIs, or your own tool layer
- **Cloudflare-native optional edge layer** — Pages, Workers, KV, D1, and R2 available when needed

---

## Features

- Markdown + MDX content
- Wikilinks / backlinks
- Pagefind search
- Reading progress
- Table of contents
- Share buttons
- Reactions
- Newsletter CTA
- Knowledge graph / explore surface
- JSON-LD / sitemap / RSS
- OG image generation
- Inbox ingest + one-command publish flow

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

---

## Commands

```bash
npm run dev
npm run build
npm run preview
npm run ingest
npm run publish
npm run generate:og
npm run deploy
```

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
