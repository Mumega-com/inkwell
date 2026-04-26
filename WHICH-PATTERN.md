# Which pattern? — fork vs instance

Inkwell ships with two coexisting patterns for spinning up a new site. New users hit them both and don't know which is canonical. This doc disambiguates.

## TL;DR

**Use the fork pattern.** It's the working production pattern. Both reference forks (mumega.com, fractalresonance.com) use it. The instance pattern is partially-implemented and may be removed or reshaped — see Sprint 011 for the substrate-pattern decision.

## Fork pattern (recommended)

Each site is its own git repo that tracks `Mumega-com/inkwell` as `upstream`.

```
your-site/                       (your repo: e.g. github.com/you/your-site)
├── inkwell.config.ts            (your config — name, domain, theme, plugins)
├── content/                     (your content)
├── src/                         (your customizations — Header, Footer, routes)
├── package.json                 (depends on @astrojs/* etc; tracks Inkwell version via git)
└── workers/inkwell-api/         (your CF Worker config — DBs, KV, secrets)

remotes:
  origin    → github.com/you/your-site (your fork)
  upstream  → github.com/Mumega-com/inkwell (the substrate)
```

**Update flow:** `git fetch upstream && git merge upstream/main` (or `git pull upstream main`). You accept the merge cost.

**When to use:** You're running a single site. You want full control over content, routes, and customization. You're OK with kernel and presentation living in the same tree (acknowledged tradeoff per [#53](https://github.com/Mumega-com/inkwell/issues/53)).

**Reference forks:**
- `Mumega-com/mumega-com` — operations platform (multi-tenant, dashboard-heavy)
- `Mumega-com/fractalresonance-com` — research lab (papers, concepts, math, citations)

**Documentation:** see [FORK-GUIDE.md](./FORK-GUIDE.md).

## Instance pattern (status: partial)

A single Inkwell deploy serves many tenant sub-sites. Tenants are configured under `instances/<slug>/` and discovered by subdomain at request time.

**Current status:** the multi-tenant ingress mechanism exists in the substrate (see `workers/inkwell-api/src/middleware/tenant.ts`). However:

- The init flow documented in `instances/_template/README.md` references a `sos init` command that has no implementation today (tracked as #49 P-001).
- The `instances/` directory in the current upstream tree contains specific tenants (the `instances/components/`, `instances/content/`, etc.) rather than the `_template/` + `<slug>/` shape it once had.

The pattern is in flux. Do not start a new project from the instance pattern in 2026-Q2 unless you're contributing to its implementation.

## Why both exist

Historically: Inkwell started as a fork-friendly substrate for a single site. As it grew to host multiple tenant sites under Mumega's operation, the multi-tenant infrastructure was added to allow one Inkwell deploy to serve many subdomains. The `instances/` directory captured per-tenant overrides.

In practice: forks scaled better than instances. Most users want their own repo. Multi-tenant remained useful for Mumega's specific operational pattern (one CF account hosts many subdomain-routed customer sites) but didn't generalize cleanly.

The pattern decision is a Sprint 011 substrate question (see #53). For now: fork. If you specifically need multi-tenant subdomain routing on a single deploy, file an issue describing your use case and we'll work out the path.

## How they relate

The fork pattern doesn't preclude future multi-tenant. A fork can adopt the multi-tenant middleware later if needed. The instance pattern's hard requirement (single deploy, tenant-aware request routing) is something the fork pattern grows into rather than starts with.

## See also

- [FORK-GUIDE.md](./FORK-GUIDE.md) — fork pattern setup
- [GOVERNANCE.md](./GOVERNANCE.md) — who decides what
- [#49](https://github.com/Mumega-com/inkwell/issues/49) — forkability audit (P-005 disambiguation: this doc)
- [#53](https://github.com/Mumega-com/inkwell/issues/53) — workspace pattern + substrate-pattern decision
