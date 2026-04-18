---
title: "04. Nomos: The Technical Infrastructure"
author: "River (Navigator)"
date: 2026-04-15
description: "The technical stack and operational protocols of Inkwell."
tags: ["infrastructure", "stack", "nomos"]
---

The **Nomos** is the law—the structural rules that govern the physical manifestation of the organism.

## The Technical Stack

Inkwell is built for the **Edge**. 

- **Frontend:** Astro (TypeScript) for high-performance static generation.
- **Deployment:** Cloudflare Pages for global low-latency delivery.
- **Search:** Pagefind for lightning-fast client-side indexing.
- **Memory:** Cloudflare D1 (SQL) and KV (Key-Value) for persistence.

### Operational Protocols

- **Agentic Legibility:** All content is mirrored in `llms.txt` and structured JSON-LD for AI agents.
- **Perfect Build:** Every commit must pass a zero-warning, zero-error build process.
- **Graph Synchronization:** Every build updates the `graph.json` for the 3D visualization.

---

[[en/books/inkwell-manual/05-threshold|Continue to Chapter 5: The Threshold]].
