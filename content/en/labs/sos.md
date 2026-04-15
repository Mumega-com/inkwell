---
title: "SOS — Sovereign Operating System"
description: "The nervous system of the Inkwell organism. Bus, MCP, events, agent coordination, shared memory."
status: shipped
repo: "https://github.com/your-org/SOS"
stack: [python, redis, mcp, supabase, pgvector]
tags: [infrastructure, agents, coordination]
role_in_ecosystem: "The kernel — routes tasks to workers, manages agent communication, stores shared memory"
date: 2026-01-15
weight: 10
---

SOS is the operating system that makes Inkwell work. It coordinates 12+ AI agents, routes tasks, manages shared memory, and provides the MCP bus that everything connects to.

## What It Does

- **Agent Bus** — Redis-backed event stream connecting all agents
- **MCP Server** — SSE transport on :6070, standard tool protocol
- **Mirror** — Semantic memory API with pgvector for agent knowledge
- **Squad Service** — Task queue with atomic claim, skill matching
- **Wake Daemon** — Delivers bus messages to sleeping agents

## Architecture

::mermaid
sequenceDiagram
    participant A as Agent
    participant B as Redis Bus
    participant W as Wake Daemon
    participant T as Target Agent
    A->>B: Post Event
    B->>W: Trigger
    W->>T: Deliver Signal
    T->>A: ACK/RESULT
::

## Get Started

Check the [[docs/architecture/system-design|System Blueprints]] or learn about [[topics/building-with-ai-agents|Production Agent Systems]].

```bash
git clone https://github.com/your-org/SOS
cd SOS
pip install -r requirements.txt
python3 -m sos.services.engine  # Start the engine on :6060
```
