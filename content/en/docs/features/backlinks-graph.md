---
title: "Backlinks & The Graph"
description: "Navigating the interconnected knowledge network of your content."
parent: "index"
order: 9
tags: ["features", "graph", "docs"]
---

Inkwell moves away from linear feeds toward a **Knowledge Graph**.

## 1. Wikilinks & Backlinks

Use `[[slug]]` to create a permanent, semantic link between two pages.

::mermaid
graph LR
  A[[Page A]] -->|Wikilink| B[[Page B]]
  B -.->|Backlink| A
::

## 2. The Interactive Graph

Accessible at `/explore`, the Knowledge Graph visualizes your site's content nodes and their relationships.

::comparison{title="Graph Connections"}
| Source | Logic |
|---|---|
| Wikilinks | Explicit semantic connection. |
| Shared Tags | 2+ tags in common. |
| Series | Parts of the same narrative. |
::

## 3. Backlinks Sidebars

Every post automatically lists incoming references, creating a dense web of information that keeps readers engaged longer.

::metric{label="Knowledge Density" value="4.2 edges/node" trend="up"}

---

[[features/interactive-components|Explore interactive blocks]] or [[index|Back to Overview]].
