import { mkdir, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const endpoints = ['health', 'field-service']

for (const endpoint of endpoints) {
  const source = path.join(root, 'src', 'backend', endpoint, `${endpoint}.js`)
  const targetDir = path.join(root, '.powerpages-site', 'server-logic', endpoint)
  const target = path.join(targetDir, `${endpoint}.js`)
  await mkdir(targetDir, { recursive: true })
  await copyFile(source, target)
  console.log(`synced ${path.relative(root, source)} -> ${path.relative(root, target)}`)
}
