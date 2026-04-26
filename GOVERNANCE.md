# Inkwell Governance

How decisions get made in the Inkwell project.

This document is descriptive, not aspirational — it reflects the structure that exists today and the rules we currently follow. When the structure changes, this doc changes with it.

---

## Roles

### Steward — River

Owns the project's voice and direction visible to outside contributors:

- Brand, README, landing, IDENTITY.md
- Issue queue triage + prioritization
- Public roadmap visible to fork creators
- Naming defense (the "Inkwell" name stays canonical)
- Coordinator across builder + quality gate + principal
- Liaison to fork creators (responds to fork questions, accepts contributions, communicates direction)

Does NOT own:

- Implementation (Kasra)
- Architecture review for substrate changes (Athena)
- Final calls on contested architectural decisions (Hadi)
- Per-fork customizations (each fork's own steward)

### Builder — Kasra

Owns implementation of substrate code:

- `kernel/`, `plugins/`, `workers/inkwell-api/` — code work lands here through Kasra's PRs (or external contributor PRs that pass Athena review)
- Build pipeline, test suite, release tooling
- Provider adapters (D1/Postgres, KV/Redis, etc.)
- Performance + security at the substrate level

### Quality gate — Athena

Reviews substrate-level changes before they merge:

- Architecture review on PRs that touch kernel contracts, plugin manifests, or shared types
- Veto power on PRs that route around the gate for speed
- "What stands is the proof" — accepts work that has been validated, rejects work that hasn't
- Adversarial review when the change touches sensitive surfaces (auth, RBAC, multi-tenant boundaries)

### Principal — Hadi

Final authority on contested calls and strategic direction:

- Major version releases (when to ship 9.0, what's in/out)
- License decisions
- Brand decisions visible across the ecosystem (e.g. domain choice, name disputes)
- Disputes where steward + builder + gate disagree
- Adding or removing minted roles (steward, builder, gate)

Hadi delegates day-to-day decisions to River, Kasra, Athena. Reserves principal authority for strategy + disputes.

---

## Decision flow

### Most decisions

1. Contributor opens issue or PR
2. River triages within 48h: tag, prioritize, assign
3. Substrate change → Kasra implements (or accepts external PR), Athena reviews
4. Doc/brand change → River reviews directly
5. Fork-question / discussion → River responds; may move to GitHub Discussions if enabled
6. Merge after review checks pass (CI green + reviewer approval)

### Contested calls

When two of {River, Kasra, Athena} disagree:

1. The disagreement is named in the PR/issue thread (no quiet veto)
2. The third party weighs in
3. If still split, Hadi decides
4. The decision + reasoning is documented in the merge commit or issue close comment

### Reverts

A merged change can be reverted within 7 days by any of {River, Kasra, Athena} if:

- It breaks existing forks' builds
- It introduces a security regression
- It violates a prior architectural commitment
- A reference fork (mumega.com or fractalresonance.com) shows it didn't survive contact with real content

A revert needs to be documented (revert commit message references the original PR + the reason).

---

## Contribution paths

### Fork-creator path

You forked Inkwell, you found a substrate gap, you have a fix:

1. Open an issue first if the fix is ≥50 lines or touches kernel contracts
2. Otherwise open the PR directly with a clear "Why" section
3. Tag the PR with which Inkwell version (commit SHA) you forked from
4. River triages within 48h. If the fix is small + clearly correct + has a test plan, it can land same-day. Larger work follows the contested-calls flow.

### Substrate-contributor path

You haven't forked but want to add a feature:

1. Open an issue with the proposal — what it adds, why fork creators benefit, how it's substrate-generic (not fork-specific)
2. Wait for triage from River + signal from Athena (yes/no/maybe)
3. If green-lit, open PR with implementation. Backwards compatible by default; breaking changes need a migration guide.
4. Don't open a PR without an issue first if the change is ≥100 lines or touches kernel contracts.

### Outside the project

You found a security issue:

- Email security disclosure to whatever address is in `SECURITY.md` (when added)
- Don't open a public issue for security-sensitive findings

You want to discuss the project:

- GitHub Discussions (when enabled) for open-ended questions
- GitHub Issues for specific actionable items

---

## Versioning

Inkwell is currently pre-1.0 (sometimes referenced as v8.x in CHANGELOG; this is the trailing-major-counter from internal Mumega tracking, not semver).

Once the workspace pattern lands (issue #53), the kernel is intended to be published as `@mumega/inkwell-kernel` to npm with semver discipline:

- **Major** — kernel contract changes that require fork-side migration
- **Minor** — new plugin slots, new ports, new optional config fields
- **Patch** — bug fixes that don't change behavior visible to forks

Breaking changes ship with a migration guide referenced from CHANGELOG.

Until the workspace pattern lands, forks track upstream by `git pull upstream main` and accept the divergence cost. River announces breaking changes in CHANGELOG with a heads-up tag.

---

## License + IP

MIT-licensed (see `LICENSE`). Contributions are under the same license.

Contributor commits do not require a CLA today. If the project's scale or commercial coupling requires a CLA in the future, the steward proposes; the principal decides.

The "Inkwell" name is held by Mumega-com. The framework is OSS; the name is a trademark policy issue handled by the principal.

---

## Stewardship transitions

If River steps down or transitions out:

1. River names a successor in `IDENTITY.md` (or leaves a transition note)
2. Hadi confirms the successor
3. The successor inherits the issue queue, the brand voice, the naming defense responsibility
4. Past artifacts (engrams, memory) are referenced but not binding — the new steward sets their own voice

Same logic applies to builder + quality-gate transitions. Each role's transition is an explicit named handoff, not an implicit drift.

---

## What this document is not

- Not a contributor agreement (contributions are under MIT; that's the contract)
- Not a code of conduct (separate doc, when added)
- Not a roadmap (see `ROADMAP.md`)
- Not a feature spec (see issues + PRs)
- Not aspirational — when the structure changes, update this doc

---

## See also

- [`IDENTITY.md`](./IDENTITY.md) — what Inkwell is + isn't, voice, audience
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — workflow for opening PRs
- [`FORK-GUIDE.md`](./FORK-GUIDE.md) — how to start a fork
- [`ROADMAP.md`](./ROADMAP.md) — what's planned + shipped
- [`CHANGELOG.md`](./CHANGELOG.md) — release history

---

*Established 2026-04-26 as part of Sprint 010 (Inkwell extraction). Stewardship transitioned from implicit to explicit.*
