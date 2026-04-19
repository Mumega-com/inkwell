# First-Party Data Collection — v7.5.0

**Date:** 2026-04-19
**Approach:** Extend analytics plugin + new middleware. No new port — events/UTMs/profiles are analytics concerns, not a new capability abstraction.
**Principle:** Kernel owns contracts. Plugins own features. Middleware owns cross-cutting collection.

## Why no new port?

Ports abstract capabilities (storage, auth, messaging). Event tracking is a feature of the analytics plugin, not a new capability. UTM parsing is middleware (runs on every request). Visitor profiles are a storage concern within analytics. Adding a port here would be over-engineering — the analytics plugin already owns page views, reactions, feedback.

## Architecture

```
workers/inkwell-api/
  src/middleware/
    utm.ts                    ← parse UTMs from query string, persist in KV session
    visitor-profile.ts        ← stitch anonymous visitor_hash → portal_account_id on auth

plugins/analytics/
  routes.ts                   ← extend: POST /api/analytics/event, GET /api/analytics/funnel
  
workers/inkwell-api/
  migrations/analytics/
    0006_events_and_profiles.sql  ← events table, visitor_profiles table, daily_aggregates view
```

## Steps

### Phase 1: Event Tracking
Step 1: Migration 0006 — events + visitor_profiles tables
Step 2: POST /api/analytics/event route (public, anonymous, visitor-hashed)
Step 3: GET /api/analytics/funnel route (auth required — funnel analysis)

### Phase 2: UTM Attribution
Step 4: UTM parsing middleware (extract from query string, persist in session)
Step 5: Attach UTM data to events, page views, and auth signups

### Phase 3: Visitor Profile Stitching  
Step 6: Visitor profile middleware (create/update profile on every request)
Step 7: Stitch anonymous → identified on auth (link visitor_hash to portal_account_id)

### Phase 4: Activation Endpoints
Step 8: GET /api/analytics/cohorts — behavioral cohort queries
Step 9: GET /api/analytics/recommendations — content recommendations from graph + engagement
Step 10: Extend flywheel — daily aggregate rollups + behavioral triggers

### Phase 5: Integration
Step 11: Tests (kernel/__tests__/analytics-events.test.ts)
Step 12: Update CLAUDE.md, CHANGELOG.md, version bump
