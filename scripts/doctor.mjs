import { access, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
const warnings = []

const nodeMajor = Number(process.versions.node.split('.')[0])
if (nodeMajor < 22) errors.push('Node.js >=22 is required; current=' + process.versions.node)

const rootPackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const frontendPackage = JSON.parse(await readFile(path.join(root, 'src/frontend/package.json'), 'utf8'))
const brand = JSON.parse(await readFile(path.join(root, 'brand.config.json'), 'utf8'))

if (rootPackage.version !== frontendPackage.version) {
  errors.push('Root and frontend package versions differ.')
}

if (rootPackage.name !== brand.packageName) {
  errors.push('Root package name differs from brand.config.json.')
}

if (frontendPackage.name !== brand.frontendPackageName) {
  errors.push('Frontend package name differs from brand.config.json.')
}

const powerPagesConfig = JSON.parse(await readFile(path.join(root, 'powerpages.config.json'), 'utf8'))
if (!powerPagesConfig.siteName || !powerPagesConfig.compiledPath) {
  errors.push('powerpages.config.json must define siteName and compiledPath.')
}

if (powerPagesConfig.siteName !== brand.siteName) {
  errors.push('Power Pages siteName differs from brand.config.json.')
}

for (const requiredPath of [
  'AGENTS.md',
  'brand.config.json',
  'schemas/brand-config.schema.json',
  'contracts',
  'src/frontend/src/offline',
  'src/backend/shared',
  '.powerpages-site/server-logic',
]) {
  try {
    await access(path.join(root, requiredPath))
  } catch {
    errors.push('Missing required path: ' + requiredPath)
  }
}

try {
  await access(path.join(root, 'package-lock.json'))
} catch {
  warnings.push('package-lock.json is missing. Commit it before declaring the baseline reproducible.')
}

const pac = spawnSync('pac', ['--version'], { encoding: 'utf8' })
if (pac.status !== 0) {
  warnings.push('PAC CLI not found. It is optional for local UI work but required for manual Power Pages deployment.')
} else {
  console.log('PAC CLI: ' + (pac.stdout || pac.stderr).trim())
}

for (const warning of warnings) console.warn('WARN: ' + warning)
for (const error of errors) console.error('ERROR: ' + error)

if (errors.length > 0) process.exit(1)
console.log('Doctor completed: ' + warnings.length + ' warning(s), no blocking errors.')
