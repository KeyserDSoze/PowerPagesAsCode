import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const rootPackage = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version: string }

const brand = JSON.parse(
  readFileSync(new URL('../../brand.config.json', import.meta.url), 'utf8'),
) as {
  displayName: string
  pwaName: string
  shortName: string
  description: string
  databaseName: string
}

const appVersion = process.env.APP_VERSION || rootPackage.version
const buildSha = process.env.GITHUB_SHA || 'local'
const buildTime = new Date().toISOString()

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const versionManifest = JSON.stringify(
  {
    version: appVersion,
    buildSha,
    buildTime,
  },
  null,
  2,
)

const applicationMetadataPlugin = (): Plugin => ({
  name: 'application-metadata',

  transformIndexHtml(html) {
    return html.replace(
      /<title>.*?<\/title>/,
      '<title>' + escapeHtml(brand.pwaName) + '</title>',
    )
  },

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
    __APP_DISPLAY_NAME__: JSON.stringify(brand.displayName),
    __APP_SHORT_NAME__: JSON.stringify(brand.shortName),
    __APP_DB_NAME__: JSON.stringify(brand.databaseName),
  },
  plugins: [
    react(),
    applicationMetadataPlugin(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/app-icon.svg'],
      manifest: {
        name: brand.pwaName,
        short_name: brand.shortName,
        description: brand.description,
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
