---
title: "Deployment & Scaling"
description: "How to deploy Inkwell to Cloudflare Pages and scale to the edge."
parent: "index"
order: 7
tags: ["publishing", "deployment", "docs"]
---

Inkwell is designed for the **Cloudflare Global Edge**. It leverages Pages, Workers, D1, KV, and R2 to provide a "stateless" but high-performance experience.

## 1. Frontend: Cloudflare Pages

The fastest way to deploy the static core.

1.  Connect your repository to Cloudflare Pages.
2.  **Build Command:** `npm run build`
3.  **Output Directory:** `dist/`
4.  **Environment Variables:** Add your `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## 2. Backend: Cloudflare Workers (D1 + KV)

The `inkwell-api` worker handles all dynamic engagement (Reactions, Feedback, Subscriptions).

### D1 Database Setup
Inkwell uses D1 for low-latency SQL storage. Run migrations before your first deploy:

```bash
# Local development
npx wrangler d1 migrations apply inkwell-analytics --local

# Production
npx wrangler d1 migrations apply inkwell-analytics --remote
```

### Edge Caching (KV)
Run `npm run cache` after your build to push pre-rendered HTML fragments to the KV store. This ensures a **< 100ms TTFB** globally.

## 3. Media: Cloudflare R2

For high-volume media, Inkwell uses R2. Configure your bucket name in `wrangler.toml` and use the `npm run upload:media` script to sync your local assets.

## 4. Production Secrets

Never commit secrets. Use Wrangler to set them in the Cloudflare environment:

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put PUBLISH_TOKEN
```

## Scaling to 1M+ Readers

Because Inkwell is **Stateless** and **Edge-Native**, scaling is handled automatically by Cloudflare. 

::stats
| 100ms | Global TTFB (via KV) |
| 0 | Database bottlenecks (via D1) |
| ∞ | Horizontal scalability |
::

---

[[config/site-config|Review the Theming guide]] or [[publishing/agent-workflow|Review Agent Workflow]].
