# SEO Autopilot — v7.3.0

**Date:** 2026-04-19
**Approach:** Option A — SeoPort (15th kernel port) + SEO plugin (20th plugin)
**Principle:** Kernel owns contracts. Plugins own features. Edge owns speed.

## Architecture

```
inkwell.config.ts
  seo.geoLocations[]        ← location dataset for programmatic geo pages
  seo.autoLink: true        ← enable graph-based auto-linking
  seo.crawlLogging: true    ← log bot visits to D1
  seo.metaOverrides: {}     ← per-path meta tag overrides from config

kernel/types.ts
  SeoPort                   ← 15th port: crawl logs, redirects, meta overrides, llms.txt

kernel/processors/
  remark-autolink.ts        ← entity-aware auto-linking via knowledge graph

kernel/adapters/
  cf-seo.ts                 ← D1 crawl logs + KV meta overrides

plugins/seo/
  manifest.ts               ← 20th plugin, mountRoutes + mcpTools
  routes.ts                 ← /api/seo/* (redirects CRUD, crawl stats, llms.txt)

workers/inkwell-api/
  src/middleware/edge-seo.ts ← robots.txt, meta injection, crawl logging, redirects
```

## Steps

### Phase 1: Kernel Contract (SeoPort)
Step 1: Add SeoPort interface to kernel/types.ts
Step 2: Add CfSeoAdapter in kernel/adapters/cf-seo.ts
Step 3: Wire adapter in workers/inkwell-api/src/middleware/adapters.ts

### Phase 2: Edge SEO Middleware
Step 4: Create edge-seo.ts middleware (dynamic robots.txt, crawl logging, redirect engine)
Step 5: Mount middleware in workers/inkwell-api/src/index.ts
Step 6: Fix public/robots.txt → served dynamically by Worker

### Phase 3: Auto-Linking Remark Plugin
Step 7: Create kernel/processors/remark-autolink.ts (graph-aware entity linking)

### Phase 4: SEO Plugin
Step 8: Create plugins/seo/manifest.ts + routes.ts (crawl stats, redirect CRUD, meta overrides)
Step 9: Add MCP tools (seo_crawl_stats, manage_redirects, seo_audit)
Step 10: Register plugin in index.ts + config

### Phase 5: Programmatic Geo Pages
Step 11: Add geo location config schema to inkwell.config.ts
Step 12: Create src/pages/locations/[city].astro with LocalBusiness schema
Step 13: Add geo pages to sitemap.xml.ts

### Phase 6: AI Search Optimization
Step 14: Create /llms.txt + /llms-full.txt Worker endpoints
Step 15: Add Speakable schema to seo.ts

### Phase 7: Integration
Step 16: D1 migration for crawl_logs + seo_redirects tables
Step 17: Tests for SeoPort (kernel/__tests__/seo-port.test.ts)
Step 18: Update CLAUDE.md, CHANGELOG.md, version bump
