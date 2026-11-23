import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { createHttpHandler } from '../src/host/http.ts'
import { createSettingsStore } from '../src/host/settings.ts'

describe('Life Wiki Host HTTP Seam (/api/life-wiki/*)', () => {
  it('supports uninitialized onboarding -> inspect -> init vault -> snapshot -> mutations -> clear sample', async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), 'life-wiki-http-'))
    const vaultDir = join(tmpRoot, 'my-life-wiki')
    const settingsFile = join(tmpRoot, 'settings.json')

    const settings = await createSettingsStore({ settingsFile })
    const handler = createHttpHandler({
      settings,
      now: () => new Date('2026-11-24T11:00:00+08:00'),
    })

    const server: Server = createServer((req, res) => {
      void handler(req, res)
    })
    await new Promise<void>((res) => server.listen(0, '127.0.0.1', res))
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

    try {
      // 1. Fresh install has dataDir === null
      const s0 = (await (await fetch(`${baseUrl}/api/life-wiki/settings`)).json()) as {
        ok: boolean
        data: { dataDir: string | null }
      }
      assert.equal(s0.ok, true)
      assert.equal(s0.data.dataDir, null)

      // 2. Inspect target directory before creation
      const insp = (await (
        await fetch(`${baseUrl}/api/life-wiki/fs/inspect?path=${encodeURIComponent(vaultDir)}`)
      ).json()) as { ok: boolean; data: { exists: boolean; isEmpty: boolean } }
      assert.equal(insp.ok, true)
      assert.equal(insp.data.exists, false)
      assert.equal(insp.data.isEmpty, true)

      // 3. Reject POST without x-life-wiki header
      const unauth = await fetch(`${baseUrl}/api/life-wiki/vault/init`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dir: vaultDir, withSample: true, initGit: false }),
      })
      assert.equal(unauth.status, 403)

      // 4. Initialize vault inside parentDir using vaultName + sample data
      const initRes = (await (
        await fetch(`${baseUrl}/api/life-wiki/vault/init`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-life-wiki': '1' },
          body: JSON.stringify({
            parentDir: tmpRoot,
            vaultName: 'my-life-wiki',
            withSample: true,
            initGit: false,
          }),
        })
      ).json()) as { ok: boolean; data: { settings: { dataDir: string } } }
      assert.equal(initRes.ok, true)
      assert.equal(initRes.data.settings.dataDir, vaultDir)

      // 5. Fetch snapshot
      const snapRes = (await (
        await fetch(`${baseUrl}/api/life-wiki/snapshot?date=2026-11-24`)
      ).json()) as {
        ok: boolean
        data: { projects: unknown[]; hasSampleData: boolean; knowledge: { wikiPages: unknown[] } }
      }
      assert.equal(snapRes.ok, true)
      assert.equal(snapRes.data.hasSampleData, true)
      assert.equal(snapRes.data.projects.length, 1)
      assert.equal(snapRes.data.knowledge.wikiPages.length, 1)

      // 6. Browse directories and serve binary image via /file/raw with dsh-app:// origin
      const browseRes = (await (
        await fetch(`${baseUrl}/api/life-wiki/fs/browse?path=${encodeURIComponent(tmpRoot)}`, {
          headers: { origin: 'dsh-app://app' },
        })
      ).json()) as { ok: boolean; data: { currentPath: string; entries: Array<{ name: string }> } }
      assert.equal(browseRes.ok, true)
      assert.ok(browseRes.data.entries.some((e) => e.name === 'my-life-wiki'))

      const imgDir = join(vaultDir, 'raw', 'me', 'diary', '2026-11-24')
      await mkdir(imgDir, { recursive: true })
      const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      await writeFile(join(imgDir, 'photo.png'), fakePng)
      const rawRes = await fetch(
        `${baseUrl}/api/life-wiki/file/raw?path=${encodeURIComponent('raw/me/diary/2026-11-24/photo.png')}`,
        { headers: { origin: 'dsh-app://app' } },
      )
      assert.equal(rawRes.status, 200)
      assert.equal(rawRes.headers.get('content-type'), 'image/png')
      assert.equal(Buffer.from(await rawRes.arrayBuffer()).equals(fakePng), true)

      // 7. Clear sample data
      const clearRes = (await (
        await fetch(`${baseUrl}/api/life-wiki/vault/clear-sample`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-life-wiki': '1',
            origin: 'dsh-app://app',
          },
          body: JSON.stringify({}),
        })
      ).json()) as { ok: boolean; data: { removedCount: number } }
      assert.equal(clearRes.ok, true)
      assert.ok(clearRes.data.removedCount >= 5)
    } finally {
      await new Promise<void>((res, rej) => server.close((err) => (err ? rej(err) : res())))
      await rm(tmpRoot, { recursive: true, force: true })
    }
  })
})
