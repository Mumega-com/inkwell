# Inkwell Roadmap

Current: **v8.4.0** — Ship-ready platform, 23 plugins, 16 ports, 38 MCP tools, CF Zero Trust + Workflows + Intelligence

## v7.x — Shipped

- [x] Microkernel architecture (600-line kernel, plugin contracts)
- [x] 21 plugins: analytics, auth, dashboard, commerce, content, mcp, contracts, courses, telegram, chat, diagnostics, discovery, payments, questionnaire, onboarding, notifications, organism, sync, media, seo, feedback
- [x] 16 hexagonal port interfaces (Database, Auth, CRM, Search, Session, Content, Storage, Graph, Agent, Bus, Memory, Economy, ContentSource, Media, Seo, Feedback)
- [x] 22 MCP tools via Streamable HTTP transport
- [x] RBAC hierarchy (owner > admin > manager > member > viewer)
- [x] OTP passwordless auth
- [x] MDX knowledge engine (wikilinks, backlinks, 14 block types, graph API)
- [x] Editorial calendar with bulk content planning
- [x] First-party data collection (UTM, visitor profiles, events, funnels, cohorts)
- [x] NPS/CSAT surveys, feature voting, LLM auto-classification
- [x] AI media pipeline (upload, describe, transcribe, transform, generate)
- [x] SEO autopilot (crawl analytics, redirects, meta overrides, dynamic robots.txt)
- [x] Glass Commerce (transactions, royalties, metering, Stripe Connect)
- [x] E-signature contracts with SMS/email delivery
- [x] Course enrollment, progress tracking, drip lessons
- [x] Organism API (managed agent provisioning, usage budgets)
- [x] Multi-tenant via subdomain routing
- [x] SOS integration (bus, memory, economy) — optional

## v8.0 — Ship-Ready Platform

### Sprint 1: Security & DevX (in progress)

- [x] S1.1 — Secure PUBLISH_TOKEN default (insecure token blocklist)
- [x] S1.2 — Per-tenant MCP token provisioning (create, list, revoke, KV-cached lookup)
- [x] S1.3 — Auto-migrate D1 on first request (compiled migrations, zero manual setup)
- [x] S1.4 — Update ROADMAP.md for v8

### Sprint 2: Provider-Agnostic Adapters

- [x] S2.1 — Postgres adapter for DatabasePort
- [x] S2.2 — S3 adapter for StoragePort
- [x] S2.3 — Redis adapter for SessionPort
- [x] S2.4 — File adapter for ContentPort
- [x] S2.5 — Provider auto-detection (env sniffing → correct adapter set)

### Sprint 3: Fork & Distribution

- [x] S3.1 — `npx create-inkwell` CLI (scaffold, configure, deploy)
- [x] S3.2 — FORK-GUIDE.md rewrite for v8

### Sprint 4: Marketing Customer Toolkit (v8.1)

- [x] S4.1 — `business_intake` MCP tool (structured wiki from customer data — 7 interlinked pages)
- [x] S4.2 — `post_social` MCP tool (webhook-based social posting — Twitter, LinkedIn, Instagram, Facebook, YouTube, TikTok, Threads)
- [x] S4.3 — `content_strategy` MCP tool (prioritized marketing plan from wiki — SEO, content, social, ads)

### Sprint 5: CRM + Automation + Outreach (v8.2)

- [x] S5.1 — CRM plugin (contacts, pipeline, deals, activities — 5 MCP tools + 9 REST endpoints)
- [x] S5.2 — Automation plugin (trigger_workflow, list_workflows — n8n bridge via webhook + API)
- [x] S5.3 — Outreach tools (find_leads with enrichment webhook, run_outreach with n8n trigger)
- [x] S5.4 — marketing_report MCP tool (cross-channel digest: contacts, deals, content, social, outreach)
- [x] S5.5 — Wire plugins, compile migrations, tests pass (48/48)

### Sprint 6: CF Zero Trust + Workflows (v8.3)

- [x] S6.1 — CF Workflows as automation provider (GenericWorkflow + OutreachSequenceWorkflow)
- [x] S6.2 — CF Access Service Tokens (machine-to-machine auth for agents)
- [x] S6.3 — CF Access JWT signature verification (RS256, JWKS cached in KV)
- [x] S6.4 — Automation plugin: 5-provider detection (CF Workflows > ToRivers > n8n > Zapier > webhook)

### Sprint 7: Intelligence Layer (v8.4)

- [x] S7.1 — `auto_tag_content` MCP tool (Workers AI text classification → suggested tags, persist to KV + D1)
- [x] S7.2 — `generate_pages` MCP tool (template × variable matrix → scale SEO, up to 500 pages/call, dry_run mode)
- [x] S7.3 — `prune_content` MCP tool (thin + stale content detection, report or auto-archive)

### Backlog

- [ ] Anthropic Managed Agent API integration (provision call is stubbed)
- [ ] Mirror tenant isolation (SOS v0.8.0)
- [ ] Bus SSE streaming (SOS v0.8.x — poll-only for now)
- [ ] Economy MCP tools (SOS v0.7.3 — using REST)
- [ ] B2B interoperability (cross-tenant transactions)
- [ ] Video generation (Remotion renders posts as animated video)
