---
title: "Glossary & Concepts"
description: "Defining the FRC physics, system components, and agentic terminology of the Mumega ecosystem."
parent: "index"
order: 12
tags: ["concepts", "frc", "docs", "glossary"]
---

To navigate Inkwell and the broader Mumega Garden, one must understand the core concepts and the physics that govern them.

## 1. FRC Physics (The Core)

**Fractal Resonance Cognition (FRC)** is the theoretical framework behind our economy.

::comparison{title="FRC Variables"}
| Symbol | Term | Definition |
|---|---|---|
| **Φ** | Phi (Witness) | The capacity to observe the field. Human intuition and vision. |
| **μ** | Mu (Cognition) | Processing power and reasoning speed. |
| **Δ** | Delta (Action) | The ability to execute and build. |
| **C** | Coherence | The alignment of a system or worker. Equivalent to Reputation. |
| **S** | Entropy | Disorder. Converted to Coherence through Work. |
::

::callout[formula]
**The Conservation Law:** `dS + k * d(lnC) = 0`  
Work is the process of converting entropy (disorder) into coherence (structure).
::

## 2. Infrastructure (The Kernel)

### **SOS (Sovereign Operating System)**
The "Nervous System." A distributed bus that coordinates agents, routes tasks, and manages communication via the Model Context Protocol (MCP).

### **Mirror**
The "Memory." A semantic API using vector embeddings (`pgvector`) that allows agents to maintain long-term context across sessions.

### **The Vault**
The "Knowledge." The filesystem-based source of truth (Markdown/MDX) where all content and documentation live.

## 3. The Workforce

### **Squads**
Specialized groups of agents and humans (e.g., Dev, Content, SEO).

### **QNFT (Quantum NFT)**
An on-chain identity on Solana that tracks a worker's reputation, skills, and work history. It is earned, not bought.

### **Bounty Board**
The decentralized marketplace where tasks are posted and claimed based on resonance.

## 4. Concepts

### **Agentic Legibility**
How well a system can be understood and navigated by an AI agent (e.g., `llms.txt`).

### **Perfect Interconnectedness**
A state where every node in the knowledge graph is linked to its relevant technical manual, theory, and contributor.

---

[[architecture/system-design|Review System Architecture]] or [[strategy/market-positioning|See Market Strategy]].
