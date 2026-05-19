/**
 * Company preset — small-to-mid business with public website + internal dashboard.
 * Enables: content, analytics, crm, seo, media, feedback
 */
export const preset = {
  plugins: [
    'auth', 'dashboard', 'content', 'analytics', 'mcp',
    'crm', 'seo', 'media', 'feedback',
    'notifications', 'onboarding',
  ],
  theme: {
    colors: {
      primary: '#2563EB',
      secondary: '#10B981',
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
      knowsAbout: ['{{INDUSTRY}}'],
    },
  },
} as const
