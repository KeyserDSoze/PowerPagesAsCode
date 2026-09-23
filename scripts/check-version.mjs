import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rootPackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const frontendPackage = JSON.parse(await readFile(path.join(root, 'src', 'frontend', 'package.json'), 'utf8'))

const rootVersion = String(rootPackage.version || '')
const frontendVersion = String(frontendPackage.version || '')
const semver = /^\d+\.\d+\.\d+$/

if (!semver.test(rootVersion)) {
  console.error('ERROR: root package.json version must be strict MAJOR.MINOR.PATCH semver.')
  process.exit(1)
}

if (rootVersion !== frontendVersion) {
  console.error(
    `ERROR: version mismatch. root=${rootVersion}, frontend=${frontendVersion}. Run npm run version:bump -- <patch|minor|major|x.y.z>.`
  )
  process.exit(1)
}

console.log(`Application version: ${rootVersion}`)
