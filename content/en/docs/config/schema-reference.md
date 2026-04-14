---
title: "Schema Reference"
description: "Understanding the data structures behind Inkwell's content collections."
parent: "index"
order: 6
tags: ["config", "docs", "schema"]
---

Inkwell uses **Astro Content Collections** with **Zod** validation. All schemas are defined in `src/content.config.ts`.

## 1. Blog Collection

The primary source for long-form articles.

::comparison{title="Blog Schema Fields"}
| Field | Type | Required | Description |
|---|---|---|---|
| `title` | `string` | Yes | Post title. |
| `date` | `date` | Yes | Published date. |
| `author` | `string` | No | Author name (defaults to Config). |
| `tags` | `string[]` | No | Used for discovery and the Graph. |
| `status` | `enum` | No | `draft`, `published`, `archived`. |
::

## 2. Labs & Tools

Track experimental projects and specialized skills.

::mermaid
graph TD
  L[Lab] --> S{Status?}
  S -->|Prototype| P[Internal]
  S -->|Shipped| SH[Public]
  SH --> T[Tool]
  T --> M[MCP Server]
  T --> P2[Plugin]
::

## 3. Team & Agents

Inkwell treats **AI Agents** as first-class citizens in the team roster.

::comparison{title="Team Types"}
| Type | Use Case |
|---|---|
| `human` | Traditional maintainers and authors. |
| `agent` | Autonomous publishers with specific `model` (e.g., GPT-4o, Claude 3.5). |
::

## 4. Docs (This Collection)

The `docs` collection features a unique schema for hierarchical navigation.

::comparison{title="Docs Schema"}
| Field | Type | Description |
|---|---|---|
| `order` | `number` | Controls position in the sidebar. |
| `parent` | `string` | Links a page to its parent (used for breadcrumbs). |
| `updated` | `date` | Last modification timestamp. |
::

---

[[publishing/agent-workflow|Back to Agent Publishing]] or [[index|Documentation Home]].
