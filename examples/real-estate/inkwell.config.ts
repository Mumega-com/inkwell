// Real-estate-instance Inkwell config — for forks running a brokerage,
// agent team site, or single-agent personal site.
//
// Copy this file to your fork's root as `inkwell.config.ts` and customize.
// Pair with `src/content.config.real-estate.ts` (substrate-provided opt-in
// schemas) by importing in your `src/content.config.ts`:
//
//   import { listings, neighborhoods } from './content.config.real-estate'
//   export const collections = { blog, team, listings, neighborhoods }
//
// Note: agent profiles use the upstream-core `team` collection (NOT a
// separate `agents` collection — `agents` is reserved for AI agents in the
// SOS bus namespace).
//
// Reference fork: pending — first published RE fork (Ron O'Neil's brokerage,
// 10-office C21 distribution) lands in late April 2026.
//
// What changes from the default config:
//   - `theme.colors.primary` set to a property-listing-friendly accent
//   - `commerce` removed (RE transactions go through agents/contracts, not
//     direct ecommerce)
//   - `contracts` plugin kept (e-sign for listing agreements, offers)
//   - `discovery` plugin tuned for buyer-lead capture
//   - `media` plugin essential for listing galleries
//   - `seo` plugin essential for neighborhood landing pages

export const config = {
  name: 'Your Brokerage Name',
  domain: 'your-brokerage.example',
  tagline: 'Local listings. Honest market reads.',  // your framing here

  theme: {
    colors: {
      primary: '#1A4D8C',     // approachable trust-blue (placeholder — change per brand)
      secondary: '#06B6D4',
      accent: '#10B981',      // for "active" listing badges
      danger: '#EF4444',      // for price reductions, withdrawals
      bg:      { dark: '#0A0F1A', light: '#FAFBFC' },
      surface: { dark: '#15191F', light: '#FFFFFF' },
      text:    { dark: '#EDEDF0', light: '#1A1D23' },
      muted:   { dark: 'rgba(255,255,255,0.55)', light: 'rgba(0,0,0,0.55)' },
      dim:     { dark: 'rgba(255,255,255,0.35)', light: 'rgba(0,0,0,0.35)' },
      border:  { dark: 'rgba(255,255,255,0.10)', light: 'rgba(0,0,0,0.10)' },
    },
    fonts: {
      display: "'Inter', system-ui, -apple-system, sans-serif",
      body: "'Inter', system-ui, -apple-system, sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
    radius: '6px',
    contentWidth: '760px',
    pageWidth: '1280px',
    darkFirst: false,           // RE sites typically light-first; flip if your brand is dark
  },

  i18n: {
    defaultLang: 'en' as const,
    languages: ['en'] as const,
    rtl: ['fa', 'ar'] as const,
    fallback: 'en' as const,
  },

  features: {
    reactions: false,
    newsletter: true,           // open-house digests, market updates
    readingProgress: false,     // listings + neighborhoods aren't long-form
    toc: false,
    shareButtons: true,         // listings get shared
    commandPalette: true,
    knowledgeGraph: true,       // neighborhoods <-> listings cross-references
    rss: true,                  // new-listing feed for buyers' aggregators
    search: true,               // Pagefind across listings + neighborhoods + blog
    darkModeToggle: true,
  },

  analytics: {
    googleAnalytics: '',
    clarity: '',
    hotjar: '',
    tagManager: '',
    plausible: '',
  },

  seo: {
    organization: {
      name: 'Your Brokerage Name',
      url: 'https://your-brokerage.example',
      logo: '/logo.svg',
      knowsAbout: [
        // Seed AI-overview / Knowledge Graph descriptions with your specific
        // service areas and specialties.
        'real estate brokerage',
        'residential listings',
        'first-time buyers',
        // Your specific neighborhoods, e.g.:
        // 'Riverdale Bronx real estate',
        // 'Westchester County market',
      ],
    },
    defaultAuthor: { name: 'Brokerage Name', url: 'https://your-brokerage.example' },
  },

  // Plugin set tuned for real-estate sites.
  plugins: [
    'auth',           // tier-gated content (member-only neighborhood reports, agent dashboards)
    'content',        // MDX + wikilinks + knowledge graph (neighborhoods <-> listings)
    'analytics',      // GA4 / Plausible / GSC for listing performance tracking
    'seo',            // sitemap, RSS, llms.txt, JSON-LD (RealEstateListing schema is part of schema.org)
    'mcp',            // AI agent operation (publish listings, generate descriptions, tour scheduling)
    'media',          // listing galleries, virtual tours, floorplan uploads + AI vision tagging
    'discovery',      // buyer-lead capture forms (contact agent, request showing)
    'contracts',      // e-sign listing agreements, offers, disclosures
    'feedback',       // open-house feedback forms, reader surveys
    'notifications',  // new-listing alerts, price-change notifications
    // 'commerce' deliberately excluded — RE transactions don't go through Stripe;
    // they go through contracts + escrow agents. Re-add if you sell add-ons
    // (staging consultations, photography packages, etc.).
  ],

  workerUrl: 'https://your-brokerage-api.workers.dev',

  publish: {
    inbox: true,                // drop a new listing markdown, run `npm run ingest`
    api: true,                  // POST /api/publish for MLS integrations
    mcp: true,                  // AI agent can publish listings via MCP tool
  },
} as const

export type InkwellConfig = typeof config
