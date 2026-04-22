/**
 * Mumega instance configuration
 *
 * This overrides the base inkwell.config.ts for the mumega.com deployment.
 * Import the base config and spread it, then override instance-specific values.
 *
 * Usage: Copy this file to the project root as inkwell.config.ts
 * or use the INKWELL_INSTANCE=mumega env var (planned).
 */
import { config as base } from '../../inkwell.config'

export const config = {
  ...base,
  name: 'Mumega',
  domain: 'mumega.com',
  tagline: 'AI teams that run your business.',

  network: {
    ...base.network,
    apiUrl: 'https://api.mumega.com',
    storageKeyPrefix: 'mumega',
    brandName: 'Mumega',
    poweredByUrl: 'https://mumega.com',
    busTarget: 'mumega',
  },

  adapters: {
    bus: 'sos',
    memory: 'mirror',
    economy: 'sos',
    agent: 'd1',
    graph: 'd1',
  },

  seo: {
    ...base.seo,
    organization: {
      ...base.seo.organization,
      name: 'Mumega',
      url: 'https://mumega.com',
      knowsAbout: [
        'AI business operations',
        'Agent-operated services',
        'Small business automation',
        'Content marketing',
        'SEO optimization',
      ],
    },
    defaultAuthor: { name: 'Mumega', url: 'https://mumega.com' },
  },

  workerUrl: 'https://api.mumega.com',
} as const
