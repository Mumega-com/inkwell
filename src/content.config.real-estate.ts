// Real-estate vertical content collections — opt-in for RE forks.
//
// USAGE — in your fork's `src/content.config.ts`:
//
//   import { listings, neighborhoods } from './content.config.real-estate'
//   export const collections = { blog, team, listings, neighborhoods }
//
// Notes on naming + scope:
//   - `team` (upstream core collection) holds realtor / agent profiles —
//     no separate `agents` collection here, deliberately, to avoid the
//     SOS bus namespace collision (where "agents" means AI agents).
//   - Schema is **MLS-vendor-neutral**. No `RETS_id` / `MLS_id` required;
//     forks integrating with an MLS feed add those as optional fields in
//     a fork-local schema extension.
//   - Status enum uses neutral language (no MLS-coded states).
//
// First commercial-vertical pack. Sets the pattern for future verticals
// (dental, grant, agency, etc.). Each vertical pack ships a content.config
// module + an examples/ starter + a reference fork.
//
// Steward: River. Refs Mumega-com/inkwell #54 (brand extraction), #56
// (research vertical pack — pattern parent). Companion to the `examples/
// real-estate/` starter directory.

import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

// ── Listings ───────────────────────────────────────────────────────────────
//
// Property listings — what the brokerage publishes about a home / lot /
// commercial unit / rental. The `team` collection (upstream core) supplies
// the agent profile; `listing_agent_id` references a `team` entry by its id.
//
// Lifecycle: status enum captures common stages without MLS-coding.
//
// Place files at: `content/<lang>/listings/<slug>.md`

export const listings = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/en/listings' }),
  schema: z.object({
    // Identity
    title: z.string(),
    id: z.string(),
    listing_agent_id: z.string().optional(),         // id of `team` collection entry

    // Address (split fields so search + filtering work)
    address_street: z.string().optional(),
    address_unit: z.string().optional(),
    city: z.string().optional(),
    region: z.string().optional(),                    // state / province / territory
    postal_code: z.string().optional(),
    country: z.string().default('US'),
    neighborhood_id: z.string().optional(),           // refs `neighborhoods` collection
    coordinates: z.object({
      lat: z.number(),
      lng: z.number(),
    }).optional(),

    // Type + lifecycle
    property_type: z.enum([
      'single_family', 'condo', 'townhouse', 'multi_family', 'land',
      'commercial', 'rental', 'other',
    ]).default('single_family'),
    status: z.enum(['active', 'pending', 'sold', 'withdrawn', 'archived']).default('active'),
    transaction_type: z.enum(['sale', 'rental']).default('sale'),

    // Numbers (optional — different property types use different sets)
    price: z.number().optional(),
    price_currency: z.string().default('USD'),
    rent_period: z.enum(['month', 'week', 'day', 'year']).optional(),  // for rentals
    beds: z.number().optional(),
    baths: z.number().optional(),                      // 1.5 baths is allowed
    sqft: z.number().optional(),                       // interior square footage
    lot_sqft: z.number().optional(),                   // lot size if applicable
    year_built: z.number().optional(),
    parking: z.number().optional(),                    // count of spots
    stories: z.number().optional(),
    hoa_fee_monthly: z.number().optional(),

    // Marketing copy
    description: z.string().optional(),
    short_description: z.string().optional(),          // for listing card teaser
    features: z.array(z.string()).default([]),         // free-form: "fireplace", "pool", etc.

    // Media
    cover_image: z.string().optional(),
    gallery: z.array(z.object({
      url: z.string(),
      caption: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    })).default([]),
    virtual_tour_url: z.string().optional(),
    floorplan_url: z.string().optional(),
    video_url: z.string().optional(),

    // Dates
    listed_date: z.coerce.date().optional(),
    last_updated: z.coerce.date().optional(),
    sold_date: z.coerce.date().optional(),
    days_on_market: z.number().optional(),

    // Optional MLS-vendor metadata (forks integrating with an MLS feed
    // populate these; substrate doesn't require them)
    external_ids: z.object({
      mls: z.string().optional(),
      mls_provider: z.string().optional(),
      provider_url: z.string().optional(),
    }).optional(),

    // SEO
    seo: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      keywords: z.array(z.string()).default([]),
    }).optional(),

    // Categorization
    tags: z.array(z.string()).default([]),

    // i18n / UI
    lang: z.string().default('en'),
    weight: z.number().default(5),
  }),
})

// ── Neighborhoods ──────────────────────────────────────────────────────────
//
// Area / neighborhood profiles — content forks publish about the places
// they operate in. Used as: SEO landing pages, market context for listings,
// filterable background for listing search.
//
// Scope: a single named neighborhood, town, or district. For broader
// regions (cities, counties), forks can either use this with a
// `coverage_type: 'city'` field or extend the schema with their own
// hierarchy. For V1 we keep a flat shape — extend if needed.
//
// Place files at: `content/<lang>/neighborhoods/<slug>.md`

export const neighborhoods = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/en/neighborhoods' }),
  schema: z.object({
    // Identity
    title: z.string(),
    id: z.string(),
    name: z.string(),                                  // canonical neighborhood name
    aliases: z.array(z.string()).default([]),          // historical / colloquial names

    // Geography
    city: z.string().optional(),
    region: z.string().optional(),
    country: z.string().default('US'),
    coverage_type: z.enum(['neighborhood', 'town', 'district', 'zip', 'city', 'region']).default('neighborhood'),
    bounds: z.object({                                  // optional bounding box
      north: z.number(),
      south: z.number(),
      east: z.number(),
      west: z.number(),
    }).optional(),
    centroid: z.object({
      lat: z.number(),
      lng: z.number(),
    }).optional(),

    // Market signal (forks update on cadence; values are advisory not authoritative)
    median_price: z.number().optional(),
    median_price_currency: z.string().default('USD'),
    median_price_per_sqft: z.number().optional(),
    market_velocity: z.string().optional(),            // free-form: "fast", "balanced", "slow"
    median_days_on_market: z.number().optional(),
    inventory_count: z.number().optional(),
    last_market_update: z.coerce.date().optional(),

    // Amenities + walkability
    school_rating: z.number().optional(),              // 1-10 scale typical
    transit_score: z.number().optional(),              // 0-100 scale typical
    walk_score: z.number().optional(),
    bike_score: z.number().optional(),
    amenities: z.array(z.string()).default([]),        // free-form: "parks", "transit hub", etc.
    schools: z.array(z.object({
      name: z.string(),
      level: z.enum(['elementary', 'middle', 'high', 'k-12', 'private', 'university']).optional(),
      rating: z.number().optional(),
      url: z.string().optional(),
    })).default([]),

    // Marketing copy
    description: z.string().optional(),
    short_description: z.string().optional(),
    history: z.string().optional(),

    // Media
    cover_image: z.string().optional(),
    gallery: z.array(z.object({
      url: z.string(),
      caption: z.string().optional(),
    })).default([]),

    // Cross-references
    nearby_neighborhoods: z.array(z.string()).default([]),  // refs other neighborhood ids
    representative_listings: z.array(z.string()).default([]),  // refs listing ids

    // SEO
    seo: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      keywords: z.array(z.string()).default([]),
    }).optional(),

    tags: z.array(z.string()).default([]),

    // i18n / UI
    lang: z.string().default('en'),
    weight: z.number().default(5),
  }),
})
