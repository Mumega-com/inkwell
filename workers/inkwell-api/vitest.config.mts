import { defineConfig } from 'vitest/config'
import { cloudflareTest } from '@cloudflare/vitest-pool-workers'

export default defineConfig({
  test: {
    testTimeout: 15000,
  },
  plugins: [
    cloudflareTest({
      main: './src/index.ts',
      remoteBindings: false,
      miniflare: {
        bindings: {
          PUBLISH_TOKEN: 'dev-inkwell-local-test-token-do-not-use-in-prod',
          INKWELL_MCP_TOKEN: 'dev-inkwell-local-test-token-do-not-use-in-prod',
        },
      },
      wrangler: { configPath: './wrangler.toml' },
    }),
  ],
})
