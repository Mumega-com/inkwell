/**
 * Agency preset — marketing agencies managing multiple client accounts.
 * Enables: agency, crm, analytics, automation, content, seo, media, feedback
 */
export const preset = {
  plugins: [
    'auth', 'dashboard', 'content', 'analytics', 'mcp',
    'agency', 'crm', 'automation', 'seo', 'media', 'feedback',
    'notifications', 'onboarding',
  ],
  theme: {
    colors: {
      primary: '#6366F1',
      secondary: '#06B6D4',
    },
  },
  features: {
    analytics: true,
    reactions: true,
    search: true,
    darkMode: true,
  },
  seo: {
    organization: {
      type: 'Organization' as const,
      knowsAbout: ['digital marketing', 'SEO', 'content strategy', 'web development'],
    },
  },
} as const
