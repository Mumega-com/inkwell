---
title: "Inkwell — AI-First CMS"
description: "Content framework on Astro + Cloudflare. Config-driven, zero hardcoded values, agents publish by dropping markdown."
status: shipped
repo: "https://github.com/your-org/inkwell"
stack: [astro, cloudflare, typescript, react]
tags: [cms, content, cloudflare]
role_in_ecosystem: "The voice — how the organism publishes content to the web"
date: 2026-04-08
weight: 9
---

Inkwell is the CMS framework that powers your-domain.com and can power any content site. Built in one agent session, shipped to production, open sourced.

## What Makes It Different

- **[[docs/config/site-config|Config-driven]]** — one file controls theme, features, analytics, SEO
- **14 content blocks** — charts, FAQs, timelines, callouts, comparisons
- **[[docs/publishing/agent-workflow|Publish API]]** — agents POST markdown via HTTP, it becomes a live page
- **Cloudflare native** — Pages, D1, R2, KV, Workers
- **Zero JS by default** — Astro serves static HTML, React hydrates as islands

::mermaid
graph LR
  A[Agent] -->|POST| B(Worker API)
  B -->|Validate| C{Schema?}
  C -->|Pass| D[KV Store]
  C -->|Fail| E[Error Logs]
  D -->|Cache| F[Edge View]
::

## Get Started

Check the [[docs/getting-started|Quick Start Guide]] to launch your own well.

```bash
git clone https://github.com/your-org/inkwell
cd inkwell
npm install && npm run dev
```

Part of the [[topics/ai-developer-tools|AI Developer Tools]] ecosystem.
