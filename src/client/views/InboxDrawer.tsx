import React, { useState } from 'react'
import type { BoardSnapshot } from '../../shared/types.ts'
import { api } from '../api.ts'

interface InboxDrawerProps {
  snapshot: BoardSnapshot
  selectedDate: string
  onClose: () => void
  onOpenFile: (relPath: string) => void
  onRunAction: (action: () => Promise<unknown>, toastText?: string) => Promise<void>
}

export function InboxDrawer({
  snapshot,
  selectedDate,
  onClose,
  onOpenFile,
  onRunAction,
}: InboxDrawerProps) {
  const [newText, setNewText] = useState('')
  const [taskPickerLine, setTaskPickerLine] = useState<number | null>(null)
  const [targetProject, setTargetProject] = useState(
    snapshot.projects.find((p) => p.status === 'doing')?.name ??
      snapshot.projects[0]?.name ??
      '',
  )
  const [showDone, setShowDone] = useState(false)

  const pending = snapshot.inbox.items.filter((i) => !i.checked)
  const done = snapshot.inbox.items.filter((i) => i.checked)
  const activeProjects = snapshot.projects

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newText.trim()) return
    await onRunAction(async () => {
      await api.addInboxItem(newText.trim(), selectedDate)
      setNewText('')
    }, '已记入收件箱')
  }

  return (
    <div className="lw-backdrop" onClick={onClose}>
      <div className="lw-drawer lw-drawer-sm" onClick={(e) => e.stopPropagation()}>
        <div className="lw-panel-header">
          <div className="lw-row">
            <strong>收件箱</strong>
            <span className="lw-badge lw-badge-accent">{pending.length} 待处理</span>
          </div>
          <div className="lw-row">
            <button
              type="button"
              className="lw-btn lw-btn-sm lw-btn-ghost"
              onClick={() => {
                onClose()
                onOpenFile(snapshot.inbox.relPath)
              }}
            >
              打开原文
            </button>
            <button type="button" className="lw-btn lw-btn-sm" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>

        <div className="lw-panel-body lw-stack" style={{ gap: 14 }}>
          <form className="lw-row" onSubmit={(e) => void handleAdd(e)}>
            <input
              className="lw-input"
              style={{ flex: 1 }}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="随手记一句，回头再分流…"
              autoFocus
            />
            <button
              type="submit"
              className="lw-btn lw-btn-primary lw-btn-sm"
              disabled={!newText.trim()}
            >
              记下
            </button>
          </form>

          {pending.length === 0 ? (
            <div className="lw-muted" style={{ textAlign: 'center', padding: '24px 8px' }}>
              收件箱已清空
            </div>
          ) : (
            <div className="lw-stack" style={{ gap: 8 }}>
              {pending.map((item) => (
                <div
                  key={item.lineIndex}
                  style={{
                    padding: '9px 11px',
                    borderRadius: 8,
                    border: '1px solid var(--lw-border)',
                    background: 'var(--lw-bg)',
                  }}
                  className="lw-stack"
                >
                  <div className="lw-row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                    <input
                      type="checkbox"
                      checked={false}
                      style={{ marginTop: 3, accentColor: 'var(--lw-accent)' }}
                      onChange={() =>
                        void onRunAction(() => api.toggleInboxItem(item.lineIndex))
                      }
                    />
                    <div className="lw-task-text" style={{ fontSize: 13.5 }}>
                      {item.text}
                    </div>
                  </div>

                  <div className="lw-row" style={{ paddingLeft: 22 }}>
                    <button
                      type="button"
                      className="lw-btn lw-btn-sm"
                      onClick={() =>
                        void onRunAction(
                          async () => {
                            await api.inboxToIdea(item.lineIndex)
                          },
                          '已转为想法（写入 projects/00_ideas/）',
                        )
                      }
                    >
                      转为想法
                    </button>
                    {activeProjects.length > 0 && (
                      <button
                        type="button"
                        className="lw-btn lw-btn-sm"
                        onClick={() => {
                          setTaskPickerLine(
                            taskPickerLine === item.lineIndex ? null : item.lineIndex,
                          )
                          if (!targetProject && activeProjects[0]) {
                            setTargetProject(activeProjects[0].name)
                          }
                        }}
                      >
                        转今日任务
                      </button>
                    )}
                    <button
                      type="button"
                      className="lw-btn lw-btn-sm lw-btn-ghost"
                      onClick={() =>
                        void onRunAction(
                          () => api.deleteInboxItem(item.lineIndex),
                          '已删除收件箱条目',
                        )
                      }
                    >
                      删除
                    </button>
                  </div>

                  {taskPickerLine === item.lineIndex && activeProjects.length > 0 && (
                    <div className="lw-row" style={{ paddingLeft: 22 }}>
                      <select
                        className="lw-select"
                        style={{ flex: 1, padding: '4px 8px', fontSize: 12.5 }}
                        value={targetProject}
                        onChange={(e) => setTargetProject(e.target.value)}
                      >
                        {activeProjects.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="lw-btn lw-btn-sm lw-btn-primary"
                        disabled={!targetProject}
                        onClick={() =>
                          void onRunAction(async () => {
                            await api.inboxToTask(item.lineIndex, targetProject, selectedDate)
                            setTaskPickerLine(null)
                          }, `已转入「${targetProject}」今日任务`)
                        }
                      >
                        确认转入
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="lw-stack" style={{ gap: 6 }}>
              <button
                type="button"
                className="lw-btn lw-btn-sm lw-btn-ghost"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setShowDone((v) => !v)}
              >
                {showDone ? '收起' : '显示'}已处理 ({done.length})
              </button>
              {showDone &&
                done.map((item) => (
                  <div key={item.lineIndex} className="lw-task-item">
                    <input
                      type="checkbox"
                      checked
                      onChange={() =>
                        void onRunAction(() => api.toggleInboxItem(item.lineIndex))
                      }
                    />
                    <span className="lw-task-text lw-task-done" style={{ fontSize: 13 }}>
                      {item.text}
                    </span>
                    <button
                      type="button"
                      className="lw-btn lw-btn-sm lw-btn-ghost"
                      onClick={() =>
                        void onRunAction(() => api.deleteInboxItem(item.lineIndex))
                      }
                    >
                      删
                    </button>
                  </div>
                ))}
            </div>
          )}

          {snapshot.inbox.proposals.length > 0 && (
            <div className="lw-stack" style={{ gap: 6 }}>
              <div className="lw-divider" />
              <div className="lw-muted" style={{ fontWeight: 600 }}>
                待确认提议
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {snapshot.inbox.proposals.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
