import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rootPackagePath = path.join(root, 'package.json')
const frontendPackagePath = path.join(root, 'src', 'frontend', 'package.json')
const lockPath = path.join(root, 'package-lock.json')

const rootPackage = JSON.parse(await readFile(rootPackagePath, 'utf8'))
const current = String(rootPackage.version || '')
const semver = /^(\d+)\.(\d+)\.(\d+)$/
const match = current.match(semver)

if (!match) {
  console.error('Current version must be strict MAJOR.MINOR.PATCH semver.')
  process.exit(1)
}

const requested = process.argv[2] || 'patch'
let next

if (semver.test(requested)) {
  next = requested
} else {
  let major = Number(match[1])
  let minor = Number(match[2])
  let patch = Number(match[3])

  if (requested === 'patch') patch += 1
  else if (requested === 'minor') {
    minor += 1
    patch = 0
  } else if (requested === 'major') {
    major += 1
    minor = 0
    patch = 0
  } else {
    console.error('Usage: npm run version:bump -- <patch|minor|major|x.y.z>')
    process.exit(1)
  }

  next = `${major}.${minor}.${patch}`
}

if (next === current) {
  console.error('New version must differ from current version.')
  process.exit(1)
}

async function updatePackage(filePath) {
  const pkg = JSON.parse(await readFile(filePath, 'utf8'))
  pkg.version = next
  await writeFile(filePath, JSON.stringify(pkg, null, 2) + '\n')
}

await updatePackage(rootPackagePath)
await updatePackage(frontendPackagePath)

try {
  await access(lockPath)
  const lock = JSON.parse(await readFile(lockPath, 'utf8'))
  lock.version = next
  if (lock.packages?.['']) lock.packages[''].version = next
  if (lock.packages?.['src/frontend']) lock.packages['src/frontend'].version = next
  await writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n')
} catch {
  // package-lock.json is optional during bootstrap.
}

console.log(`Version bumped: ${current} -> ${next}`)
