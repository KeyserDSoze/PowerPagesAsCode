import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildServerLogic } from './server-logic-build.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(root, 'src', 'backend', 'dist', 'server-logic')

await buildServerLogic({ root, outputRoot })
