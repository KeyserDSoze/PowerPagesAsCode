import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = async (relativePath) =>
  JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))

const [brand, rootPackage, frontendPackage, powerPagesConfig] = await Promise.all([
  readJson('brand.config.json'),
  readJson('package.json'),
  readJson('src/frontend/package.json'),
  readJson('powerpages.config.json'),
])

const errors = []

if (rootPackage.name !== brand.packageName) {
  errors.push("root package name '" + rootPackage.name + "' != brand packageName '" + brand.packageName + "'")
}

if (frontendPackage.name !== brand.frontendPackageName) {
  errors.push("frontend package name '" + frontendPackage.name + "' != brand frontendPackageName '" + brand.frontendPackageName + "'")
}

if (powerPagesConfig.siteName !== brand.siteName) {
  errors.push("Power Pages siteName '" + powerPagesConfig.siteName + "' != brand siteName '" + brand.siteName + "'")
}

if (brand.frontendPackageName !== brand.packageScope + '/frontend') {
  errors.push('frontendPackageName must equal <packageScope>/frontend.')
}

if (errors.length > 0) {
  for (const error of errors) console.error('ERROR: ' + error)
  console.error('Run the rebrand script or align brand.config.json and project files.')
  process.exit(1)
}

console.log(
  'Brand configuration OK: ' + brand.displayName + ' / ' + brand.packageName + ' / ' + brand.siteName,
)
