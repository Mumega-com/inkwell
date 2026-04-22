export const config = {
  name: 'Inkwell',
  domain: 'inkwell.dev',
  tagline: 'The agent-first publishing organism. Fork it. Configure it. Scale it.',

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
        'Agent-operated publishing',
        'Customer portals',
        'Operational software',
        'Content systems',
        'Internal tools',
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

  // Feedback — customer surveys, NPS, feature voting.
  // Forks configure their own surveys. Empty = no auto-surveys.
  feedback: {
    surveys: [] as Array<{
      id: string
      type: 'nps' | 'csat' | 'micro' | 'exit' | 'custom'
      title: string
      questions: Array<{
        id: string
        text: string
        type: 'nps' | 'rating' | 'choice' | 'text' | 'boolean'
        options?: string[]
        required: boolean
      }>
      trigger?: string          // 'day-14', 'post-checkout', 'exit', 'manual'
      targetPath?: string       // only show on this path pattern
      active: boolean
    }>,
    votingEnabled: true,        // feature request voting board
    classifyEnabled: false,     // LLM auto-classification (requires Workers AI)
  },

  // Content sources — external systems that sync content into Inkwell.
  // Each entry creates a ContentSourcePort adapter. The sync plugin pulls from all.
  // Credentials come from env vars (NOTION_TOKEN, GITHUB_TOKEN, GDRIVE_TOKEN).
  // Forks enable whichever sources they use. Empty array = manual content only.
  contentSources: [] as Array<
    | { type: 'obsidian'; vaultPath: string; glob?: string }
    | { type: 'github'; owner: string; repo: string; branch?: string; path?: string }
    | { type: 'notion'; databaseId: string }
    | { type: 'gdrive'; folderId: string }
  >,

  // Network — how this instance connects to external services.
  // Forks override these. Standalone instances leave them empty.
  network: {
    apiUrl: '',                    // External API for network tools (remember, recall, tasks, marketplace)
    storageKeyPrefix: 'inkwell',   // Prefix for localStorage keys (e.g. 'inkwell_auth_token')
    brandName: 'Inkwell',          // Shown in "Powered by X" footer, ledger entries
    poweredByUrl: 'https://github.com/Mumega-com/inkwell',
    busTarget: 'owner',            // Default bus recipient for system messages
  },

  workerUrl: '',  // Set per fork — e.g. 'https://api.yoursite.workers.dev'

  publish: {
    inbox: true,
    api: true,
    mcp: true,
  },

  // Brand — customer-facing language and identity
  // Every fork customizes this. Components read from it.
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
    'analytics', 'auth', 'dashboard', 'commerce', 'content', 'mcp',
    'contracts', 'courses', 'telegram', 'chat',
    'diagnostics', 'discovery', 'payments', 'questionnaire',
    'onboarding', 'notifications', 'organism', 'sync', 'media', 'seo', 'feedback',
    'crm', 'automation', 'bounty', 'agency',
  ],

  // Adapters — which implementation to use for each port.
  // Each key maps a port name to an adapter type.
  // The adapter middleware resolves these at request time.
  // To swap infrastructure, change the adapter type — no code changes needed.
  //
  // Available adapter types per port:
  //   bus:     'standalone' | 'sos'
  //   memory:  'standalone' | 'mirror'
  //   economy: 'standalone' | 'sos'
  //   agent:   'd1'
  //   graph:   'd1'
  //
  // Adding a new adapter: create kernel/adapters/<name>.ts implementing the port,
  // add it to the factory in middleware/adapters.ts, register the type here.
  adapters: {
    bus: 'standalone' as string,
    memory: 'standalone' as string,
    economy: 'standalone' as string,
    agent: 'd1' as string,
    graph: 'd1' as string,
    media: 'cf' as string,
  },
} as const

export type InkwellConfig = typeof config
