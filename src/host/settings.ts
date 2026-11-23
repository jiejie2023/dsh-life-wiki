import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { VaultSettings } from '../shared/types.ts'

export interface SettingsStore {
  get(): VaultSettings
  setDataDir(nextDir: string | null): Promise<VaultSettings>
}

interface StoredSettings {
  dataDir?: string | null
  recentDirs?: string[]
}

export async function createSettingsStore(options: {
  settingsFile?: string
  initialDataDir?: string | null
} = {}): Promise<SettingsStore> {
  const settingsFile = options.settingsFile ?? join(homedir(), '.dsh', 'life-wiki-settings.json')
  const home = homedir()
  const docsCandidate = join(home, 'Documents')
  const docsStat = await stat(docsCandidate).catch(() => null)
  const defaultParentDir = docsStat?.isDirectory() ? docsCandidate : home
  const defaultSuggestedDir = join(defaultParentDir, 'Life Wiki')

  let activeDataDir: string | null = options.initialDataDir ? resolve(options.initialDataDir) : null
  let recentDirs: string[] = []

  if (options.initialDataDir === undefined) {
    try {
      const raw = await readFile(settingsFile, 'utf8')
      const parsed = JSON.parse(raw) as StoredSettings
      if (Array.isArray(parsed.recentDirs)) {
        recentDirs = parsed.recentDirs.filter(
          (x): x is string => typeof x === 'string' && x.trim().length > 0,
        )
      }
      if (typeof parsed.dataDir === 'string' && parsed.dataDir.trim()) {
        const candidate = resolve(parsed.dataDir.trim())
        const st = await stat(candidate).catch(() => null)
        if (st?.isDirectory()) {
          activeDataDir = candidate
        }
      }
    } catch {
      // Fresh install: start in onboarding mode (dataDir: null)
    }
  }

  const get = (): VaultSettings => ({
    dataDir: activeDataDir,
    recentDirs,
    defaultSuggestedDir,
    defaultParentDir,
  })

  return {
    get,

    async setDataDir(nextDir: string | null) {
      if (nextDir === null) {
        activeDataDir = null
      } else {
        const candidate = resolve(nextDir.trim())
        const st = await stat(candidate).catch(() => null)
        if (!st?.isDirectory()) {
          throw new Error(`目录不存在或不可访问：${candidate}`)
        }
        activeDataDir = candidate
        recentDirs = [
          candidate,
          ...recentDirs.filter((d) => d.toLowerCase() !== candidate.toLowerCase()),
        ].slice(0, 6)
      }
      await mkdir(dirname(settingsFile), { recursive: true })
      await writeFile(
        settingsFile,
        `${JSON.stringify({ dataDir: activeDataDir, recentDirs }, null, 2)}\n`,
        'utf8',
      )
      return get()
    },
  }
}
