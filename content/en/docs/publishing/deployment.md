---
title: "Deployment & Scaling"
description: "How to deploy Inkwell to Cloudflare Pages and scale to the edge."
parent: "index"
order: 7
tags: ["publishing", "deployment", "docs"]
---

Inkwell is optimized for the **Cloudflare ecosystem**.

## 1. Cloudflare Pages

The fastest way to deploy.

::mermaid
graph LR
  G[GitHub] -->|Push| P[CF Pages]
  P -->|Build| B[Astro Build]
  B -->|Deploy| E[Edge Network]
::

### Configuration
1. Connect your repository to Cloudflare Pages.
2. Set the build command to `npm run build`.
3. Set the output directory to `dist/`.

## 2. Environment Variables

::comparison{title="Required Env Vars"}
| Variable | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | For KV/D1/R2 management. |
| `CLOUDFLARE_ACCOUNT_ID` | Your CF account identifier. |
| `KV_NAMESPACE_ID` | The ID of your edge cache namespace. |
::

## 3. Edge Caching

Run `npm run cache` after your build to push pre-rendered HTML to the KV store.

::callout[tip]
This allows your site to be served in **< 50ms** from anywhere in the world.
::

---

[[config/site-config|Review configuration]] or [[publishing/agent-workflow|Back to Agent Workflow]].
