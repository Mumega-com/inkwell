---
title: "Transparent Diagnostics"
description: "Translating complex routing physics into human-readable health narratives."
parent: "index"
order: 7
tags: ["features", "diagnostics", "health", "routing"]
---

The **Transparent Diagnostics Engine (DIAG-UI)** solves the "Black Box" problem of autonomous systems. It translates the mathematical state of your business squads into clear, actionable narratives.

## The dG/dt Translation

Inkwell squads are routed based on a physics equation:
`dG/dt = |F|^γ - αG` (The change in Conductance over time).

While the math is complex, the Diagnostics Engine translates specific thresholds into deterministic templates:

::comparison{title="Narrative Mapping"}
| Threshold | Status | Narrative Template |
|---|---|---|
| `G_trend < -0.1` | **Paused** | "Squad encountered errors while trying to {action}." |
| `G_trend > 0.05` | **Optimal** | "Squad is highly efficient today. {n} tasks completed." |
| `FMAAP Blocked` | **Blocked** | "Action blocked: Metabolism limit reached ({budget})." |
::

## The Diagnostics UI

Located at `/dashboard/health`, the UI provides three distinct health badges for every squad:

- **[ GREEN ] Optimal:** Squad is executing and gaining conductance.
- **[ YELLOW ] Throttled:** Squad is approaching metabolic limits or experiencing minor bottlenecks.
- **[ RED ] Halted:** Squad has stopped due to a critical error or a safety gate violation.

## Anomaly Detection

The engine constantly monitors for three types of anomalies:
1.  **Metabolism Anomaly:** Spending budget faster than the allocated daily rate.
2.  **Flow Anomaly:** A massive queue of tasks with zero completion rate.
3.  **Coherence Anomaly:** Repeated failures in a single workflow.

---

[[concepts/glass-dashboard|Back to The Glass Dashboard]] or [[features/glass-commerce|Explore the Commerce Engine]].
