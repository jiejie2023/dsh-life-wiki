import React, { useEffect, useState } from 'react'
import type { DirectoryBrowseResult, DirectoryInspection, VaultSettings } from '../../shared/types.ts'
import { api, hasNativeDirectoryPicker, pickNativeDirectory } from '../api.ts'

interface OnboardingViewProps {
  settings: VaultSettings
  canCancel?: boolean
  onCancel?: () => void
  onVaultReady: (message: string) => Promise<void>
}

export function OnboardingView({
  settings,
  canCancel,
  onCancel,
  onVaultReady,
}: OnboardingViewProps) {
  const [dirInput, setDirInput] = useState(settings.dataDir ?? settings.defaultSuggestedDir)
  const [inspection, setInspection] = useState<DirectoryInspection | null>(null)
  const [inspecting, setInspecting] = useState(false)
  const [initGit, setInitGit] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Built-in directory browser modal
  const [browserOpen, setBrowserOpen] = useState(false)
  const [browseData, setBrowseData] = useState<DirectoryBrowseResult | null>(null)
  const [browsePathInput, setBrowsePathInput] = useState('')
  const [browsing, setBrowsing] = useState(false)

  const nativePickerAvailable = hasNativeDirectoryPicker()

  const runInspect = async (target: string) => {
    const cleaned = target.trim()
    if (!cleaned) {
      setInspection(null)
      return
    }
    setInspecting(true)
    setError(null)
    try {
      const result = await api.inspectDirectory(cleaned)
      setInspection(result)
    } catch (err) {
      setInspection(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setInspecting(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void runInspect(dirInput)
    }, 260)
    return () => clearTimeout(timer)
  }, [dirInput])

  const handleNativePick = async () => {
    try {
      const picked = await pickNativeDirectory()
      if (picked) {
        setDirInput(picked)
        await runInspect(picked)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const openBrowser = async (startPath?: string) => {
    setBrowserOpen(true)
    setBrowsing(true)
    try {
      const res = await api.browseDirectories(startPath)
      setBrowseData(res)
      setBrowsePathInput(res.currentPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBrowsing(false)
    }
  }

  const navigateBrowser = async (target?: string) => {
    setBrowsing(true)
    try {
      const res = await api.browseDirectories(target)
      setBrowseData(res)
      setBrowsePathInput(res.currentPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBrowsing(false)
    }
  }

  const handleOpenExisting = async (targetDir: string) => {
    setBusy(true)
    setError(null)
    try {
      await api.openVault(targetDir)
      await onVaultReady('已打开本地知识库')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleInit = async (withSample: boolean) => {
    const target = dirInput.trim()
    if (!target) return
    setBusy(true)
    setError(null)
    try {
      await api.initVault({ dir: target, withSample, initGit })
      await onVaultReady(withSample ? '已创建 Life Wiki（含示例数据）' : '已创建空白 Life Wiki')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const appendSubfolder = () => {
    const cleaned = dirInput.trim().replace(/[\\/]+$/, '')
    const sep = cleaned.includes('\\') ? '\\' : '/'
    setDirInput(`${cleaned}${sep}Life Wiki`)
  }

  return (
    <div className="lw-onboard-wrap">
      <div className="lw-onboard-card">
        <div className="lw-between">
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
              Life Wiki
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--lw-muted)',
                  marginLeft: 10,
                }}
              >
                人生知识库
              </span>
            </div>
            <div className="lw-muted" style={{ marginTop: 4 }}>
              你的项目、每日任务、日记、周复盘与知识页都存为本地 Markdown 文件，不锁平台，随时可用任意编辑器打开。
            </div>
          </div>
          {canCancel && onCancel && (
            <button type="button" className="lw-btn lw-btn-ghost" onClick={onCancel}>
              返回当前库
            </button>
          )}
        </div>

        <div className="lw-stack">
          <label style={{ fontSize: 13, fontWeight: 600 }}>选择一个本地文件夹作为知识库</label>
          <div className="lw-row">
            <input
              className="lw-input lw-mono"
              style={{ flex: '1 1 280px' }}
              value={dirInput}
              onChange={(e) => setDirInput(e.target.value)}
              placeholder={settings.defaultSuggestedDir}
            />
            {nativePickerAvailable && (
              <button
                type="button"
                className="lw-btn lw-btn-primary"
                onClick={() => void handleNativePick()}
                disabled={busy}
              >
                选择文件夹
              </button>
            )}
            <button
              type="button"
              className="lw-btn"
              onClick={() => void openBrowser(dirInput)}
              disabled={busy}
            >
              浏览目录
            </button>
          </div>
        </div>

        {error && <div className="lw-banner lw-banner-warn">{error}</div>}

        {inspecting && <div className="lw-muted">正在检查目录状态…</div>}

        {!inspecting && inspection && (
          <div className="lw-stack">
            {inspection.looksLikeVault ? (
              <div className="lw-stack">
                <div className="lw-banner lw-banner-accent">
                  <div>
                    <div style={{ fontWeight: 600 }}>检测到已有的 Life Wiki 知识库</div>
                    <div style={{ fontSize: 12.5, marginTop: 2 }}>
                      已发现：
                      {[
                        inspection.hasProjects && 'projects/',
                        inspection.hasInbox && 'inbox.md',
                        inspection.hasSystem && 'system/',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      。直接打开不会覆盖任何现有文件。
                    </div>
                  </div>
                </div>
                <div className="lw-row">
                  <button
                    type="button"
                    className="lw-btn lw-btn-primary"
                    disabled={busy}
                    onClick={() => void handleOpenExisting(inspection.path)}
                  >
                    {busy ? '正在打开…' : '直接打开已有库'}
                  </button>
                </div>
              </div>
            ) : !inspection.exists || inspection.isEmpty ? (
              <div className="lw-stack">
                <div className="lw-tree-box lw-mono">
                  <div style={{ fontWeight: 600, marginBottom: 4, fontFamily: 'inherit' }}>
                    将在此目录初始化标准结构（{inspection.exists ? '当前为空目录' : '将自动新建目录'}）：
                  </div>
                  <div>├── inbox.md            # 收件箱（随手记）</div>
                  <div>├── projects/           # 项目（00_ideas 想法 / 进行中项目 / 99_archives 归档）</div>
                  <div>├── raw/                # 原件库（me/diary 日记 + 外部文章与仓库）</div>
                  <div>├── wiki/               # 知识页（可检索的提炼笔记）</div>
                  <div>└── system/             # 规则说明与模板（schema.md / templates/）</div>
                </div>

                <label className="lw-row" style={{ fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={initGit}
                    onChange={(e) => setInitGit(e.target.checked)}
                    style={{ accentColor: 'var(--lw-accent)' }}
                  />
                  同时初始化本地 Git 仓库（支持顶栏一键提交快照）
                </label>

                <div className="lw-row">
                  <button
                    type="button"
                    className="lw-btn lw-btn-primary"
                    disabled={busy}
                    onClick={() => void handleInit(true)}
                  >
                    {busy ? '正在初始化…' : '新建（带示例数据，可一键清空）'}
                  </button>
                  <button
                    type="button"
                    className="lw-btn"
                    disabled={busy}
                    onClick={() => void handleInit(false)}
                  >
                    新建空白库
                  </button>
                </div>
              </div>
            ) : (
              <div className="lw-stack">
                <div className="lw-banner lw-banner-warn">
                  <div>
                    <div style={{ fontWeight: 600 }}>该目录不是空的（已有 {inspection.entryCount} 项）</div>
                    <div style={{ fontSize: 12.5, marginTop: 2 }}>
                      建议在它下面新建一个独立的 <span className="lw-mono">Life Wiki</span> 子文件夹；如果你确认要在这里直接使用，也可以直接补建目录（不会覆盖已有文件）。
                    </div>
                  </div>
                </div>
                <div className="lw-row">
                  <button
                    type="button"
                    className="lw-btn lw-btn-primary"
                    disabled={busy}
                    onClick={appendSubfolder}
                  >
                    改用子目录（…/Life Wiki）
                  </button>
                  <button
                    type="button"
                    className="lw-btn"
                    disabled={busy}
                    onClick={() => void handleInit(false)}
                  >
                    就地补建空白结构
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {settings.recentDirs.length > 0 && (
          <>
            <div className="lw-divider" />
            <div className="lw-stack" style={{ gap: 6 }}>
              <div className="lw-muted" style={{ fontWeight: 600 }}>
                最近打开的目录
              </div>
              {settings.recentDirs.map((dir) => (
                <div key={dir} className="lw-between" style={{ gap: 8 }}>
                  <span className="lw-mono" style={{ fontSize: 12.5, wordBreak: 'break-all' }}>
                    {dir}
                  </span>
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm"
                    disabled={busy}
                    onClick={() => void handleOpenExisting(dir)}
                  >
                    打开
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {browserOpen && (
        <div
          className="lw-backdrop lw-backdrop-center"
          onClick={() => setBrowserOpen(false)}
        >
          <div className="lw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lw-panel-header">
              <strong>浏览本机文件夹</strong>
              <button
                type="button"
                className="lw-btn lw-btn-ghost lw-btn-sm"
                onClick={() => setBrowserOpen(false)}
              >
                关闭
              </button>
            </div>
            <div className="lw-panel-body lw-stack">
              <form
                className="lw-row"
                onSubmit={(e) => {
                  e.preventDefault()
                  void navigateBrowser(browsePathInput)
                }}
              >
                <input
                  className="lw-input lw-mono"
                  style={{ flex: 1 }}
                  value={browsePathInput}
                  onChange={(e) => setBrowsePathInput(e.target.value)}
                  placeholder="输入路径如 D:\ 或 /Users/..."
                />
                <button type="submit" className="lw-btn lw-btn-sm" disabled={browsing}>
                  前往
                </button>
                {browseData?.parentPath && (
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm"
                    disabled={browsing}
                    onClick={() => void navigateBrowser(browseData.parentPath!)}
                  >
                    上一级
                  </button>
                )}
              </form>

              <div className="lw-dir-list">
                {browsing ? (
                  <div style={{ padding: 16 }} className="lw-muted">
                    读取中…
                  </div>
                ) : !browseData || browseData.entries.length === 0 ? (
                  <div style={{ padding: 16 }} className="lw-muted">
                    当前目录下没有子文件夹
                  </div>
                ) : (
                  browseData.entries.map((entry) => (
                    <div
                      key={entry.path}
                      className="lw-dir-row"
                      onClick={() => void navigateBrowser(entry.path)}
                    >
                      <span>📁 {entry.name}</span>
                      <button
                        type="button"
                        className="lw-btn lw-btn-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDirInput(entry.path)
                          setBrowserOpen(false)
                        }}
                      >
                        选此目录
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="lw-panel-footer">
              <button
                type="button"
                className="lw-btn"
                onClick={() => setBrowserOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="lw-btn lw-btn-primary"
                disabled={!browseData}
                onClick={() => {
                  if (browseData) setDirInput(browseData.currentPath)
                  setBrowserOpen(false)
                }}
              >
                选择当前目录
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
