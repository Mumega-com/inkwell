/**
 * Creator preset — solo creators, writers, artists, podcasters.
 * Enables: content, analytics, media, courses, commerce, feedback
 */
export const preset = {
  plugins: [
    'auth', 'dashboard', 'content', 'analytics', 'mcp',
    'media', 'courses', 'commerce', 'feedback',
    'notifications', 'onboarding',
  ],
  theme: {
    colors: {
      primary: '#F59E0B',
      secondary: '#EC4899',
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
      type: 'Person' as const,
      knowsAbout: ['{{INDUSTRY}}'],
    },
  },
} as const
