import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)

const readArg = (name) => {
  const index = args.indexOf(name)
  if (index === -1) return undefined
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(name + ' requires a value.')
  return value
}

const hasFlag = (name) => args.includes(name)
const slugify = (value) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const compactNamespace = (slug) => slug.replace(/[^a-z0-9]/g, '')
const readJson = async (relativePath) =>
  JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))

const writeJson = async (relativePath, value, dryRun) => {
  if (!dryRun) await writeFile(path.join(root, relativePath), JSON.stringify(value, null, 2) + '\n')
  console.log((dryRun ? '[dry-run] ' : '') + 'updated ' + relativePath)
}

const usage = () => {
  console.log([
    '',
    'Usage:',
    '  npm run rebrand -- --name "Contoso Field Operations" [options]',
    '',
    'Options:',
    '  --name <display name>             Required brand/product display name',
    '  --slug <npm-safe-slug>            Default: derived from --name',
    '  --site-name <Power Pages name>    Default: --name',
    '  --pwa-name <installed app name>   Default: --name',
    '  --short-name <PWA short name>     Default: first 30 chars of --name',
    '  --description <description>       Default: existing description',
    '  --scope <npm scope>               Default: @<slug>',
    '  --cicd-app-name <Entra app name>  Default: <slug>-cicd',
    '  --database-name <IndexedDB name>  Requires --rename-database',
    '  --rename-database                 Explicitly allow IndexedDB database rename',
    '  --dry-run                         Print changes without writing files',
    '  --help                            Show this help',
    ''
  ].join('\n'))
}

if (hasFlag('--help')) {
  usage()
  process.exit(0)
}

const requestedName = readArg('--name')
if (!requestedName) {
  usage()
  process.exit(1)
}

const dryRun = hasFlag('--dry-run')
const allowDatabaseRename = hasFlag('--rename-database')
const current = await readJson('brand.config.json')

const slug = readArg('--slug') || slugify(requestedName)
if (!slug) throw new Error('Unable to derive a valid slug from --name.')

const packageScope = readArg('--scope') || '@' + slug
if (!/^@[a-z0-9][a-z0-9._-]*$/.test(packageScope)) {
  throw new Error('--scope must be a valid lower-case npm scope, for example @contoso.')
}

const databaseNameArg = readArg('--database-name')
if (databaseNameArg && !allowDatabaseRename) {
  throw new Error(
    '--database-name requires --rename-database because changing the IndexedDB name can orphan existing offline data.',
  )
}

const next = {
  ...current,
  displayName: requestedName,
  siteName: readArg('--site-name') || requestedName,
  pwaName: readArg('--pwa-name') || requestedName,
  shortName: (readArg('--short-name') || requestedName).slice(0, 30),
  description: readArg('--description') || current.description,
  packageName: slug,
  packageScope,
  frontendPackageName: packageScope + '/frontend',
  contractNamespace: compactNamespace(slug) + '.local',
  databaseName: databaseNameArg || current.databaseName,
  cicdAppName: readArg('--cicd-app-name') || slug + '-cicd',
}

const replacements = [
  [current.displayName, next.displayName],
  [current.packageName, next.packageName],
  [current.packageScope, next.packageScope],
  [current.frontendPackageName, next.frontendPackageName],
  [current.contractNamespace, next.contractNamespace],
  [current.cicdAppName, next.cicdAppName],
]

if (allowDatabaseRename) replacements.push([current.databaseName, next.databaseName])

const replaceText = (text) => {
  let output = text
  for (const pair of replacements) {
    const from = pair[0]
    const to = pair[1]
    if (from && from !== to) output = output.split(from).join(to)
  }
  return output
}

const collectFiles = async (directory, suffixes) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectFiles(full, suffixes))
    else if (entry.isFile() && suffixes.some((suffix) => entry.name.endsWith(suffix))) files.push(full)
  }
  return files
}

await writeJson('brand.config.json', next, dryRun)

const rootPackage = await readJson('package.json')
rootPackage.name = next.packageName
await writeJson('package.json', rootPackage, dryRun)

const frontendPackage = await readJson('src/frontend/package.json')
frontendPackage.name = next.frontendPackageName
await writeJson('src/frontend/package.json', frontendPackage, dryRun)

const powerPagesConfig = await readJson('powerpages.config.json')
powerPagesConfig.siteName = next.siteName
await writeJson('powerpages.config.json', powerPagesConfig, dryRun)

try {
  const lock = await readJson('package-lock.json')
  lock.name = next.packageName
  if (lock.packages && lock.packages['']) lock.packages[''].name = next.packageName
  if (lock.packages && lock.packages['src/frontend']) lock.packages['src/frontend'].name = next.frontendPackageName

  if (lock.packages) {
    const oldWorkspaceKey = 'node_modules/' + current.frontendPackageName
    const newWorkspaceKey = 'node_modules/' + next.frontendPackageName
    if (oldWorkspaceKey !== newWorkspaceKey && lock.packages[oldWorkspaceKey]) {
      lock.packages[newWorkspaceKey] = lock.packages[oldWorkspaceKey]
      delete lock.packages[oldWorkspaceKey]
    }
  }

  await writeJson('package-lock.json', lock, dryRun)
} catch (error) {
  console.warn('WARN: package-lock.json could not be updated: ' + error.message)
}

const textFiles = [
  path.join(root, 'README.md'),
  path.join(root, 'AGENTS.md'),
  path.join(root, 'SECURITY.md'),
  path.join(root, 'CONTRIBUTING.md'),
  ...(await collectFiles(path.join(root, 'docs'), ['.md'])),
  ...(await collectFiles(path.join(root, 'contracts'), ['.json'])),
  ...(await collectFiles(path.join(root, 'schemas'), ['.json'])),
]

for (const fullPath of textFiles) {
  try {
    const before = await readFile(fullPath, 'utf8')
    const after = replaceText(before)
    if (before !== after) {
      if (!dryRun) await writeFile(fullPath, after)
      console.log((dryRun ? '[dry-run] ' : '') + 'rebranded ' + path.relative(root, fullPath))
    }
  } catch {
    // Optional text files are ignored.
  }
}

console.log('')
console.log('Rebrand summary')
console.log('  displayName:         ' + current.displayName + ' -> ' + next.displayName)
console.log('  packageName:         ' + current.packageName + ' -> ' + next.packageName)
console.log('  frontendPackageName: ' + current.frontendPackageName + ' -> ' + next.frontendPackageName)
console.log('  siteName:            ' + current.siteName + ' -> ' + next.siteName)
console.log('  PWA name:            ' + current.pwaName + ' -> ' + next.pwaName)
console.log('  IndexedDB:           ' + current.databaseName + ' -> ' + next.databaseName)
console.log('')
console.log('Next: npm run brand:check && npm run check && npm test && npm run build')
console.log('')
console.log('This script does NOT rename GitHub repositories, Power Platform environments,')
console.log('existing Power Pages records, Entra app registrations, Dataverse publisher/schema')
console.log('prefixes, custom domains, or already-deployed browser databases.')
