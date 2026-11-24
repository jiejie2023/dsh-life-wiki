import { rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeVault } from '../src/core/scaffold.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const targetDir = resolve(__dirname, '..', 'vault-template')

await rm(targetDir, { recursive: true, force: true })
await initializeVault(targetDir, {
  withSample: true,
  initGit: false,
  now: new Date('2026-11-24T12:00:00'),
})

console.log(`Synced canonical vault template to ${targetDir}`)
