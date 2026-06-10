import { defineConfig } from 'vitest/config'

// Scope vitest to its own directory so it does not pick up the node:test suite
// (test/), the jest suite (jest/) or the bun suite (bun/).
export default defineConfig({
  test: {
    include: ['vitest/**/*.test.ts'],
  },
})
