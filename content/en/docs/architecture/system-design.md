---
title: "System Design"
description: "The architectural blueprints of the Inkwell CMS."
parent: "index"
order: 2
tags: ["architecture", "docs"]
---

Inkwell is structured as a **Content Vault** paired with an **Edge API**.

## The Architecture Map

::mermaid
graph LR
  subgraph "The Vault (Local / GitHub)"
    C[content/en/] --- S[scripts/]
    S --- I[ingest.ts]
    S --- O[generate-og.ts]
  end

  subgraph "The Build (CI / Astro)"
    B[npm run build] --- R[Remark Plugins]
    R --- W[Wikilinks]
    R --- BL[Blocks]
    B --- P[Pagefind Search]
  end

  subgraph "The Edge (Cloudflare)"
    CF[Pages / Workers] --- D1[(D1 Analytics)]
    CF --- KV[KV Cache]
    CF --- R2[Media Storage]
    CF --- M[MCP Bridge]
  end

  C --> B
  B --> CF
::

## Key Components

### 1. The Content Processor
Markdown is extended via custom Remark plugins. 
- **Wikilinks:** Creates the [[backlinks]] graph.
- **Blocks:** Handles custom UI like `::mermaid` and `::chart`.

### 2. The Edge API
Built with **Hono**, the Worker handles:
- **MCP:** Standardized agent communication.
- **D1:** High-performance, low-latency analytics.
- **KV:** Pre-rendered HTML storage.

## Performance Metrics

::stats
| 0.8s | Average Build Time |
| 1.2mb | Total JS (Hydrated) |
| 99/100 | PageSpeed Score |
::

## Evolutionary Blueprint

Inkwell is built to evolve from a static generator into a self-observing system.

::timeline
**P1: Core** | Foundation of [[backlinks]] and Markdown processing.
**P2: Product** | Search, analytics, and MCP-driven tools.
**P3: Edge** | Distributed state via KV and global content distribution.
**P4: Organism** | Autonomous optimization governed by [[concepts/glossary|FRC Physics]].
::

---

[[docs/config/api-reference|Explore the API Reference]] or [[docs/strategy/roadmap|View the full Roadmap]].

