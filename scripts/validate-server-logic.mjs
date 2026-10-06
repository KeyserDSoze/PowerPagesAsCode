import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const endpoints = ['health', 'field-service', 'field-service-sync', 'field-service-pull']
const sharedPaths = [
  path.join(root, 'src', 'backend', 'shared', 'runtime.js'),
  path.join(root, 'src', 'backend', 'shared', 'idempotency.js'),
]
const forbidden = [
  ['__dirname', /\b__dirname\b/],
  ['__filename', /\b__filename\b/],
  ['require(', /\brequire\s*\(/],
  ['dynamic import', /\bimport\s*\(/],
  ['import from', /\bimport\s+.+\s+from\b/],
  ['fetch(', /\bfetch\s*\(/],
  ['process.exit', /\bprocess\s*\.\s*exit\b/],
  ['process.kill', /\bprocess\s*\.\s*kill\b/],
  ['child_process', /\bchild_process\b/],
  ['fs.', /\bfs\s*\./],
  ['eval(', /\beval\s*\(/],
  ['Function(', /\bFunction\s*\(/],
  ['setTimeout(', /\bsetTimeout\s*\(/],
  ['setInterval(', /\bsetInterval\s*\(/],
  ['setImmediate(', /\bsetImmediate\s*\(/],
  ['constructor.constructor', /constructor\s*\.\s*constructor/],
  ['this.constructor', /\bthis\s*\.\s*constructor\b/],
  ['arguments.callee', /\barguments\s*\.\s*callee\b/],
  ['with(', /\bwith\s*\(/],
  ['delete keyword', /\bdelete\s+/],
  ['Object.getPrototypeOf', /\bObject\s*\.\s*getPrototypeOf\b/],
  ['Object.setPrototypeOf', /\bObject\s*\.\s*setPrototypeOf\b/],
  ['Symbol.for', /\bSymbol\s*\.\s*for\b/],
  ['prototype keyword', /\bprototype\b/],
  ['__proto__', /__proto__/],
  ['Proxy(', /\bProxy\s*\(/],
  ['Reflect.', /\bReflect\s*\./],
  ['debugger', /\bdebugger\b/]
]

let failed = false
const shared = (await Promise.all(sharedPaths.map((file) => readFile(file, 'utf8')))).join('\n')

for (const endpoint of endpoints) {
  const sourcePath = path.join(root, 'src', 'backend', endpoint, `${endpoint}.js`)
  const metadataPath = path.join(root, 'src', 'backend', endpoint, `${endpoint}.serverlogic.yml`)
  const source = await readFile(sourcePath, 'utf8')
  const metadata = await readFile(metadataPath, 'utf8')
  const banner = `// GENERATED SERVER LOGIC BUILD.
// Source: src/backend/shared/*.js + src/backend/${endpoint}/${endpoint}.js
// Do not edit generated output. Edit the source files under src/backend/.

`
  const expected = banner + shared + '\n' + source

  if (!new RegExp(`^name:\\s*${endpoint}$`, 'm').test(metadata)) {
    console.error(`ERROR: ${endpoint} metadata name must match the endpoint folder.`)
    failed = true
  }

  if (!/^id:\s*[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\s*$/im.test(metadata)) {
    console.error(`ERROR: ${endpoint} metadata must contain a valid GUID id.`)
    failed = true
  }

  for (const [label, pattern] of forbidden) {
    if (pattern.test(expected)) {
      console.error(`ERROR: ${endpoint} contains forbidden Server Logic pattern: ${label}`)
      failed = true
    }
  }

  const syntax = spawnSync(process.execPath, ['--check', '-'], {
    input: expected,
    encoding: 'utf8',
  })
  if (syntax.status !== 0) {
    console.error(syntax.stderr || syntax.stdout)
    failed = true
  }
}

if (failed) process.exit(1)
console.log('Server Logic validation passed.')
