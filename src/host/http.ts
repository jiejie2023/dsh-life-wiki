import { readdir, stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { clearSampleData, initializeVault, inspectDirectory } from '../core/scaffold.ts'
import { createLifeWikiEngine, type LifeWikiEngine } from '../core/vault.ts'
import type {
  DirectoryBrowseResult,
  ProjectStatus,
  ReviewStatus,
  TaskFileStatus,
} from '../shared/types.ts'
import type { SettingsStore } from './settings.ts'

const CLIENT_MARKER_HEADER = 'x-life-wiki'
const MAX_BODY_BYTES = 2 * 1024 * 1024

export interface HttpHandlerDeps {
  settings: SettingsStore
  getTrustedHosts?: () => string[]
  now?: () => Date
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  if (res.writableEnded || res.destroyed) return
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

function isLoopbackHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]' || hostname === '::1') return true
  const parts = hostname.split('.')
  return (
    parts.length === 4 &&
    parts[0] === '127' &&
    parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)
  )
}

function validateOrigin(req: IncomingMessage, trustedHosts: string[]): string | null {
  const host = typeof req.headers.host === 'string' ? req.headers.host : ''
  if (!host) return 'missing host header'
  let hostUrl: URL
  try {
    hostUrl = new URL(`http://${host}`)
  } catch {
    return 'invalid host header'
  }
  const trusted =
    isLoopbackHost(hostUrl.hostname) ||
    trustedHosts.some((entry) => {
      try {
        return new URL(`http://${entry}`).hostname === hostUrl.hostname
      } catch {
        return false
      }
    })
  if (!trusted) return 'forbidden host'
  if (req.headers['sec-fetch-site'] === 'cross-site') return 'cross-site request forbidden'
  const origin = req.headers.origin
  if (typeof origin === 'string') {
    try {
      const originUrl = new URL(origin)
      if (originUrl.protocol !== 'dsh-app:' && originUrl.host !== hostUrl.host) {
        return 'origin mismatch'
      }
    } catch {
      return 'invalid origin'
    }
  }
  return null
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolvePromise, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        const parsed = text ? (JSON.parse(text) as unknown) : {}
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new Error('JSON body must be an object'))
          return
        }
        resolvePromise(parsed as Record<string, unknown>)
      } catch (err) {
        reject(new Error(`Invalid JSON body: ${err instanceof Error ? err.message : String(err)}`))
      }
    })
    req.on('error', reject)
  })
}

async function browseDirectories(rawPath?: string): Promise<DirectoryBrowseResult> {
  const target = rawPath?.trim() ? resolve(rawPath.trim()) : homedir()
  const st = await stat(target).catch(() => null)
  const currentPath = st?.isDirectory() ? target : homedir()
  const parent = dirname(currentPath)
  const parentPath = parent !== currentPath ? parent : null
  const dirents = await readdir(currentPath, { withFileTypes: true }).catch(() => [])
  const entries = dirents
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    .slice(0, 120)
    .map((d) => ({ name: d.name, path: join(currentPath, d.name) }))
  return { currentPath, parentPath, entries }
}

export function createHttpHandler(
  deps: HttpHandlerDeps,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  let mutationQueue: Promise<unknown> = Promise.resolve()
  const enqueueMutation = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = mutationQueue.then(fn, fn)
    mutationQueue = next.catch(() => undefined)
    return next
  }

  const requireEngine = (): LifeWikiEngine => {
    const dir = deps.settings.get().dataDir
    if (!dir) {
      const err = new Error('尚未选择本地知识库目录') as Error & { statusCode?: number }
      err.statusCode = 409
      throw err
    }
    return createLifeWikiEngine(dir, { now: deps.now })
  }

  return async (req, res) => {
    try {
      const trustedHosts = deps.getTrustedHosts?.() ?? []
      const originErr = validateOrigin(req, trustedHosts)
      if (originErr) {
        sendJson(res, 403, { ok: false, error: originErr })
        return
      }

      const url = new URL(req.url ?? '/', 'http://localhost')
      const path = url.pathname.replace(/\/+$/, '')

      if (req.method === 'GET') {
        if (path === '/api/life-wiki/settings') {
          sendJson(res, 200, { ok: true, data: deps.settings.get() })
          return
        }
        if (path === '/api/life-wiki/fs/inspect') {
          const target = url.searchParams.get('path') ?? ''
          if (!target.trim()) {
            sendJson(res, 400, { ok: false, error: '路径不能为空' })
            return
          }
          sendJson(res, 200, { ok: true, data: await inspectDirectory(target) })
          return
        }
        if (path === '/api/life-wiki/fs/browse') {
          const target = url.searchParams.get('path') ?? undefined
          sendJson(res, 200, { ok: true, data: await browseDirectories(target) })
          return
        }
        if (path === '/api/life-wiki/snapshot') {
          const date = url.searchParams.get('date') || undefined
          const week = url.searchParams.get('week') || undefined
          const data = await requireEngine().getSnapshot(date, week)
          sendJson(res, 200, { ok: true, data })
          return
        }
        if (path === '/api/life-wiki/file/read') {
          const relPath = url.searchParams.get('path') ?? ''
          sendJson(res, 200, { ok: true, data: await requireEngine().readFile(relPath) })
          return
        }
        if (path === '/api/life-wiki/file/raw') {
          const relPath = url.searchParams.get('path') ?? ''
          const { buffer, mime } = await requireEngine().readBinaryFile(relPath)
          res.writeHead(200, {
            'content-type': mime,
            'content-length': buffer.byteLength,
            'cache-control': 'private, max-age=60',
          })
          res.end(buffer)
          return
        }
        sendJson(res, 404, { ok: false, error: `Unknown GET route: ${path}` })
        return
      }

      if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: `Method not allowed: ${req.method}` })
        return
      }

      if (req.headers[CLIENT_MARKER_HEADER] !== '1') {
        sendJson(res, 403, { ok: false, error: 'Missing required x-life-wiki header' })
        return
      }
      const contentType = String(req.headers['content-type'] ?? '')
        .split(';', 1)[0]!
        .trim()
        .toLowerCase()
      if (contentType !== 'application/json') {
        sendJson(res, 415, { ok: false, error: 'content-type must be application/json' })
        return
      }

      const body = await readJsonBody(req)

      const data = await enqueueMutation(async () => {
        // Vault-level setup routes (allowed before dataDir is set)
        if (path === '/api/life-wiki/vault/init') {
          const dir = String(body.dir ?? '').trim()
          if (!dir) throw new Error('请先选择目标文件夹')
          const withSample = body.withSample !== false
          const initGit = body.initGit === true
          const resInit = await initializeVault(dir, {
            withSample,
            initGit,
            now: deps.now?.(),
          })
          const nextSettings = await deps.settings.setDataDir(resInit.rootDir)
          return { ...resInit, settings: nextSettings }
        }
        if (path === '/api/life-wiki/vault/open') {
          const dir = String(body.dir ?? '').trim()
          if (!dir) throw new Error('请先选择文件夹')
          const nextSettings = await deps.settings.setDataDir(dir)
          return { settings: nextSettings }
        }
        if (path === '/api/life-wiki/vault/disconnect') {
          const nextSettings = await deps.settings.setDataDir(null)
          return { settings: nextSettings }
        }

        const engine = requireEngine()
        switch (path) {
          case '/api/life-wiki/vault/clear-sample':
            return clearSampleData(engine.rootDir)

          case '/api/life-wiki/file/write':
            await engine.writeFile(String(body.path ?? ''), String(body.content ?? ''))
            return { saved: true }

          case '/api/life-wiki/tasks/create':
            return {
              relPath: await engine.createTaskFile(
                String(body.projectName ?? ''),
                typeof body.date === 'string' ? body.date : undefined,
              ),
            }

          case '/api/life-wiki/tasks/toggle':
            await engine.toggleTask(
              String(body.relPath ?? ''),
              Number(body.lineIndex),
              typeof body.minutes === 'number' ? body.minutes : undefined,
            )
            return { updated: true }

          case '/api/life-wiki/tasks/minutes':
            await engine.setTaskMinutes(
              String(body.relPath ?? ''),
              Number(body.lineIndex),
              typeof body.minutes === 'number' ? body.minutes : null,
            )
            return { updated: true }

          case '/api/life-wiki/tasks/add':
            return {
              relPath: await engine.addTask(
                String(body.projectName ?? ''),
                String(body.text ?? ''),
                typeof body.date === 'string' ? body.date : undefined,
              ),
            }

          case '/api/life-wiki/tasks/status':
            await engine.updateTaskFileStatus(
              String(body.relPath ?? ''),
              String(body.status ?? '') as TaskFileStatus,
            )
            return { updated: true }

          case '/api/life-wiki/tasks/append':
            await engine.appendTaskEntry(
              String(body.relPath ?? ''),
              body.section === 'reflection' ? 'reflection' : 'log',
              String(body.text ?? ''),
            )
            return { updated: true }

          case '/api/life-wiki/ideas/create':
            return {
              relPath: await engine.createIdea(
                String(body.title ?? ''),
                String(body.ideaText ?? ''),
              ),
            }

          case '/api/life-wiki/ideas/promote':
            return {
              relPath: await engine.promoteIdeaToProject(String(body.ideaName ?? ''), {
                area: String(body.area ?? ''),
                timeframe: typeof body.timeframe === 'string' ? body.timeframe : undefined,
                goal: typeof body.goal === 'string' ? body.goal : undefined,
              }),
            }

          case '/api/life-wiki/ideas/cancel':
            return {
              relPath: await engine.cancelIdea(
                String(body.ideaName ?? ''),
                typeof body.reason === 'string' ? body.reason : undefined,
              ),
            }

          case '/api/life-wiki/project/create':
            return {
              relPath: await engine.createProject({
                name: String(body.name ?? ''),
                area: String(body.area ?? ''),
                timeframe: typeof body.timeframe === 'string' ? body.timeframe : undefined,
                idea: typeof body.idea === 'string' ? body.idea : undefined,
                goal: typeof body.goal === 'string' ? body.goal : undefined,
              }),
            }

          case '/api/life-wiki/project/archive':
            return {
              relPath: await engine.archiveProject(
                String(body.projectName ?? ''),
                body.finalStatus === 'cancel' ? 'cancel' : 'done',
              ),
            }

          case '/api/life-wiki/project/restore':
            return {
              relPath: await engine.restoreProject(String(body.projectName ?? '')),
            }

          case '/api/life-wiki/project/meta':
            await engine.updateProjectMeta(String(body.projectName ?? ''), {
              status:
                typeof body.status === 'string' ? (body.status as ProjectStatus) : undefined,
              area: typeof body.area === 'string' ? body.area : undefined,
              timeframe: typeof body.timeframe === 'string' ? body.timeframe : undefined,
            })
            return { updated: true }

          case '/api/life-wiki/project/plan/toggle':
            await engine.togglePlanItem(String(body.projectName ?? ''), Number(body.lineIndex))
            return { updated: true }

          case '/api/life-wiki/project/plan/add':
            await engine.addPlanItem(String(body.projectName ?? ''), String(body.text ?? ''))
            return { updated: true }

          case '/api/life-wiki/inbox/add':
            await engine.addInboxItem(
              String(body.text ?? ''),
              typeof body.date === 'string' ? body.date : undefined,
            )
            return { updated: true }

          case '/api/life-wiki/inbox/toggle':
            await engine.toggleInboxItem(Number(body.lineIndex))
            return { updated: true }

          case '/api/life-wiki/inbox/delete':
            await engine.deleteInboxItem(Number(body.lineIndex))
            return { updated: true }

          case '/api/life-wiki/inbox/to-idea':
            return {
              relPath: await engine.inboxToIdea(
                Number(body.lineIndex),
                typeof body.title === 'string' ? body.title : undefined,
              ),
            }

          case '/api/life-wiki/inbox/to-task':
            return {
              relPath: await engine.inboxToTask(
                Number(body.lineIndex),
                String(body.projectName ?? ''),
                typeof body.date === 'string' ? body.date : undefined,
              ),
            }

          case '/api/life-wiki/reviews/generate':
            return {
              relPath: await engine.generateWeeklyReviewDraft(
                String(body.projectName ?? ''),
                typeof body.week === 'string' ? body.week : undefined,
              ),
            }

          case '/api/life-wiki/reviews/update':
            await engine.updateReview(String(body.relPath ?? ''), {
              status:
                typeof body.status === 'string' ? (body.status as ReviewStatus) : undefined,
              nextWeek: Array.isArray(body.nextWeek)
                ? body.nextWeek.map((x) => String(x))
                : undefined,
            })
            return { updated: true }

          case '/api/life-wiki/diary/append':
            return {
              relPath: await engine.appendDiary(
                String(body.text ?? ''),
                typeof body.date === 'string' ? body.date : undefined,
                typeof body.time === 'string' ? body.time : undefined,
              ),
            }

          case '/api/life-wiki/wiki/create':
            return {
              relPath: await engine.createWikiPage(
                String(body.title ?? ''),
                String(body.body ?? ''),
                Array.isArray(body.sources) ? body.sources.map((x) => String(x)) : [],
              ),
            }

          case '/api/life-wiki/areas/update':
            return {
              areas: await engine.updateAreas(
                Array.isArray(body.areas) ? body.areas.map((x) => String(x)) : [],
              ),
            }

          case '/api/life-wiki/git/commit':
            return engine.commitSnapshot(
              typeof body.message === 'string' ? body.message : undefined,
            )

          default: {
            const err = new Error(`Unknown POST route: ${path}`) as Error & { statusCode?: number }
            err.statusCode = 404
            throw err
          }
        }
      })

      sendJson(res, 200, { ok: true, data })
    } catch (caught) {
      const err = caught as Error & { statusCode?: number }
      const code = typeof err.statusCode === 'number' ? err.statusCode : 400
      sendJson(res, code, { ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }
}
