# Inkwell v3 Roadmap

## P1 — Core CMS (the CMS doesn't work without these)

- [x] **Wikilinks** — remark-wikilinks.ts parses [[page]] and [[page|text]]
- [x] **Backlinks** — reverse index built by wikilinks plugin
- [x] **:: block rendering** — remark-blocks.ts renders 8 block types
- [x] **Inline charts** — ::chart blocks output data attributes for Recharts
- [x] **TOC in post layout** — 220px sticky sidebar, hidden on mobile
- [x] **JSON-LD verified** — BlogPosting + Organization + WebSite schemas
- [x] **Reading time** — calculated from actual word count in post header
- [x] **Analytics injection** — GA, GTM, Clarity, Hotjar, Plausible conditional on config

## P2 — Product (makes it usable by others)

- [x] **Search** — Pagefind static search, /search page, dark themed
- [x] **Command palette** — Cmd+K wired in Base.astro with nav links
- [ ] **Video hero** — Video-first page layout with chapters (needs video content)
- [x] **API publish** — inkwell-api Worker with view, reaction, subscribe endpoints
- [x] **OG image generation** — Playwright script (npm run generate:og)
- [x] **D1 analytics** — Worker wired to inkwell-analytics D1 (page_views, reactions, subscribers)
- [x] **Feature flags** — Config toggles gate ReadingProgress, Reactions, ShareButtons, NewsletterCTA
- [x] **Mermaid diagrams** — ::mermaid blocks with CDN lazy-load, dark theme
- [x] **Twitter Card meta** — summary_large_image verified in Base.astro
- [x] **Auto-description** — Ingest generates from first sentence if missing
- [x] **Live Feedback** — POST /api/feedback endpoint + two-stage React component

## P2.5 — Documentation (Stripe-Quality)

- [x] **Integrated Docs** — New `docs` collection with hierarchical navigation
- [x] **10+ High-Fidelity Guides** — Getting Started, Architecture, API, Schemas, etc.
- [x] **Perfect Interconnectedness** — Complete semantic web of [[wikilinks]] across all collections
- [x] **Developer Reference** — Documentation of core internal abstractions
- [x] **Agentic entry point** — Optimized `llms.txt` for external AI legibility
- [x] **Strategy Manuals** — Market Positioning, Content Strategy, and Roadmap guides

## P3 — Differentiators (what no other CMS does)

- [x] **i18n routing** — Astro built-in, RTL support, hreflang tags, language switcher
- [x] **RTL support** — dir="rtl" from config.i18n.rtl
- [x] **Hreflang tags** — self-ref + x-default, expandable
- [x] **Annotations API** — Generic interface + Astro component, pluggable auth
- [x] **Content flywheel** — scripts/flywheel.ts monitors HN RSS, scores by tags
- [x] **KV edge cache** — lib/kv-cache.ts + scripts/cache-to-kv.ts
- [x] **R2 media pipeline** — scripts/upload-media.ts
- [x] **Social proof bar** — SocialProofBar.tsx fetches live D1 stats
- [x] **KaTeX math** — remark-math + rehype-katex
- [ ] **Auto-tags** — Suggest tags from content analysis (deferred to P4, needs AI)

## P4 — Organism (the system that improves itself)

- [x] **Adaptive pages** — A/B variants on Cloudflare edge (KV), significance testing, agent optimization loop.
- [x] **A/B testing** — KV variant configs, serve different versions with deterministic chi-squared logic.
- [ ] **Video generation** — Remotion renders posts as animated video
- [ ] **Schema predator** — Read competitor SERPs, generate richer structured data
- [ ] **Content as context** — Vectorize all posts, derive opinions from body of work
- [ ] **Programmatic generation** — Template × Variable matrix for scale SEO
- [ ] **Content pruning** — Archive underperformers monthly
- [ ] **Referral program** — Subscribers recruit subscribers

## P5 — Autonomous Business Engine (v4.1 / v5)

- [x] **FMAAP Gate** — Systemic safety layer checking Flow, Metabolism, Alignment, Autonomy, and Physics.
- [x] **Glass Commerce Engine** — Deterministic D1 ledger (transactions, royalties, metering), Stripe Connect integration for native digital product sales.
- [x] **Transparent Diagnostics Engine** — Translates `dG/dt` physics into human-readable, template-based health narratives on the dashboard.
- [x] **Mirror Memory** — Cross-tenant learning pushed to global memory so all Inkwell instances optimize together.
- [ ] **B2B Interoperability** — Squads negotiate and execute cross-tenant transactions autonomously.

## Done

- [x] Astro scaffold with content collections (Zod schemas)
- [x] Config-driven theme (inkwell.config.ts → CSS custom properties)
- [x] Dark/light/system toggle in header
- [x] 9 Astro server components (Header, Footer, Callout, PullQuote, Tldr, Figure, StatsBar, AuthorCard, JsonLd)
- [x] 8 React islands (Reactions, ShareButtons, NewsletterCTA, ReadingProgress, CommandPalette, TOC, KnowledgeGraph, VideoHero)
- [x] Blog listing + individual post pages
- [x] Explore page with knowledge graph
- [x] RSS feed + sitemap
- [x] 404 page
- [x] Ingest script (content/inbox/ → content/en/)
- [x] Publishing skill (inkwell-publish)
- [x] Content strategy document
- [x] 14 blog posts
- [x] Deployed to Cloudflare Pages
- [x] Cloudflare D1 + R2 + KV created
- [x] Screenshots captured (Playwright)

## Backlog — Optional Integrations

These features depend on external systems and are NOT part of the forkable Inkwell core. They can be added as plugins/integrations when a fork needs them.

- [ ] **Bus publish** — MCP message → content published
- [ ] **MCP server** — Agents connect and publish via MCP protocol
- [ ] **Agent annotations** — authenticated agents annotate posts (corrections, additions)
- [ ] **Reward attribution** — Track rewards earned per post in frontmatter
- [ ] **Live stats** — Homepage pulls live counts from an external service
- [ ] **Agent profiles** — /team pages pull real data from a registry
- [ ] **Task-to-content pipeline** — Completed task auto-publishes result as blog post
