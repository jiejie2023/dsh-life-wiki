import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

describe('Life Wiki Built Bundles (Seam 3)', () => {
  it('loads host bundle under strict Cordis-like Proxy and responds HTTP 200 to dsh-app:// origin', async () => {
    const hostMod = await import(pathToFileURL(resolve(rootDir, 'lib/index.js')).href)
    assert.equal(hostMod.name, 'life-wiki')
    assert.deepEqual([...hostMod.inject], ['webServer'])

    let registeredHandler = null
    const rawTarget = {
      webServer: {
        register(route) {
          assert.equal(route.kind, 'prefix')
          assert.equal(route.path, '/api/life-wiki')
          registeredHandler = route.handler
          return () => {}
        },
      },
      get() {
        return undefined
      },
      effect(fn) {
        fn()
      },
    }

    // Strict proxy matching Cordis 4.1: throws on un-injected service property reads
    const strictCtx = new Proxy(rawTarget, {
      get(target, prop, receiver) {
        if (prop === 'webServer' || prop === 'get' || prop === 'effect') {
          return Reflect.get(target, prop, receiver)
        }
        throw new Error(`cannot get property "${String(prop)}" without inject`)
      },
    })

    await hostMod.apply(strictCtx)
    assert.ok(registeredHandler, 'host bundle must register /api/life-wiki handler')

    const server = createServer((req, res) => {
      void registeredHandler(req, res)
    })
    await new Promise((r) => server.listen(0, '127.0.0.1', r))
    const addr = server.address()
    const baseUrl = `http://127.0.0.1:${addr.port}`

    try {
      const res = await fetch(`${baseUrl}/api/life-wiki/settings`, {
        headers: { origin: 'dsh-app://app' },
      })
      assert.equal(res.status, 200)
      const json = await res.json()
      assert.equal(json.ok, true)
      assert.ok(json.data.defaultSuggestedDir.length > 0)
    } finally {
      await new Promise((r, j) => server.close((err) => (err ? j(err) : r())))
    }
  })

  it('loads client bundle via window.__ModuleLoader__ and registers main + sidebar.panellist slots', async () => {
    const code = await readFile(resolve(rootDir, 'lib/client.js'), 'utf8')
    let loaded = null

    const sandbox = {
      window: {
        __ModuleLoader__: {
          load(entry) {
            loaded = entry
          },
        },
      },
      globalThis: {},
      console,
    }
    vm.runInNewContext(code, sandbox)
    assert.ok(loaded, 'client.js must call window.__ModuleLoader__.load')
    assert.equal(loaded.id, 'dsh-life-wiki')

    const fakeReact = {
      createElement: () => null,
      Fragment: Symbol('Fragment'),
      useState: () => [null, () => {}],
      useEffect: () => {},
      useCallback: (fn) => fn,
      useMemo: (fn) => fn(),
    }
    const clientExports = loaded.factory((dep) => {
      if (dep === 'react') return fakeReact
      if (dep === 'react/jsx-runtime') {
        return { jsx: () => null, jsxs: () => null, Fragment: fakeReact.Fragment }
      }
      throw new Error(`Unexpected runtime require: ${dep}`)
    })

    assert.equal(clientExports.name, 'life-wiki-client')
    assert.deepEqual([...clientExports.inject], ['slots'])

    const registered = []
    clientExports.apply({
      slots: {
        register(slot, comp) {
          registered.push({ slot, comp })
        },
      },
    })

    const mainSlot = registered.find((r) => r.slot.name === 'main')
    const sidebarSlot = registered.find((r) => r.slot.name === 'sidebar.panellist')
    assert.ok(mainSlot, 'must register main slot')
    assert.equal(mainSlot.slot.key, 'life-wiki')
    assert.ok(sidebarSlot, 'must register sidebar.panellist slot')
    assert.equal(sidebarSlot.slot.id, 'life-wiki')
    assert.equal(sidebarSlot.slot.label(), 'Life Wiki')
    assert.equal(typeof mainSlot.comp, 'function')
    assert.equal(typeof sidebarSlot.comp, 'function')
  })
})
