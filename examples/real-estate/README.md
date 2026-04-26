# Real-estate-instance starter

Drop-in starter config for forking Inkwell as a real-estate site. Suitable for:

- Brokerages with multi-agent teams + neighborhood landing pages
- Solo agents wanting a personal-brand site with listings + market reads
- Multi-office franchises (10+ offices on one Inkwell deploy via multi-tenant)
- Real-estate-adjacent content sites (market analysis, buyer education, off-MLS pocket listings)

## What this gives you

| Feature | Notes |
|---|---|
| `listings` collection | Full property schema: address, price, beds/baths/sqft, photos gallery, virtual tour, status enum (active/pending/sold/withdrawn/archived), MLS-vendor-neutral |
| `neighborhoods` collection | Area profiles: bounds, median price, school ratings, walk/transit scores, market velocity |
| Agent profiles | Use the upstream-core `team` collection (NOT a separate `agents` collection — namespace reserved for AI agents in the SOS bus) |
| RealEstateListing JSON-LD | schema.org's RE schemas surface in Google's rich-listing rich results |
| Wikilinks | `[[neighborhood-name]]` from a listing auto-resolves to the neighborhood page |
| Knowledge graph | Neighborhoods backlink to all listings inside them; listings show "more in this area" |
| Pagefind search | Static, free, fast; searches across listings + neighborhoods + blog |
| MCP tools | AI agent can publish listings, generate descriptions, schedule tours, send buyer alerts |
| Media plugin | Photo galleries with AI vision tagging (auto-extract "kitchen with island", "south-facing windows") |
| Contracts plugin | E-sign listing agreements, offer letters, buyer-rep agreements via SMS/email |
| Discovery plugin | Buyer-lead capture forms — "request showing" / "contact agent" / "save search" |

## What this is NOT

- **Not an MLS integration** — Inkwell is the substrate; MLS integration is a fork-specific concern. The schema includes optional `external_ids.mls` / `external_ids.mls_provider` fields so forks integrating with an MLS feed can populate them, but the substrate doesn't require an MLS connection. Run a clean off-MLS site or build your own MLS adapter.
- **Not a CRM** — for buyer/seller pipeline tracking, use Inkwell's `crm` plugin (or a hosted CRM like HubSpot via the `crm` adapter port).
- **Not a transaction-management platform** — for offer-to-close workflows, use a dedicated tool (DotLoop, SkySlope, etc.) and integrate via the contracts plugin's webhook hooks.
- **Not an MLS-replacement** — listings on your Inkwell site complement your MLS presence; they don't replace MLS (which has its own legal + cooperative-compensation rules).

## Quickstart

```bash
# 1. Fork Mumega-com/inkwell on GitHub (or clone)
git clone https://github.com/Mumega-com/inkwell my-brokerage
cd my-brokerage && npm install

# 2. Copy this starter config to repo root
cp examples/real-estate/inkwell.config.ts ./inkwell.config.ts

# 3. Edit name, domain, theme, organization in inkwell.config.ts

# 4. Add the RE schemas to your content.config.ts:
#    Open src/content.config.ts and add:
#       import { listings, neighborhoods }
#         from './content.config.real-estate'
#    Then update collections export to include them.

# 5. Add your content under content/en/{listings,neighborhoods,team}/

# 6. Build + deploy
npm run dev      # local
npm run deploy   # Cloudflare Pages
```

## Sample listing markdown

`content/en/listings/123-main-street-portland.md`:

```yaml
---
title: "123 Main Street — Sunlit 3BR with River View"
id: 123-main-street-portland
listing_agent_id: jane-smith    # refs content/en/team/jane-smith.md

address_street: "123 Main Street"
city: "Portland"
region: "OR"
postal_code: "97205"
country: "US"
neighborhood_id: pearl-district  # refs content/en/neighborhoods/pearl-district.md
coordinates: { lat: 45.5236, lng: -122.6750 }

property_type: single_family
status: active
transaction_type: sale

price: 875000
beds: 3
baths: 2.5
sqft: 1850
year_built: 2018
parking: 2

description: |
  South-facing windows along the entire main floor. Quartz counters in
  kitchen, white-oak floors throughout. Two blocks from the river trail.

short_description: "Bright, modern 3BR in the Pearl with kitchen island + river-trail proximity."
features: ["fireplace", "hardwood floors", "garage", "open kitchen"]

cover_image: "/listings/123-main-cover.jpg"
gallery:
  - { url: "/listings/123-main-1.jpg", caption: "Living room with south-facing windows" }
  - { url: "/listings/123-main-2.jpg", caption: "Kitchen with quartz island" }
  - { url: "/listings/123-main-3.jpg", caption: "Primary bedroom" }
virtual_tour_url: "https://my.matterport.com/show/?m=ABC123"

listed_date: 2026-04-26
days_on_market: 3

seo:
  title: "3BR Pearl District Home for Sale | $875K"
  description: "Sunlit 3-bed, 2.5-bath in Portland's Pearl District. River trail access, modern kitchen. Listed by Jane Smith."

tags: ["portland", "pearl-district", "3-bedroom"]
---

## About this home

[Full listing description in markdown body. Use [[pearl-district]] to
auto-link to the neighborhood page. Use [[jane-smith]] to link to the
agent's profile.]
```

## Sample neighborhood markdown

`content/en/neighborhoods/pearl-district.md`:

```yaml
---
title: "Pearl District — Portland, OR"
id: pearl-district
name: "Pearl District"
city: "Portland"
region: "OR"
country: "US"
coverage_type: neighborhood
centroid: { lat: 45.5283, lng: -122.6841 }

median_price: 750000
median_price_per_sqft: 525
market_velocity: "balanced"
median_days_on_market: 28
inventory_count: 47
last_market_update: 2026-04-20

walk_score: 96
transit_score: 78
amenities: ["transit hub", "art galleries", "restaurants", "parks"]

description: |
  Once a warehouse district, the Pearl is now Portland's most walkable
  urban neighborhood — converted lofts above ground-floor cafes,
  galleries, and the Saturday farmers' market.
short_description: "Portland's most walkable urban district — converted lofts, galleries, and easy transit."

cover_image: "/neighborhoods/pearl-district-cover.jpg"

representative_listings:
  - 123-main-street-portland

tags: ["portland", "urban", "walkable"]
---

## Living in the Pearl

[Long-form neighborhood guide in markdown body. Cross-reference [[123-main-street-portland]]
or other listings; reference adjacent neighborhoods like [[old-town]].]
```

## What you should change

- **Brand colors** — RE sites typically default to a trust-blue or warm-neutral palette; the starter primary is a placeholder
- **`seo.organization.knowsAbout`** — list your service areas + specialties (e.g., "Portland luxury homes", "first-time buyers", "1031 exchanges")
- **`plugins[]`** — add/remove based on your office's actual workflow
- **Default-light theme** (`darkFirst: false`) — RE sites usually light-first; keep this unless your brand is dark-first

## Compliance notes (substrate doesn't enforce; your fork handles)

- **Fair Housing** — the substrate doesn't include automated FH compliance checks. Your fork should integrate listing-text-review (a simple regex pass against the [HUD Fair Housing Act prohibited language list](https://www.hud.gov/sites/dfiles/PA/documents/HUD_OFHEO508c.pdf) is a starting point).
- **MLS rules** — if you're an IDX licensee, your MLS will have specific rules about what listing data you can display, attribution requirements, and refresh cadences. Substrate is MLS-neutral; your fork's MLS adapter handles compliance.
- **Disclosure requirements** — vary by state/province. Substrate doesn't generate disclosures; your fork's `contracts` plugin templates handle them.

## What's still TODO upstream (visible to RE forks)

These are gaps the substrate hasn't closed yet:

- **MLS adapter port** — there's no `MLSPort` in the hexagonal port set today. Forks integrating with RETS / RESO / regional MLS feeds build their own adapter against `ContentSourcePort`. Steward-track issue.
- **RealEstateListing JSON-LD generator** — schema.org's `RealEstate` types aren't yet wired into Inkwell's JSON-LD library. Forks emit their own `<script type="application/ld+json">` blocks for now. Will land in a follow-up substrate PR.
- **Showing-scheduler MCP tool** — the `schedule_tour` MCP tool is a candidate for the next plugin pack release (`@mumega/inkwell-real-estate` package, when workspace pattern lands).
- **Map clustering** — listings + neighborhoods carry coordinates; substrate doesn't ship a map widget. Forks integrate Leaflet/Mapbox/Google Maps client-side.

## Stewardship

Inkwell's real-estate flavor is the **first commercial-vertical pack**. Steward's stamp is on the schema decisions (vendor-neutral, namespace-safe, agent-vs-AI-agent disambiguation). If your fork hits friction, [open an issue](https://github.com/Mumega-com/inkwell/issues/new) — the fork-question template surfaces what River triages.

Future verticals (dental, grants, agency, etc.) will mirror this pack's pattern: separate `content.config.<vertical>.ts` module, `examples/<vertical>/` starter, named first-class as a vertical pack.

## License

Inkwell is MIT. Your fork can be any license you choose. RE schemas + this starter were authored as part of Sprint 010 (2026-04-26) for the Ron O'Neil C21 demo. First commercial-vertical pack establishes the pattern.
