import React, { useCallback, useEffect, useState } from 'react'
import type { BoardSnapshot, VaultSettings } from '../shared/types.ts'
import { api } from './api.ts'
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

type MainTab = 'today' | 'projects' | 'diary' | 'review' | 'knowledge'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [switchingVault, setSwitchingVault] = useState(false)

  const [activeTab, setActiveTab] = useState<MainTab>('today')
  const [selectedDate, setSelectedDate] = useState<string>(() => localTodayIso())
  const [selectedWeek, setSelectedWeek] = useState<string | undefined>(undefined)

  const [inboxOpen, setInboxOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [drawerFile, setDrawerFile] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; isError: boolean } | null>(null)

  const showToast = useCallback((text: string, isError = false) => {
    setToast({ text, isError })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

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

  const loadAll = useCallback(
    async (dateArg = selectedDate, weekArg = selectedWeek) => {
      setLoading(true)
      setError(null)
      try {
        const s = await api.getSettings()
        setSettings(s)
        if (!s.dataDir) {
          setSnapshot(null)
          return
        }
        const snap = await api.getSnapshot(dateArg, weekArg)
        setSnapshot(snap)
        if (!weekArg) setSelectedWeek(snap.reviewCenter.week)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    [selectedDate, selectedWeek],
  )

  useEffect(() => {
    void loadAll(selectedDate, selectedWeek)
  }, [loadAll, selectedDate, selectedWeek])

  const runAction = useCallback(
    async (action: () => Promise<unknown>, toastText?: string) => {
      try {
        await action()
        await loadAll(selectedDate, selectedWeek)
        if (toastText) showToast(toastText)
      } catch (err) {
        showToast(err instanceof Error ? err.message : String(err), true)
      }
    },
    [loadAll, selectedDate, selectedWeek, showToast],
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

  const showOnboarding = !loading && settings && (!settings.dataDir || switchingVault)

  return (
    <div className="lw-root" data-lw-theme={theme}>
      {/* Top Navigation Bar */}
      <header className="lw-header">
        <div className="lw-brand">
          <span className="lw-brand-title">Life Wiki</span>
          {snapshot && !switchingVault && (
            <button
              type="button"
              className="lw-vault-pill"
              title={`当前库：${snapshot.vaultRoot}（点击切换）`}
              onClick={() => setSettingsOpen(true)}
            >
              <span>📁</span>
              <span>{snapshot.vaultName}</span>
            </button>
          )}
        </div>

        {snapshot && !showOnboarding && (
          <>
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
                  className={`lw-nav-btn ${activeTab === key ? 'active' : ''}`}
                  onClick={() => setActiveTab(key)}
                >
                  {label}
                </button>
              ))}
            </nav>

            <div className="lw-actions">
              <button
                type="button"
                className="lw-btn lw-btn-sm"
                onClick={() => setInboxOpen(true)}
              >
                收件箱
                {pendingInboxCount > 0 && (
                  <span className="lw-count-dot">{pendingInboxCount}</span>
                )}
              </button>

              {snapshot.git.isRepo && (
                <button
                  type="button"
                  className="lw-btn lw-btn-sm"
                  title={
                    snapshot.git.dirtyCount > 0
                      ? `有 ${snapshot.git.dirtyCount} 处本地改动，点击提交 Git 快照`
                      : '当前工作区干净'
                  }
                  onClick={() => void handleCommitSnapshot()}
                >
                  快照{snapshot.git.dirtyCount > 0 ? ` (${snapshot.git.dirtyCount})` : ''}
                </button>
              )}

              <button
                type="button"
                className="lw-btn lw-btn-sm lw-btn-ghost"
                onClick={() => void loadAll(selectedDate, selectedWeek)}
                title="重新读取本地文件"
              >
                刷新
              </button>

              <button
                type="button"
                className="lw-btn lw-btn-sm lw-btn-ghost"
                onClick={() => setSettingsOpen(true)}
              >
                设置
              </button>
            </div>
          </>
        )}
      </header>

      {/* Body */}
      {loading && !snapshot && !settings ? (
        <div className="lw-onboard-wrap">
          <div className="lw-muted">正在加载 Life Wiki…</div>
        </div>
      ) : showOnboarding && settings ? (
        <OnboardingView
          settings={settings}
          canCancel={Boolean(settings.dataDir)}
          onCancel={() => setSwitchingVault(false)}
          onVaultReady={async (msg) => {
            setSwitchingVault(false)
            setSelectedWeek(undefined)
            await loadAll(selectedDate, undefined)
            showToast(msg)
          }}
        />
      ) : error && !snapshot ? (
        <div className="lw-onboard-wrap">
          <div className="lw-onboard-card">
            <div className="lw-banner lw-banner-warn">{error}</div>
            <div className="lw-row">
              <button
                type="button"
                className="lw-btn lw-btn-primary"
                onClick={() => void loadAll(selectedDate, selectedWeek)}
              >
                重试
              </button>
              <button
                type="button"
                className="lw-btn"
                onClick={() => setSwitchingVault(true)}
              >
                重新选择目录
              </button>
            </div>
          </div>
        </div>
      ) : snapshot ? (
        <main className="lw-main">
          {snapshot.hasSampleData && (
            <div className="lw-container" style={{ marginBottom: 14 }}>
              <div className="lw-banner lw-banner-accent">
                <span>
                  当前库带有示例项目与示例笔记，帮你熟悉工作流。用顺手后可以随时一键清空示例（保留你自己写的内容）。
                </span>
                <button
                  type="button"
                  className="lw-btn lw-btn-sm"
                  onClick={() => setSettingsOpen(true)}
                >
                  去清空示例
                </button>
              </div>
            </div>
          )}

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

      {/* Drawers & Modals */}
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
          onSaved={() => loadAll(selectedDate, selectedWeek)}
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
