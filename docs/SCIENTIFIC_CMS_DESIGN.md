# Scientific CMS — design rationale

**Author:** River (Inkwell steward, FRC PM)
**Date:** 2026-04-26
**Status:** Design record. Reviewed periodically; updated when architecture shifts.

---

## Thesis

Inkwell is positioned to be the open-source default for scientific content management — research labs, theoretical-research sites, working-paper publishers, multi-volume corpora — because the substrate composition (Astro SSG + Cloudflare edge + microkernel + plugins + MCP) hits a set of constraints that mainstream CMS choices miss.

This document records why that composition is fit for scientific use, what's required to actually deliver, and what's not in scope.

---

## Constraints a scientific CMS must satisfy

Drawing from the real onboarding of fractalresonance.com onto Inkwell (139 content units across papers / concepts / inquiries / books / people, 11 published DOIs, 4-language hreflang, lens-spectrum Q&A format) — these are the constraints encountered:

### 1. AI-readable canonical URLs

Search engines and AI agents (RAG ingesters, vector-DB embedders, coordinator agents) read the canonical paper URL as the source of truth. If the body is JS-hydrated client-side, agents see metadata only. Mirror, OpenAlex, Google Scholar all require server-rendered content.

→ **Inkwell's answer:** Astro SSG. `npm run build` produces static HTML with paper bodies baked in. No client JS required to render content. Verified on FRC fork: 126 KB of fully-rendered HTML per paper, 34+ `<p>` tags including substantive prose.

### 2. Versioned papers with supersession lineage

Research artifacts evolve. A v3 paper supersedes a v1; readers who land on v1 should see the supersession + a link forward. Citation graphs must track which version was cited.

→ **Inkwell's answer:** `papers` collection schema with `version`, `status: draft|preprint|published|superseded`, `supersedesId`, `supersededById`. Stored in the markdown frontmatter, queryable at build time.

### 3. Citation-aware backlinks

A paper that cites another paper should be reachable from the cited paper. Concepts mentioned across the corpus should aggregate. Topic pages should link to relevant papers.

→ **Inkwell's answer:** the `[[wikilinks]]` syntax (remark plugin in `src/lib/remark-wikilinks.ts`) auto-builds a graph. The `resolveLink` option (PR #50) routes links to the right collection (`papers`, `concepts`, `inquiries`) instead of hardcoding `/blog/`. The knowledge graph is queryable via the MCP server.

### 4. Math rendering — server-side, no JS dependency

Equations must render at build time so AI agents read them; client-side LaTeX rendering excludes non-browser readers.

→ **Inkwell's answer:** KaTeX wired in `astro.config.mjs` via `remarkMath` + `rehypeKatex`. `$inline$` and `$$display$$` syntax. HTML output includes both visual rendering and MathML semantics.

### 5. Academic discoverability metadata

Google Scholar reads `citation_*` Highwire Press tags. Other indexers read Dublin Core. JSON-LD `ScholarlyArticle` is the schema.org canonical. Without these, the corpus is invisible to academic search.

→ **Inkwell's answer:** the `ScholarMeta` component (PR #51). Drop-in `<ScholarMeta paper={fm} canonicalUrl={...} />` emits 12+ citation_* tags + 10+ DC.* tags + JSON-LD ScholarlyArticle with author, datePublished, identifier (DOI), sameAs, isPartOf.

### 6. Multi-perspective content (the lens-spectrum)

Some research questions earn multiple seriously-held answers, not consensus. A topic page that collapses perspectives into a single voice loses the productive disagreement. Format must hold multiple lenses without collapsing.

→ **Inkwell's answer:** the `inquiries` collection schema (added today). Each entry has `question`, `short_answer`, `authorities[]` (external citations), and `answers[]` — array of perspectives, each with `lens`, `by`, `role`, `stance`, `answer`. The lens vocabulary is open; forks define their own.

(Caveat: as of 2026-04-26 the FRC fork's existing topics use this schema but the *content* doesn't yet fill it — the body is single-voice, the chips are decoration. Format-vs-content tension is real and acknowledged in `EDITORIAL_LENS_SPECTRUM_2026-04-26.md`. Substrate is sound; content layer needs density work.)

### 7. URL preservation across cutover

Migrating from a legacy stack must preserve indexed URLs to avoid SEO regression. Every URL Google has crawled must continue to resolve at the same path.

→ **Inkwell's answer:** Astro's i18n routing supports `/{lang}/...` shape natively. The wikilink resolver respects the lang prefix. Sitemap.xml emits hreflang alternates for all configured languages. The fractalresonance-com fork preserves 100% of indexed URLs from the legacy Next.js site.

### 8. Tier-gated content

Working papers, members-only annotations, embargoed deposits — research labs need granular RBAC.

→ **Inkwell's answer:** RBAC hierarchy (`owner > admin > manager > member > viewer`) at the kernel layer. The `auth` plugin handles passwordless OTP. The `tier-gate` middleware exists in `workers/inkwell-api/src/middleware/`. Granular per-content-tier access is implementable via the existing primitives.

### 9. Multi-language with x-default

Research corpora often serve multiple languages. The default language declaration affects how Google indexes alternates.

→ **Inkwell's answer:** built-in i18n config (`defaultLang`, `languages`, `rtl`). Per-page hreflang emission in `Base.astro`. RTL awareness for `fa` / `ar`. Sitemap-level x-default pointing at default lang.

### 10. Submission gating + reader contributions

Citations, comments, peer notes, working-paper submissions — research instances need a moderated input surface.

→ **Inkwell's answer:** *partial.* The `feedback` plugin handles reader feedback. The `discovery` plugin handles lead capture. A dedicated `submissions` plugin with reviewer queue is named in the lab plugin pack roadmap but not yet built. Forks needing this today implement it locally.

---

## What "scientific CMS" composes from

From the substrate primitives:

| Substrate primitive | Scientific CMS use |
|---|---|
| Microkernel + plugins | Lab plugin pack (papers / citations / topics / submissions) loads as additive |
| Astro 6 SSG | AI-readable canonical URLs; content baked into HTML at build |
| Cloudflare Workers | Edge-deployed paper API + MCP server; free-tier handles real research-site load |
| D1 + KV + R2 | Citation graph (D1), session/cache (KV), media + figures (R2) |
| Hexagonal ports | Swap D1 for Postgres if the citation graph outgrows D1; swap KV for Redis |
| `[[wikilinks]]` + knowledge graph | Citation backlinks, related-papers, concept-paper cross-refs |
| KaTeX + remark/rehype | Display + inline math, server-rendered |
| `inkwell.config.ts` | Per-fork theme + plugin set + i18n + SEO without code changes |
| MCP server (16+ tools) | AI agents publish, query corpus, run citation analytics |
| `papers` / `concepts` / `inquiries` / `books` schemas | Content-collection types matched to research artifacts |
| `ScholarMeta` component | Academic indexing surface (Scholar + DC + JSON-LD) |
| Hreflang + sitemap | Multi-language discoverability |
| `NotConfigured` component | Graceful degradation when fork hasn't filled all routes |

The composition isn't novel in any single piece — Astro is mainstream, Cloudflare is mainstream, Zod schemas are mainstream — but the *combination tuned for research* doesn't exist as a coherent open-source default elsewhere.

---

## What's adjacent vs what we're not

| Tool | Where it sits |
|---|---|
| Quarto | Document-rendering tool. Generates static sites from .qmd. Not multi-tenant, not edge-deployed, not agent-operable. |
| Distill (Pub) | Article-publishing template. Limited collection support, no citation graph, no MCP. |
| Manubot | Markdown-to-paper workflow. Output is one paper per repo. Not a CMS. |
| OJS (Open Journal Systems) | Full journal management. Heavy, PHP/MySQL, not edge-native, monolithic. |
| Strapi / Payload | Headless CMS. Generic. Forks must build their own scientific schemas. |
| WordPress + plugins | Mainstream. Plugin jungle, not microkernel. RBAC is bolt-on. |

Inkwell's positioning: **lighter than OJS, more research-aware than Strapi, more multi-tenant than Quarto, more agent-operable than any of them.** The combination is the bet.

We are NOT trying to be:

- A submission-and-review platform (OJS's territory; we provide the inputs but not the workflow)
- A typesetting tool (Pandoc + LaTeX still own that)
- A monolithic publication platform (medium / substack — those are SaaS, we are substrate)
- A peer-reviewed journal management system (different operational complexity)

---

## Substrate gaps (today's known problems)

Not all of the above is solved at substrate level. Honest inventory:

- **Workspace pattern (#53)** — kernel + plugins ship in same tree as fork customizations. Forks diverge over time. Sprint 011 substrate decision required.
- **Slot-based layouts** — Header / Footer / Base aren't slot-extensible yet. Forks copy-paste and override. Phase 1 of #53.
- **Lab plugin pack v.1** — `papers` / `citations` / `topics` are content-collection schemas (added today, opt-in via `content.config.research.ts`); the matching plugins (page routes, MCP tools, citation export) aren't installable plugins yet. Forks implement locally.
- **Submission queue + gate** — partial via `feedback` + `discovery` plugins; no dedicated reviewer-flow plugin.
- **Citation export plugin** — no BibTeX / RIS / EndNote download today.
- **Topic-tabbed UI** — the lens-spectrum content needs primary-navigation UX, not just chips at the end of a body. Editorial finding from `EDITORIAL_LENS_SPECTRUM_2026-04-26.md`.
- **Fork-creator visible Plausible/GA wiring** — analytics plugin works but the SEO autopilot's research-relevant signals (paper view, citation click, search-term-to-paper attribution) need a research-flavored dashboard.

Each of these is a tracked issue or named in a roadmap doc; none is a permanent blocker.

---

## How a research fork creator gets started today

```bash
# 1. Fork
git clone https://github.com/Mumega-com/inkwell my-lab
cd my-lab && npm install

# 2. Adopt research starter
cp examples/research-instance/inkwell.config.ts ./inkwell.config.ts
# edit name, domain, theme, organization, knowsAbout

# 3. Add research schemas
# In src/content.config.ts:
import { papers, concepts, inquiries, books, bookChapters, people }
  from './content.config.research'
export const collections = { blog, papers, concepts, inquiries, books, bookChapters, people }

# 4. Add content
mkdir -p content/en/papers content/en/concepts content/en/inquiries
# write your first paper at content/en/papers/your-paper.md

# 5. (Optional) wire ScholarMeta into your paper page route
# See src/pages/papers/[id].astro pattern in fractalresonance-com fork

# 6. Build + deploy
npm run dev      # local preview
npm run deploy   # Cloudflare Pages
```

The fractalresonance-com fork is the canonical reference. Read its commits in chronological order to see the migration arc.

---

## What changes when the workspace pattern lands (Sprint 011+)

The `@mumega/inkwell-kernel` package + slot-based layouts will reduce the per-fork divergence cost. Specifically:

- Forks won't need to copy-paste-override `Header.astro` / `Footer.astro` / `Base.astro` — they'll compose against slots.
- `npm update @mumega/inkwell-kernel` replaces `git pull upstream main`. Semver discipline does the work git was doing badly.
- The lab plugin pack ships as `@mumega/inkwell-research` — installable, versioned, optional.
- Forks become *thin* — config, content, plugins-local, layout overrides. Most lines of code in a research fork will be the content itself.

This is the long arc. Today's research-instance forks operate on the pre-workspace pattern (`git pull upstream`) and accept the divergence cost.

---

## Stewardship notes

The scientific-CMS framing belongs to the steward (River). Implementation belongs to the builder (Kasra). Architecture review on substrate changes belongs to the quality gate (Athena). Strategic calls (when to release a major version, when to publish the kernel package) belong to the principal (Hadi). See `GOVERNANCE.md`.

The framing in this doc isn't aspirational — it reflects what's been *built and verified* on the FRC fork tonight. The gaps named above are honest. When a gap closes, the corresponding section in this doc updates.

---

## See also

- [`IDENTITY.md`](../IDENTITY.md) — what Inkwell is + voice + audience
- [`GOVERNANCE.md`](../GOVERNANCE.md) — decision flow + roles
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — how to PR
- [`ROADMAP.md`](../ROADMAP.md) — what's planned + shipped
- [`examples/research-instance/`](../examples/research-instance/) — research-fork starter
- [`src/content.config.research.ts`](../src/content.config.research.ts) — opt-in research schemas
- [#49](https://github.com/Mumega-com/inkwell/issues/49) — forkability audit
- [#53](https://github.com/Mumega-com/inkwell/issues/53) — workspace pattern proposal
- [`Mumega-com/fractalresonance-com`](https://github.com/Mumega-com/fractalresonance-com) — reference research fork

---

*River, 2026-04-26. Authored during the 2-hour autonomous push that established the scientific CMS layer. Updated when the architecture shifts.*
