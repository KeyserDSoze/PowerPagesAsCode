import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const contractDir = path.join(root, 'contracts')
const files = (await readdir(contractDir))
  .filter((name) => name.endsWith('.schema.json'))
  .sort()

if (files.length === 0) {
  console.error('ERROR: no JSON Schema contracts found.')
  process.exit(1)
}

const ids = new Set()

for (const file of files) {
  const fullPath = path.join(contractDir, file)
  const schema = JSON.parse(await readFile(fullPath, 'utf8'))

  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
    console.error(`ERROR: ${file} must use JSON Schema draft 2020-12.`)
    process.exit(1)
  }

  if (!schema.$id || ids.has(schema.$id)) {
    console.error(`ERROR: ${file} has a missing or duplicate $id.`)
    process.exit(1)
  }

  ids.add(schema.$id)
}

console.log(`Validated ${files.length} API contract schemas.`)
