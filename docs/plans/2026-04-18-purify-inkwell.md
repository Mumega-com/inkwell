# Plan: Purify Inkwell — Separate Framework from Instance

**Date:** 2026-04-18
**Goal:** Make Inkwell a pure open-source framework with zero Mumega-specific references. mumega.com becomes an *instance* that uses Inkwell with SOS/Mirror/CF adapters.

## Problem

51 hardcoded `mumega` references across worker code and plugins violate rule #3 (no hardcoded URLs). A fork inherits Mumega branding, API URLs, and localStorage keys. Not fork-ready.

## Approach: Hybrid (Option C)

Phase 1: Purge all hardcoded references → config-driven
Phase 2: Create `instances/mumega/` with production overrides

## Steps

### Step 1: Add network config to inkwell.config.ts
- Add `network.apiUrl`, `network.storageKeyPrefix`, `network.brandName`, `network.poweredByUrl`, `network.corsOrigins`
- Defaults: `'inkwell'` prefix, empty URLs (standalone mode)

### Step 2: Purge Worker index.ts (16 refs)
- CORS: read from config.network.corsOrigins or derive from SITE_URL env
- Fallback URLs: read from env, no hardcoded defaults
- localStorage keys: `inkwell_auth_token`, `inkwell_tenant_slug`, `inkwell_api_url`
- Default page: "Powered by {config.name}" not "Powered by Mumega"

### Step 3: Purge React components (5 files, 20 refs)
- AssistantChat.tsx, SettingsForm.tsx, OnboardingWizard.tsx, NotificationBell.tsx
- All localStorage keys: `mumega_*` → `inkwell_*`
- All hardcoded URLs: read from config/props

### Step 4: Purge plugin routes (3 files, 8 refs)
- mcp-tools.ts: `mumegaPost`/`mumegaGet` → `networkPost`/`networkGet`, remove default URL
- organism/routes.ts: `bus.send('mumega', ...)` → `bus.send(config.network.busTarget, ...)`
- commerce/routes.ts: `'mumega'` ledger entry → `config.name.toLowerCase()`

### Step 5: Purge Worker types + middleware (7 refs)
- `MUMEGA_API_URL` → `NETWORK_API_URL`
- `MUMEGA_TOKEN` → `NETWORK_TOKEN`
- Update adapter middleware

### Step 6: Create instances/mumega/
- `instances/mumega/config.ts` — extends base config with Mumega values
- `instances/mumega/wrangler.production.toml` — moved from workers/
- `instances/mumega/README.md` — how to deploy this instance

### Step 7: Verify purity
- `grep -r 'mumega' **/*.ts **/*.tsx` outside instances/ = 0 matches

### Step 8: Build + test + deploy
- 100 kernel tests pass
- Worker builds from base config (standalone mode)
- Deploy from instances/mumega/ with SOS adapters
- *.mumega.com still works

## What a fork looks like after this

```bash
git clone https://github.com/Mumega-com/inkwell
cd inkwell
# Edit inkwell.config.ts (name, domain, theme, adapters)
# Edit wrangler.toml (CF resource IDs)
npx wrangler deploy
# Done. Zero Mumega references. Your brand, your infra.
```

## What mumega.com looks like after this

```
inkwell/                    ← pure framework (open source)
  inkwell.config.ts         ← generic defaults
  kernel/                   ← contracts + adapters
  plugins/                  ← features
  workers/inkwell-api/      ← worker entry + generic wrangler.toml

inkwell/instances/mumega/   ← mumega.com instance (can be gitignored or separate repo)
  config.ts                 ← overrides: SOS adapters, mumega branding, API URLs
  wrangler.production.toml  ← real CF resource IDs
  README.md                 ← deploy instructions
```
