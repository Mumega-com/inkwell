// Research-instance Inkwell config — for forks running a scientific corpus,
// research lab, or theoretical-research site.
//
// Copy this file to your fork's root as `inkwell.config.ts` and customize.
// Pair it with `src/content.config.research.ts` (substrate-provided opt-in
// schemas) by importing in your `src/content.config.ts`:
//
//   import { papers, concepts, inquiries, books, bookChapters, people }
//     from './content.config.research'
//   export const collections = { papers, concepts, inquiries, books, bookChapters, people }
//
// Reference fork: https://github.com/Mumega-com/fractalresonance-com
//
// What changes from the default config:
//   - `reactions: false` — papers don't get hearts; the gesture wrong-fits
//   - `knowledgeGraph: true` — citation graph + topic backlinks are core
//   - `toc: true`, wider contentWidth — papers have structure + figures
//   - `commerce` plugins removed — research labs aren't shops
//   - `auth` kept for tier-gated content (working papers, members-only)

export const config = {
  name: 'Your Lab Name',
  domain: 'your-lab.example',
  tagline: 'Coherence is the lens.',  // your framing here

  theme: {
    colors: {
      primary: '#7C5DFA',     // contemplative violet — calmer than commercial sites
      secondary: '#06B6D4',
      accent: '#10B981',
      danger: '#EF4444',
      bg:      { dark: '#0A0A12', light: '#FAFBFC' },
      surface: { dark: '#15151B', light: '#FFFFFF' },
      text:    { dark: '#EDEDF0', light: '#1A1D23' },
      muted:   { dark: 'rgba(255,255,255,0.55)', light: 'rgba(0,0,0,0.55)' },
      dim:     { dark: 'rgba(255,255,255,0.35)', light: 'rgba(0,0,0,0.35)' },
      border:  { dark: 'rgba(255,255,255,0.10)', light: 'rgba(0,0,0,0.10)' },
    },
    fonts: {
      display: "'JetBrains Mono', monospace",
      body: "'Inter', system-ui, -apple-system, sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
    radius: '4px',           // tighter than commercial — research register
    contentWidth: '720px',   // wider for figures + display equations
    pageWidth: '1280px',
    darkFirst: true,
  },

  i18n: {
    defaultLang: 'en' as const,
    languages: ['en'] as const,
    rtl: ['fa', 'ar'] as const,
    fallback: 'en' as const,
  },

  features: {
    reactions: false,         // papers don't get hearts
    newsletter: true,         // weekly digest cadence
    readingProgress: true,
    toc: true,                // papers have structure
    shareButtons: true,
    commandPalette: true,
    knowledgeGraph: true,     // citation graph is core
    rss: true,                // academic syndication
    search: true,             // Pagefind, free
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
      name: 'Your Lab Name',
      url: 'https://your-lab.example',
      logo: '/logo.svg',
      knowsAbout: [
        // List the topics your lab is recognized for — Schema.org Organization
        // field. Seeds AI-overview / Knowledge Graph descriptions.
        'your research domain',
        'specific framework names',
      ],
    },
    defaultAuthor: { name: 'Lead Author', url: 'https://your-lab.example' },
  },

  // Plugin set tuned for research instances. Customize as needed.
  plugins: [
    'auth',           // tier-gated content (working papers, members)
    'content',        // MDX + wikilinks + knowledge graph
    'analytics',      // GA4 / Plausible / GSC
    'seo',            // sitemap, RSS, llms.txt, JSON-LD
    'mcp',            // AI agent operation (publish, query, analyze)
    'feedback',       // reader feedback / questions / surveys
    'sync',           // pull content from Obsidian / GitHub / Notion
    'media',          // figures, vision analysis on uploaded images
    'discovery',      // collaboration / submission queue surface
  ],

  workerUrl: 'https://your-lab-api.workers.dev',

  publish: {
    inbox: true,
    api: true,
    mcp: true,
  },
} as const

export type InkwellConfig = typeof config
