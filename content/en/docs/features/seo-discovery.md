---
title: "SEO & Discovery"
description: "How Inkwell dominates search results for humans and AI models."
parent: "index"
order: 8
tags: ["features", "seo", "docs"]
---

Inkwell features a multi-layered **Discovery Engine**.

## 1. Static Search

Powered by **Pagefind**, search is lightning fast and 100% static.

::metric{label="Search Latency" value="< 10ms" trend="up"}

## 2. Structured Data (JSON-LD)

Inkwell automatically generates 14 types of schema data.

::comparison{title="AI Search Signal Strength"}
| Feature | Impact | Why? |
|---|---|---|
| JSON-LD | High | Provides clear semantic structure. |
| `knowsAbout` | High | Establishes topical authority. |
| Semantic Tags | Med | Helps with clustering. |
::

## 3. Open Graph Assets

Every post automatically receives a high-quality OG image via `npm run generate:og`.

::mermaid
graph TD
  P[Post] -->|Script| S[Playwright]
  S -->|Render| H[HTML Template]
  H -->|Snapshot| I[OG Image]
  I -->|R2| R[Cloudflare R2]
::

---

[[config/site-config|Configure your SEO fields]] or [[architecture/system-design|Learn about the build process]].
