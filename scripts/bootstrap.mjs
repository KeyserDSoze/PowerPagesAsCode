import { spawnSync } from 'node:child_process'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const nodeMajor = Number(process.versions.node.split('.')[0])

if (nodeMajor < 22) {
  console.error('Node.js 22+ is required. Current version: ' + process.versions.node)
  process.exit(1)
}

const run = (args) => {
  console.log('\n> npm ' + args.join(' '))
  const result = spawnSync(npm, args, { stdio: 'inherit', env: process.env })
  if (result.status !== 0) process.exit(result.status || 1)
}

run(['ci'])
run(['run', 'doctor'])
run(['run', 'check'])
run(['test'])

console.log('\nBootstrap completed successfully.')
console.log('For browser E2E tests install Chromium once:')
console.log('  npx playwright install chromium')
console.log('or on CI/Linux:')
console.log('  npx playwright install --with-deps chromium')
console.log('')
console.log('For Power Pages deployment, install/authenticate PAC CLI separately.')
