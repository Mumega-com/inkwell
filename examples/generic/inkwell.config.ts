// Generic-instance Inkwell config — for forks that haven't picked a
// vertical yet, OR forks that explicitly want pure substrate (blog +
// team + pages) without research / real-estate / dental / grants schemas.
//
// Copy this file to your fork's root as `inkwell.config.ts` and customize.
// The matching content schema is `src/content.config.generic.ts` (which
// re-exports the upstream-core 7 collections):
//
//   import { blog, topics, labs, tools, team, products, pages }
//     from './content.config.generic'
//   export const collections = { blog, topics, labs, tools, team, products, pages }
//
// What changes from the (vertical-specific) starters:
//   - Plugin set is the most minimal that still produces a useful site
//   - Theme is a neutral default (Inkwell gold + cyan)
//   - No vertical-specific `seo.organization.knowsAbout` seeding —
//     fork-creator fills based on actual domain
//
// When you're ready for a vertical: copy from `examples/research-instance/`,
// `examples/real-estate/`, etc. and switch the schema import.

export const config = {
  name: 'Your Site',
  domain: 'your-site.example',
  tagline: 'Publish with agents, not busywork.',

  theme: {
    colors: {
      primary: '#D4A017',     // Inkwell default gold
      secondary: '#06B6D4',
      accent: '#10B981',
      danger: '#EF4444',
      bg:      { dark: '#0A0A10', light: '#FAFBFC' },
      surface: { dark: '#151519', light: '#FFFFFF' },
      text:    { dark: '#EDEDF0', light: '#1A1D23' },
      muted:   { dark: 'rgba(255,255,255,0.55)', light: 'rgba(0,0,0,0.55)' },
      dim:     { dark: 'rgba(255,255,255,0.35)', light: 'rgba(0,0,0,0.35)' },
      border:  { dark: 'rgba(255,255,255,0.10)', light: 'rgba(0,0,0,0.10)' },
    },
    fonts: {
      display: "'JetBrains Mono', monospace",
      body: "system-ui, -apple-system, sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
    radius: '6px',
    contentWidth: '680px',
    pageWidth: '1200px',
    darkFirst: true,
  },

  i18n: {
    defaultLang: 'en' as const,
    languages: ['en'] as const,
    rtl: ['fa', 'ar'] as const,
    fallback: 'en' as const,
  },

  features: {
    reactions: true,
    newsletter: true,
    readingProgress: true,
    toc: true,
    shareButtons: true,
    commandPalette: true,
    knowledgeGraph: true,
    rss: true,
    search: true,
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
      name: 'Your Site',
      url: 'https://your-site.example',
      logo: '/logo.svg',
      knowsAbout: [
        // Fill with topics specific to your site. Seeds AI-overview /
        // Knowledge Graph descriptions.
      ],
    },
    defaultAuthor: { name: 'Site Author', url: 'https://your-site.example' },
  },

  // Minimal-but-useful plugin set. Add more as needs surface.
  plugins: [
    'content',        // MDX + wikilinks + knowledge graph
    'analytics',      // GA4 / Plausible / GSC
    'seo',            // sitemap, RSS, llms.txt, JSON-LD
    'mcp',            // AI agent operation
    'auth',           // OTP login (optional but useful from day one)
    'feedback',       // reader feedback / surveys
  ],

  workerUrl: 'https://your-site-api.workers.dev',

  publish: {
    inbox: true,
    api: true,
    mcp: true,
  },
} as const

export type InkwellConfig = typeof config
