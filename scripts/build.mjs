import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const outDir = resolve(rootDir, 'lib')

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

// 1. Host ESM bundle (lib/index.js)
await esbuild.build({
  entryPoints: [resolve(rootDir, 'src/host/index.ts')],
  outfile: resolve(outDir, 'index.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: false,
  external: ['@deepseek-ai/*', 'node:*'],
  logLevel: 'info',
})

// 2. DSH Client bundle (lib/client.js) wrapped for window.__ModuleLoader__
const clientBuild = await esbuild.build({
  entryPoints: [resolve(rootDir, 'src/client/index.tsx')],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    '@deepseek-ai/*',
  ],
  logLevel: 'info',
})

const rawClientCode = clientBuild.outputFiles[0]?.text ?? ''
const wrappedClientCode = [
  'window.__ModuleLoader__.load({',
  '  id: "dsh-life-wiki",',
  '  factory: (require) => {',
  '    var module = { exports: {} };',
  '    var exports = module.exports;',
  rawClientCode,
  '    return module.exports;',
  '  },',
  '});',
  '',
].join('\n')

await writeFile(resolve(outDir, 'client.js'), wrappedClientCode, 'utf8')

// 3. Standalone preview browser bundle (lib/preview.js)
await esbuild.build({
  entryPoints: [resolve(rootDir, 'src/client/preview-entry.tsx')],
  outfile: resolve(outDir, 'preview.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  logLevel: 'info',
})

console.log('Built lib/index.js, lib/client.js, and lib/preview.js successfully.')
