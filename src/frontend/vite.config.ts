import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const rootPackage = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version: string }

const appVersion = process.env.APP_VERSION || rootPackage.version
const buildSha = process.env.GITHUB_SHA || 'local'
const buildTime = new Date().toISOString()

const versionManifest = JSON.stringify(
  {
    version: appVersion,
    buildSha,
    buildTime,
  },
  null,
  2,
)

const appVersionPlugin = (): Plugin => ({
  name: 'app-version-manifest',

  configureServer(server) {
    server.middlewares.use('/version.json', (_request, response) => {
      response.statusCode = 200
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
      response.end(versionManifest)
    })
  },

  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: versionManifest,
    })
  },
})

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_SHA__: JSON.stringify(buildSha),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [
    react(),
    appVersionPlugin(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/app-icon.svg'],
      manifest: {
        name: 'Power Pages Field Service',
        short_name: 'Field Service',
        description: 'Offline-first Power Pages PWA boilerplate',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/app-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // version.json is deliberately excluded from precache.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
      },
    }),
  ],
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    sourcemap: true,
  },
})
