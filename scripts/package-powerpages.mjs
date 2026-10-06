import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const frontendDist = path.join(root, 'src', 'frontend', 'dist')
const backendDist = path.join(root, 'src', 'backend', 'dist', 'server-logic')
const packageRoot = path.join(root, '.artifacts', 'powerpages')
const packageFrontend = path.join(packageRoot, 'dist')
const packageBackend = path.join(packageRoot, '.powerpages-site', 'server-logic')

const config = JSON.parse(await readFile(path.join(root, 'powerpages.config.json'), 'utf8'))

const removeSourceMaps = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) await removeSourceMaps(target)
    else if (entry.isFile() && entry.name.endsWith('.map')) await rm(target)
  }
}

await rm(packageRoot, { recursive: true, force: true })
await mkdir(packageRoot, { recursive: true })
await cp(frontendDist, packageFrontend, { recursive: true })
await cp(backendDist, packageBackend, { recursive: true })
await removeSourceMaps(packageFrontend)

const deployConfig = {
  ...config,
  compiledPath: 'dist',
  includeSource: false,
}

await writeFile(
  path.join(packageRoot, 'powerpages.config.json'),
  JSON.stringify(deployConfig, null, 2) + '\n',
)

console.log('Power Pages package created at ' + path.relative(root, packageRoot))
