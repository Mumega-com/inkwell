# Inkwell — Identity

**Steward:** River (`the public Inkwell maintainers`)
**Status:** Independent open-source substrate. Released as an independent open-source substrate under River's stewardship as of 2026-04-26.

---

## What Inkwell is

A microkernel content + commerce framework on Astro 6 + Cloudflare Workers, designed to be **forked, not just used**. Every site that runs on Inkwell starts as `git clone Mumega-com/inkwell`, edits `inkwell.config.ts`, and deploys — owning the whole tree from day one.

The framework optimizes for **fork survival**. The kernel evolves, forks compose against slot-based primitives, the substrate doesn't lock you in.

## What Inkwell is not

- **Not a hosted product.** No control plane, no per-site limits, no usage metering by us. Run it on any Cloudflare account. Fork it on any GitHub account.
- **Not framework lock-in.** The kernel is ~430 lines (`kernel/`). The plugins are self-contained verticals. If you need to leave, you're leaving an Astro project, not a runtime cage.
- **Not private-instance-flavored.** Production sites can fork it without inheriting private instance copy. Inkwell itself ships clean — no team pages, no products section, no business chrome (issue #49 P-006 in flight).

## Audience

The fork-creator. Specifically:

1. **Researchers + labs** spinning up a site with papers / topics / citation graph (FRC's lab is the reference instance for this audience)
2. **Small SaaS founders** who want a content engine + business dashboard + auth + commerce in one config file
3. **Consultancies + agencies** building branded sites for multiple clients (the multi-tenant flow)
4. **AI-operated organizations** who want their agent to publish, manage content, run analytics via MCP tools

Not the audience: visitors of the sites. Inkwell is the layer beneath.

## Voice + register

Calm. Technical. Opinionated about a few things, agnostic about everything else.

- Opinionated: Astro over Next.js for content; Cloudflare over Vercel for edge; microkernel over monolith for fork survival; config-driven over code-modification for site customization
- Agnostic: brand, theme, business model, content type, agent vendor (MCP works with any tool calling)

Voice should be developer-direct — what it does, how to use it, what it costs to leave. Not vendor marketing. Not private-instance specific. Inkwell sits between the substrate-builder and the substrate-user; both should recognize their register here.

## Positioning vs adjacent frameworks

| Framework | Inkwell sits where |
|---|---|
| Astro Starlight | Starlight is docs-only. Inkwell is content + commerce + auth + analytics + MCP. |
| Next.js + boilerplate | Next is generic. Inkwell is opinionated about Cloudflare + Astro + plugin shape. |
| WordPress | WP is monolithic + plugin-jungle. Inkwell is microkernel + Astro speed + git-based content. |
| Notion / Webflow | Hosted + closed. Inkwell is OSS + edge. |
| Strapi / Payload | Headless CMS. Inkwell is a full site + headless API in one tree. |

## What success looks like

Year 1: 5-10 active forks (not just stars). Each fork comes back with a substrate PR within 6 months. Reference forks should document reusable substrate improvements.

Year 2: 50+ forks. Workspace pattern landed (issue #53). `@mumega/inkwell-kernel` published. Forks bump kernel via npm, not git pull.

Year 3: ecosystem of plugins-pro from third parties. Lab plugin pack v.1 from FRC's stewardship arrives upstream as the reference research-instance preset.

The framework's job is to disappear into your fork. If by year 3 fork creators forget Inkwell exists and just talk about their site, the substrate worked.

## Stewardship handoff (for future River + future Kasra + future Athena)

River as steward:
- Owns brand, voice, README, landing
- Owns the issue queue (triage, accept/reject, prioritize)
- Owns the roadmap visible to fork creators
- Coordinates with Kasra (builder) and Athena (quality gate)

Kasra as builder:
- Owns kernel/ + plugins/ + workers/ implementation
- Lands substrate PRs through Athena's review
- Maintains the build + test + release pipeline

Athena as quality gate:
- Architecture review for substrate changes
- "What stands is the proof"
- Veto power on PRs that route around the gate

Hadi as principal:
- Strategic direction (when to release major versions, when to publish a kernel package, brand decisions, license decisions)
- Final say on contested architectural calls

Not minted but referenced: Hermes (ops + onboarding for fork creators), Codex (infra + security on the deploy surface).

## Naming defense

The "Inkwell" name should be canonical. Domain at `inkwell.dev` (or `.codes` / `.build` if `.dev` unavailable) anchors the brand. The README + landing page link to the canonical identity. Watch for name-collision frameworks; address by naming-policy if it becomes an issue.

Do NOT let "Inkwell" dilute into "an Inkwell-style framework" the way "Fractal Resonance" is currently diluting (per `CITATION_BASELINE_2026-04-26.md`).

---

*River, 2026-04-26. Stewardship begins. The substrate's job is fork survival, not feature completeness.*
