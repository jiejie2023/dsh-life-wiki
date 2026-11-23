import React, { useEffect, useMemo, useState } from 'react'
import type { DirectoryBrowseResult, DirectoryInspection, VaultSettings } from '../../shared/types.ts'
import { api, hasNativeDirectoryPicker, pickNativeDirectory } from '../api.ts'
import { IconFolder, IconX } from '../components/Icons.tsx'

interface OnboardingViewProps {
  settings: VaultSettings
  canCancel?: boolean
  onCancel?: () => void
  onVaultReady: () => Promise<void>
}

function joinClientPath(parent: string, child: string): string {
  const cleanedParent = parent.trim().replace(/[\\/]+$/, '')
  const cleanedChild = child.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim()
  if (!cleanedParent || !cleanedChild) return ''
  const sep = cleanedParent.includes('\\') || /^[a-zA-Z]:/.test(cleanedParent) ? '\\' : '/'
  return `${cleanedParent}${sep}${cleanedChild}`
}

function folderBasename(p: string): string {
  const cleaned = p.replace(/[\\/]+$/, '')
  const parts = cleaned.split(/[\\/]/)
  return parts[parts.length - 1] || p
}

export function OnboardingView({
  settings,
  canCancel,
  onCancel,
  onVaultReady,
}: OnboardingViewProps) {
  const [mode, setMode] = useState<'create' | 'open'>('create')

  // Create mode: Name -> Location -> Create <Location>/<Name>
  const [vaultName, setVaultName] = useState('')
  const [parentDir, setParentDir] = useState(settings.defaultParentDir)
  const [withSample, setWithSample] = useState(true)
  const [initGit, setInitGit] = useState(true)

  // Open mode: pick an existing vault folder
  const [openDir, setOpenDir] = useState(settings.dataDir ?? '')

  const [inspection, setInspection] = useState<DirectoryInspection | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Built-in folder browser modal
  const [browserOpen, setBrowserOpen] = useState(false)
  const [browseData, setBrowseData] = useState<DirectoryBrowseResult | null>(null)
  const [browsePathInput, setBrowsePathInput] = useState('')
  const [browsing, setBrowsing] = useState(false)

  const nativePickerAvailable = hasNativeDirectoryPicker()

  const computedTargetDir = useMemo(() => {
    if (mode === 'create') {
      return joinClientPath(parentDir, vaultName)
    }
    return openDir.trim()
  }, [mode, parentDir, vaultName, openDir])

  useEffect(() => {
    if (!computedTargetDir) {
      setInspection(null)
      return
    }
    const timer = setTimeout(() => {
      api
        .inspectDirectory(computedTargetDir)
        .then((res) => {
          setInspection(res)
          setError(null)
        })
        .catch(() => {
          setInspection(null)
        })
    }, 200)
    return () => clearTimeout(timer)
  }, [computedTargetDir])

  const handlePickFolder = async () => {
    if (nativePickerAvailable) {
      const picked = await pickNativeDirectory()
      if (picked) {
        if (mode === 'create') setParentDir(picked)
        else setOpenDir(picked)
      }
      return
    }
    setBrowserOpen(true)
    void navigateBrowser(mode === 'create' ? parentDir : openDir || settings.defaultParentDir)
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanName = vaultName.trim()
    const cleanParent = parentDir.trim()
    if (!cleanName) {
      setError('请先给知识库起个名字')
      return
    }
    if (!cleanParent) {
      setError('请选择要存放的位置')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.initVault({
        parentDir: cleanParent,
        vaultName: cleanName,
        withSample,
        initGit,
      })
      await onVaultReady()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleOpenExisting = async (targetDir: string) => {
    const cleaned = targetDir.trim()
    if (!cleaned) return
    setBusy(true)
    setError(null)
    try {
      await api.openVault(cleaned)
      await onVaultReady()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const createConflictNonVault =
    mode === 'create' &&
    Boolean(inspection?.exists && !inspection.isEmpty && !inspection.looksLikeVault)

  const createConflictVault =
    mode === 'create' && Boolean(inspection?.exists && inspection.looksLikeVault)

  return (
    <div className="lw-onboard-wrap">
      <div className="lw-onboard-card">
        <div className="lw-between">
          <div>
            <h1 className="lw-h1">Life Wiki</h1>
            <div className="lw-muted" style={{ marginTop: 4 }}>
              本地优先的 Markdown 个人项目与知识库
            </div>
          </div>
          {canCancel && onCancel && (
            <button type="button" className="lw-btn lw-btn-sm lw-btn-ghost" onClick={onCancel}>
              返回
            </button>
          )}
        </div>

        {/* Clean 2-mode switch */}
        <div className="lw-subtabs">
          <button
            type="button"
            className={`lw-subtab ${mode === 'create' ? 'active' : ''}`}
            onClick={() => {
              setMode('create')
              setError(null)
            }}
          >
            新建知识库
          </button>
          <button
            type="button"
            className={`lw-subtab ${mode === 'open' ? 'active' : ''}`}
            onClick={() => {
              setMode('open')
              setError(null)
            }}
          >
            打开已有库
          </button>
        </div>

        {mode === 'create' ? (
          <form className="lw-stack" style={{ gap: 16 }} onSubmit={(e) => void handleCreate(e)}>
            <div>
              <label className="lw-field-label">知识库名称</label>
              <input
                className="lw-input"
                value={vaultName}
                onChange={(e) => {
                  setVaultName(e.target.value)
                  setError(null)
                }}
                placeholder="例如：我的知识库、Life Wiki"
                autoFocus
              />
            </div>

            <div>
              <label className="lw-field-label">存放位置（将在此目录下自动新建同名文件夹）</label>
              <div className="lw-row">
                <input
                  className="lw-input lw-mono"
                  style={{ flex: 1 }}
                  value={parentDir}
                  onChange={(e) => setParentDir(e.target.value)}
                  placeholder={settings.defaultParentDir}
                />
                <button
                  type="button"
                  className="lw-btn"
                  disabled={busy}
                  onClick={() => void handlePickFolder()}
                >
                  选择文件夹
                </button>
                {nativePickerAvailable && (
                  <button
                    type="button"
                    className="lw-btn lw-btn-ghost"
                    disabled={busy}
                    onClick={() => {
                      setBrowserOpen(true)
                      void navigateBrowser(parentDir)
                    }}
                  >
                    浏览
                  </button>
                )}
              </div>
              {computedTargetDir && (
                <div className="lw-muted lw-mono" style={{ marginTop: 6, wordBreak: 'break-all' }}>
                  将创建在：{computedTargetDir}
                </div>
              )}
            </div>

            {createConflictVault && (
              <div className="lw-between" style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--lw-accent-text)' }}>
                  该位置已存在同名知识库，可以直接打开
                </span>
                <button
                  type="button"
                  className="lw-btn lw-btn-sm lw-btn-accent"
                  disabled={busy}
                  onClick={() => void handleOpenExisting(computedTargetDir)}
                >
                  直接打开
                </button>
              </div>
            )}

            {createConflictNonVault && (
              <div style={{ fontSize: 13, color: 'var(--lw-warn)' }}>
                该位置已存在同名非空文件夹，请换一个名称或存放位置。
              </div>
            )}

            <div className="lw-row" style={{ gap: 18 }}>
              <label
                className="lw-row"
                style={{ fontSize: 13, color: 'var(--lw-text-2)', cursor: 'pointer', gap: 6 }}
              >
                <input
                  type="checkbox"
                  checked={withSample}
                  onChange={(e) => setWithSample(e.target.checked)}
                  style={{ accentColor: 'var(--lw-accent)' }}
                />
                带示例数据（可一键清空）
              </label>
              <label
                className="lw-row"
                style={{ fontSize: 13, color: 'var(--lw-text-2)', cursor: 'pointer', gap: 6 }}
              >
                <input
                  type="checkbox"
                  checked={initGit}
                  onChange={(e) => setInitGit(e.target.checked)}
                  style={{ accentColor: 'var(--lw-accent)' }}
                />
                初始化 Git
              </label>
            </div>

            {error && <div style={{ color: 'var(--lw-danger)', fontSize: 13 }}>{error}</div>}

            <div className="lw-row">
              <button
                type="submit"
                className="lw-btn lw-btn-primary"
                disabled={busy || !vaultName.trim() || !parentDir.trim() || createConflictNonVault || createConflictVault}
              >
                {busy ? '正在创建…' : '创建知识库'}
              </button>
            </div>
          </form>
        ) : (
          <div className="lw-stack" style={{ gap: 16 }}>
            <div>
              <label className="lw-field-label">选择已有的知识库文件夹</label>
              <div className="lw-row">
                <input
                  className="lw-input lw-mono"
                  style={{ flex: 1 }}
                  value={openDir}
                  onChange={(e) => setOpenDir(e.target.value)}
                  placeholder={settings.defaultSuggestedDir}
                  autoFocus
                />
                <button
                  type="button"
                  className="lw-btn"
                  disabled={busy}
                  onClick={() => void handlePickFolder()}
                >
                  选择文件夹
                </button>
                {nativePickerAvailable && (
                  <button
                    type="button"
                    className="lw-btn lw-btn-ghost"
                    disabled={busy}
                    onClick={() => {
                      setBrowserOpen(true)
                      void navigateBrowser(openDir || settings.defaultParentDir)
                    }}
                  >
                    浏览
                  </button>
                )}
              </div>
            </div>

            {inspection && (
              <div className="lw-meta">
                {inspection.looksLikeVault
                  ? '已识别为标准知识库，直接打开不会覆盖原文件。'
                  : inspection.exists
                    ? '未检测到标准目录，仍可直接打开或切换到「新建知识库」。'
                    : '该目录不存在。'}
              </div>
            )}

            {error && <div style={{ color: 'var(--lw-danger)', fontSize: 13 }}>{error}</div>}

            <div className="lw-row">
              <button
                type="button"
                className="lw-btn lw-btn-primary"
                disabled={busy || !openDir.trim() || (inspection !== null && !inspection.exists)}
                onClick={() => void handleOpenExisting(openDir)}
              >
                {busy ? '正在打开…' : '打开知识库'}
              </button>
            </div>
          </div>
        )}

        {settings.recentDirs.length > 0 && (
          <div
            className="lw-stack"
            style={{ gap: 4, paddingTop: 12, borderTop: '1px solid var(--lw-border)' }}
          >
            <div className="lw-muted" style={{ marginBottom: 2 }}>
              最近打开
            </div>
            {settings.recentDirs.map((dir) => (
              <div
                key={dir}
                className="lw-item-row"
                style={{ cursor: 'pointer', alignItems: 'center', padding: '7px 10px' }}
                onClick={() => void handleOpenExisting(dir)}
              >
                <IconFolder size={14} />
                <span style={{ fontWeight: 500, fontSize: 13.5 }}>{folderBasename(dir)}</span>
                <span
                  className="lw-mono lw-muted"
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textAlign: 'right',
                  }}
                >
                  {dir}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Built-in Folder Browser Modal */}
      {browserOpen && (
        <div className="lw-backdrop lw-backdrop-center" onClick={() => setBrowserOpen(false)}>
          <div className="lw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lw-panel-header">
              <strong>{mode === 'create' ? '选择存放位置' : '选择知识库文件夹'}</strong>
              <button
                type="button"
                className="lw-icon-btn"
                onClick={() => setBrowserOpen(false)}
              >
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
                          if (mode === 'create') setParentDir(entry.path)
                          else setOpenDir(entry.path)
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
                className="lw-btn lw-btn-ghost"
                onClick={() => setBrowserOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="lw-btn lw-btn-primary"
                disabled={!browseData}
                onClick={() => {
                  if (browseData) {
                    if (mode === 'create') setParentDir(browseData.currentPath)
                    else setOpenDir(browseData.currentPath)
                  }
                  setBrowserOpen(false)
                }}
              >
                选当前目录
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
