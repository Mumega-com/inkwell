# Feedback & Engagement System — v7.4.0

**Date:** 2026-04-19
**Approach:** Option A — FeedbackPort (16th kernel port) + feedback plugin (21st plugin) + flywheel integration
**Principle:** Kernel owns contracts. Plugins own features. Edge owns speed.

## Architecture

```
inkwell.config.ts
  feedback.surveys[]         ← configurable survey definitions (NPS, CSAT, custom)
  feedback.triggers{}        ← when to show surveys (day-14, post-checkout, exit)
  feedback.votingEnabled     ← feature voting board on/off
  feedback.classifyEnabled   ← LLM auto-classification on/off

kernel/types.ts
  FeedbackPort               ← 16th port: submit, query, classify, vote, aggregate

kernel/adapters/
  cf-feedback.ts             ← D1 implementation of FeedbackPort

plugins/feedback/
  manifest.ts                ← 21st plugin, mountRoutes + mcpTools
  routes.ts                  ← /api/feedback/* (surveys, responses, votes, insights)
  components/
    FeedbackWidget.tsx        ← contextual micro-survey React island
    NpsWidget.tsx             ← NPS 0-10 scale widget
    FeatureVoteBoard.tsx      ← feature request voting board

workers/inkwell-api/
  src/scheduled.ts           ← extend flywheel: classify feedback, score churn
  migrations/analytics/
    0005_feedback_system.sql  ← survey responses, feature votes, classifications
```

## Steps

### Phase 1: Kernel Contract (FeedbackPort)
Step 1: Add FeedbackPort interface + data types to kernel/types.ts
Step 2: Add CfFeedbackAdapter in kernel/adapters/cf-feedback.ts
Step 3: Wire adapter in workers/inkwell-api/src/middleware/adapters.ts + types.ts
Step 4: D1 migration for survey_responses, feature_votes, feedback_classifications

### Phase 2: Feedback Plugin (API)
Step 5: Create plugins/feedback/manifest.ts + routes.ts
Step 6: Add survey submission + query routes
Step 7: Add feature voting routes (submit vote, list, get results)
Step 8: Add insights routes (aggregates, trends, top issues)
Step 9: Add MCP tools (get_feedback_summary, trigger_survey, get_churn_signals)
Step 10: Register plugin in index.ts + config

### Phase 3: React Islands (UI)
Step 11: FeedbackWidget — contextual 1-2 question micro-survey (inline, not modal)
Step 12: NpsWidget — NPS 0-10 scale with optional follow-up text
Step 13: FeatureVoteBoard — list of feature requests with upvote counts

### Phase 4: Flywheel Integration
Step 14: LLM classification of freetext feedback (bug/friction/request/praise)
Step 15: Churn signal scoring (login frequency + feature breadth + feedback sentiment)
Step 16: Weekly feedback digest to owner via bus

### Phase 5: Integration
Step 17: Tests for FeedbackPort (kernel/__tests__/feedback-port.test.ts)
Step 18: Update CLAUDE.md, CHANGELOG.md, version bump
