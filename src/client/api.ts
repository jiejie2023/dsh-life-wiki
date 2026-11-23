import type {
  BoardSnapshot,
  CommitResult,
  DirectoryBrowseResult,
  DirectoryInspection,
  ProjectStatus,
  ReviewStatus,
  TaskFileStatus,
  VaultSettings,
} from '../shared/types.ts'

const API_BASE = '/api/life-wiki'

interface ApiEnvelope<T> {
  ok: boolean
  data?: T
  error?: string
}

async function parseEnvelope<T>(res: Response): Promise<T> {
  const raw = await res.text()
  let parsed: ApiEnvelope<T> | null = null
  if (raw.trim()) {
    try {
      parsed = JSON.parse(raw) as ApiEnvelope<T>
    } catch {
      throw new Error(`服务端返回异常响应 (HTTP ${res.status}): ${raw.slice(0, 120)}`)
    }
  }
  if (!parsed) {
    throw new Error(`服务端返回空响应 (HTTP ${res.status})`)
  }
  if (!res.ok || !parsed.ok) {
    throw new Error(parsed.error || `请求失败 (HTTP ${res.status})`)
  }
  return parsed.data as T
}

async function apiGet<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const query = new URLSearchParams()
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') query.set(k, v)
    }
  }
  const qs = query.toString()
  const res = await fetch(`${API_BASE}${path}${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    credentials: 'same-origin',
  })
  return parseEnvelope<T>(res)
}

async function apiPost<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'x-life-wiki': '1',
    },
    body: JSON.stringify(body),
  })
  return parseEnvelope<T>(res)
}

export function rawFileUrl(relPath: string): string {
  return `${API_BASE}/file/raw?path=${encodeURIComponent(relPath)}`
}

interface NativeDirectoryPicker {
  pick?: () => Promise<string | null | undefined>
}

export function hasNativeDirectoryPicker(): boolean {
  const picker = (globalThis as { __DSH_DIRECTORY_PICKER__?: NativeDirectoryPicker })
    .__DSH_DIRECTORY_PICKER__
  return typeof picker?.pick === 'function'
}

export async function pickNativeDirectory(): Promise<string | null> {
  const picker = (globalThis as { __DSH_DIRECTORY_PICKER__?: NativeDirectoryPicker })
    .__DSH_DIRECTORY_PICKER__
  if (typeof picker?.pick !== 'function') return null
  const picked = await picker.pick()
  return typeof picked === 'string' && picked.trim() ? picked.trim() : null
}

export const api = {
  getSettings: () => apiGet<VaultSettings>('/settings'),
  inspectDirectory: (path: string) => apiGet<DirectoryInspection>('/fs/inspect', { path }),
  browseDirectories: (path?: string) => apiGet<DirectoryBrowseResult>('/fs/browse', { path }),

  initVault: (opts: { dir: string; withSample: boolean; initGit: boolean }) =>
    apiPost<{ rootDir: string; createdFiles: string[]; gitInitialized: boolean; settings: VaultSettings }>(
      '/vault/init',
      opts,
    ),
  openVault: (dir: string) => apiPost<{ settings: VaultSettings }>('/vault/open', { dir }),
  disconnectVault: () => apiPost<{ settings: VaultSettings }>('/vault/disconnect'),
  clearSampleData: () => apiPost<{ removedCount: number; skippedCount: number }>('/vault/clear-sample'),

  getSnapshot: (date?: string, week?: string) =>
    apiGet<BoardSnapshot>('/snapshot', { date, week }),

  readFile: (relPath: string) =>
    apiGet<{ relPath: string; content: string }>('/file/read', { path: relPath }),
  writeFile: (relPath: string, content: string) =>
    apiPost<{ saved: boolean }>('/file/write', { path: relPath, content }),

  createTaskFile: (projectName: string, date?: string) =>
    apiPost<{ relPath: string }>('/tasks/create', { projectName, date }),
  addTask: (projectName: string, text: string, date?: string) =>
    apiPost<{ relPath: string }>('/tasks/add', { projectName, text, date }),
  toggleTask: (relPath: string, lineIndex: number, minutes?: number) =>
    apiPost<{ updated: boolean }>('/tasks/toggle', { relPath, lineIndex, minutes }),
  setTaskMinutes: (relPath: string, lineIndex: number, minutes: number | null) =>
    apiPost<{ updated: boolean }>('/tasks/minutes', { relPath, lineIndex, minutes }),
  updateTaskStatus: (relPath: string, status: TaskFileStatus) =>
    apiPost<{ updated: boolean }>('/tasks/status', { relPath, status }),
  appendTaskEntry: (relPath: string, section: 'log' | 'reflection', text: string) =>
    apiPost<{ updated: boolean }>('/tasks/append', { relPath, section, text }),

  createIdea: (title: string, ideaText: string) =>
    apiPost<{ relPath: string }>('/ideas/create', { title, ideaText }),
  promoteIdea: (
    ideaName: string,
    opts: { area: string; timeframe?: string; goal?: string },
  ) => apiPost<{ relPath: string }>('/ideas/promote', { ideaName, ...opts }),
  cancelIdea: (ideaName: string, reason?: string) =>
    apiPost<{ relPath: string }>('/ideas/cancel', { ideaName, reason }),

  createProject: (opts: {
    name: string
    area: string
    timeframe?: string
    idea?: string
    goal?: string
  }) => apiPost<{ relPath: string }>('/project/create', opts),
  archiveProject: (projectName: string, finalStatus: 'done' | 'cancel') =>
    apiPost<{ relPath: string }>('/project/archive', { projectName, finalStatus }),
  restoreProject: (projectName: string) =>
    apiPost<{ relPath: string }>('/project/restore', { projectName }),
  updateProjectMeta: (
    projectName: string,
    patch: { status?: ProjectStatus; area?: string; timeframe?: string },
  ) => apiPost<{ updated: boolean }>('/project/meta', { projectName, ...patch }),
  togglePlanItem: (projectName: string, lineIndex: number) =>
    apiPost<{ updated: boolean }>('/project/plan/toggle', { projectName, lineIndex }),
  addPlanItem: (projectName: string, text: string) =>
    apiPost<{ updated: boolean }>('/project/plan/add', { projectName, text }),

  addInboxItem: (text: string, date?: string) =>
    apiPost<{ updated: boolean }>('/inbox/add', { text, date }),
  toggleInboxItem: (lineIndex: number) =>
    apiPost<{ updated: boolean }>('/inbox/toggle', { lineIndex }),
  deleteInboxItem: (lineIndex: number) =>
    apiPost<{ updated: boolean }>('/inbox/delete', { lineIndex }),
  inboxToIdea: (lineIndex: number, title?: string) =>
    apiPost<{ relPath: string }>('/inbox/to-idea', { lineIndex, title }),
  inboxToTask: (lineIndex: number, projectName: string, date?: string) =>
    apiPost<{ relPath: string }>('/inbox/to-task', { lineIndex, projectName, date }),

  generateWeeklyReview: (projectName: string, week?: string) =>
    apiPost<{ relPath: string }>('/reviews/generate', { projectName, week }),
  updateReview: (relPath: string, patch: { status?: ReviewStatus; nextWeek?: string[] }) =>
    apiPost<{ updated: boolean }>('/reviews/update', { relPath, ...patch }),

  appendDiary: (text: string, date?: string, time?: string) =>
    apiPost<{ relPath: string }>('/diary/append', { text, date, time }),

  createWikiPage: (title: string, body: string, sources: string[]) =>
    apiPost<{ relPath: string }>('/wiki/create', { title, body, sources }),

  updateAreas: (areas: string[]) => apiPost<{ areas: string[] }>('/areas/update', { areas }),

  commitSnapshot: (message?: string) => apiPost<CommitResult>('/git/commit', { message }),
}
