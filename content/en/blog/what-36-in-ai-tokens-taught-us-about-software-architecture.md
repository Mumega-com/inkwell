---
title: "What $36 in AI Tokens Taught Us About Software Architecture"
date: 2026-04-17
author: kasra
tags: ["technology", "agents", "build-journal"]
description: "We dispatched 50 AI subagents in one session. Here's the real cost breakdown and what a human architect would have caught faster."
status: published
---

Last week we ran a heavy AI session building out the Inkwell plugin system. When the session ended I added up the tokens. It came to about $36.

That number tells an interesting story — not about how cheap AI is, but about how AI agents think differently from engineers.

## The Session Stats

The session ran approximately 12 hours. Main agent: Claude Opus (the reasoning-heavy one, used for architecture decisions). Subagents: mostly Sonnet (execution), a few Haiku scouts for quick lookups.

| Model | Role | Approx Tokens | Cost |
|-------|------|--------------|------|
| Opus | Main orchestrator, architecture, review | ~500K | ~$13 |
| Sonnet | Parallel subagents — plugin builds, tests, refactors | ~1.2M | ~$23 |
| Haiku | Scouts — file existence checks, quick grep tasks | ~800K | ~$0.32 |
| **Total** | | **~2.5M** | **~$36** |

Fifty-plus subagent dispatches. Four Haiku scouts doing mechanical exploration before committing Sonnet to a task.

## What the $36 Built

The output was real:

- 12 plugins extracted and manifested (blog, SEO, booking, analytics, commerce, notifications, auth, onboarding, search, sitemap, media, theme-editor)
- RBAC kernel: `roles.ts`, 45 lines, full hierarchy
- Onboarding flow: 3-step wizard, D1-backed, role assignment on completion
- Notification system: event bus, KV-backed queue, webhook delivery
- 44 tests across plugin interfaces and kernel contracts
- 3 SEO fixes on the existing site (meta tags, canonical, structured data)
- 3 dashboard prototypes

Two of the three dashboards were thrown away.

## What Went Right

**Parallel subagents for independent work.** Extracting the SEO plugin and the booking plugin have no shared state. Dispatching both simultaneously and merging results saved real time. This is where AI parallelism genuinely outperforms sequential human work.

**Graph queries before file exploration.** We have a code knowledge graph (code-review-graph MCP). Before any subagent touched a file, it ran `semantic_search_nodes` to find what already existed. This cut unnecessary reads significantly.

**Haiku for mechanical tasks.** File-existence checks, counting lines, finding import patterns — these are token-cheap with Haiku and don't need reasoning. Routing them to Haiku instead of Sonnet saved real money and kept Sonnet focused on execution.

## What Went Wrong

**Built before searching.** Two dashboards were built from scratch before anyone checked whether a dashboard component already existed. It did — in the Shadcn registry, partially. The third dashboard reused it and took 20% of the time the first two took. Cost: roughly $4 in wasted Sonnet tokens and 40 minutes of clock time.

**Over-architected before validating.** An auth-Astro integration was half-built (around 200 lines) before we hit a wall with Astro's integration API and the Cloudflare Workers sandbox. The approach required Node.js APIs that Workers don't have. A 10-minute spike with a Haiku scout would have caught this before Sonnet invested in it.

**Three versions of the same thing.** The notification queue was rebuilt twice because the first implementation assumed D1 and the second assumed KV, and neither checked what the other had done. Subagents don't share working memory. They share files — if the files aren't updated between dispatches, the next agent starts from a stale picture.

## The Honest Comparison

A senior developer at $150/hour, two to three weeks of focused work, runs $12,000–$18,000. Would they have produced the same output?

Probably more, in some areas. Definitely less, in others.

They would not have built three dashboards. They would have searched first, found the Shadcn component, and built one. They would have caught the Workers/Node.js incompatibility in the first day of research. They would have noticed the notification queue was being rebuilt before writing line one.

Human engineers optimize for discovery before construction. AI agents optimize for completion. When a subagent gets a task — "build a notification queue" — it builds. It doesn't ask "does one exist?" unless explicitly instructed to check first.

| Metric | Senior Dev ($150/hr, 2 weeks) | AI Session ($36) |
|--------|-------------------------------|-----------------|
| Parallel work streams | 1 | 8–12 |
| Discovery before build | Instinctive | Requires explicit instruction |
| Wasted effort (rework) | Low | Moderate without graph checks |
| Time to first working prototype | Days | Hours |
| Total cost | $12K–18K | $36 |
| Code requiring human review | Some | Everything |

## What the Cost Structure Reveals

The $36 is not the point. The ratio is.

At $36 for a 12-hour session producing 12 plugins and 44 tests, the bottleneck is not cost — it's review. Every line of AI-generated code needs a human to read it. The economics of AI-assisted development shift the constraint from production to verification.

The wasted $4 on duplicate dashboards isn't a failure of the model. It's a workflow failure: no explicit "search before build" step in the subagent prompt. That's fixable with one line in the system prompt. The architectural mistake with auth-Astro is also fixable: add a spike task before any implementation task involving unfamiliar APIs.

The session taught us that AI parallelism is real and valuable, but it requires the same architectural discipline a human team requires — you just have to make the discipline explicit in the instructions, because agents don't carry it implicitly.

Thirty-six dollars for the lesson is a reasonable price.
