import React, { useMemo, useRef, useState } from 'react'
import type { BoardSnapshot, ProjectTaskGroup, TaskFileStatus } from '../../shared/types.ts'
import type { RunActionFn } from '../App.tsx'
import { api } from '../api.ts'
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconFile,
  IconPlus,
  IconX,
} from '../components/Icons.tsx'

interface TodayViewProps {
  snapshot: BoardSnapshot
  selectedDate: string
  onDateChange: (nextDate: string) => void
  onOpenFile: (relPath: string) => void
  onJumpToDiary: () => void
  onRunAction: RunActionFn
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function shiftDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d! + deltaDays))
  return dt.toISOString().slice(0, 10)
}

function todayLocalIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatReadableDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  const dt = new Date(y, m - 1, d)
  return `${m}月${d}日 · ${WEEKDAYS[dt.getDay()]}`
}

export function TodayView({
  snapshot,
  selectedDate,
  onDateChange,
  onOpenFile,
  onJumpToDiary,
  onRunAction,
}: TodayViewProps) {
  const [diaryText, setDiaryText] = useState('')
  const [newTaskInputs, setNewTaskInputs] = useState<Record<string, string>>({})
  const [durationOpenKey, setDurationOpenKey] = useState<string | null>(null)
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({})
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})
  const [noteKinds, setNoteKinds] = useState<Record<string, 'log' | 'reflection'>>({})
  const [revealedProjects, setRevealedProjects] = useState<Record<string, boolean>>({})
  const [warningsModalOpen, setWarningsModalOpen] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const { diary, groups, formatWarnings } = snapshot.today
  const isToday = selectedDate === todayLocalIso()

  const { activeGroups, idleGroups } = useMemo(() => {
    const active: ProjectTaskGroup[] = []
    const idle: ProjectTaskGroup[] = []
    for (const g of groups) {
      if (g.exists || g.projectStatus === 'doing' || revealedProjects[g.projectName]) {
        active.push(g)
      } else {
        idle.push(g)
      }
    }
    return { activeGroups: active, idleGroups: idle }
  }, [groups, revealedProjects])

  const totalDone = groups.reduce(
    (sum, g) => sum + g.tasks.filter((t) => t.checked).length,
    0,
  )
  const totalTasks = groups.reduce((sum, g) => sum + g.tasks.length, 0)
  const totalMinutes = groups.reduce((sum, g) => sum + g.totalMinutes, 0)

  const handleDiaryAppend = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = diaryText.trim()
    if (!trimmed) return
    setDiaryText('')
    await onRunAction(() => api.appendDiary(trimmed, selectedDate), {
      optimistic: (prev) => ({
        ...prev,
        today: {
          ...prev.today,
          diary: {
            ...prev.today.diary,
            exists: true,
            preview: trimmed,
            entryCount: prev.today.diary.entryCount + 1,
          },
        },
      }),
    })
  }

  const handleToggleTask = async (
    group: ProjectTaskGroup,
    lineIndex: number,
    minutes?: number,
  ) => {
    setDurationOpenKey(null)
    await onRunAction(() => api.toggleTask(group.fileRelPath, lineIndex, minutes), {
      optimistic: (prev) => ({
        ...prev,
        today: {
          ...prev.today,
          groups: prev.today.groups.map((g) => {
            if (g.fileRelPath !== group.fileRelPath) return g
            const nextTasks = g.tasks.map((t) => {
              if (t.lineIndex !== lineIndex) return t
              const nextChecked = !t.checked
              return {
                ...t,
                checked: nextChecked,
                minutes: nextChecked ? (minutes ?? t.minutes) : t.minutes,
              }
            })
            return {
              ...g,
              tasks: nextTasks,
              totalMinutes: nextTasks.reduce(
                (s, t) => s + (t.checked && t.minutes ? t.minutes : 0),
                0,
              ),
            }
          }),
        },
      }),
    })
  }

  const handleAddTask = async (projectName: string) => {
    const text = (newTaskInputs[projectName] ?? '').trim()
    if (!text) return
    setNewTaskInputs((prev) => ({ ...prev, [projectName]: '' }))
    await onRunAction(() => api.addTask(projectName, text, selectedDate), {
      optimistic: (prev) => ({
        ...prev,
        today: {
          ...prev.today,
          groups: prev.today.groups.map((g) =>
            g.projectName !== projectName
              ? g
              : {
                  ...g,
                  exists: true,
                  status: g.status ?? 'doing',
                  tasks: [
                    ...g.tasks,
                    {
                      lineIndex: -Date.now(),
                      checked: false,
                      text,
                      minutes: null,
                      fromDate: null,
                      rawLine: `- [ ] ${text}`,
                    },
                  ],
                },
          ),
        },
      }),
    })
  }

  const handleCycleStatus = async (group: ProjectTaskGroup) => {
    const order: TaskFileStatus[] = ['todo', 'doing', 'done']
    const cur = group.status ?? 'doing'
    const next = order[(order.indexOf(cur) + 1) % order.length]!
    await onRunAction(() => api.updateTaskStatus(group.fileRelPath, next), {
      optimistic: (prev) => ({
        ...prev,
        today: {
          ...prev.today,
          groups: prev.today.groups.map((g) =>
            g.fileRelPath === group.fileRelPath ? { ...g, status: next } : g,
          ),
        },
      }),
    })
  }

  const handleAppendNote = async (group: ProjectTaskGroup) => {
    const text = (noteInputs[group.projectName] ?? '').trim()
    if (!text) return
    const section = noteKinds[group.projectName] ?? 'log'
    setNoteInputs((prev) => ({ ...prev, [group.projectName]: '' }))
    await onRunAction(() => api.appendTaskEntry(group.fileRelPath, section, text), {
      optimistic: (prev) => ({
        ...prev,
        today: {
          ...prev.today,
          groups: prev.today.groups.map((g) => {
            if (g.fileRelPath !== group.fileRelPath) return g
            return section === 'log'
              ? { ...g, logs: [...g.logs, text] }
              : { ...g, reflections: [...g.reflections, text] }
          }),
        },
      }),
    })
  }

  return (
    <div className="lw-canvas">
      {/* Calm Date Header */}
      <div className="lw-page-head">
        <div className="lw-row" style={{ gap: 6 }}>
          <h1
            className="lw-h1"
            style={{ cursor: 'pointer' }}
            title="点击选择日期"
            onClick={() => {
              try {
                dateInputRef.current?.showPicker?.()
              } catch {
                dateInputRef.current?.focus()
                dateInputRef.current?.click()
              }
            }}
          >
            {formatReadableDate(selectedDate)}
          </h1>
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) onDateChange(e.target.value)
            }}
            style={{
              position: 'absolute',
              opacity: 0,
              pointerEvents: 'none',
              width: 1,
              height: 1,
            }}
          />
          <button
            type="button"
            className="lw-icon-btn"
            title="前一天"
            onClick={() => onDateChange(shiftDate(selectedDate, -1))}
          >
            <IconChevronLeft />
          </button>
          <button
            type="button"
            className="lw-icon-btn"
            title="后一天"
            onClick={() => onDateChange(shiftDate(selectedDate, 1))}
          >
            <IconChevronRight />
          </button>
          {!isToday && (
            <button
              type="button"
              className="lw-btn lw-btn-sm lw-btn-ghost"
              onClick={() => onDateChange(todayLocalIso())}
            >
              回到今天
            </button>
          )}
        </div>

        <div className="lw-muted" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {totalTasks > 0 && (
            <span>
              {totalDone} / {totalTasks} 完成
            </span>
          )}
          {totalMinutes > 0 && <span>{totalMinutes}m</span>}
          {formatWarnings.length > 0 && (
            <button
              type="button"
              className="lw-btn lw-btn-sm lw-btn-ghost"
              style={{ color: 'var(--lw-warn)', padding: '0 6px' }}
              onClick={() => setWarningsModalOpen(true)}
            >
              {formatWarnings.length} 项格式提醒
            </button>
          )}
        </div>
      </div>

      {/* Quiet Diary Line */}
      <div className="lw-stack" style={{ gap: 6 }}>
        <form className="lw-capture" onSubmit={(e) => void handleDiaryAppend(e)}>
          <input
            className="lw-inline-input"
            style={{ padding: '2px 0' }}
            value={diaryText}
            onChange={(e) => setDiaryText(e.target.value)}
            placeholder="记一句今天的日记…"
          />
          {diaryText.trim() ? (
            <button type="submit" className="lw-btn lw-btn-sm lw-btn-primary">
              记下
            </button>
          ) : diary.exists ? (
            <button
              type="button"
              className="lw-btn lw-btn-sm lw-btn-ghost"
              onClick={onJumpToDiary}
            >
              已记 {diary.entryCount || 1} 段
            </button>
          ) : null}
        </form>
        {diary.exists && diary.preview && (
          <div
            className="lw-muted"
            style={{
              paddingLeft: 12,
              cursor: 'pointer',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            onClick={() => onOpenFile(diary.relPath)}
          >
            {diary.preview}
          </div>
        )}
      </div>

      {/* Active Project Task Sections */}
      {activeGroups.length === 0 ? (
        <div className="lw-empty">
          还没有进行中的项目，去「项目」页新建一个吧。
        </div>
      ) : (
        <div className="lw-stack" style={{ gap: 26 }}>
          {activeGroups.map((group) => {
            const logsOpen = Boolean(expandedLogs[group.projectName])
            const noteKind = noteKinds[group.projectName] ?? 'log'
            const noteCount = group.logs.length + group.reflections.length

            return (
              <section key={group.projectName} className="lw-stack" style={{ gap: 6 }}>
                <div className="lw-section-head">
                  <div className="lw-row" style={{ gap: 8 }}>
                    <h2 className="lw-section-title">{group.projectName}</h2>
                    {group.area && <span className="lw-muted">{group.area}</span>}
                    {group.totalMinutes > 0 && (
                      <span className="lw-muted">{group.totalMinutes}m</span>
                    )}
                  </div>

                  <div className="lw-hover-actions">
                    {group.exists && (
                      <>
                        <button
                          type="button"
                          className="lw-btn lw-btn-sm lw-btn-ghost"
                          title="点击切换当日状态"
                          onClick={() => void handleCycleStatus(group)}
                        >
                          {group.status ?? 'doing'}
                        </button>
                        <button
                          type="button"
                          className="lw-btn lw-btn-sm lw-btn-ghost"
                          onClick={() =>
                            setExpandedLogs((prev) => ({
                              ...prev,
                              [group.projectName]: !logsOpen,
                            }))
                          }
                        >
                          日志{noteCount > 0 ? ` ${noteCount}` : ''}
                        </button>
                        <button
                          type="button"
                          className="lw-icon-btn"
                          title="打开原文"
                          onClick={() => onOpenFile(group.fileRelPath)}
                        >
                          <IconFile size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Tasks */}
                <div className="lw-list">
                  {group.tasks.map((task) => {
                    const rowKey = `${group.fileRelPath}:${task.lineIndex}`
                    const durOpen = durationOpenKey === rowKey
                    return (
                      <div key={task.lineIndex} className="lw-item-row">
                        <button
                          type="button"
                          className={`lw-check ${task.checked ? 'checked' : ''}`}
                          onClick={() => void handleToggleTask(group, task.lineIndex)}
                          aria-label={task.checked ? '取消完成' : '标记完成'}
                        >
                          {task.checked && <IconCheck />}
                        </button>

                        <div className={`lw-item-title ${task.checked ? 'lw-item-done' : ''}`}>
                          {task.text}
                          {task.fromDate && (
                            <span className="lw-muted" style={{ marginLeft: 8 }}>
                              {task.fromDate}
                            </span>
                          )}
                        </div>

                        {task.checked && task.minutes !== null ? (
                          <span className="lw-muted">{task.minutes}m</span>
                        ) : !task.checked ? (
                          durOpen ? (
                            <div className="lw-popover-row">
                              {[15, 30, 45, 60].map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  className="lw-pop-chip"
                                  onClick={() => void handleToggleTask(group, task.lineIndex, m)}
                                >
                                  {m}m
                                </button>
                              ))}
                              <button
                                type="button"
                                className="lw-pop-chip"
                                onClick={() => setDurationOpenKey(null)}
                              >
                                <IconX size={11} />
                              </button>
                            </div>
                          ) : (
                            <div className="lw-hover-actions">
                              <button
                                type="button"
                                className="lw-icon-btn"
                                style={{ height: 24, minWidth: 24, padding: '0 5px' }}
                                title="记录用时并完成"
                                onClick={() => setDurationOpenKey(rowKey)}
                              >
                                <IconClock size={13} />
                              </button>
                            </div>
                          )
                        ) : null}
                      </div>
                    )
                  })}

                  {/* Seamless inline add task */}
                  <form
                    className="lw-row"
                    style={{ padding: '4px 0 2px 28px' }}
                    onSubmit={(e) => {
                      e.preventDefault()
                      void handleAddTask(group.projectName)
                    }}
                  >
                    <input
                      className="lw-inline-input"
                      style={{ flex: 1, fontSize: 13.5 }}
                      value={newTaskInputs[group.projectName] ?? ''}
                      onChange={(e) =>
                        setNewTaskInputs((prev) => ({
                          ...prev,
                          [group.projectName]: e.target.value,
                        }))
                      }
                      placeholder="+ 添加任务"
                    />
                  </form>
                </div>

                {/* Collapsible Log & Reflection */}
                {group.exists && logsOpen && (
                  <div
                    className="lw-stack"
                    style={{
                      marginLeft: 28,
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'var(--lw-subtle)',
                      gap: 8,
                    }}
                  >
                    {group.logs.map((l, i) => (
                      <div key={`l-${i}`} style={{ fontSize: 13, color: 'var(--lw-text-2)' }}>
                        · {l}
                      </div>
                    ))}
                    {group.reflections.map((r, i) => (
                      <div key={`r-${i}`} style={{ fontSize: 13, color: 'var(--lw-accent-text)' }}>
                        ↳ {r}
                      </div>
                    ))}
                    <form
                      className="lw-row"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void handleAppendNote(group)
                      }}
                    >
                      <button
                        type="button"
                        className="lw-btn lw-btn-sm lw-btn-ghost"
                        onClick={() =>
                          setNoteKinds((prev) => ({
                            ...prev,
                            [group.projectName]: noteKind === 'log' ? 'reflection' : 'log',
                          }))
                        }
                      >
                        {noteKind === 'log' ? '日志' : '反思'}
                      </button>
                      <input
                        className="lw-inline-input"
                        style={{ flex: 1, fontSize: 13 }}
                        value={noteInputs[group.projectName] ?? ''}
                        onChange={(e) =>
                          setNoteInputs((prev) => ({
                            ...prev,
                            [group.projectName]: e.target.value,
                          }))
                        }
                        placeholder={noteKind === 'log' ? '写一条日志，回车保存…' : '写一条反思，回车保存…'}
                      />
                    </form>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* Idle Projects quiet strip */}
      {idleGroups.length > 0 && (
        <div className="lw-row" style={{ paddingTop: 4 }}>
          <span className="lw-muted">其他项目：</span>
          {idleGroups.map((g) => (
            <button
              key={g.projectName}
              type="button"
              className="lw-btn lw-btn-sm lw-btn-ghost"
              onClick={() =>
                setRevealedProjects((prev) => ({ ...prev, [g.projectName]: true }))
              }
            >
              <IconPlus size={12} />
              {g.projectName}
            </button>
          ))}
        </div>
      )}

      {/* Quiet Format Warnings Modal (only on explicit click) */}
      {warningsModalOpen && (
        <div
          className="lw-backdrop lw-backdrop-center"
          onClick={() => setWarningsModalOpen(false)}
        >
          <div className="lw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lw-panel-header">
              <strong>非标任务文件 ({formatWarnings.length})</strong>
              <button
                type="button"
                className="lw-icon-btn"
                onClick={() => setWarningsModalOpen(false)}
              >
                <IconX />
              </button>
            </div>
            <div className="lw-panel-body lw-stack" style={{ gap: 8 }}>
              {formatWarnings.map((w) => (
                <div key={w.fileRelPath} className="lw-between" style={{ padding: '4px 0' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                      {w.projectName} · {w.date}
                    </div>
                    <div className="lw-muted">{w.issues.join(' / ')}</div>
                  </div>
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm"
                    onClick={() => {
                      setWarningsModalOpen(false)
                      onOpenFile(w.fileRelPath)
                    }}
                  >
                    打开
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
