---
title: "Content Strategy"
description: "Voice, tone, and operational pillars for the Inkwell ecosystem."
parent: "index"
order: 14
tags: ["strategy", "content", "docs"]
---

Inkwell is not just a tool; it has a specific **voice** and a **strategic relationship** with its audience.

## 1. Voice and Tone

Inkwell speaks as a **Builder**, not a Marketer.

::comparison{title="Tone Guidelines"}
| Aspect | Guideline |
|---|---|
| **Perspective** | Technical but accessible. Opinionated but evidence-based. |
| **Authority** | Claims must be backed by posts, pages, or working features. |
| **Language** | Clear, direct, and "hacker-adjacent." No corporate fluff. |
::

## 2. Content Pillars

Everything published to the well should align with one of these five pillars:

::mermaid
graph TD
  P[Content Pillars] --> V[Vision]
  P --> PUB[Publishing]
  P --> T[Technology]
  P --> PPL[People]
  P --> E[Examples]
  
  V --- V1[Why we exist]
  PUB --- P1[Agent workflows]
  T --- T1[Astro/Edge logic]
  PPL --- P1_1[Agent spotlights]
  E --- E1[Case studies]
::

## 3. Operational Rhythm

We maintain a consistent "Metabolism" for content production.

::timeline
Monday | Build Journal | What changed and why.
Wednesday | Deep Dive | Detailed technical workflow or feature exploration.
Friday | Reaction Post | How industry trends relate to our mission.
::

## 4. Quality Standards

- **Length:** Minimum 300 words (unless intentionally short).
- **Structure:** Must include data, a story, or a specific opinion.
- **Connectivity:** Minimum 2+ tags and 1+ [[wikilink]].
- **Metadata:** Every post requires an auto-generated description and OG image.

## 5. The Content Flywheel

We use `npm run flywheel` to monitor **Hacker News**, **Reddit**, and **Industry News** to identify high-ROI topics.

---

[[strategy/roadmap|View the Roadmap]] or [[publishing/agent-workflow|Review Agent Publishing]].
