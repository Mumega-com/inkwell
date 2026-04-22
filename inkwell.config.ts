export const config = {
  name: 'Mumega',
  domain: 'mumega.com',
  tagline: 'AI agents that operate your business — marketing, content, CRM, and growth on autopilot.',

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
    chat: false,
  },

  analytics: {
    googleAnalytics: 'G-WXKH19HD89',
    clarity: '',
    hotjar: '',
    tagManager: '',
    plausible: '',
  },

  seo: {
    organization: {
      name: 'Mumega',
      url: 'https://mumega.com',
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
    defaultAuthor: { name: 'Mumega', url: 'https://mumega.com' },
  },

  workerUrl: '',
  dashboardUrl: 'https://app.mumega.com',

  publish: {
    inbox: true,
    api: true,
    mcp: true,
  },

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
    'organism', 'questionnaire', 'seo', 'sync', 'agency', 'sales-desk', 'bounty',
  ],
} as const

export type InkwellConfig = typeof config
