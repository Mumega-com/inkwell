---
title: "Adaptive Pages"
description: "Edge-level A/B testing and autonomous site optimization."
parent: "index"
order: 8
tags: ["features", "optimization", "ab-testing", "edge"]
---

**Adaptive Pages** transform Inkwell into a self-optimizing organism. By utilizing Cloudflare KV at the edge, the system can test different layouts and content variants without sacrificing performance.

## Zero-Latency A/B Testing

Traditional A/B testing tools often cause "flicker" or slow down page loads. Inkwell resolves variants at the **Cloudflare Edge**:
1.  **KV Storage:** Variants (HTML fragments or config overrides) are stored in KV.
2.  **Edge Resolution:** The Worker randomly assigns a variant and sets a session cookie.
3.  **Deterministic Measurement:** Results are logged to D1 and analyzed via statistical math.

## Chi-Squared Significance

We don't "guess" which variant is better. Inkwell uses a deterministic **Chi-Squared test** to declare a winner.
- **Confidence Threshold:** Must reach > 95% significance (p < 0.05).
- **Sample Size:** Minimum conversion count required before a winner is flagged.

## The Approval Gate

Optimization is autonomous, but deployment is **human-in-the-loop**.
1.  **Proposal:** When a winner is found, the system sends a Telegram message via the SOS bus.
2.  **Approval:** The business owner approves the change via a simple `/approve` command.
3.  **Deployment:** The system automatically commits the new default and rebuilds the static site.

## Mirror Learning

Inkwell instances share their "lessons" anonymously via the **Mirror** global memory. If a specific CTA style converts better in your industry, other Inkwell users can benefit from that starting point, creating a rising tide of optimization across the network.

---

[[concepts/glass-dashboard|Back to The Glass Dashboard]] or [[docs/config/api-reference|Review the API Reference]].
