import { defineConfig } from 'vitest/config'

// Route contracts can also run without the local Workerd listener.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/content-access.test.ts'],
    setupFiles: ['src/__tests__/node-crypto.setup.ts'],
  },
})
