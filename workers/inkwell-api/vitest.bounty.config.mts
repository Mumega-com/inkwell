import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const testInkwellConfig = fileURLToPath(new URL('./src/__tests__/fixtures/inkwell-config.ts', import.meta.url))

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: './src/__tests__/fixtures/test-worker.ts',
      remoteBindings: false,
      wrangler: { configPath: './wrangler.toml' },
    }),
  ],
  resolve: {
    alias: [
      { find: /^hono$/, replacement: fileURLToPath(new URL('./node_modules/hono/dist/index.js', import.meta.url)) },
      { find: /^hono\/cors$/, replacement: fileURLToPath(new URL('./node_modules/hono/dist/middleware/cors/index.js', import.meta.url)) },
      { find: /.*inkwell\.config(\.ts)?$/, replacement: testInkwellConfig },
    ],
  },
})
