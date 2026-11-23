import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { BoardSnapshot, VaultSettings } from '../shared/types.ts'
import { api } from './api.ts'
import { IconGit, IconInbox, IconRefresh, IconSettings } from './components/Icons.tsx'
import { ensureStyles } from './styles.ts'
import { DiaryView } from './views/DiaryView.tsx'
import { FileDrawer } from './views/FileDrawer.tsx'
import { InboxDrawer } from './views/InboxDrawer.tsx'
import { KnowledgeView } from './views/KnowledgeView.tsx'
import { OnboardingView } from './views/OnboardingView.tsx'
import { ProjectsView } from './views/ProjectsView.tsx'
import { ReviewView } from './views/ReviewView.tsx'
import { SettingsModal } from './views/SettingsModal.tsx'
import { TodayView } from './views/TodayView.tsx'

export type MainTab = 'today' | 'projects' | 'diary' | 'review' | 'knowledge'

export type RunActionFn = (
  action: () => Promise<unknown>,
  opts?: {
    toast?: string
    optimistic?: (prev: BoardSnapshot) => BoardSnapshot
    reloadSettings?: boolean
  },
) => Promise<void>

function localTodayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function detectHostTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light'
  const root = document.documentElement
  const body = document.body
  if (
    root.classList.contains('dark') ||
    body?.classList.contains('dark') ||
    root.getAttribute('data-theme') === 'dark' ||
    body?.getAttribute('data-theme') === 'dark'
  ) {
    return 'dark'
  }
  if (root.classList.contains('light') || root.getAttribute('data-theme') === 'light') {
    return 'light'
  }
  try {
    const bg = getComputedStyle(body || root).backgroundColor
    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (m) {
      const lum = (0.299 * Number(m[1]) + 0.587 * Number(m[2]) + 0.114 * Number(m[3])) / 255
      if (lum < 0.4) return 'dark'
      if (lum > 0.6) return 'light'
    }
  } catch {
    // ignore
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function LifeWikiApp() {
  ensureStyles()

  const [theme, setTheme] = useState<'light' | 'dark'>(() => detectHostTheme())
  const [settings, setSettings] = useState<VaultSettings | null>(null)
  const [snapshot, setSnapshot] = useState<BoardSnapshot | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [switchingVault, setSwitchingVault] = useState(false)

  const [activeTab, setActiveTab] = useState<MainTab>('today')
  const [selectedDate, setSelectedDate] = useState<string>(() => localTodayIso())
  const [selectedWeek, setSelectedWeek] = useState<string | undefined>(undefined)

  const [inboxOpen, setInboxOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [drawerFile, setDrawerFile] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; isError: boolean } | null>(null)

  const snapshotRef = useRef<BoardSnapshot | null>(null)
  snapshotRef.current = snapshot

  const showToast = useCallback((text: string, isError = false) => {
    setToast({ text, isError })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  // Sync light/dark theme with DSH host
  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
    const sync = () => setTheme(detectHostTheme())
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'style'],
    })
    if (document.body) {
      obs.observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'style'],
      })
    }
    return () => obs.disconnect()
  }, [])

  // Esc key closes topmost overlay
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (drawerFile) {
        e.preventDefault()
        setDrawerFile(null)
      } else if (inboxOpen) {
        e.preventDefault()
        setInboxOpen(false)
      } else if (settingsOpen) {
        e.preventDefault()
        setSettingsOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerFile, inboxOpen, settingsOpen])

  const fetchSnapshot = useCallback(
    async (dateArg: string, weekArg: string | undefined, withSettings: boolean) => {
      try {
        if (withSettings) {
          const s = await api.getSettings()
          setSettings(s)
          if (!s.dataDir) {
            setSnapshot(null)
            setError(null)
            return
          }
        }
        const snap = await api.getSnapshot(dateArg, weekArg)
        setSnapshot(snap)
        setError(null)
        if (!weekArg) setSelectedWeek(snap.reviewCenter.week)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setInitialLoading(false)
      }
    },
    [],
  )

  // Initial load
  useEffect(() => {
    void fetchSnapshot(selectedDate, selectedWeek, true)
  }, [fetchSnapshot, selectedDate, selectedWeek])

  const runAction: RunActionFn = useCallback(
    async (action, opts) => {
      const prev = snapshotRef.current
      if (opts?.optimistic && prev) {
        setSnapshot(opts.optimistic(prev))
      }
      try {
        await action()
        await fetchSnapshot(selectedDate, selectedWeek, Boolean(opts?.reloadSettings))
        if (opts?.toast) showToast(opts.toast)
      } catch (err) {
        if (opts?.optimistic && prev) {
          setSnapshot(prev)
        }
        showToast(err instanceof Error ? err.message : String(err), true)
      }
    },
    [fetchSnapshot, selectedDate, selectedWeek, showToast],
  )

  const handleCommitSnapshot = async () => {
    await runAction(async () => {
      const res = await api.commitSnapshot()
      showToast(res.summary)
    })
  }

  const pendingInboxCount = snapshot
    ? snapshot.inbox.items.filter((i) => !i.checked).length
    : 0

  const showOnboarding = !initialLoading && settings && (!settings.dataDir || switchingVault)

  return (
    <div className="lw-root" data-lw-theme={theme}>
      {/* Calm 3-column Header */}
      <header className="lw-header">
        <div className="lw-brand">
          <span className="lw-brand-name">Life Wiki</span>
          {snapshot && !switchingVault && (
            <>
              <span className="lw-brand-sep">/</span>
              <button
                type="button"
                className="lw-vault-btn"
                title={snapshot.vaultRoot}
                onClick={() => setSettingsOpen(true)}
              >
                {snapshot.vaultName}
              </button>
            </>
          )}
        </div>

        {snapshot && !showOnboarding ? (
          <nav className="lw-nav" aria-label="主导航">
            {(
              [
                ['today', '今日'],
                ['projects', '项目'],
                ['diary', '日记'],
                ['review', '复盘'],
                ['knowledge', '知识库'],
              ] as Array<[MainTab, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`lw-nav-item ${activeTab === key ? 'active' : ''}`}
                onClick={() => setActiveTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>
        ) : (
          <div />
        )}

        <div className="lw-header-right">
          {snapshot && !showOnboarding && (
            <>
              <button
                type="button"
                className="lw-icon-btn"
                title="收件箱"
                onClick={() => setInboxOpen(true)}
              >
                <IconInbox size={15} />
                {pendingInboxCount > 0 && <span className="lw-num">{pendingInboxCount}</span>}
              </button>

              {snapshot.git.isRepo && (
                <button
                  type="button"
                  className="lw-icon-btn"
                  title={
                    snapshot.git.dirtyCount > 0
                      ? `提交 Git 快照（${snapshot.git.dirtyCount} 处改动）`
                      : '本地 Git 已同步'
                  }
                  onClick={() => void handleCommitSnapshot()}
                >
                  <IconGit size={15} />
                  {snapshot.git.dirtyCount > 0 && <span className="lw-dot" />}
                </button>
              )}

              <button
                type="button"
                className="lw-icon-btn"
                title="刷新本地文件"
                onClick={() => void fetchSnapshot(selectedDate, selectedWeek, false)}
              >
                <IconRefresh size={14} />
              </button>

              <button
                type="button"
                className="lw-icon-btn"
                title="设置"
                onClick={() => setSettingsOpen(true)}
              >
                <IconSettings size={15} />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      {initialLoading && !snapshot ? (
        <div className="lw-onboard-wrap">
          <div className="lw-muted">加载中…</div>
        </div>
      ) : showOnboarding && settings ? (
        <OnboardingView
          settings={settings}
          canCancel={Boolean(settings.dataDir)}
          onCancel={() => setSwitchingVault(false)}
          onVaultReady={async () => {
            setSwitchingVault(false)
            setSelectedWeek(undefined)
            await fetchSnapshot(selectedDate, undefined, true)
          }}
        />
      ) : error && !snapshot ? (
        <div className="lw-onboard-wrap">
          <div className="lw-onboard-card">
            <div style={{ color: 'var(--lw-danger)', fontSize: 13.5 }}>{error}</div>
            <div className="lw-row">
              <button
                type="button"
                className="lw-btn lw-btn-primary"
                onClick={() => void fetchSnapshot(selectedDate, selectedWeek, true)}
              >
                重试
              </button>
              <button type="button" className="lw-btn" onClick={() => setSwitchingVault(true)}>
                切换目录
              </button>
            </div>
          </div>
        </div>
      ) : snapshot ? (
        <main className="lw-main">
          {activeTab === 'today' && (
            <TodayView
              snapshot={snapshot}
              selectedDate={selectedDate}
              onDateChange={(next) => setSelectedDate(next)}
              onOpenFile={(rel) => setDrawerFile(rel)}
              onJumpToDiary={() => setActiveTab('diary')}
              onRunAction={runAction}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectsView
              snapshot={snapshot}
              onOpenFile={(rel) => setDrawerFile(rel)}
              onJumpToToday={() => {
                setSelectedDate(localTodayIso())
                setActiveTab('today')
              }}
              onRunAction={runAction}
            />
          )}

          {activeTab === 'diary' && (
            <DiaryView
              snapshot={snapshot}
              defaultDate={selectedDate}
              onOpenFile={(rel) => setDrawerFile(rel)}
              onRunAction={runAction}
            />
          )}

          {activeTab === 'review' && (
            <ReviewView
              snapshot={snapshot}
              selectedWeek={selectedWeek ?? snapshot.reviewCenter.week}
              onWeekChange={(nextWeek) => setSelectedWeek(nextWeek)}
              onOpenFile={(rel) => setDrawerFile(rel)}
              onRunAction={runAction}
            />
          )}

          {activeTab === 'knowledge' && (
            <KnowledgeView
              snapshot={snapshot}
              onOpenFile={(rel) => setDrawerFile(rel)}
              onRunAction={runAction}
            />
          )}
        </main>
      ) : null}

      {inboxOpen && snapshot && (
        <InboxDrawer
          snapshot={snapshot}
          selectedDate={selectedDate}
          onClose={() => setInboxOpen(false)}
          onOpenFile={(rel) => setDrawerFile(rel)}
          onRunAction={runAction}
        />
      )}

      {drawerFile && (
        <FileDrawer
          relPath={drawerFile}
          onClose={() => setDrawerFile(null)}
          onSaved={() => fetchSnapshot(selectedDate, selectedWeek, false)}
          onToast={showToast}
        />
      )}

      {settingsOpen && settings && snapshot && (
        <SettingsModal
          settings={settings}
          snapshot={snapshot}
          onClose={() => setSettingsOpen(false)}
          onSwitchVault={() => setSwitchingVault(true)}
          onOpenFile={(rel) => setDrawerFile(rel)}
          onRunAction={runAction}
        />
      )}

      {toast && (
        <div className={`lw-toast ${toast.isError ? 'lw-toast-err' : ''}`}>
          {toast.text}
        </div>
      )}
    </div>
  )
}
