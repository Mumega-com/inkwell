# Generic-instance starter

The canonical "no vertical chosen" option. Pick this when:

- You're forking Inkwell to start a site and don't know yet whether it'll be a research lab, a real-estate brokerage, a dental practice, an agency, or something else
- You explicitly want pure substrate — `blog + team + pages + topics + labs + tools + products` without vertical-specific schemas
- You're building something Inkwell doesn't yet have a vertical pack for, and you want the cleanest base from which to add your own schemas

## What this gives you

The upstream-core 7 content collections, opt-in via the same pack pattern as every other vertical:

| Collection | What it holds |
|---|---|
| `blog` | Standard blog/article publishing |
| `topics` | Trending content aggregator (sources, voices, weekly updates) |
| `labs` | Experimental projects / sandboxes |
| `tools` | Tool/utility profiles |
| `team` | Person profiles (works for any vertical's human-role list) |
| `products` | Product catalog |
| `pages` | Static pages (about, privacy, terms, etc.) |

Plus everything Inkwell ships out of the box:

- KaTeX math rendering (`$inline$` and `$$display$$`)
- Wikilinks + knowledge graph (`[[link-target]]`)
- Pagefind search (static, free)
- Hreflang for multi-language
- MCP server (16+ tools)
- OTP passwordless auth
- Cloudflare Workers backend (free tier handles real load)

## What this does NOT give you

- **No vertical-specific schemas** — that's the point. If you're publishing papers, fork the `examples/research-instance/` starter. If listings, `examples/real-estate/`. Etc.
- **No commerce / contracts / courses by default** — minimal plugin set. Add as you need.

## Quickstart

```bash
# 1. Fork Mumega-com/inkwell on GitHub (or clone)
git clone https://github.com/Mumega-com/inkwell my-site
cd my-site && npm install

# 2. Copy this starter config to repo root
cp examples/generic/inkwell.config.ts ./inkwell.config.ts

# 3. Edit name, domain, theme, organization in inkwell.config.ts

# 4. Either:
#    (a) Use the upstream-core content.config.ts as-is (no import needed) — DEFAULT
#    (b) Or import from the generic pack module for explicitness:
#        Open src/content.config.ts and replace the bottom collections export with:
#          import { blog, topics, labs, tools, team, products, pages }
#            from './content.config.generic'
#          export const collections = { blog, topics, labs, tools, team, products, pages }

# 5. Add your content under content/en/{blog,team,pages,...}/

# 6. Build + deploy
npm run dev      # local
npm run deploy   # Cloudflare Pages
```

## When to switch to a vertical pack

Switch when you find yourself adding the same custom schema fields a vertical pack already provides. Example: you've started writing custom `address`, `price`, `beds`, `baths` fields on your `blog` schema. Stop. That means you're a real-estate fork in disguise. Switch to:

```ts
import { blog, listings, neighborhoods, team, pages }
  from { ... }   // adjust based on which packs you import from
```

Available vertical packs:

| Pack | Use case | Reference fork |
|---|---|---|
| **`generic` (this)** | No vertical / DIY | (none — this IS the pure-substrate option) |
| `research` | Research labs, theoretical-research sites | [fractalresonance.com](https://github.com/Mumega-com/fractalresonance-com) (private; pending public visibility) |
| `real-estate` | Brokerages, agent sites, listings | (Ron O'Neil C21 — pending) |

Future verticals (dental, grants, agency, etc.) follow the same pattern.

## Why this file exists (LOCK-J context)

The signup-flow's vertical picker (`re | research | dental | grants | generic`) needs every option to map to a real artifact on the filesystem. "Generic" can't be a fallback for "we ran out of presets" — it must be a substrate-real choice with the same shape as research / real-estate / etc. This README + the `inkwell.config.ts` next to it + `src/content.config.generic.ts` are that artifact.

This is **LOCK-I** in S012 brief — generic vertical pack as canonical option, not a special case. **LOCK-J** says filesystem IS the pack registry; this file is what the picker reads.

## What's substrate-purity-preserved here

Per **LOCK-K**, this generic pack must not introduce vertical-specific behavior. It doesn't:

- No vendor-coded states or required external IDs
- No brand-specific terminology (no "Realtor®", no "PhD", no "DDS")
- No namespace collisions (no `agents` collection — that's reserved for AI agents)
- No required fields that lock fork creators into a specific operational mode

If you're a fork creator and you find yourself wishing the generic pack had X, X is probably either a vertical pack feature (open an issue tagged `vertical-pack-suggestion`) or a substrate addition (open an issue tagged `enhancement`).

## License

Inkwell is MIT. Your fork can be any license.
