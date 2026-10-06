import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const endpoints = ['health', 'field-service', 'field-service-sync', 'field-service-pull']

export const buildServerLogic = async ({ root, outputRoot }) => {
  const shared = [
    await readFile(path.join(root, 'src', 'backend', 'shared', 'runtime.js'), 'utf8'),
    await readFile(path.join(root, 'src', 'backend', 'shared', 'idempotency.js'), 'utf8'),
  ].join('\n')

  await rm(outputRoot, { recursive: true, force: true })

  for (const endpoint of endpoints) {
    const sourceDir = path.join(root, 'src', 'backend', endpoint)
    const sourcePath = path.join(sourceDir, `${endpoint}.js`)
    const metadataPath = path.join(sourceDir, `${endpoint}.serverlogic.yml`)
    const targetDir = path.join(outputRoot, endpoint)
    const target = path.join(targetDir, `${endpoint}.js`)
    const source = await readFile(sourcePath, 'utf8')
    const banner = `// GENERATED SERVER LOGIC BUILD.
// Source: src/backend/shared/*.js + src/backend/${endpoint}/${endpoint}.js
// Do not edit generated output. Edit the source files under src/backend/.

`

    await mkdir(targetDir, { recursive: true })
    await writeFile(target, banner + shared + '\n' + source)
    await cp(metadataPath, path.join(targetDir, `${endpoint}.serverlogic.yml`))

    console.log(`built ${path.relative(root, sourcePath)} -> ${path.relative(root, target)}`)
  }
}
