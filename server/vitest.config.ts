import { defineConfig } from 'vitest/config'

// Set default env vars so npm test runs standalone (set before any imports)
process.env.SQLITE_KEY ??= '0'.repeat(64)
process.env.JWT_SECRET ??= 'test-jwt-secret'
process.env.DATABASE_PATH ??= '/tmp/stocktrack-test.db'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    fileParallelism: false,
  },
})
