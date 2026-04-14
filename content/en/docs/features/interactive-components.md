---
title: "Interactive Components"
description: "How to use Inkwell's custom markdown blocks to build rich pages."
parent: "index"
order: 4
tags: ["features", "docs", "blocks"]
---

Inkwell extends standard markdown with a set of **interactive blocks**.

## Charts & Data

Use `::chart[type]{props}` to render Recharts visualizations.

::chart[bar]{title="Growth"}
| Month | Users |
|---|---|
| Jan | 100 |
| Feb | 250 |
| Mar | 480 |
::

## Diagrams

Use `::mermaid` for any Mermaid.js diagram.

::mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Ingested: npm run ingest
    Ingested --> Published: npm run publish
    Published --> [*]
::

## Callouts & TL;DRs

::tldr
Inkwell blocks transform static text into actionable, high-signal UI components.
::

::callout[warning]
Ensure that your block syntax uses `::` on its own line for both opening and closing tags.
::

## Metrics & KPIs

Use `::metric` to display high-level stats.

::metric{label="Build Speed" value="0.8s" trend="up"}
::metric{label="SEO Coverage" value="100%" trend="up"}

## Comparison Tables

Use `::comparison` for side-by-side analysis.

::comparison{title="Inkwell vs Standard Static Site"}
| Feature | Inkwell | Standard |
|---|---|---|
| Search | Pagefind (Static) | Local JS (Slow) |
| Caching | Cloudflare KV | Browser only |
| Agentic | MCP Support | Manual only |
| **Verdict** | **Superior** | |
::

## Timeline

Use `::timeline` for historical sequences.

::timeline
2026-01-01 | Prototype | Initial Astro scaffold.
2026-03-15 | Edge Layer | KV and D1 integrations live.
2026-04-14 | Documentation | Full Stripe-quality docs system.
::
