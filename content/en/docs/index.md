---
title: "Inkwell Overview"
description: "The complete architecture, configuration, and publishing guide for the agent-first CMS."
order: 1
tags: ["docs", "architecture", "overview"]
date: "2026-04-14"
---

Welcome to the **Inkwell Technical Documentation**. This system is built for speed, agency, and 100% config-driven autonomy.

::mermaid
graph TD
  A[Human / Agent] -->|Markdown| B(content/inbox/)
  B -->|npm run ingest| C{Content Ingest}
  C -->|Validate| D[content/en/blog/]
  C -->|Tag & Graph| E[Knowledge Graph]
  D -->|npm run build| F[Static HTML / Pagefind]
  F -->|npm run cache| G[Cloudflare KV Edge]
  G -->|inkwell-api| H[User View]
::

## Core Philosophy

Inkwell is a **headless content engine** that treats the filesystem as the source of truth and Cloudflare as the execution layer.

::stats
| 100% | Config-driven |
| < 100ms | Edge Latency |
| 14 | JSON-LD Schemas |
::

## Navigation

### 1. Concepts
- [[concepts/glossary|Glossary]] — Core terminology and FRC variables.
- [[concepts/glass-dashboard|The Glass Dashboard]] — Deterministic observability.
- [[strategy/market-positioning|Market Positioning]] — Inkwell vs. The Unicorns.

### 2. Features
- [[features/glass-commerce|Glass Commerce Engine]] — Native digital products and Stripe Connect.
- [[features/transparent-diagnostics|Transparent Diagnostics]] — Understanding squad health (DIAG-UI).
- [[features/adaptive-pages|Adaptive Pages]] — Autonomous A/B testing at the edge.
- [[features/seo-discovery|SEO & Discovery]] — Dominating the search landscape.
- [[features/interactive-components|Interactive Features]] — Charts, Graphs, and Reactions.
- [[features/backlinks-graph|The Knowledge Graph]] — Navigating the network.

### 3. Architecture & Config
- [[architecture/system-design|System Design]] — How the pieces fit together.
- [[config/site-config|Configuration]] — Tuning your site from a single file.
- [[getting-started|Getting Started]] — Quick setup and first post.
- [[publishing/agent-workflow|Agent Workflow]] — Automation and publishing.
- [[publishing/deployment|Deployment & Scaling]] — Going live on Cloudflare.
- [[config/schema-reference|Schema Reference]] — Zod and D1 table definitions.
- [[config/api-reference|API Reference]] — REST and MCP endpoints.
- [[strategy/roadmap|Project Roadmap]] — Evolutionary path and planned features.
- [[strategy/content-strategy|Content Strategy]] — Voice, tone, and editorial pillars.
- [[reference/internal-abstractions|Internal Abstractions]] — Blueprints of the core logic.
- [[reference/troubleshooting|Troubleshooting & FAQ]] — Common issues and resolutions.


::callout[tip]
Use `npm run flywheel` to automatically discover trending topics and generate content briefs like this one!
::

## Feedback
Was this helpful? 
::metric{label="Helpfulness" value="98%" trend="up"}
::
this helpful? 
::metric{label="Helpfulness" value="98%" trend="up"}
::
::
