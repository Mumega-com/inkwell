---
title: "Glass Commerce Engine"
description: "Native digital commerce and revenue attribution for Inkwell."
parent: "index"
order: 6
tags: ["features", "commerce", "payments", "stripe"]
---

The **Glass Commerce Engine** is the financial heart of Inkwell 5. It transforms your CMS into a revenue-generating business by providing native Stripe Connect integration and a deterministic transaction ledger.

## The Shelf
"The Shelf" is the native marketplace capability of Inkwell. It allows you to sell:
- **Books & Manuals** (PDF or Web-based)
- **Courses & Premium Content**
- **Digital Assets & Reports**

All commerce logic lives in the Inkwell Worker, routing payments directly to your connected Stripe account.

## Deterministic Ledger (D1)

Inkwell maintains an immutable record of all financial activity in three core D1 tables:

- **`glass_transactions`**: The master list of all inbound and outbound funds.
- **`glass_royalties`**: Automatic revenue attribution (splits) between the platform, the owner, and potential squad budgets.
- **`glass_metering`**: Real-time tracking of operational costs (LLM tokens, API calls).

## Subscription Tiers

Inkwell 5 introduces a multi-tenant SaaS model with three distinct tiers:

::comparison{title="Pricing Tiers"}
| Tier | Price | Active Squads | Key Features |
|---|---|---|---|
| **Starter** | $29/mo | 1 | Core CMS, Basic Glass Dashboard |
| **Growth** | $79/mo | 3 | FMAAP Gate, Adaptive Pages |
| **Scale** | $199/mo | Unlimited | Stripe Connect, B2B Interop |
::

## Stripe Connect Flow

For Scale-tier users, Inkwell provisions a Stripe Connect account. 
1.  **Onboarding**: Initiated via the `/portal`.
2.  **Checkout**: Secure Stripe Checkout sessions handled by the Worker.
3.  **Settlement**: Funds are routed and splits are calculated automatically.

---

[[concepts/glass-dashboard|Back to The Glass Dashboard]] or [[features/adaptive-pages|Learn about Adaptive Pages]].
