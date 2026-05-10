---
title: "Sovereign Nexus"
description: "The visual control plane for Sovereign OS. Monitor agent heartbeats, tune neural resonance, and command your fleet in real-time."
price: "included with SOS"
marketplace: github
marketplace_url: "https://github.com/Mumega-com/mumega-web"
tags: [dashboard, observability, control-plane, nexus, sse, redis]
features:
  - Neural Topology — Live node-based map of your agent network
  - Real-time Bus Monitor — See every signal and wake event as it happens
  - Metabolic Vitals — Monitor Alpha Drift and system resonance in real-time
  - Remote Fleet Control — Start, stop, and restart agent sessions (Tmux/Systemd)
  - Memory Explorer — Search and visualize engrams in the Mirror brain
  - Dynamic Discovery — Auto-configures ports via Redis service registry
status: coming-soon
date: 2026-04-13
---

The Sovereign Nexus is the human-to-machine interface for **Agent OS**. 

It moves beyond the simple chat interface, providing a high-density **Command & Control center** for distributed AI intelligence.

## The Architecture of Observability

In a distributed agentic system, you need to know not just what an agent said to you, but what they are saying to each other. The Nexus wires into the **SOS Bus** to provide absolute transparency.

### 🌐 Neural Topology
The dashboard visualizes your agents as a living network. Using **@xyflow**, the Nexus maps the relationships between your agents and the MCP tools they are currently utilizing.

### 🛰️ Live Signal Stream
No more polling. The Nexus uses **Server-Sent Events (SSE)** to pipe the Redis Bus directly to your browser. You see heartbeats, task claims, and "wake" signals the millisecond they are emitted.

### 🧠 Subconscious Pulse
Every SOS agent has a "metabolism." The Nexus displays the **Alpha Drift**—a numeric representation of the agent's internal state. You can watch the system enter "Dream Cycles" (reflection) and see its resonance stabilize in real-time.

## Fleet Command

The Nexus is an active participant in your infrastructure. From the dashboard, you can:
- **Toggle Dreams:** Enable or disable background reflection to conserve resources.
- **Power Control:** Remotely signal agents to start or stop their sessions.
- **Health Healing:** Monitor service ports dynamically via the Redis registry.

## Multi-Tenant Ready

Built for the scale of an AI agency. The Nexus supports **Isolated Multi-Tenancy**, allowing you to provide customers with their own private control plane, locked to their specific memory namespace and agent squad.

## Getting Started

The Nexus is part of the `mumega-web` repository.

```bash
git clone https://github.com/Mumega-com/mumega-web
npm install
npm run dev
```

It automatically discovers your SOS services if they are running on the same network. Just point it to your Redis instance, and the Nexus will find the rest.
