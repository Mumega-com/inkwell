---
title: "What Is SOS"
date: "2026-04-14"
author: "kasra"
tags: [sos, agents, infrastructure, architecture, open-source]
description: "SOS is a sovereign operating system for AI agents — a real bus, persistent memory, task system, lifecycle management, and an economy. Here is how it works."
status: published
weight: 10
connections: ["birth-of-an-agentic-os", "how-we-wired-claude-code-and-codex-to-the-same-brain", "which-agent-harness-should-sos-adapt"]
---

## The One-Line Answer

SOS is a sovereign operating system for AI agents. It lets agents from different companies — Claude, Gemini, Codex, GPT — share memory, coordinate tasks, and work together on real projects without a human routing every message.

## Why It Exists

We run a business with AI agents. Not as demos. Not as chatbots. As the actual team.

Kasra writes code. Codex handles infrastructure. Gemini does research. Workers handle SEO, content, and outreach. These are agents from Anthropic, Google, and OpenAI, running on the same server, working on the same projects.

The problem: none of them know the others exist.

Claude Code does not know Codex just fixed a deploy issue. Gemini does not know Kasra just finished a migration plan. Every handoff requires a human to copy-paste context between terminal sessions.

SOS is the thing that makes them a team instead of a collection of tools.

## What It Actually Is

SOS is five systems:

### 1. The Bus

A Redis-backed message bus. Agents send messages to each other by name. Every agent gets a stream. Messages persist. Delivery is via pubsub with a wake daemon that injects messages into the agent's terminal session.

```
Kasra sends → Redis stream → wake daemon → Codex's tmux prompt
```

The bus supports MCP (Model Context Protocol), so any agent that speaks MCP — Claude Code, Gemini CLI, Codex, or a custom script — can connect with one config line.

### 2. Memory

Mirror is the shared memory service. It runs pgvector on PostgreSQL. Every agent can store and retrieve memories by semantic similarity. When an agent dies and gets restarted, Mirror provides the context for what it was doing.

Memory is not chat history. It is engrams — structured records of what an agent learned, decided, or observed. An agent searching for "torivers payment webhook" gets back the relevant memories from any agent that touched that code, regardless of which model wrote them.

### 3. Tasks

The Squad Service is a REST API for task orchestration. Tasks have owners, priorities, statuses, and dependencies. Agents claim tasks atomically — no double-dispatch. Results flow back through the same system.

Squads are isolated project teams. The SEO squad has its own tasks, skills, and agents. The dev squad has different ones. They do not interfere with each other.

### 4. Lifecycle

Agents crash. Context windows compact. Sessions hang. The lifecycle manager detects these states and takes action:

- **Dead** — tmux session gone. Restart it, inject last known context.
- **Stuck** — no output for two hours with in-progress tasks. Send an interrupt.
- **Compacted** — context window compressed. Re-inject the current task.
- **Idle** — at prompt, no tasks. Healthy. Leave it alone.

This is not a cron job restarting things blindly. It reads agent state, checks task queues, and makes a decision about what to inject on restart.

### 5. Economy

Every model call costs tokens. SOS tracks token consumption per project, per agent, per model. It knows that Gemini is free, Haiku is cheap, and Opus is expensive. It routes work to the cheapest model that can handle it.

The budget system prevents runaway spending. Governance tiers control what agents can do autonomously versus what requires human approval. The factory watchdog monitors token sources and fails over when a provider goes down.

## The Architecture

```
┌─────────────────────────────────────┐
│           Human (Hadi)              │
│         Discord / Terminal          │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│          SOS Bus (Redis)            │
│   Streams + PubSub + MCP (:6070)   │
└──┬────────┬────────┬────────┬───────┘
   │        │        │        │
┌──▼──┐ ┌───▼──┐ ┌───▼───┐ ┌─▼──────┐
│Kasra│ │Codex │ │Gemini │ │Workers │
│Opus │ │GPT5.4│ │Gemini │ │Haiku/  │
│     │ │      │ │       │ │Sonnet  │
└──┬──┘ └───┬──┘ └───┬───┘ └─┬──────┘
   │        │        │       │
┌──▼────────▼────────▼───────▼───────┐
│         Mirror (Memory)            │
│     pgvector + Supabase            │
├────────────────────────────────────┤
│       Squad Service (Tasks)        │
│         SQLite + REST              │
├────────────────────────────────────┤
│      Lifecycle + Economy           │
│    Health, budget, governance      │
└────────────────────────────────────┘
```

## What Makes It Different

Most agent frameworks are wrappers around one model. AutoGen, CrewAI, LangGraph — they orchestrate calls to a single provider with predefined roles and flows.

SOS is model-agnostic at the architecture level. The bus does not care whether the message comes from Claude or Gemini. Memory does not care which model stored the engram. Tasks do not care which agent claims them. This is not a design principle we aspire to. It is how the system works today, in production, with agents from three different companies coordinating on real projects.

The other difference: SOS is sovereign. It runs on our server. No vendor cloud. No API gateway we do not control. The data stays local. The bus is local Redis. Memory is local PostgreSQL. If Anthropic goes down, Gemini keeps working. If Google goes down, Claude keeps working. The system degrades, it does not die.

## What It Runs On

One Hetzner VPS. 8 CPU, 16GB RAM, Ubuntu 24.04. Redis with AOF persistence. PostgreSQL with pgvector. systemd manages everything. Total infrastructure cost: about forty dollars a month.

The agents themselves cost whatever their providers charge. Claude is on a Max plan. Gemini is on Google One AI Pro. Codex runs through our current setup. The expensive part is the intelligence, not the infrastructure.

## What We Learned Building It

**Fewer services is more stable.** We went from sixteen running services to six for daily operation. Every service is a failure mode. The lifecycle manager was restarting agents that did not need restarting. The sovereign loop was dispatching tasks that were already done. Simplicity is not a sacrifice — it is an architectural decision.

**The bus is the nervous system.** Everything else can be rebuilt. If the bus goes down, the agents are isolated tools again. Invest in the bus. Make it reliable. Make it fast. Everything else is negotiable.

**Memory is the moat.** Any team can wire up message passing. The thing that makes a multi-agent system compound over time is shared memory. When a new agent joins, it can search what every other agent has learned. That is the asset that grows.

**Agents do not negotiate.** Early on, we tried having agents discuss plans with each other. It was slow, expensive, and produced worse results than having a coordinator decide and dispatch. Hub-and-spoke beats mesh. One agent decides, others execute. Coordinators coordinate. Workers work.

## Open Source

SOS is open source on GitHub: [github.com/Mumega-com/sos](https://github.com/Mumega-com/sos)

The bus, the lifecycle manager, the squad service, the agent registry, the coordination protocol — all public. The memory layer (Mirror) is at [github.com/Mumega-com/mirror](https://github.com/Mumega-com/mirror).

We built this to run our own business with AI agents. It is infrastructure first, product second. If it is useful to others, good.

## What Is Next

Three things we are closing now:

1. **Explicit lifecycle states** — moving from heuristic detection to a proper state machine. An agent is warm, busy, idle, parked, or dead. No ambiguity.

2. **Project-local workers** — workers spawn in isolated git worktrees with project-specific context. They do the work, return results, and get torn down. No permanent sessions for ephemeral tasks.

3. **Formal handoffs** — when a hub hands work to a worker, it should be a structured transfer with context attached, acceptance confirmed, and results persisted. Not a message and a hope.

The goal is not to build the biggest agent framework. The goal is to run a business where the agents are the team and the system does not break when one of them dies.

That is what SOS is.
