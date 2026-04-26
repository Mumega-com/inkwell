# Research-instance starter

Drop-in starter config for forking Inkwell as a scientific CMS. Suitable for:

- Research labs publishing working papers + a corpus
- Theoretical-research sites with multi-volume textbooks
- Scientific glossaries + topic-page Q&A
- Anyone wanting **academic discoverability** (Google Scholar, Dublin Core, hreflang)

## What this gives you

| Feature | Notes |
|---|---|
| `papers` collection | Full academic schema: DOI, opinion-level (L1-L5), supersession lineage, citation export |
| `concepts` collection | Glossary entries with related[] backlinks |
| `inquiries` collection | Multi-lens Q&A pages (the FRC "lens-spectrum" pattern) |
| `books` + `bookChapters` | Long-form publishing with chapter ordering |
| `people` collection | Author profiles with ORCID, affiliations |
| KaTeX math rendering | `$...$` inline + `$$...$$` display, works out of the box |
| Wikilinks + knowledge graph | `[[FRC-100-007]]` auto-resolves to the right collection |
| ScholarMeta | Highwire Press citation tags + Dublin Core + JSON-LD ScholarlyArticle |
| Pagefind search | Static, free, zero server |
| 4-language hreflang | en/es/fa/fr support out of the box |
| MCP tools | AI agent can publish, query corpus, run citation analytics |

## Reference fork

The canonical research instance is [fractalresonance.com](https://github.com/Mumega-com/fractalresonance-com) — FRC's lab. Open it and read these files to understand the pattern:

- `inkwell.config.ts` — config (similar to this starter)
- `src/content.config.ts` — collection schemas (extends `content.config.research.ts`)
- `src/pages/en/papers/[id].astro` — paper page route with ScholarMeta + series prev/next
- `src/pages/en/inquiries/[id].astro` — inquiry page with lens-spectrum cards (will land when FRC migrates topics → inquiries naming)
- `content/en/papers/` — 11 example paper files (FRC 100-series + 566 + 841)
- `content/en/concepts/` — 9 glossary entries

## Quickstart

```bash
# 1. Fork Mumega-com/inkwell on GitHub (or clone)
git clone https://github.com/Mumega-com/inkwell my-lab
cd my-lab && npm install

# 2. Copy this starter config to repo root
cp examples/research-instance/inkwell.config.ts ./inkwell.config.ts

# 3. Edit name, domain, theme, organization in inkwell.config.ts

# 4. Add the research schemas to your content.config.ts:
#    Open src/content.config.ts and add:
#       import { papers, concepts, inquiries, books, bookChapters, people }
#         from './content.config.research'
#    Then update collections export to include them.

# 5. Add your content under content/en/{papers,concepts,inquiries,books,people}/

# 6. Build + deploy
npm run dev      # local
npm run deploy   # Cloudflare Pages
```

## What you should change

- **Name + tagline** — your lab's identity
- **Theme colors** — research register suggests calmer palette (violet / cyan / muted) over commercial brights
- **`seo.organization.knowsAbout`** — seed AI-overview descriptions with your specific framework names + domains
- **`plugins[]`** — add/remove based on what you actually use; default set is research-tuned
- **i18n languages** — drop or add languages

## What you should NOT change (without thinking)

- `reactions: false` — papers don't get hearts; reader-facing engagement on academic content tends to undercut it
- `knowledgeGraph: true` — the citation graph is the lab's organizing structure; turning it off loses backlinks
- `toc: true` — papers + chapters have section structure; readers skim by TOC

## What's still TODO upstream (visible to research forks)

These are gaps I (River, Inkwell steward) hit when building fractalresonance.com tonight. Tracked publicly:

- **Lab plugin pack** (`papers`/`citations`/`submissions`) as installable plugins, not just schemas — Sprint 011
- **Workspace pattern** ([#53](https://github.com/Mumega-com/inkwell/issues/53)) — kernel as published npm package so forks bump cleanly
- **Citation export plugin** — BibTeX / RIS / EndNote download per paper
- **Submission queue + gate** — for forks accepting reader contributions
- **Topic-tabbed UI** — UX rendering of the lens-spectrum as primary navigation (currently lens cards are decoration on a single-voice body — see `EDITORIAL_LENS_SPECTRUM_2026-04-26.md` in the FRC fork's `agents/river/` for the full read)

Pinned commits + bi-weekly upstream pulls is the recommended cadence for a research fork until those gaps close.

## Stewardship

Inkwell's research-instance flavor is custodied by River (also FRC's PM). If your fork hits friction or needs a substrate-generic feature added, [open an issue](https://github.com/Mumega-com/inkwell/issues/new) — the fork-question template surfaces what River triages.

## License

Inkwell is MIT. Your fork can be any license you choose. Citation schemas + ScholarMeta component were authored as part of FRC's onboarding (Sprint 010, 2026-04-26).
