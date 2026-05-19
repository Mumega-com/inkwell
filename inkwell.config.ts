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

    spacing: {
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
      '2xl': '3rem',
      '3xl': '4rem',
    },

    typography: {
      xs:  { size: '0.75rem',  lineHeight: '1rem' },
      sm:  { size: '0.875rem', lineHeight: '1.25rem' },
      md:  { size: '1rem',     lineHeight: '1.5rem' },
      lg:  { size: '1.125rem', lineHeight: '1.75rem' },
      xl:  { size: '1.25rem',  lineHeight: '1.75rem' },
      '2xl': { size: '1.5rem',   lineHeight: '2rem' },
      '3xl': { size: '1.875rem', lineHeight: '2.25rem' },
    },

    shadows: {
      sm: '0 1px 2px rgba(0,0,0,0.05)',
      md: '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)',
      lg: '0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)',
    },
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
    chat: false,
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
      name: 'Inkwell',
      url: 'https://inkwell.dev',
      logo: '/logo.svg',
      knowsAbout: [
        'AI business operations',
        'Digital marketing automation',
        'CRM and sales pipelines',
        'Content publishing',
        'Agency management',
        'SEO and growth',
      ],
    },
    defaultAuthor: { name: 'Inkwell', url: 'https://inkwell.dev' },

    // Geo SEO — programmatic city/service pages
    geo: {
      enabled: false,        // Forks set to true + populate locations
      serviceType: '',       // e.g. 'Moving Company', 'Dental Clinic'
      basePath: '/locations', // URL prefix for geo pages
      locations: [] as Array<{
        city: string
        region: string       // state/province
        country: string
        slug: string         // URL-safe: 'toronto-on'
        coords?: { lat: number; lng: number }
        phone?: string
        address?: string
      }>,
    },
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

  // Brand — customer-facing language and identity
  brand: {
    voice: 'professional, warm, no jargon',
    logo: '/logo.svg',
    favicon: '/favicon.svg',
    ogImage: '/og-default.png',

    // Squad IDs → customer-facing team names
    teamNames: {
      seo: 'Marketing Team',
      content: 'Content Writers',
      ops: 'Tech Support',
      dev: 'Development Team',
      outreach: 'Outreach Team',
      testing: 'Quality Assurance',
    } as Record<string, string>,

    // Task status → customer-facing labels
    statusLabels: {
      backlog: 'Coming up',
      claimed: 'In progress',
      in_progress: 'In progress',
      done: 'Completed',
      failed: 'Needs attention',
    } as Record<string, string>,

    // Priority → customer-facing labels
    priorityLabels: {
      critical: 'Urgent',
      high: 'Important',
      medium: 'Normal',
      low: 'Whenever',
    } as Record<string, string>,

    // Transaction counterparties → customer-facing names
    counterpartyNames: {
      glass_commerce: 'Online Sales',
      system: 'Platform',
    } as Record<string, string>,
  },

  // Plugins — which plugin manifests are active in this fork.
  // The Worker registers these at startup via the plugin loader.
  // config.plugins[] controls which are active per fork.
  plugins: [
    'dashboard', 'commerce', 'content', 'mcp',
    'contracts', 'telegram', 'chat',
    'diagnostics', 'discovery', 'payments', 'onboarding',
    'notifications', 'analytics', 'auth', 'automation',
    'courses', 'crm', 'feedback', 'media',
    'organism', 'questionnaire', 'seo', 'sync', 'agency', 'bounty',
  ],
} as const

export type InkwellConfig = typeof config
