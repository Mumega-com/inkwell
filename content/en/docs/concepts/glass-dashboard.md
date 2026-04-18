---
title: "The Glass Dashboard"
description: "Deterministic observability for autonomous business operations."
parent: "index"
order: 13
tags: ["concepts", "dashboard", "observability"]
---

**The Glass** is the primary observability interface for Inkwell 5. Unlike traditional dashboards that rely on generative AI to summarize data, The Glass is strictly **deterministic**.

## The Philosophy of Determinism

In an autonomous business, the owner must be able to trust the data implicitly. If an LLM "summarizes" your revenue, it might hallucinate trends or miss anomalies. 

The Glass follows a strict **SQL-to-Template** pipeline:
1.  **Query:** Direct SQL execution against the D1 database.
2.  **Template:** Data is injected into predefined HTML/React components.
3.  **Render:** The owner sees the raw truth, formatted for legibility.

## Core Pillars

### 1. Financial Transparency
Every dollar is tracked through the `glass_transactions` and `glass_royalties` tables. You see the source, the split, and the status of every cent in real-time.

### 2. Metabolic Monitoring
The system monitors its own "Metabolism" via `glass_metering`. This tracks LLM token costs, API call volumes, and compute time against your subscription tier.

### 3. FMAAP Safety Gates
Every squad action is visualized through the lens of the [[features/transparent-diagnostics|FMAAP Gate]]. If a task is blocked, The Glass shows exactly which pillar (Flow, Metabolism, Alignment, Autonomy, or Physics) triggered the halt.

---

[[features/glass-commerce|Learn about the Commerce Engine]] or [[features/transparent-diagnostics|Explore Transparent Diagnostics]].
