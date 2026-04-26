# Contributing to Inkwell

Thanks for considering a contribution. Inkwell is a config-driven, fork-first content framework — built on Astro, deployed to Cloudflare. This guide is for two kinds of people. Pick the path that matches.

---

## Two paths in

### 1. You forked Inkwell and hit a substrate gap

You're running your own Inkwell-powered site (research lab, agency, blog, docs hub). You found something that should work upstream but doesn't — a hardcoded path, a missing config knob, a plugin that assumes mumega.com's specifics. Open an issue or PR; we want the upstream to absorb that pressure.

Typical fork-creator contributions:
- "This component takes a brand prop but renders `Mumega` if the prop is missing" → make the default driven by config
- "I had to copy `remark-wikilinks.ts` and add `resolveLink` to my fork" → upstream the hook
- "Plugin X assumes a `papers/` collection but I have `articles/`" → make the collection name configurable

### 2. You haven't forked, but you want to PR a substrate fix

You read the code, found something off, want to fix it. Welcome. Same workflow as path 1; just skip the "in my fork" framing.

---

## Before you open a PR

Read these, in order:

1. **`IDENTITY.md`** — who stewards this repo and how decisions get made (added in PR #54 / brand-extraction work; will land on main shortly)
2. **`GOVERNANCE.md`** — full decision-making structure, escalation paths, mint/seal of major changes
3. **Open issues** — see if it's already tracked. Especially:
   - [#49 — forkability audit](https://github.com/Mumega-com/inkwell/issues/49) (where mumega-coupling lives)
   - [#53 — workspace pattern](https://github.com/Mumega-com/inkwell/issues/53) (slot-based Header/Footer/Base)
4. **This file (CONTRIBUTING.md)** — workflow + acceptance criteria
5. **`README.md`** — project overview
6. **`ROADMAP.md`** — what's planned, what's in flight

---

## What we accept

### Substrate-generic improvements (yes, please)
- Removing hardcoded `mumega.com` / `Mumega` references from substrate code
- Making collection names, paths, and component props configurable via `inkwell.config.ts`
- Adding hooks (`resolveLink`, `transformFrontmatter`, etc.) that fork-creators have copy-pasted into their forks
- New schema types in `src/lib/seo.ts` (JSON-LD)
- Bug fixes with a failing test that now passes
- Plugin gaps that any research/content/agency fork would hit

### Workspace-pattern phases (#53)
We're moving toward a setup where forks override `Header.astro` / `Footer.astro` / `Base.astro` via slots and config, not by patching the substrate. PRs that move us along that gradient are welcome — coordinate with River first so phases land coherently.

### Mumega-decoupling (#49)
The audit issue tracks every place mumega-the-business has leaked into Inkwell-the-framework. Each item is a candidate PR.

### What we don't accept (yet)
- **Mumega-specific features** — those live in `instances/mumega/` or downstream forks
- **Breaking changes without discussion** — open an issue first, get steward sign-off
- **Style/format-only churn** — Prettier handles this
- **Vendor dependencies** without a clear case (we keep the dep tree small)
- **Ideology rewrites** of CLAUDE.md, README.md, IDENTITY.md without prior conversation

---

## Workflow

1. **Branch off `main`** — name it descriptively: `fix/wikilink-undefined-slug`, `feat/scholar-meta-affiliations`, `docs/governance-clarify-mint-path`
2. **One purpose per PR** — small is reviewable; mega-PRs get sent back
3. **Keep diffs under ~500 lines** — if you must go bigger, split it
4. **Run the build locally** — `npm install && npm run build` from the repo root
5. **Write a Test plan** in the PR body — even one line ("ran `npm run build`, no new errors") is fine for docs PRs; substrate changes need real coverage
6. **Conventional commit prefix** in title: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
7. **Open the PR** against `main` with the issue number in the description if one exists

### Commit messages

```
feat(seo): add ScholarMeta JSON-LD type for academic papers

Closes #51.
```

```
fix(wikilinks): pass resolveLink hook to remark plugin

Currently remark-wikilinks.ts hardcodes /posts/<slug>; forks need to
override per collection. Adds an optional `resolveLink(target, ctx)` hook
to the plugin options.

Closes #50.
```

---

## Review SLA

- **River** — repo steward, triages new issues + PRs within 48h on weekdays. Sets `accepted` / `needs-revision` / `out-of-scope` labels.
- **Athena** — quality gate for substrate changes (the kernel/, plugin contracts, schema changes). Her gate runs before merge for anything that touches structural surface area.
- **Kasra** — implements upstream substrate fixes when they need a builder. PRs from external contributors don't need to wait for Kasra; he's a parallel resource.
- **Hadi** — final word on contested architectural calls. River escalates to him when stewardship + quality gate disagree.

If a PR sits idle for more than a week without a label or comment, ping River on the PR thread.

---

## Stewardship structure (quick reference)

| Role | Who | Scope |
|------|-----|-------|
| Steward | River | Triage, merge, roadmap, fork support |
| Quality gate | Athena | Structural correctness, contract review |
| Builder | Kasra | Substrate implementation |
| Principal | Hadi | Architectural disputes, releases |

Full detail (mint paths, sealing artifacts, escalation under conflict) lives in `GOVERNANCE.md`.

---

## Repo orientation (where things live)

- `kernel/` — contracts the framework guarantees (don't break without discussion)
- `plugins/` — verticals that ship in the substrate (papers, citations, topic, etc.)
- `workers/inkwell-api/` — Cloudflare Worker for views, reactions, subscribe
- `src/` — Astro components, layouts, library code (theme, SEO, content schema)
- `scripts/` — build helpers, ingest, OG generation, migration tools
- `instances/` — mumega's own deployment; **do not edit from a substrate PR** (see #49)
- `content/` — markdown content for the mumega.com instance; not the framework

---

## Code style

- TypeScript strict mode; no `any` without a comment
- Prettier + ESLint run on save (config in repo root)
- Astro components for server-rendered, React islands for interactive (`client:visible` lazy, `client:load` immediate)
- Tailwind for styling; no inline styles unless dynamic
- Theme via `var(--ink-*)` CSS custom properties, never hardcoded colors

---

## Reporting bugs / asking for help

- **Bug?** Use `.github/ISSUE_TEMPLATE/bug_report.md`
- **Feature idea?** Use `.github/ISSUE_TEMPLATE/feature_request.md`
- **Stuck on your fork?** Use `.github/ISSUE_TEMPLATE/fork_question.md` — or post in GitHub Discussions if/when enabled

---

## Credit

Contributions are credited in commit history and (for substantive work) in release notes. Substrate-generic PRs that fix a fork-creator pain point are especially welcome — those compound for everyone downstream.

— River, steward
