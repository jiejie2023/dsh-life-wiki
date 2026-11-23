import React, { useState } from 'react'
import type { BoardSnapshot, VaultSettings } from '../../shared/types.ts'
import { api } from '../api.ts'

interface SettingsModalProps {
  settings: VaultSettings
  snapshot: BoardSnapshot
  onClose: () => void
  onSwitchVault: () => void
  onOpenFile: (relPath: string) => void
  onRunAction: (action: () => Promise<unknown>, toastText?: string) => Promise<void>
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
          <strong>Life Wiki 设置</strong>
          <button type="button" className="lw-btn lw-btn-sm lw-btn-ghost" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="lw-panel-body lw-stack" style={{ gap: 18 }}>
          {/* Current Vault */}
          <div className="lw-stack" style={{ gap: 6 }}>
            <div style={{ fontWeight: 600 }}>当前本地知识库</div>
            <div
              className="lw-mono"
              style={{
                fontSize: 12.5,
                padding: '8px 10px',
                borderRadius: 7,
                background: 'var(--lw-surface-2)',
                border: '1px solid var(--lw-border)',
                wordBreak: 'break-all',
              }}
            >
              {snapshot.vaultRoot}
            </div>
            <div className="lw-row">
              <button
                type="button"
                className="lw-btn lw-btn-sm"
                onClick={() => {
                  onClose()
                  onSwitchVault()
                }}
              >
                切换 / 新建知识库
              </button>
              <button
                type="button"
                className="lw-btn lw-btn-sm lw-btn-ghost"
                onClick={() => {
                  onClose()
                  onOpenFile('system/schema.md')
                }}
              >
                查看 schema.md
              </button>
              <button
                type="button"
                className="lw-btn lw-btn-sm lw-btn-ghost"
                onClick={() => {
                  onClose()
                  onOpenFile('system/design.md')
                }}
              >
                查看 design.md
              </button>
            </div>
          </div>

          {settings.recentDirs.filter((d) => d !== snapshot.vaultRoot).length > 0 && (
            <div className="lw-stack" style={{ gap: 6 }}>
              <div className="lw-muted" style={{ fontWeight: 600 }}>
                快速切换最近目录
              </div>
              {settings.recentDirs
                .filter((d) => d !== snapshot.vaultRoot)
                .map((dir) => (
                  <div key={dir} className="lw-between">
                    <span className="lw-mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                      {dir}
                    </span>
                    <button
                      type="button"
                      className="lw-btn lw-btn-sm"
                      onClick={() =>
                        void onRunAction(async () => {
                          await api.openVault(dir)
                          onClose()
                        }, '已切换知识库')
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
            <div
              className="lw-stack"
              style={{
                padding: 12,
                borderRadius: 8,
                background: 'var(--lw-warn-soft)',
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--lw-warn)' }}>
                当前库包含初始化示例数据
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--lw-text-2)' }}>
                熟悉用法后可以一键清空示例项目、示例日记和示例知识页。只会删除未被你改动过的示例文件，绝不会碰你自己新建的内容。
              </div>
              <div className="lw-row">
                {!confirmClear ? (
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm lw-btn-danger"
                    onClick={() => setConfirmClear(true)}
                  >
                    一键清空示例数据
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="lw-btn lw-btn-sm lw-btn-danger"
                      onClick={() =>
                        void onRunAction(async () => {
                          const res = await api.clearSampleData()
                          setConfirmClear(false)
                          if (res.removedCount === 0) return
                        }, '示例数据已清空，已保留你新建的内容')
                      }
                    >
                      确认清空示例
                    </button>
                    <button
                      type="button"
                      className="lw-btn lw-btn-sm"
                      onClick={() => setConfirmClear(false)}
                    >
                      取消
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Custom Areas */}
          <div className="lw-stack" style={{ gap: 8 }}>
            <div>
              <div style={{ fontWeight: 600 }}>自定义领域（area）</div>
              <div className="lw-muted">
                用于给项目归类，修改后会直接写回 <span className="lw-mono">system/schema.md</span>。
              </div>
            </div>

            <div className="lw-row">
              {areas.map((a) => (
                <span key={a} className="lw-badge" style={{ padding: '4px 9px', fontSize: 12.5 }}>
                  {a}
                  {areas.length > 1 && (
                    <button
                      type="button"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--lw-muted)',
                        cursor: 'pointer',
                        padding: '0 2px',
                        marginLeft: 3,
                      }}
                      title={`移除 ${a}`}
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
                placeholder="输入新领域名称，如：创作、家庭、财务…"
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
                    void onRunAction(async () => {
                      await api.updateAreas(areas)
                    }, '已更新领域列表并写回 system/schema.md')
                  }
                >
                  保存领域设置
                </button>
                <button
                  type="button"
                  className="lw-btn lw-btn-sm lw-btn-ghost"
                  onClick={() => setAreas(snapshot.areas)}
                >
                  还原
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="lw-panel-footer">
          <button type="button" className="lw-btn lw-btn-primary" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
