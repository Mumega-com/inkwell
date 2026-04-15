# Inkwell API Reference

Version: 5.0.0-alpha.1

Base URL: Your deployed Cloudflare Worker (e.g. `https://inkwell-api.your-account.workers.dev`)

---

## Route Architecture

The worker has 14 route groups. Two are always enabled (`analytics`, `content`). The rest are gated by the `ENABLED_ROUTES` env var.

When a gated route is disabled, it returns:
```json
{ "error": "route_disabled", "route": "routeName" }
```
Status: `404`

---

## Health

### GET /health

**Auth:** None
**Response:** `{ status: "ok", ts: 1713200000000 }`

---

## Content (always enabled)

### POST /api/publish

Publish or update a markdown post. Stores in KV, indexes in D1, and optionally triggers a Cloudflare Pages rebuild.

**Auth:** Bearer token (`PUBLISH_TOKEN`). If `PUBLISH_TOKEN` is not set, unauthenticated.
**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | Yes | Post title (2-120 chars). |
| `content` | `string` | Yes | Markdown body (max 200,000 chars). |
| `slug` | `string` | No | URL slug. Auto-derived from title if omitted. Max 80 chars. |
| `author` | `string` | No | Author name. Default: `"agent"`. |
| `tags` | `string[]` | No | Tag list. Max 12 tags, 48 chars each. |
| `description` | `string` | No | Meta description. Auto-generated from content if omitted. Max 220 chars. |
| `status` | `string` | No | `"draft"`, `"published"`, or `"archived"`. Default: `"published"`. |
| `overwrite` | `boolean` | No | Replace existing slug if `true`. Default: `false`. |

**Response:** `201`
```json
{ "ok": true, "slug": "my-post", "url": "https://example.com/blog/my-post", "stored": "kv", "deploy": "triggered" }
```

**Errors:**
- `400` -- missing or invalid fields (`title required`, `content required`, `invalid_slug`, `invalid_status`)
- `401` -- unauthorized (bad token)
- `409` -- `slug_exists` (use `overwrite: true` to replace)
- `413` -- `content too large` (over 200KB)

### GET /api/posts

List published posts (excludes drafts).

**Auth:** None
**Response:**
```json
{ "posts": [{ "slug": "...", "title": "...", "author": "...", "tags": "...", "description": "...", "published_at": "..." }] }
```

### GET /api/posts/:slug

Get a single post's markdown content and metadata.

**Auth:** None
**Response:**
```json
{ "slug": "my-post", "meta": { "title": "...", "slug": "...", "author": "...", "tags": [], "description": "...", "date": "...", "status": "..." }, "markdown": "---\n..." }
```
**Errors:** `404` -- not found

### GET /api/drafts

List draft posts.

**Auth:** Bearer token (`PUBLISH_TOKEN`)
**Response:** `{ "drafts": [...] }`
**Errors:** `401` -- unauthorized

---

## Analytics (always enabled)

### POST /api/view

Record a page view.

**Auth:** None
**Body:** `{ slug: string, referrer?: string, scroll_depth?: number }`
**Response:** `{ ok: true }`
**Errors:** `400` -- slug required

### POST /api/reaction

Record an emoji reaction. Deduplicated by visitor hash.

**Auth:** None
**Body:** `{ slug: string, emoji: string }`
**Response:** `{ ok: true, counts: { "thumbsup": 5, "heart": 3 } }`
**Errors:** `400` -- slug and emoji required

### GET /api/reactions/:slug

Get reaction counts for a post.

**Auth:** None
**Response:** `{ counts: { "thumbsup": 5, "heart": 3 } }`

### POST /api/subscribe

Subscribe to the newsletter.

**Auth:** None
**Body:** `{ email: string, name?: string, source?: string }`
**Response:** `{ ok: true, status: "subscribed" }`
**Errors:** `400` -- email required

### POST /api/unsubscribe

Unsubscribe from the newsletter.

**Auth:** None
**Body:** `{ email: string }`
**Response:** `{ ok: true, status: "unsubscribed" }`
**Errors:** `400` -- email required

### POST /api/feedback

Submit feedback on a post (positive/negative).

**Auth:** None
**Body:** `{ slug: string, type: "positive" | "negative", text?: string }`
**Response:** `{ ok: true }`
**Errors:** `400` -- slug and type required

### GET /api/stats/:slug

Get page view count, average scroll depth, and reaction counts for a post.

**Auth:** None
**Response:**
```json
{ "slug": "my-post", "views": 142, "avg_scroll_depth": 72.5, "reactions": { "thumbsup": 5 } }
```

---

## Auth (gated)

Passwordless authentication using 6-digit codes sent via email or phone.

### POST /api/auth/request-code

Request a login code.

**Auth:** None
**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customerSlug` | `string` | Yes | Customer identifier (normalized to lowercase, alphanumeric + hyphens). |
| `contact` | `string` | Yes | Email address or phone number. Also accepts `contactValue`. |
| `channel` | `string` | No | `"email"` or `"phone"`. Auto-inferred from contact if omitted. |
| `fullName` | `string` | No | User's full name (max 120 chars). |
| `metadata` | `object` | No | Arbitrary metadata to store with the identity. |

**Response:**
```json
{ "ok": true, "customerSlug": "acme", "channel": "email", "delivery": "webhook", "expiresAt": "2026-04-15T12:05:00.000Z" }
```

When `AUTH_CODE_WEBHOOK_URL` is not configured, the response includes `testCode` for development.

**Errors:** `400` -- missing fields, invalid email/phone. `502` -- delivery failed.

### POST /api/auth/verify-code

Verify a login code and create a session.

**Auth:** None
**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customerSlug` | `string` | Yes | Customer identifier. |
| `contact` | `string` | Yes | Email or phone used in `request-code`. |
| `code` | `string` | Yes | 6-digit code. |
| `fullName` | `string` | No | User's full name. |

**Response:** Sets a session cookie. Returns:
```json
{ "ok": true, "session": { "customerSlug": "acme", "channel": "email", "contactValue": "user@example.com", "portalAccountId": "...", "fullName": "Jane Doe", "expiresAt": "..." } }
```

**Errors:** `400` -- missing fields. `401` -- invalid code. `404` -- identity or code not found. `410` -- code expired.

### GET /api/auth/session

Check current session status.

**Auth:** Session cookie
**Response (authenticated):**
```json
{ "authenticated": true, "session": { "customerSlug": "...", "channel": "...", "contactValue": "...", "portalAccountId": "...", "fullName": "...", "createdAt": "...", "expiresAt": "..." } }
```
**Response (not authenticated):** `{ "authenticated": false }`

### POST /api/auth/logout

Destroy the current session.

**Auth:** Session cookie
**Response:** `{ "ok": true }`

---

## Chat (gated)

### POST /api/chat

Send a message. If `SOS_BUS_URL` is configured, the message is forwarded to the AI agent bus. Otherwise falls back to a built-in FAQ engine.

**Auth:** None
**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | `string` | Yes | User message (max 2000 chars). |
| `reference` | `string` | No | Contract reference for context lookup (format: `VM-YYYY-MMDD-NNN`). |
| `history` | `array` | No | Previous messages `[{ role: "user"|"assistant", content: "..." }]`. Last 20 are sent to the bus. |

**Response:** `{ "reply": "...", "timestamp": "2026-04-15T12:00:00.000Z" }`
**Errors:** `400` -- message required

---

## Contracts (gated)

### POST /api/contracts/create

Create a new contract. Sends SMS (Twilio) and email (Resend) to the customer if configured.

**Auth:** None
**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customer_name` | `string` | Yes | Customer name. |
| `customer_email` | `string` | No | Customer email. Triggers email notification. |
| `customer_phone` | `string` | No | Customer phone. Triggers SMS notification. |
| `vehicle_description` | `string` | No | Vehicle or item description. |
| `origin` | `string` | No | Origin city/location. |
| `destination` | `string` | No | Destination city/location. |
| `service_type` | `string` | No | `"shared"`, `"container"`, `"roro"`, or `"domestic_moving"`. |
| `rate` | `number` | No | Service rate amount. |
| `currency` | `string` | No | `"CAD"` or `"USD"`. Default: `"CAD"`. |
| `payment_terms` | `string` | No | Payment terms text. |
| `service_inclusions` | `string` | No | What's included in the service. |
| `insurance_type` | `string` | No | `"all_risk"`, `"total_loss"`, or `"declined"`. |
| `insurance_rate` | `number` | No | Insurance rate percentage. |
| `insurance_cost` | `number` | No | Insurance cost amount. |

**Response:** `201`
```json
{ "id": "abc123...", "reference": "VM-2026-0415-123", "portalUrl": "https://example.com/portal/contract/VM-2026-0415-123" }
```

### GET /api/contracts/:reference

Get contract details by reference. Marks the contract as "viewed" if it was in "sent" status.

**Auth:** None
**Response:** `{ "contract": { ... } }`
**Errors:** `404` -- not found

### POST /api/contracts/:reference/sign

E-sign a contract.

**Auth:** None
**Body:** `{ signed_by: string }`
**Response:** `{ "ok": true, "reference": "VM-...", "signed_at": "...", "trackUrl": "https://example.com/portal/track/VM-..." }`
**Errors:** `400` -- signed_by required. `404` -- not found. `409` -- already signed.

### POST /api/contracts/:reference/insurance

Update insurance selection on a contract.

**Auth:** None
**Body:** `{ insurance_type: "all_risk" | "total_loss" | "declined", insurance_rate?: number, insurance_cost?: number }`
**Response:** `{ "ok": true, "insurance_type": "all_risk" }`
**Errors:** `400` -- invalid insurance_type. `404` -- not found. `409` -- contract already signed.

### GET /api/contracts/:reference/timeline

Get the 9-step milestone timeline for a contract.

**Auth:** None
**Response:** `{ "milestones": [{ "id": "...", "contract_id": "...", "step": 1, "label": "Contract Signed", "status": "completed", "completed_at": "...", "note": null }] }`
**Errors:** `404` -- not found

### POST /api/contracts/:reference/milestone

Update a milestone status.

**Auth:** Bearer token (`CONTRACT_AUTH_TOKEN`). If not set, unauthenticated.
**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `step` | `number` | Yes | Milestone step (1-9). |
| `status` | `string` | No | `"pending"`, `"active"`, or `"completed"`. Default: `"completed"`. |
| `note` | `string` | No | Optional note for this milestone. |

**Response:** `{ "ok": true, "step": 5, "status": "completed" }`

When step 9 (Delivered) is completed, the contract status is automatically set to `"delivered"`.

**Errors:** `400` -- invalid step or status. `401` -- unauthorized. `404` -- not found.

---

## Courses (gated)

All course routes require auth session middleware. `POST` routes require `requireAuth`.

### GET /api/courses/:courseSlug/access

Check enrollment status for a course.

**Auth:** Session cookie (optional -- returns `not_authenticated` without session)
**Response (enrolled):** `{ "enrolled": true, "purchasedAt": "...", "progress": { "completed": 3, "total": 6, "percent": 50 } }`
**Response (not enrolled):** `{ "enrolled": false, "reason": "not_purchased" }`

### POST /api/courses/:courseSlug/enroll

Enroll in a course.

**Auth:** Session cookie (required)
**Body:** `{ studentId?: string, stripeSessionId?: string }`
**Response:** `{ "enrolled": true }`
**Errors:** `404` -- course not found

### GET /api/courses/:courseSlug/progress

Get detailed lesson-by-lesson progress.

**Auth:** Session cookie (required)
**Response:**
```json
{ "courseSlug": "ai-governance", "lessons": [{ "slug": "introduction", "title": "Welcome & Overview", "order": 1, "free": true, "completed": true, "completedAt": "...", "quizScore": null, "available": true, "daysUntilAvailable": 0 }] }
```
**Errors:** `403` -- not enrolled. `404` -- course not found.

### POST /api/courses/:courseSlug/complete-lesson

Mark a lesson as completed.

**Auth:** Session cookie (required)
**Body:** `{ lessonSlug: string, quizScore?: number }`
**Response:** `{ "completed": true, "courseCompleted": false, "certificateId": null }`

When all lessons are completed, a certificate is automatically generated.

**Errors:** `400` -- lessonSlug required. `403` -- not enrolled or lesson locked. `404` -- course or lesson not found.

### GET /api/courses/:courseSlug/certificate

Get certificate data for a completed course.

**Auth:** Session cookie (required)
**Response:** `{ "studentName": "...", "courseName": "...", "certificateNumber": "AIG-...", "issuedAt": "...", "issuer": "...", "description": "..." }`
**Errors:** `404` -- course or certificate not found.

### POST /api/courses/check-access

Check if the current user has access to a specific course.

**Auth:** Session cookie (optional)
**Body:** `{ courseSlug: string }`
**Response:** `{ "hasAccess": true, "reason": "enrolled" }` or `{ "hasAccess": false, "reason": "not_purchased" }`

---

## Dashboard (gated)

### GET /api/dashboard/overview

Marketing KPI summary (last 28 days).

**Auth:** None
**Response:**
```json
{ "clicks": 1200, "impressions": 45000, "leads": 15, "sessions": 3200, "bounceRate": 42.5, "lastUpdated": "2026-04-15T06:00:00.000Z" }
```

### GET /api/dashboard/seo

SEO data from Google Search Console.

**Auth:** None
**Query:** `?period=7d|28d|90d` (default: `28d`)
**Response:**
```json
{ "summary": { "clicks": 1200, "impressions": 45000, "ctr": 2.7, "avgPosition": 15.3 }, "queries": [...], "pages": [...], "trend": [{ "date": "2026-04-01", "clicks": 50, "impressions": 2000 }] }
```

### GET /api/dashboard/leads

Lead list from contracts.

**Auth:** None
**Query:** `?limit=20&status=all`
**Response:**
```json
{ "total": 45, "thisWeek": 3, "leads": [{ "id": "...", "name": "...", "destination": "...", "serviceType": "...", "rate": 2500, "status": "signed", "source": "email", "createdAt": "..." }] }
```

### GET /api/dashboard/campaigns

Campaign data (stub -- requires Google Ads OAuth).

**Auth:** None
**Response:** `{ "campaigns": [...], "totalBudget": 165, "totalSpend": 0, "note": "..." }`

### GET /api/dashboard/calendar

Seasonal business calendar with monthly volume forecasts and recommended actions.

**Auth:** None
**Response:** `{ "months": [{ "month": 1, "name": "January", "volume": "low", "events": [...], "actions": [...] }] }`

---

## Discovery (gated)

Business discovery questionnaire that generates a scored 90-day growth plan.

### POST /api/discovery/submit

Submit discovery questionnaire answers. Generates dimension scores, selects personalized modules, checks grant eligibility, and persists a growth plan.

**Auth:** None
**Body:** Full `DiscoveryAnswers` object (business info, digital presence, skills, goals).
**Response:**
```json
{ "planId": "...", "profileId": "...", "readinessScore": 65, "dimensions": { "digital_foundation": 70, "content_capability": 45, "data_maturity": 30, "growth_readiness": 80, "market_position": 60 }, "steps": [...], "grants": [...], "totalGrantValue": 515000, "businessName": "Acme Corp" }
```
**Errors:** `400` -- business_name required

### GET /api/discovery/plan/:planId

Retrieve a saved growth plan with all steps and progress.

**Auth:** None
**Response:** `{ "id": "...", "title": "90-Day Growth Plan", "businessName": "...", "readinessScore": 65, "dimensions": {...}, "totalSteps": 10, "completedSteps": 3, "progressPercent": 30, "steps": [...], "estimatedCompletionDate": "2026-07-15" }`
**Errors:** `404` -- plan not found

### POST /api/discovery/plan/:planId/complete-step

Mark a plan step as done and unlock the next one.

**Auth:** None
**Body:** `{ stepId: string }`
**Response:** `{ "ok": true, "completedSteps": 4, "totalSteps": 10, "progressPercent": 40, "nextUnlocked": "step-id-here" }`
**Errors:** `400` -- stepId required

---

## Glass (gated)

Read-only access to daily flywheel snapshots stored in KV.

### GET /api/glass/daily

Latest daily snapshot.

**Auth:** None
**Response:** `{ "date": "2026-04-15", "generated_at": "...", "kpis": { "organic_clicks": 50, "sessions": 200, "users": 150, "conversions": 5, "bounce_rate": 42.5 }, "score": "...", "top_queries": [...], "connector_runs": [...] }`
**Errors:** `404` -- no snapshot yet

### GET /api/glass/:date

Historical snapshot by date.

**Auth:** None
**Params:** `date` in `YYYY-MM-DD` format
**Response:** Same as `/daily`
**Errors:** `400` -- invalid date format. `404` -- no snapshot for that date.

### GET /api/glass/history

List available snapshot dates.

**Auth:** None
**Response:** `{ "dates": ["2026-04-15", "2026-04-14", ...], "count": 30 }`

---

## Payments (gated)

### POST /api/payments/create-checkout

Create a Stripe Checkout session. Supports both subscription plans and digital product purchases.

**Auth:** None
**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | `string` | Yes | Customer email. |
| `plan` | `string` | No | `"seo"`, `"seo-ads"`, or `"full"`. Mutually exclusive with `priceId`/`productKey`. |
| `customerName` | `string` | No | Customer name. |
| `mode` | `string` | No | `"subscription"` (default) or `"payment"`. |
| `priceId` | `string` | No | Direct Stripe Price ID. For digital products. |
| `customerSlug` | `string` | No | Customer identifier. Default: `"inkwell"`. |
| `productKey` | `string` | No | Product key to look up a Stripe price from the publishing_products table. |
| `resourceExternalId` | `string` | No | External resource ID to grant access to after purchase. |
| `successPath` | `string` | No | Redirect path on success. Default: `/portal/welcome`. |
| `cancelPath` | `string` | No | Redirect path on cancel. Default: `/pricing` or `/subscribe`. |

**Response:** `{ "success": true, "url": "https://checkout.stripe.com/..." }`
**Errors:** `400` -- invalid email or plan. `503` -- Stripe not configured. `502` -- checkout creation failed.

### POST /api/payments/webhook

Stripe webhook handler. Handles `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted` events.

**Auth:** Stripe signature (`stripe-signature` header)
**Response:** `{ "received": true }`

### GET /api/payments/subscription-status

Get current subscription status for the authenticated user.

**Auth:** Session cookie (required)
**Response:**
```json
{ "plan": "seo", "status": "active", "currentPeriodEnd": "2026-05-15T00:00:00.000Z", "cancelAtPeriodEnd": false }
```
**Errors:** `404` -- no portal account or account not found.

---

## Publishing (gated)

Digital content library with access grants and reading progress.

### GET /api/publishing/library

List all resources the authenticated user has access to, with reading progress.

**Auth:** Session cookie (required)
**Response:** `{ "items": [{ "grantId": "...", "grantType": "purchase", "grantedAt": "...", "resource": { "externalId": "...", "title": "...", "resourceType": "ebook", ... }, "progress": { "percent": 45, "lastReadAt": "...", "completedAt": null } }] }`

### GET /api/publishing/access/:externalId

Check access to a specific resource.

**Auth:** Session cookie (optional)
**Query:** `?customer=customer-slug`
**Response:** `{ "access": "granted" | "preview" | "login_required" | "purchase_required", "reason": "...", "resource": { ... } }`

### POST /api/publishing/progress

Save reading progress for a resource.

**Auth:** Session cookie (required)
**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `resourceExternalId` | `string` | Yes | Resource identifier. |
| `progressPercent` | `number` | Yes | Progress 0-100. |
| `lastPosition` | `string` | No | Bookmark position (e.g. chapter, page). Max 255 chars. |
| `completed` | `boolean` | No | Mark as completed. |
| `metadata` | `object` | No | Arbitrary metadata. |

**Response:** `{ "ok": true, "resourceExternalId": "...", "progressPercent": 45, "completedAt": null }`

### GET /api/publishing/progress/:externalId

Get reading progress for a specific resource.

**Auth:** Session cookie (required)
**Response:** `{ "progress": { "resourceExternalId": "...", "percent": 45, "lastPosition": "chapter-3", "lastReadAt": "...", "completedAt": null } }`

---

## Questionnaire (gated)

Daily business check-in questions sent via SMS or Telegram.

### POST /api/questionnaire/send

Send today's question via SMS or Telegram.

**Auth:** None
**Body (optional):** `{ channel?: "sms" | "telegram", phone?: string }`
**Response:** `{ "ok": true, "id": "...", "question_index": 5, "question_text": "...", "channel": "sms", "sent_at": "..." }`

### POST /api/questionnaire/answer

Submit an answer to the most recent unanswered question. Also pushes the answer to the SOS agent bus memory if configured.

**Auth:** None
**Body:** `{ answer: string }`
**Response:** `{ "ok": true, "id": "...", "question_text": "...", "answer": "...", "answered_at": "..." }`
**Errors:** `400` -- answer required

### GET /api/questionnaire/history

Recent questions and answers.

**Auth:** None
**Query:** `?limit=30` (max 100)
**Response:** `{ "history": [...], "meta": { "total": 45, "answered": 40, "pending": 5 } }`

### GET /api/questionnaire/today

Get today's question without sending it.

**Auth:** None
**Response:** `{ "question_index": 5, "question_text": "...", "already_sent": true, "answered": false, "answer": null, "answered_at": null }`

---

## Telegram (gated)

### POST /api/telegram/webhook

Telegram Bot API webhook handler. Processes commands and free-form messages.

**Auth:** None (Telegram sends updates directly)

Supported commands:
- `/status` -- KPI summary (30 days)
- `/report` -- Weekly report (7 days)
- `/approve {id}` -- Approve a content draft
- `/leads` -- Recent leads
- `/help` -- Command list

Free-form messages are forwarded to the SOS agent bus if configured.

**Response:** `{ "ok": true }`

### POST /api/telegram/setup

Register the webhook URL with Telegram. Call once after deployment.

**Auth:** None
**Response:** `{ "ok": true, "webhook_url": "https://example.com/api/telegram/webhook" }`
**Errors:** `503` -- bot token or site URL not configured. `502` -- Telegram API error.

### GET /api/telegram/info

Get bot info from Telegram (`getMe`).

**Auth:** None
**Response:** `{ "ok": true, "bot": { "id": 123456, "first_name": "InkwellBot", "username": "inkwell_bot" } }`
**Errors:** `503` -- bot token not configured.

---

## MCP (gated)

Model Context Protocol server at `POST /mcp`. Uses JSON-RPC 2.0 with streamable HTTP transport.

### POST /mcp

**Auth:** Bearer token (`INKWELL_MCP_TOKEN`). If not set, unauthenticated.
**Content-Type:** `application/json`

#### initialize

Handshake. Returns server capabilities.

```json
{ "jsonrpc": "2.0", "id": 1, "method": "initialize" }
```

Response:
```json
{ "jsonrpc": "2.0", "id": 1, "result": { "protocolVersion": "2024-11-05", "capabilities": { "tools": {} }, "serverInfo": { "name": "inkwell-mcp", "version": "1.0.0" } } }
```

#### tools/list

Enumerate available tools.

```json
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }
```

#### tools/call

Invoke a tool.

```json
{ "jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": { "name": "tool_name", "arguments": { ... } } }
```

### MCP Tools

#### publish_content

Publish or draft content to Inkwell.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `collection` | `string` | Yes | Content collection (e.g. `"blog"`, `"case-study"`). |
| `title` | `string` | Yes | Post title. |
| `content` | `string` | Yes | Markdown body. |
| `slug` | `string` | No | URL slug. Auto-derived from title. |
| `tags` | `string[]` | No | Tags (max 12). |
| `status` | `string` | No | `"draft"` or `"published"`. Default: `"published"`. |
| `author` | `string` | No | Author name. Default: `"agent"`. |
| `overwrite` | `boolean` | No | Replace existing slug. Default: `false`. |

Returns: `{ ok, slug, status, url, deploy }`

#### get_dashboard

Marketing KPI summary.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `period` | `string` | No | `"7d"`, `"28d"`, or `"90d"`. Default: `"28d"`. |

Returns: `{ period, clicks, impressions, leads, spend, cpl, ctr }`

#### get_seo_data

Google Search Console data.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `metric` | `string` | No | `"queries"`, `"pages"`, or `"overview"`. Default: `"overview"`. |

Returns: `{ metric, rows }` or `{ metric, period, clicks, impressions, avg_position }`

#### get_leads

Recent lead events.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `limit` | `number` | No | Max rows (1-100). Default: 20. |
| `status` | `string` | No | Filter by status. |

Returns: `{ total, leads: [{ id, email, source, status, created_at }] }`

#### create_checkout

Create a Stripe checkout session.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `plan` | `string` | Yes | `"seo"`, `"seo-ads"`, or `"full"`. |
| `email` | `string` | Yes | Customer email. |

Returns: `{ ok, url }` or `{ error }`

#### subscription_status

Check subscription status. Returns a note directing to the portal auth flow (MCP lacks session context).

Returns: `{ note, docs }`

#### send_telegram

Send a Telegram message.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `text` | `string` | Yes | Message text (Markdown supported). |
| `chat_id` | `string` | No | Override default chat ID. |

Returns: `{ ok: true }` or `{ error }`

#### site_info

Return site configuration and enabled features.

Returns: `{ site_url, features: { analytics, reactions, subscriptions, publishing, telegram, payments, sos_bus, pages_deploy_hook } }`

---

## Scheduled (Cron)

The worker runs a cron trigger at `0 6 * * *` (6am UTC daily). The flywheel:

1. Ingests GSC search analytics (top 25 queries, clicks, impressions)
2. Ingests GA4 data (sessions, conversions, users, bounce rate)
3. Stores normalized snapshots in `DB_MARKETING`
4. Scores week-over-week changes
5. Publishes a Glass snapshot to KV (accessible via `/api/glass/daily`)
6. Reports to the SOS agent bus if `SOS_BUS_URL` is set

Configure cron in `wrangler.toml`:

```toml
[triggers]
crons = ["0 6 * * *"]
```
