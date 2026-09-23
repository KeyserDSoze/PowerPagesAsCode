import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const version = String(packageJson.version || '')

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('package.json version must be strict MAJOR.MINOR.PATCH semver.')
  process.exit(1)
}

process.stdout.write(version)
