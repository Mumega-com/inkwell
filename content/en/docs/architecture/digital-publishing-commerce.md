---
title: "Digital Publishing Commerce"
description: "A forkable architecture for digital books, subscriptions, and gated reading built across Shabrang CMS and Inkwell."
parent: "index"
order: 3
tags: ["architecture", "publishing", "commerce", "docs"]
---

Inkwell can power a **Substack-style digital publishing business** without turning the core product into a CMS.

The clean split is:

- **Shabrang CMS** owns content truth.
- **Inkwell** owns identity, billing, access control, and reader accounts.

This keeps Inkwell forkable and generic while still supporting paid books, serialized chapters, premium essays, reports, courses, and memberships.

## The Architecture Map

::mermaid
graph LR
  subgraph "Publishing Layer (Shabrang CMS)"
    B[Books]
    C[Chapters]
    M[Metadata]
    R[Release Rules]
    P[Public Previews]
  end

  subgraph "Commerce Layer (Inkwell)"
    A[Auth / Sessions]
    S[Stripe Checkout]
    G[Access Grants]
    L[Reader Library]
    RP[Reading Progress]
    N[Notifications]
  end

  subgraph "Delivery Channels"
    E[Email]
    T[Twilio SMS]
  end

  B --> G
  C --> G
  M --> L
  R --> N
  P --> L
  A --> G
  S --> G
  G --> L
  L --> RP
  N --> E
  N --> T
::

## Product Boundary

### Shabrang CMS
Shabrang CMS should continue to own:

- books
- chapters
- chapter metadata
- cover art
- release dates
- previews
- editorial workflow
- public SEO pages

It remains the source of truth for publishing.

### Inkwell
Inkwell should own:

- signup and login
- reader sessions
- Stripe checkout
- subscriptions and purchases
- access grants
- account portal
- reading library
- progress tracking
- billing state
- release notifications

It becomes the commercial and private-user layer.

## Why No GHL In V1

For digital publishing, GHL adds more weight than value.

Inkwell already has the right primitives:

- **Stripe** for one-time purchases and subscriptions
- **Twilio** for login codes, reminders, and release alerts
- **Email** for receipts, magic links, and new chapter notifications
- **Auth + Portal** for reader identity and account management

The first release should avoid funnel complexity and keep the product loop tight:

1. publish content
2. gate premium access
3. collect payment
4. grant access
5. notify readers
6. track engagement

GHL can return later if a fork needs CRM automation, but it should not define the core product.

## Core Data Model

### In Shabrang CMS

- `books`
- `chapters`
- `chapter.visibility`
- `chapter.release_at`
- `chapter.preview`
- `chapter.slug`
- `chapter.external_id`

### In Inkwell

- `reader_accounts`
- `products`
- `product_entitlements`
- `subscriptions`
- `purchases`
- `access_grants`
- `reading_progress`
- `notification_events`

The important rule is that **content lives in Shabrang, entitlements live in Inkwell**.

All commerce-facing tables should follow the same **tenant isolation pattern** used by other business-domain tables in Inkwell. In practice, that means:

- tenant-scoped rows by default
- no cross-tenant joins without an explicit bridge
- account, access, progress, and notification records partitioned the same way as other customer-owned state

Digital publishing should not introduce a second isolation model.

## Access Model

Each chapter should resolve to one of three states:

- `public`
- `preview`
- `members_only`

The delivery flow is:

1. reader lands on a public book or chapter page
2. Shabrang renders metadata and any allowed preview
3. if the chapter is `members_only`, Inkwell checks the user session and entitlements
4. if access is valid, Inkwell returns the gated payload or a signed fetch token
5. if access is missing, Inkwell returns checkout and login options

This keeps the paywall and entitlements centralized instead of scattering access logic through the publishing layer.

## Reader Lifecycle

The lifecycle is not shipment-based. It is access-based.

::timeline
**Discovered** | Reader lands on a public page, preview, or book landing page.
**Converted** | Reader purchases access or starts a subscription.
**Granted** | Inkwell creates the access grant and attaches it to the account.
**Reading** | The reader unlocks chapters and accumulates progress.
**Released** | New paid or subscriber chapters become available.
**Notified** | Email and SMS announce new releases or reminders.
**Retained** | The reader stays subscribed or purchases more content.
::

## V1 Implementation Plan

### Phase 1: Publishing Contract

- add `visibility`, `release_at`, and stable external IDs to chapter content
- define the API shape Shabrang exposes for books and chapters
- support previews for paywalled chapters

### Phase 2: Commerce Contract

- create Inkwell products for books, subscriptions, and premium collections
- support one-time purchases and recurring subscriptions in Stripe
- map purchases to `access_grants`

### Phase 3: Reader Portal

- add a library view in Inkwell
- add account and billing pages
- add progress tracking per chapter

### Phase 4: Notifications

- send receipt and welcome email after purchase
- send release alerts for new chapters
- use Twilio for optional login and release reminders

## Generic Product Surface

This model should stay forkable.

The same architecture can support:

- digital books
- premium newsletters
- serialized fiction
- member-only essays
- research reports
- audio series
- courses

The fork should swap the content model and pricing strategy, not the platform primitives.

## Release Placement

This architecture belongs in the **v4.1** evolution line, layered on top of the existing v4 auth, billing, and portal primitives.

The implementation should be tracked as:

- publishing contract in the content system
- entitlement and reader-state tables in the Worker
- digital-access routes in the Worker API
- reader library and progress UI in the site shell

## Operating Rule

Do not put fork-specific brands, books, or workflows into the Inkwell core.

The product should describe generic publishing-commerce behavior:

- content source
- payment source
- access control
- reader portal
- notification engine

Everything customer-specific belongs in the fork or content instance.

---

[[docs/architecture/system-design|Back to System Design]] or [[docs/strategy/roadmap|View the Roadmap]].
