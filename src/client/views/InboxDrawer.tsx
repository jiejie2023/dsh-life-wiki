import React, { useState } from 'react'
import type { BoardSnapshot } from '../../shared/types.ts'
import type { RunActionFn } from '../App.tsx'
import { api } from '../api.ts'
import { IconCheck, IconFile, IconX } from '../components/Icons.tsx'

interface InboxDrawerProps {
  snapshot: BoardSnapshot
  selectedDate: string
  onClose: () => void
  onOpenFile: (relPath: string, opts?: { edit?: boolean }) => void
  onRunAction: RunActionFn
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
    const text = newText.trim()
    if (!text) return
    setNewText('')
    await onRunAction(() => api.addInboxItem(text, selectedDate), {
      optimistic: (prev) => ({
        ...prev,
        inbox: {
          ...prev.inbox,
          items: [
            ...prev.inbox.items,
            { lineIndex: -Date.now(), checked: false, text, rawLine: `- [ ] ${text}` },
          ],
        },
      }),
    })
  }

  const handleToggle = async (lineIndex: number) => {
    await onRunAction(() => api.toggleInboxItem(lineIndex), {
      optimistic: (prev) => ({
        ...prev,
        inbox: {
          ...prev.inbox,
          items: prev.inbox.items.map((i) =>
            i.lineIndex === lineIndex ? { ...i, checked: !i.checked } : i,
          ),
        },
      }),
    })
  }

  const handleDelete = async (lineIndex: number) => {
    await onRunAction(() => api.deleteInboxItem(lineIndex), {
      optimistic: (prev) => ({
        ...prev,
        inbox: {
          ...prev.inbox,
          items: prev.inbox.items.filter((i) => i.lineIndex !== lineIndex),
        },
      }),
    })
  }

  return (
    <div className="lw-backdrop" onClick={onClose}>
      <div className="lw-drawer lw-drawer-sm" onClick={(e) => e.stopPropagation()}>
        <div className="lw-panel-header">
          <strong style={{ fontSize: 15 }}>收件箱</strong>
          <div className="lw-row" style={{ gap: 2 }}>
            <button
              type="button"
              className="lw-icon-btn"
              title="编辑 inbox.md"
              onClick={() => {
                onClose()
                onOpenFile(snapshot.inbox.relPath, { edit: true })
              }}
            >
              <IconFile size={14} />
            </button>
            <button type="button" className="lw-icon-btn" onClick={onClose}>
              <IconX />
            </button>
          </div>
        </div>

        <div className="lw-panel-body lw-stack" style={{ gap: 16 }}>
          <form className="lw-capture" onSubmit={(e) => void handleAdd(e)}>
            <input
              className="lw-inline-input"
              style={{ padding: '2px 0' }}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="随手记一条，回车保存…"
              autoFocus
            />
          </form>

          {pending.length === 0 ? (
            <div className="lw-empty">收件箱已清空</div>
          ) : (
            <div className="lw-list">
              {pending.map((item) => (
                <div key={item.lineIndex} className="lw-stack" style={{ gap: 4 }}>
                  <div className="lw-item-row">
                    <button
                      type="button"
                      className="lw-check"
                      style={{ marginTop: 3 }}
                      onClick={() => void handleToggle(item.lineIndex)}
                    />
                    <div className="lw-item-title">{item.text}</div>
                    <div className="lw-hover-actions">
                      <button
                        type="button"
                        className="lw-btn lw-btn-sm lw-btn-ghost"
                        onClick={() =>
                          void onRunAction(() => api.inboxToIdea(item.lineIndex), {
                            toast: '已转为想法',
                          })
                        }
                      >
                        想法
                      </button>
                      {activeProjects.length > 0 && (
                        <button
                          type="button"
                          className="lw-btn lw-btn-sm lw-btn-ghost"
                          onClick={() => {
                            setTaskPickerLine(
                              taskPickerLine === item.lineIndex ? null : item.lineIndex,
                            )
                            if (!targetProject && activeProjects[0]) {
                              setTargetProject(activeProjects[0].name)
                            }
                          }}
                        >
                          任务
                        </button>
                      )}
                      <button
                        type="button"
                        className="lw-icon-btn"
                        style={{ height: 24, minWidth: 24 }}
                        title="删除"
                        onClick={() => void handleDelete(item.lineIndex)}
                      >
                        <IconX size={13} />
                      </button>
                    </div>
                  </div>

                  {taskPickerLine === item.lineIndex && activeProjects.length > 0 && (
                    <div className="lw-row" style={{ padding: '0 0 8px 28px' }}>
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
                          void onRunAction(
                            async () => {
                              await api.inboxToTask(item.lineIndex, targetProject, selectedDate)
                              setTaskPickerLine(null)
                            },
                            { toast: `已转入「${targetProject}」` },
                          )
                        }
                      >
                        转入
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="lw-stack" style={{ gap: 4 }}>
              <button
                type="button"
                className="lw-btn lw-btn-sm lw-btn-ghost"
                style={{ alignSelf: 'flex-start', paddingLeft: 2 }}
                onClick={() => setShowDone((v) => !v)}
              >
                {showDone ? '收起' : '已处理'} ({done.length})
              </button>
              {showDone &&
                done.map((item) => (
                  <div key={item.lineIndex} className="lw-item-row">
                    <button
                      type="button"
                      className="lw-check checked"
                      onClick={() => void handleToggle(item.lineIndex)}
                    >
                      <IconCheck />
                    </button>
                    <span className="lw-item-title lw-item-done" style={{ fontSize: 13 }}>
                      {item.text}
                    </span>
                    <div className="lw-hover-actions">
                      <button
                        type="button"
                        className="lw-icon-btn"
                        style={{ height: 24, minWidth: 24 }}
                        onClick={() => void handleDelete(item.lineIndex)}
                      >
                        <IconX size={13} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {snapshot.inbox.proposals.length > 0 && (
            <div className="lw-stack" style={{ gap: 6, paddingTop: 8, borderTop: '1px solid var(--lw-border)' }}>
              <div className="lw-muted">待确认</div>
              {snapshot.inbox.proposals.map((p, idx) => (
                <div key={idx} style={{ fontSize: 13, color: 'var(--lw-text-2)' }}>
                  · {p}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
