/**
 * SaaS preset — software product with docs, changelog, and customer portal.
 * Enables: content, analytics, crm, commerce, contracts, feedback, automation
 */
export const preset = {
  plugins: [
    'auth', 'dashboard', 'content', 'analytics', 'mcp',
    'crm', 'commerce', 'contracts', 'feedback', 'automation',
    'notifications', 'onboarding',
  ],
  theme: {
    colors: {
      primary: '#8B5CF6',
      secondary: '#06B6D4',
    },
  },
  features: {
    analytics: true,
    reactions: false,
    search: true,
    darkMode: true,
  },
  seo: {
    organization: {
      type: 'Organization' as const,
      knowsAbout: ['software', '{{INDUSTRY}}'],
    },
  },
} as const
