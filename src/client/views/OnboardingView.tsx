import React, { useEffect, useState } from 'react'
import type { DirectoryBrowseResult, DirectoryInspection, VaultSettings } from '../../shared/types.ts'
import { api, hasNativeDirectoryPicker, pickNativeDirectory } from '../api.ts'
import { IconFolder, IconX } from '../components/Icons.tsx'

interface OnboardingViewProps {
  settings: VaultSettings
  canCancel?: boolean
  onCancel?: () => void
  onVaultReady: () => Promise<void>
}

export function OnboardingView({
  settings,
  canCancel,
  onCancel,
  onVaultReady,
}: OnboardingViewProps) {
  const [dirInput, setDirInput] = useState(settings.dataDir ?? settings.defaultSuggestedDir)
  const [inspection, setInspection] = useState<DirectoryInspection | null>(null)
  const [initGit, setInitGit] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [browserOpen, setBrowserOpen] = useState(false)
  const [browseData, setBrowseData] = useState<DirectoryBrowseResult | null>(null)
  const [browsePathInput, setBrowsePathInput] = useState('')
  const [browsing, setBrowsing] = useState(false)

  const nativePickerAvailable = hasNativeDirectoryPicker()

  useEffect(() => {
    const cleaned = dirInput.trim()
    if (!cleaned) {
      setInspection(null)
      return
    }
    const timer = setTimeout(() => {
      api
        .inspectDirectory(cleaned)
        .then((res) => {
          setInspection(res)
          setError(null)
        })
        .catch((err) => {
          setInspection(null)
          setError(err instanceof Error ? err.message : String(err))
        })
    }, 220)
    return () => clearTimeout(timer)
  }, [dirInput])

  const handleNativePick = async () => {
    const picked = await pickNativeDirectory()
    if (picked) setDirInput(picked)
  }

  const navigateBrowser = async (target?: string) => {
    setBrowsing(true)
    try {
      const res = await api.browseDirectories(target)
      setBrowseData(res)
      setBrowsePathInput(res.currentPath)
    } finally {
      setBrowsing(false)
    }
  }

  const handleOpenExisting = async (targetDir: string) => {
    setBusy(true)
    setError(null)
    try {
      await api.openVault(targetDir)
      await onVaultReady()
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
      await onVaultReady()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="lw-onboard-wrap">
      <div className="lw-onboard-card">
        <div className="lw-between">
          <div>
            <h1 className="lw-h1">Life Wiki</h1>
            <div className="lw-muted" style={{ marginTop: 4 }}>
              选择一个本地文件夹，所有笔记与项目直接保存为 Markdown。
            </div>
          </div>
          {canCancel && onCancel && (
            <button type="button" className="lw-btn lw-btn-sm lw-btn-ghost" onClick={onCancel}>
              返回
            </button>
          )}
        </div>

        <div className="lw-row">
          <input
            className="lw-input lw-mono"
            style={{ flex: 1 }}
            value={dirInput}
            onChange={(e) => setDirInput(e.target.value)}
            placeholder={settings.defaultSuggestedDir}
          />
          {nativePickerAvailable ? (
            <button
              type="button"
              className="lw-btn"
              onClick={() => void handleNativePick()}
              disabled={busy}
            >
              选择
            </button>
          ) : null}
          <button
            type="button"
            className="lw-btn lw-btn-ghost"
            onClick={() => {
              setBrowserOpen(true)
              void navigateBrowser(dirInput)
            }}
            disabled={busy}
          >
            浏览
          </button>
        </div>

        {error && <div style={{ color: 'var(--lw-danger)', fontSize: 13 }}>{error}</div>}

        {inspection && (
          <div className="lw-stack" style={{ gap: 14 }}>
            {inspection.looksLikeVault ? (
              <div className="lw-between">
                <span className="lw-meta">检测到已有知识库，不会覆盖原文件</span>
                <button
                  type="button"
                  className="lw-btn lw-btn-primary"
                  disabled={busy}
                  onClick={() => void handleOpenExisting(inspection.path)}
                >
                  打开知识库
                </button>
              </div>
            ) : !inspection.exists || inspection.isEmpty ? (
              <>
                <label className="lw-row" style={{ fontSize: 13, color: 'var(--lw-text-2)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={initGit}
                    onChange={(e) => setInitGit(e.target.checked)}
                    style={{ accentColor: 'var(--lw-accent)' }}
                  />
                  同时初始化本地 Git
                </label>
                <div className="lw-row">
                  <button
                    type="button"
                    className="lw-btn lw-btn-primary"
                    disabled={busy}
                    onClick={() => void handleInit(true)}
                  >
                    新建（带示例）
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
              </>
            ) : (
              <div className="lw-stack" style={{ gap: 10 }}>
                <div className="lw-meta">该目录非空（{inspection.entryCount} 项）</div>
                <div className="lw-row">
                  <button
                    type="button"
                    className="lw-btn lw-btn-primary"
                    onClick={() => {
                      const cleaned = dirInput.trim().replace(/[\\/]+$/, '')
                      const sep = cleaned.includes('\\') ? '\\' : '/'
                      setDirInput(`${cleaned}${sep}Life Wiki`)
                    }}
                  >
                    新建子目录 Life Wiki
                  </button>
                  <button
                    type="button"
                    className="lw-btn"
                    disabled={busy}
                    onClick={() => void handleInit(false)}
                  >
                    就地初始化
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {settings.recentDirs.length > 0 && (
          <div className="lw-stack" style={{ gap: 6, paddingTop: 10, borderTop: '1px solid var(--lw-border)' }}>
            <div className="lw-muted">最近打开</div>
            {settings.recentDirs.map((dir) => (
              <div
                key={dir}
                className="lw-item-row"
                style={{ cursor: 'pointer', alignItems: 'center' }}
                onClick={() => void handleOpenExisting(dir)}
              >
                <IconFolder size={14} />
                <span className="lw-mono" style={{ fontSize: 12.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {dir}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {browserOpen && (
        <div className="lw-backdrop lw-backdrop-center" onClick={() => setBrowserOpen(false)}>
          <div className="lw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lw-panel-header">
              <strong>选择文件夹</strong>
              <button type="button" className="lw-icon-btn" onClick={() => setBrowserOpen(false)}>
                <IconX />
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
                />
                {browseData?.parentPath && (
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm"
                    onClick={() => void navigateBrowser(browseData.parentPath!)}
                  >
                    上一级
                  </button>
                )}
              </form>
              <div className="lw-dir-list">
                {browsing ? (
                  <div style={{ padding: 14 }} className="lw-muted">
                    读取中…
                  </div>
                ) : !browseData || browseData.entries.length === 0 ? (
                  <div style={{ padding: 14 }} className="lw-muted">
                    无子文件夹
                  </div>
                ) : (
                  browseData.entries.map((entry) => (
                    <div
                      key={entry.path}
                      className="lw-dir-row"
                      onClick={() => void navigateBrowser(entry.path)}
                    >
                      <span className="lw-row" style={{ gap: 8 }}>
                        <IconFolder size={14} />
                        {entry.name}
                      </span>
                      <button
                        type="button"
                        className="lw-btn lw-btn-sm lw-btn-ghost"
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
              <button type="button" className="lw-btn lw-btn-ghost" onClick={() => setBrowserOpen(false)}>
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
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
