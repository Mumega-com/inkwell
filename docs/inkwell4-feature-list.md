# Inkwell 4 Feature List

Inkwell 4 should become an agent-native CMS for business sites and structured publishing. It should not try to clone WordPress. The core advantage is that content, publishing, search, forms, and integrations can be governed by code, agents, and Cloudflare-native infrastructure.

## Product Position

Inkwell 4 is for teams that want:

- repo-owned content
- agent-assisted publishing
- structured SEO and answer-engine optimization
- Cloudflare-native hosting and data
- API-first integrations with CRMs, email, analytics, and automation tools
- less plugin/theme drift than WordPress

The product should stay file/content-first, with Cloudflare storage and APIs handling dynamic behavior.

## Core Capabilities

### 1. Site Presets

Ship reusable site presets:

- `artist`
- `business`
- `publication`
- `agency`
- `consulting`
- `resource-hub`

Each preset should include routes, collections, starter content, schema defaults, and navigation defaults.

### 2. Business Site Collections

Add first-class collections for:

- `services`
- `case_studies`
- `resources`
- `faqs`
- `offers`
- `people`
- `testimonials`

This lets sites like `digid.ca` move off WordPress without forcing service pages into generic markdown pages.

### 3. WordPress Importer

Build a WordPress REST importer that exports:

- pages
- posts
- categories
- tags
- featured images
- media references
- SEO metadata when available
- original URL and slug

The importer should output Inkwell markdown plus a redirect map.

### 4. Redirect Manager

Add a redirect format and generator:

- source URL
- destination URL
- status code
- reason
- migration source

Cloudflare Pages/Workers should be able to consume the generated redirects directly.

### 5. Lead Capture Forms

Add form support backed by Cloudflare:

- form schema
- spam protection
- Cloudflare D1 or KV storage
- email notification
- webhook delivery
- optional CRM forwarding

This is required before Inkwell can replace WordPress for lead-gen sites.

### 6. Integration Registry

Create a standard integration layer:

- GHL / HighLevel
- HubSpot
- Mailchimp / Resend
- Google Analytics / Search Console
- Clarity
- Stripe
- Notion
- Airtable
- Slack / Discord

The rule: if a third party has an API and the site has permission, Inkwell should integrate through a typed adapter instead of plugin sprawl.

### 7. Cloudflare Data Layer

Standardize Cloudflare usage:

- D1 for forms, content metadata, submissions, and audit logs
- KV for fast metadata and deploy state
- R2 for media when repo storage is not appropriate
- Workers for publish API, form API, webhooks, and integration callbacks
- Pages for static hosting

### 8. Publish Workflow

Upgrade publishing from script to governed workflow:

- draft
- preview
- validate
- review
- publish
- rollback

Validation should include:

- frontmatter schema
- duplicate slug check
- broken link check
- image existence
- canonical URL check
- mobile layout smoke check
- Pagefind build check

### 9. Agent Permissions

Add role-based publishing permissions:

- draft-only agent
- editor agent
- publisher agent
- admin

Every publish action should record:

- actor
- source
- changed files
- validation result
- deploy URL

### 10. SEO And AEO Layer

Add schema presets for:

- `Organization`
- `LocalBusiness`
- `ProfessionalService`
- `Service`
- `FAQPage`
- `BreadcrumbList`
- `Article`
- `Person`
- `Product`

Also add structured internal linking rules:

- service to topic
- topic to article
- article to service
- case study to service
- resource to CTA

### 11. Content Graph

Make the graph visible and useful:

- cross-collection tag pages
- related content blocks
- connection frontmatter
- topic pages with weekly updates
- backlink views
- Obsidian-compatible links where possible

### 12. Design Input Pipeline

Support design tools as optional inputs:

- Google Stitch brief import
- Figma MCP import
- `DESIGN.md` import

The output should become theme tokens, layout notes, and component rules, not arbitrary pasted UI code.

## Digid Migration Requirements

For `digid.ca`, Inkwell 4 needs:

- WordPress import
- service pages
- forms
- redirects
- business schema
- media migration
- Digid-specific design preset from the Stitch `Steel Precision` concept

## Non-Goals

Do not build:

- a full visual page builder
- arbitrary plugin marketplace
- WordPress-compatible theme system
- database-only CMS that loses repo ownership

Inkwell 4 should be narrower and more controlled than WordPress.

## First Implementation Milestones

1. WordPress importer with redirect map.
2. `services` and `case_studies` collections.
3. Cloudflare-backed form endpoint.
4. Business schema presets.
5. Governed publish workflow.
6. Integration registry with one real CRM/email adapter.
7. Digid migration proof of concept.
