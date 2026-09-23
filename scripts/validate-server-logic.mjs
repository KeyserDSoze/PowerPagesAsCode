import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const endpoints = ['health', 'field-service']
const forbidden = [
  ['require(', /\brequire\s*\(/],
  ['dynamic import', /\bimport\s*\(/],
  ['fetch(', /\bfetch\s*\(/],
  ['process.', /\bprocess\s*\./],
  ['child_process', /\bchild_process\b/],
  ['fs.', /\bfs\s*\./],
  ['eval(', /\beval\s*\(/],
  ['setTimeout(', /\bsetTimeout\s*\(/],
  ['setInterval(', /\bsetInterval\s*\(/],
  ['__proto__', /__proto__/],
  ['Proxy(', /\bProxy\s*\(/],
  ['Reflect.', /\bReflect\s*\./]
]

let failed = false

for (const endpoint of endpoints) {
  const sourcePath = path.join(root, 'src', 'backend', endpoint, `${endpoint}.js`)
  const deployPath = path.join(root, '.powerpages-site', 'server-logic', endpoint, `${endpoint}.js`)
  const [source, deploy] = await Promise.all([readFile(sourcePath, 'utf8'), readFile(deployPath, 'utf8')])

  if (source !== deploy) {
    console.error(`ERROR: ${endpoint} snapshot differs from src/backend. Run npm run backend:sync.`)
    failed = true
  }

  for (const [label, pattern] of forbidden) {
    if (pattern.test(source)) {
      console.error(`ERROR: ${endpoint} contains forbidden Server Logic pattern: ${label}`)
      failed = true
    }
  }

  const syntax = spawnSync(process.execPath, ['--check', sourcePath], { encoding: 'utf8' })
  if (syntax.status !== 0) {
    console.error(syntax.stderr || syntax.stdout)
    failed = true
  }
}

if (failed) process.exit(1)
console.log('Server Logic validation passed.')
