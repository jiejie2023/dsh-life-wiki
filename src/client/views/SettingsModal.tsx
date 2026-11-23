import React, { useState } from 'react'
import type { BoardSnapshot, VaultSettings } from '../../shared/types.ts'
import type { RunActionFn } from '../App.tsx'
import { api } from '../api.ts'
import { IconX } from '../components/Icons.tsx'

interface SettingsModalProps {
  settings: VaultSettings
  snapshot: BoardSnapshot
  onClose: () => void
  onSwitchVault: () => void
  onOpenFile: (relPath: string) => void
  onRunAction: RunActionFn
}

export function SettingsModal({
  settings,
  snapshot,
  onClose,
  onSwitchVault,
  onOpenFile,
  onRunAction,
}: SettingsModalProps) {
  const [areas, setAreas] = useState<string[]>(snapshot.areas)
  const [newArea, setNewArea] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  const areasChanged = JSON.stringify(areas) !== JSON.stringify(snapshot.areas)
  const otherRecent = settings.recentDirs.filter((d) => d !== snapshot.vaultRoot)

  const handleAddArea = (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = newArea.trim()
    if (!cleaned || areas.includes(cleaned)) return
    setAreas([...areas, cleaned])
    setNewArea('')
  }

  return (
    <div className="lw-backdrop lw-backdrop-center" onClick={onClose}>
      <div className="lw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lw-panel-header">
          <strong>设置</strong>
          <button type="button" className="lw-icon-btn" onClick={onClose}>
            <IconX />
          </button>
        </div>

        <div className="lw-panel-body lw-stack" style={{ gap: 20 }}>
          {/* Vault Path */}
          <div className="lw-stack" style={{ gap: 8 }}>
            <div className="lw-between">
              <span className="lw-field-label" style={{ margin: 0 }}>
                当前目录
              </span>
              <button
                type="button"
                className="lw-btn lw-btn-sm"
                onClick={() => {
                  onClose()
                  onSwitchVault()
                }}
              >
                切换 / 新建
              </button>
            </div>
            <div
              className="lw-mono"
              style={{
                fontSize: 12.5,
                color: 'var(--lw-text-2)',
                padding: '7px 10px',
                borderRadius: 7,
                background: 'var(--lw-subtle)',
                wordBreak: 'break-all',
              }}
            >
              {snapshot.vaultRoot}
            </div>
            <div className="lw-row" style={{ gap: 4 }}>
              <button
                type="button"
                className="lw-btn lw-btn-sm lw-btn-ghost"
                onClick={() => {
                  onClose()
                  onOpenFile('system/schema.md')
                }}
              >
                schema.md
              </button>
              <button
                type="button"
                className="lw-btn lw-btn-sm lw-btn-ghost"
                onClick={() => {
                  onClose()
                  onOpenFile('system/design.md')
                }}
              >
                design.md
              </button>
            </div>
          </div>

          {otherRecent.length > 0 && (
            <div className="lw-stack" style={{ gap: 6 }}>
              <span className="lw-field-label" style={{ margin: 0 }}>
                最近打开
              </span>
              {otherRecent.map((dir) => (
                <div key={dir} className="lw-between">
                  <span className="lw-mono lw-muted" style={{ wordBreak: 'break-all' }}>
                    {dir}
                  </span>
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm lw-btn-ghost"
                    onClick={() =>
                      void onRunAction(
                        async () => {
                          await api.openVault(dir)
                          onClose()
                        },
                        { reloadSettings: true },
                      )
                    }
                  >
                    切换
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Sample Data Cleanup */}
          {snapshot.hasSampleData && (
            <div className="lw-between" style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--lw-subtle)' }}>
              <span style={{ fontSize: 13 }}>示例数据</span>
              {!confirmClear ? (
                <button
                  type="button"
                  className="lw-btn lw-btn-sm lw-btn-danger"
                  onClick={() => setConfirmClear(true)}
                >
                  清空示例
                </button>
              ) : (
                <div className="lw-row" style={{ gap: 6 }}>
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm lw-btn-danger"
                    onClick={() =>
                      void onRunAction(
                        async () => {
                          await api.clearSampleData()
                          setConfirmClear(false)
                        },
                        { toast: '已清空示例数据' },
                      )
                    }
                  >
                    确认清空
                  </button>
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm lw-btn-ghost"
                    onClick={() => setConfirmClear(false)}
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Custom Areas */}
          <div className="lw-stack" style={{ gap: 8 }}>
            <span className="lw-field-label" style={{ margin: 0 }}>
              领域（area）
            </span>
            <div className="lw-row" style={{ gap: 6 }}>
              {areas.map((a) => (
                <span key={a} className="lw-tag" style={{ padding: '3px 8px', fontSize: 12.5 }}>
                  {a}
                  {areas.length > 1 && (
                    <button
                      type="button"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--lw-muted)',
                        cursor: 'pointer',
                        padding: '0 0 0 3px',
                        lineHeight: 1,
                      }}
                      onClick={() => setAreas(areas.filter((x) => x !== a))}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
            <form className="lw-row" onSubmit={handleAddArea}>
              <input
                className="lw-input"
                style={{ flex: 1 }}
                value={newArea}
                onChange={(e) => setNewArea(e.target.value)}
                placeholder="新增领域…"
              />
              <button type="submit" className="lw-btn lw-btn-sm" disabled={!newArea.trim()}>
                添加
              </button>
            </form>
            {areasChanged && (
              <div className="lw-row">
                <button
                  type="button"
                  className="lw-btn lw-btn-sm lw-btn-primary"
                  onClick={() =>
                    void onRunAction(() => api.updateAreas(areas), { toast: '已保存' })
                  }
                >
                  保存领域
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
