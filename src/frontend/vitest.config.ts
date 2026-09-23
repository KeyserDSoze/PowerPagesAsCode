import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify('0.0.1-test'),
    __BUILD_SHA__: JSON.stringify('vitest'),
    __BUILD_TIME__: JSON.stringify('2026-01-01T00:00:00.000Z'),
    __APP_DISPLAY_NAME__: JSON.stringify('PowerPagesAsCode Test'),
    __APP_SHORT_NAME__: JSON.stringify('PPA Test'),
    __APP_DB_NAME__: JSON.stringify('PowerPagesFieldServiceTest'),
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts']
  }
})
