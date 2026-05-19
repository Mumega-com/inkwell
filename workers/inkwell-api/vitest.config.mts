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
      wrangler: { configPath: './wrangler.toml' },
    }),
  ],
})
