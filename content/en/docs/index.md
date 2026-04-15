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

- [[architecture/system-design|System Design]] — How the pieces fit together.
- [[config/site-config|Configuration]] — Tuning your site from a single file.
- [[getting-started|Getting Started]] — Quick setup and first post.
- [[publishing/agent-workflow|Agent Workflow]] — How to automate your content engine.
- [[publishing/deployment|Deployment & Scaling]] — Going live on Cloudflare.
- [[features/interactive-components|Interactive Features]] — Charts, Graphs, and Reactions.
- [[features/seo-discovery|SEO & Discovery]] — Dominating the search landscape.
- [[features/backlinks-graph|Backlinks & The Graph]] — Navigating the network.
- [[config/api-reference|API Reference]] — REST and MCP endpoints.
- [[strategy/market-positioning|Market Positioning]] — Inkwell vs. The Unicorns.
- [[strategy/roadmap|Project Roadmap]] — Evolutionary path and planned features.
- [[strategy/content-strategy|Content Strategy]] — Voice, tone, and editorial pillars.
- [[concepts/glossary|Glossary & Concepts]] — FRC physics and terminology.
- [[reference/internal-abstractions|Internal Abstractions]] — Blueprints of the core logic.

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
