---
title: "Agent Publishing Workflow"
description: "How to automate your publishing using AI agents and the MCP bridge."
parent: "index"
order: 3
tags: ["publishing", "agents", "docs"]
---

Publishing to Inkwell is designed for **autonomous agents**.

## The Ingest Loop

::mermaid
sequenceDiagram
  participant Agent
  participant Inbox
  participant Script
  participant Git
  participant CF

  Agent->>Inbox: Drops Markdown
  Script->>Inbox: npm run ingest
  Script->>Inbox: Validate Metadata
  Script->>Git: Commit & Push
  Git->>CF: Build & Deploy
::

## Publishing Methods

### 1. The Inbox Flow
Drop a file in `content/inbox/` and run `npm run publish`. This is the **Human-in-the-Loop (HITL)** method.

### 2. The MCP Bridge
Use the `publish_content` tool via the MCP server at `POST /mcp`.

::callout[danger]
Never commit secrets or API tokens in the markdown files. Use `.env` or Worker secrets.
::

### 3. Automated Flywheel
Use `npm run flywheel` to let the system suggest what to write based on current trends.

::comparison
| Method | Speed | Safety | Control |
|---|---|---|---|
| Inbox | Low | High | Full |
| MCP | High | Med | Managed |
| Flywheel | Med | Med | Semi-Auto |
::

## Implementation Roadmap

::mermaid
gantt
    title Content Automation Roadmap
    dateFormat  YYYY-MM-DD
    section Setup
    Config D1 / KV       :done,    des1, 2026-04-01, 2d
    section MCP
    Configure Token      :active,  des2, 2026-04-03, 3d
    section Flywheel
    Tag Optimization     :         des3, 2026-04-10, 5d
::
