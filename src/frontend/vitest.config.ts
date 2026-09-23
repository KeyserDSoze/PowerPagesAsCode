import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify('0.0.1-test'),
    __BUILD_SHA__: JSON.stringify('vitest'),
    __BUILD_TIME__: JSON.stringify('2026-01-01T00:00:00.000Z'),
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts']
  }
})
