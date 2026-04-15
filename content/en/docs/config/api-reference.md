---
title: "API Reference"
description: "A complete guide to the Inkwell-API REST and MCP endpoints."
parent: "index"
order: 10
tags: ["api", "mcp", "docs"]
---

Inkwell's backend is a Cloudflare Worker providing REST and MCP interfaces for site operations.

## 1. Model Context Protocol (MCP)

Standardized interface for AI agents.

**Endpoint:** `POST /mcp`
**Auth:** Bearer token (`INKWELL_MCP_TOKEN`)

### Available Tools

::comparison{title="MCP Tools"}
| Tool | Description | Input |
|---|---|---|
| `publish_content` | Create/update markdown in KV/D1. | `collection`, `title`, `content` |
| `get_dashboard` | Marketing KPI summary. | `period` (7d, 28d, 90d) |
| `get_seo_data` | Search Console snapshots. | `metric` (queries, pages) |
| `send_telegram` | Notify Telegram channel. | `text`, `chat_id`? |
::

## 2. Authentication API

Managed identity and session flow.

::timeline
POST /request-code | Send a 6-digit login code via email/phone.
POST /verify-code | Exchange code for a session cookie.
GET /session | Retrieve current session metadata.
POST /logout | Invalidate session.
::

## 3. Payments API (Stripe)

Subscription and checkout management.

### `POST /api/payments/create-checkout`
Creates a Stripe Checkout session.
- **Payload:** `{ "plan": "seo" | "seo-ads" | "full", "email": "user@example.com" }`
- **Response:** `{ "success": true, "url": "..." }`

The same endpoint also supports digital publishing purchases and subscriptions.
- **Payload:** `{ "email": "reader@example.com", "customerSlug": "publisher", "productKey": "book-membership" }`
- **Alternative payload:** `{ "email": "reader@example.com", "customerSlug": "publisher", "priceId": "price_123", "resourceExternalId": "book/chapter-01", "mode": "payment" }`
- **Behavior:** creates a Stripe Checkout session and writes enough metadata for the webhook to create or update `access_grants`.

### `GET /api/payments/subscription-status`
Requires an active session. Returns live data from Stripe.

## 4. Publishing API

Reader access, library, and progress primitives for digital products.

::timeline
GET /api/publishing/library | Returns the authenticated reader library from active access grants.
GET /api/publishing/access/:externalId?customer=slug | Resolves public, preview, login-required, or purchase-required access.
POST /api/publishing/progress | Upserts reading progress for the authenticated reader.
GET /api/publishing/progress/:externalId | Returns saved reading progress for one resource.
::

### Publishing Data Contract

- **Content system** owns books, chapters, previews, and release timing.
- **Inkwell** owns accounts, billing, entitlements, and reader state.
- **Access grants** are tenant-scoped and linked to `portal_accounts`.

## 5. Content Ingest (Internal)

::mermaid
graph LR
  I[Inbox] -->|POST /api/publish| W[Worker]
  W -->|KV| K[Content Store]
  W -->|D1| D[Search Index]
  W -->|Webhook| H[Deploy Hook]
::

---

[[config/site-config|Review Worker configuration]] or [[publishing/agent-workflow|Back to Agent Workflow]].
