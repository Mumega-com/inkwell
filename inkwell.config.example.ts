export const config = {
  name: 'Inkwell Site',
  domain: 'example.com',
  tagline: 'Publish with agents, not busywork.',

  theme: {
    colors: {
      primary: '#D4A017',
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
      name: 'Inkwell Site',
      url: 'https://example.com',
      logo: '/logo.svg',
      knowsAbout: ['content publishing', 'documentation', 'knowledge graphs'],
    },
    defaultAuthor: { name: 'Site Author', url: 'https://example.com' },
  },

  workerUrl: 'https://your-worker.workers.dev',
  dashboardUrl: 'https://dashboard.example.com',
  allowedOrigins: [
    'https://example.com',
    'https://*.example.com',
  ],

  publish: {
    inbox: true,
    api: true,
    mcp: true,
  },

  adapters: {
    graph: 'd1',
    agent: 'd1',
    bus: 'standalone',
    memory: 'standalone',
    economy: 'standalone',
  },

  contentSources: [] as Array<
    | { type: 'github'; owner: string; repo: string; branch: string; path: string }
    | { type: 'notion'; databaseId: string }
    | { type: 'gdrive'; folderId: string }
    | { type: 'obsidian' }
  >,
} as const

export type InkwellConfig = typeof config
