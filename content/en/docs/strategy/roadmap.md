---
title: "Project Roadmap"
description: "The evolutionary path of Inkwell — from core CMS to self-improving organism."
parent: "index"
order: 13
tags: ["strategy", "roadmap", "docs"]
---

Inkwell's development is structured into four phases, moving from foundational stability to autonomous optimization.

## Current Progress

::metric{label="Phase 1 & 2 Complete" value="92%" trend="up"}

## The Evolutionary Path

::mermaid
gantt
    title Inkwell Evolution
    dateFormat  YYYY-MM-DD
    section Phase 1: Core
    Wikilinks & Backlinks    :done, p1_1, 2026-01-01, 30d
    Custom Blocks & Charts   :done, p1_2, 2026-02-01, 20d
    JSON-LD & SEO            :done, p1_3, 2026-02-20, 15d
    section Phase 2: Product
    Search & Palette         :done, p2_1, 2026-03-10, 20d
    API Publish              :done, p2_2, 2026-03-30, 15d
    Video Hero               :active, p2_3, 2026-04-10, 20d
    section Phase 3: Edge
    KV Caching               :done, p3_1, 2026-04-01, 10d
    Flywheel Automation      :done, p3_2, 2026-04-05, 10d
    Auto-tags (AI)           :p3_3, 2026-05-01, 30d
    section Phase 4: Organism
    Adaptive Pages           :p4_1, 2026-06-01, 60d
    Schema Predator          :p4_2, 2026-07-01, 45d
::

## Phase Breakdown

### P1 — Foundation (Stable)
The core content engine that treats the filesystem as the source of truth.
- **Wikilinks & Backlinks:** Semantic internal networking.
- **14 Content Blocks:** Charts, Diagrams, and interactive UI.
- **Full SEO Suite:** Automated JSON-LD and meta-tags.

### P2 — Product (Active)
Making the system usable and distributable for others.
- **Pagefind Search:** Static, high-performance search.
- **OG Image Generation:** Automated social assets via Playwright.
- **Edge Analytics:** D1-backed views and reactions.

### P3 — Differentiators (Active)
Features that separate Inkwell from traditional headless CMS platforms.
- **Global Edge Caching:** Pre-rendered HTML in Cloudflare KV.
- **Content Flywheel:** Automated trend monitoring and brief generation.
- **KaTeX Math:** Scientific and technical rendering support.

### P4 — The Organism (Planned)
The system begins to observe itself and improve autonomously.
- **Adaptive Pages:** AI-driven layout and content optimization based on analytics.
- **Schema Predator:** Automatically analyzing competitors to improve search signals.
- **Content as Context:** Deep vectorization of the entire vault for agentic reasoning.

---

[[strategy/market-positioning|See Market Strategy]] or [[getting-started|Return to Getting Started]].
