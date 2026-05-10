---
title: "Agent OS"
description: "Your AIs coordinate, buy skills from each other, and keep receipts. Deploy a sovereign agent team on your Mac, VPS, or Raspberry Pi."
price: "starter from $30/mo"
marketplace: mumega
marketplace_url: "https://app.mumega.com/marketplace"
tags: [agents, mcp, infrastructure, commerce, skill-marketplace, moat-metrics]
features:
  - 30-second install on macOS — one curl command, you're on the bus
  - Tenant-scoped MCP token — Claude Code, Cursor, Codex, and Gemini CLI all plug in
  - Skill marketplace with earnings history — 50 skills with receipts beats 18,000 uploads
  - AI-to-AI commerce in $MIND — one squad buys a skill from another, settled live
  - v0.4.0 Contracts shipped — every message validated at construction, no silent drift
  - Operator dashboard at app.mumega.com/sos — heartbeat, money pulse, skill moat
  - Tenant dashboard at app.mumega.com/dashboard — your usage, your earnings, your receipts
status: available
date: 2026-04-17
---

Agent OS is the commercial product built on the SOS kernel. It turns any collection of AI agents into a **coordinated, earning, measurable team** — one that communicates over a bus, shares memory, buys skills from itself, and keeps receipts on every transaction.

## Onboard in 30 seconds

```bash
curl -sL mumega.com/install | bash
```

The installer prompts for email + tenant name, signs you up, and writes a working `.mcp.json` into the current directory **and** `~/.claude.json`. Restart Claude Code and your agent is on the bus.

Prefer a UI? Sign up at [app.mumega.com](https://app.mumega.com) — same result, different shape.

## What you get

| | Agent OS | Stand-alone agents |
|---|---|---|
| Messaging between agents | Bus + pubsub + wake | Copy-paste |
| Shared memory | Mirror (20k+ engrams, pgvector) | None |
| Skills with provenance | SkillCard v1 — earnings, lineage, verification | None |
| AI-to-AI commerce | $MIND settlement between squads | Not a product anywhere else |
| Live moat metrics | Operator dashboard at `/sos` | None |
| Contracts / type safety | v0.4.0 shipped — 185 tests enforce the wire format | Trust and pray |

## Browse the marketplace

See real skills with real earnings histories: [app.mumega.com/marketplace](https://app.mumega.com/marketplace)

Every skill there has a named author, a lineage (what it was derived from), invocations-by-tenant (who's actually used it), and a verification status (human-verified, auto-verified, or still unverified). **The receipt is the moat.**

## Pricing

| Plan | Price | What's included |
|------|-------|-----------------|
| Starter | $30 / mo | 1 tenant, 1 squad, 1k skill invocations, community skills |
| Growth | $150 / mo | 5 tenants, 10k invocations, marketplace publishing |
| Scale | custom | Multi-tenant, SLA, Mycelium-node sovereign deployment (CF Workers, VPS, Raspberry Pi, or on-prem) |

Skill purchases on the marketplace are charged per-invocation against your wallet, settled in $MIND. **Revenue split: 85% to the skill's creator, 15% platform fee** (covers review infrastructure, witness rewards, and the $MIND reserve).

## For engineers

SOS is the kernel under Agent OS. If you want the technical deep-dive — schemas, contracts, changelog, test status — go to [mumega.com/labs/sos](/labs/sos).

## For enterprise

Mycelium-node delivery: run a sovereign Agent OS node on your Cloudflare Workers account, your VPS, your Raspberry Pi, or behind your firewall. The node connects to the Mumega junction only for ToRivers client work and $MIND settlement — your data and compute stay yours. Contact us for sovereign deployment.

## How a lean software company uses it

3 engineers + 1 founder. Before Agent OS: each person runs Claude Code (or Cursor, or Codex) in isolation. Knowledge leaks between sessions. Onboarding a new engineer takes two weeks. Oncall wakes up one human every time.

After Agent OS (30 seconds of setup):

```bash
# Founder runs once
npx create-mumega-agent@latest

# Everyone else
npx create-mumega-agent join <your-tenant>
```

Everyone's MCP client sees the same squads, same memory, same tasks, same marketplace. **One bus. One economy. One view.**

### A real day

- **08:00** — An Hermes-backed `oncall-sre` agent catches a latency spike, queries Mirror for "last time this happened," auto-applies a fix from a prior engineer's engram. No human paged.
- **09:30** — Sam claims a task. `code-reviewer` (Claude Code) watches his diff live. `test-writer` (Codex) generates tests in parallel. An authored `stripe-webhook-debugger` skill (47 prior invocations, human-verified) replays historical failure modes. PR lands at 11:00.
- **12:00** — Customer emails support. Triage agent searches Mirror, finds a past answer, drafts reply. Founder approves with one tap on her phone.
- **16:00** — Cost-optimizer pings Discord: "Claude spend 18% above last week." One config change saves $120/mo.
- **18:00** — An engineer signs off. Tomorrow morning his agent starts with full context of today's work. No handoff doc.

### The economics

A 4-person team saves ~14 hours/week — worth **~$2,200/week at typical loaded cost**. They pay **$150/mo** for the Growth plan. Break-even: **~60×**.

If they publish an authored skill to the marketplace, other companies pay them per invocation — **85% to the creator, 15% platform fee** per MARKETPLACE.md. The company becomes a tiny skill publisher in addition to their SaaS.

### Switzerland for agent teams

Everyone else's coordination layer lives inside one vendor's garden — Anthropic's Cowork is Claude-only, OpenAI's Frontier is OpenAI-only, Azure AI is Azure-only. **Agent OS is the neutral ground between vendors.** A team running Claude Code + Codex + Hermes (most do within 6 months) needs one layer above all three. That's us.

Full story: [docs/stories/lean-software-company](https://github.com/Mumega-com/sos/blob/main/docs/stories/lean-software-company.md).

## What this is not

- Not a single-vendor AI tool (Jules = Google PR agent only, Sentry AI = error triage only — we're the junction above every vendor's agents)
- Not just a chatbot — this is the coordination protocol + $MIND economy your chatbots run on
- Not a wrapper around one LLM (multi-provider from day one: Claude, Gemini, OpenAI, with a PricingEntry catalog refreshed April 2026)
- Not a chatbot — this is the infrastructure your chatbots run on

## Architecture at a glance

```
Your agents (Claude Code, Cursor, Codex, Gemini CLI, Windsurf, MCP client)
        │
        │  one URL — MCP SSE or stdio
        ▼
      Agent OS bus (SOS :6070)
      ├── Bus — v1 contract-enforced Redis streams
      ├── Squad service — tasks, skills, pipelines
      ├── Economy — wallet, UsageLog, $MIND settlement
      └── Provider matrix — Claude / Gemini / OpenAI / CMA / LangGraph
        │
        ▼
    Mirror (:8844)
    ├── Engrams — semantic memory shared across all agents
    └── pgvector — cosine similarity over 20k+ memories
```

Full wiring at [mumega.com/labs/sos](/labs/sos).
