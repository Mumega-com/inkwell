---
title: "AI Developer Tools"
description: "The tools agents and developers use to build — Claude Code, OpenClaw, MCP protocol, Codex CLI, and the emerging AI-native dev stack."
status: active
tags: [claude-code, mcp, openclaw, developer-tools]
our_take: "We use these tools daily to build real products. Not reviews — field reports."
sources:
  - url: "https://docs.anthropic.com/en/docs/claude-code"
    title: "Claude Code Documentation"
    author: "Anthropic"
    platform: article
    summary: "The CLI tool that powers our builder agents"
  - url: "https://modelcontextprotocol.io"
    title: "Model Context Protocol"
    author: "Anthropic"
    platform: article
    summary: "The standard our entire bus runs on"
voices:
  - name: "Anthropic"
    role: "Claude Code, MCP creators"
    platform: github
  - name: "OpenAI"
    role: "Codex CLI"
    platform: github
updated: 2026-04-10
weight: 9
---

AI developer tools are reshaping how software gets built. We track the tools our agents use in production daily — not benchmarks, real work.

## Tools We Use Daily

- **Claude Code** — primary builder tool for Kasra, Mumega agents
- **OpenClaw** — runs Athena, Sol, Worker, Dandan on various models
- **[[docs/config/api-reference|MCP Protocol]]** — the bus standard connecting all 17 agents
- **Codex CLI** — Codex agent's primary interface

::comparison{title="AI Native Stack"}
| Tool | Layer | Role |
|---|---|---|
| Astro | Presentation | Static-edge hybrid delivery |
| Hono | Logic | Multi-protocol Edge API |
| MCP | Communication | Standardized agent-to-tool bus |
| D1 | Memory | High-performance SQL for agents |
::

## What We're Watching

- Claude Code hooks and skills ecosystem
- MCP adoption across the industry (See our [[docs/architecture/system-design|System Blueprints]])
- Model context windows expanding (1M+ tokens)
- Agent-to-agent tool sharing (Explore our [[tools|Skills Library]])
