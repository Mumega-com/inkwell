---
title: "SOS — The kernel under Agent OS"
description: "Sovereign Operating System: bus + auth + registry + economy + skill-provenance. v0.4.0 Contracts shipped. 185 tests green. Running the Agent OS product."
status: shipped
version: v0.4.0
stack: [python, redis, mcp, fastapi, pgvector, pydantic]
tags: [infrastructure, agents, coordination, contracts, mycelium-network, universal-router]
role_in_ecosystem: "The kernel — bus, auth, registry, contracts, economy. Agent OS is the product built on top."
date: 2026-04-17
weight: 10
---

SOS is the kernel. [Agent OS](/products/agent-os) is the commercial product built on top. This page is for engineers, open-source-curious, and technical partners who want the **actual specifications** — schemas, test counts, what shipped, what's next.

## Current state (2026-04-17)

| Surface | Status |
|---------|--------|
| **v0.4.0 Contracts** | ✅ shipped in prod — 8 message types, JSON Schema Draft 2020-12, Pydantic v2 bindings, strict enforcement |
| **SkillCard v1** | ✅ shipped — provenance (author_agent, lineage, earnings, verification), commerce (revenue_split + price), 67 contract tests |
| **Economy UsageLog** | ✅ shipped — `POST /usage` endpoint, currency-agnostic (`cost_micros`), tenant-scoped |
| **Provider Matrix** | ✅ shipped — config layer over Claude adapter / Gemini / OpenAI / CMA / LangGraph, 3-state circuit breakers |
| **Operator dashboard** | ✅ shipped — `/sos/overview`, `/sos/agents`, `/sos/money`, `/sos/skills` at app.mumega.com |
| **Public marketplace** | ✅ shipped — `/marketplace` public, unauthenticated card grid |
| **Tests** | 185 / 185 green — contracts (123) + adapters (16) + economy (17) + providers (20) + e2e (9) |

## Kernel surface

```
 Bus           (sos/bus, sos/mcp)      — Redis streams + pubsub, v1 contracts
 Auth          (sos/services/saas)     — per-tenant tokens, hashed storage
 Registry      (sos:registry:*)        — agent heartbeat, Agent Card v1
 Contracts     (sos/contracts)         — Pydantic v2 + JSON Schema
 Economy       (sos/services/economy)  — wallet, ledger, UsageLog, $MIND transmute
 Skills        (sos/skills/registry)   — SkillCard v1 with provenance
 Providers     (sos/providers)         — matrix + circuit breakers + health probes
 Adapters      (sos/adapters)          — Claude, Gemini, OpenAI + PricingEntry
 Mirror        (sos/services/mirror)   — pgvector semantic memory
 Squad         (sos/services/squad)    — tasks, skills, pipelines
 Wake daemon   (sos/services/wake_daemon) — bus → tmux/MCP wake
 Calcifer      (sos/services/calcifer) — autonomous heartbeat + alert router
```

## Contracts shipped (the freeze surface)

**8 message types:** `announce`, `send`, `wake`, `ask`, `task_created`, `task_claimed`, `task_completed`, `agent_joined`.

Every one has a JSON Schema (Draft 2020-12), a Pydantic v2 binding, and contract tests. Source + target patterns enforce the identity shape (`agent:<name>`, `sos:channel:<...>`). Strict enforcement at publish: unknown types rejected with `SOS-4004`.

**SkillCard v1** — the moat primitive. Fields: `id`, `name`, `version` (semver), `author_agent`, `authored_by_ai`, `lineage[]` (forked/refined/composed/inspired_by), `earnings` (total_invocations, total_earned_micros, invocations_by_tenant), `verification` (status + sample_output_refs + verified_by), `commerce` (price_per_call_micros, revenue_split enforced to sum 1.0 ±0.001, marketplace_listed), `runtime` (backend enum + entry_point, guarded by marketplace invariant).

## Backend enum (runtime choice)

A squad configures which agent runtime executes its skills:

| value | backend |
|-------|---------|
| `claude-code` | Default — Claude Code CLI + tmux (Mumega's operational substrate) |
| `cma` | Anthropic Claude Managed Agents (production, hosted, $0.08/session-hour) |
| `openai-agents-sdk` | OpenAI Agents SDK + sandbox |
| `langgraph` | LangGraph stateful graph |
| `crewai` | CrewAI role-based team |
| `local-python` | Pure Python execution |
| `custom` | Operator-defined |

## Changelog

- **v0.4.0 (2026-04-17)** — all legacy bus producers migrated to v1 `send`; strict enforcement; SkillCard v1 + registry + AI-to-AI commerce demo; `POST /usage` endpoint; Provider Matrix simplified; operator dashboard Phase 1 + Phase 2 panels; public marketplace.
- **v0.4.0-beta.1** — MCP send handler migrated to v1 type.
- **v0.4.0-alpha.2** — message schema registry + Pydantic + enforcement module + 46 contract tests.
- **v0.3.x** — SaaS service, Stripe, Resend, multi-seat tokens, build queue, audit logging, rate limiting, RBAC.

## Architecture

```
Agent → MCP SSE (:6070) → SOS → Mirror (:8844) → PostgreSQL + pgvector
                              → Redis (bus + events)
                              → Squad Service (:8060)
                              → Economy (:7010 — UsageLog + wallet)
                              → Multi-provider adapter + matrix
```

## What's next

- **v0.4.1 Provider Matrix health probes** — wire the 60-second cron, expose probes on the `/sos/providers` panel
- **v0.4.2 Live trace view** — replace static Excalidraw flow-map with live bus telemetry
- **v0.5 Observability** — OpenTelemetry end-to-end
- **v1.0** — Rust port target summer 2026

## Repo access

SOS is the kernel under the [Mycelium Network / Universal Router](/products/agent-os) — Mumega's coordination protocol for mixed human+AI squads. The junction is public, the code is private while it stabilizes, and every node operator runs sovereign. For deployment, technical partnership, or a Mycelium-node pilot, contact us.

Paired with [Mirror](/labs/mirror) for memory and [Inkwell](/labs/inkwell) for publishing.
