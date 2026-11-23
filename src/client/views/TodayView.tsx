import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { BoardSnapshot, ProjectTaskGroup, TaskFileStatus } from '../../shared/types.ts'
import type { RunActionFn } from '../App.tsx'
import { api } from '../api.ts'
import {
  IconCheck,
  IconChevronDown,
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

const TASK_STATUS_OPTIONS: Array<{ value: TaskFileStatus; label: string }> = [
  { value: 'todo', label: '未开始' },
  { value: 'doing', label: '进行中' },
  { value: 'done', label: '已完成' },
]

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

function formatDurationSummary(minutes: number): string {
  if (minutes < 60) return `今日投入 ${minutes} min`
  const h = (minutes / 60).toFixed(1).replace(/\.0$/, '')
  return `今日投入 ${h} h`
}

function cleanDisplayBullet(line: string): string {
  return line.replace(/^\s*[-*•·]+\s+/, '').trim()
}

function cleanTaskDisplayText(text: string, hasMinutes: boolean): string {
  if (!hasMinutes) return text
  return text
    .replace(/\s*[（(]\s*\d+(?:\.\d+)?\s*(分钟|分|min|小时|h)\s*[）)]\s*$/i, '')
    .trimEnd()
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
  const [customMinutes, setCustomMinutes] = useState('')
  const [statusMenuProject, setStatusMenuProject] = useState<string | null>(null)
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({})
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})
  const [noteKinds, setNoteKinds] = useState<Record<string, 'log' | 'reflection'>>({})
  const [revealedProjects, setRevealedProjects] = useState<Record<string, boolean>>({})
  const [warningsModalOpen, setWarningsModalOpen] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const { diary, groups, formatWarnings } = snapshot.today
  const isToday = selectedDate === todayLocalIso()

  // Close floating menus on outside click or Esc
  useEffect(() => {
    if (!statusMenuProject && !durationOpenKey) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (statusMenuProject && !target?.closest('[data-status-menu]')) {
        setStatusMenuProject(null)
      }
      if (durationOpenKey && !target?.closest('[data-duration-menu]')) {
        setDurationOpenKey(null)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStatusMenuProject(null)
        setDurationOpenKey(null)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [statusMenuProject, durationOpenKey])

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

  const durationTooltip = useMemo(() => {
    const parts = groups
      .filter((g) => g.totalMinutes > 0)
      .map((g) => `${g.projectName} ${g.totalMinutes} min`)
    return parts.length > 0 ? `今日各项目投入：${parts.join('，')}` : '今日任务累计投入时长'
  }, [groups])

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
    setCustomMinutes('')
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
              totalMinutes: nextTasks.reduce((s, t) => s + (t.minutes ?? 0), 0),
            }
          }),
        },
      }),
    })
  }

  const handleSetMinutes = async (
    group: ProjectTaskGroup,
    lineIndex: number,
    minutes: number | null,
  ) => {
    setDurationOpenKey(null)
    setCustomMinutes('')
    await onRunAction(() => api.setTaskMinutes(group.fileRelPath, lineIndex, minutes), {
      optimistic: (prev) => ({
        ...prev,
        today: {
          ...prev.today,
          groups: prev.today.groups.map((g) => {
            if (g.fileRelPath !== group.fileRelPath) return g
            const nextTasks = g.tasks.map((t) =>
              t.lineIndex === lineIndex ? { ...t, minutes } : t,
            )
            return {
              ...g,
              tasks: nextTasks,
              totalMinutes: nextTasks.reduce((s, t) => s + (t.minutes ?? 0), 0),
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

  const handleSelectStatus = async (group: ProjectTaskGroup, next: TaskFileStatus) => {
    setStatusMenuProject(null)
    if (group.status === next) return
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
          {totalMinutes > 0 && (
            <span title={durationTooltip}>{formatDurationSummary(totalMinutes)}</span>
          )}
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
        <div className="lw-empty">还没有进行中的项目，去「项目」页新建一个吧。</div>
      ) : (
        <div className="lw-stack" style={{ gap: 28 }}>
          {activeGroups.map((group) => {
            const logsOpen = Boolean(expandedLogs[group.projectName])
            const noteKind = noteKinds[group.projectName] ?? 'log'
            const noteCount = group.logs.length + group.reflections.length
            const curStatus: TaskFileStatus = group.status ?? 'doing'
            const curStatusLabel =
              TASK_STATUS_OPTIONS.find((o) => o.value === curStatus)?.label ?? '进行中'
            const menuOpen = statusMenuProject === group.projectName

            return (
              <section key={group.projectName} className="lw-stack" style={{ gap: 6 }}>
                {/* Section Header */}
                <div className="lw-section-head">
                  <div className="lw-row" style={{ gap: 8 }}>
                    <h2 className="lw-section-title">{group.projectName}</h2>
                    {group.area && <span className="lw-muted">{group.area}</span>}
                    {group.totalMinutes > 0 && (
                      <span className="lw-muted">{group.totalMinutes} min</span>
                    )}
                  </div>

                  {group.exists && (
                    <div className="lw-row" style={{ gap: 4 }}>
                      {/* Linear-style Status Dropdown */}
                      <div className="lw-menu-wrap" data-status-menu>
                        <button
                          type="button"
                          className={`lw-status-trigger ${menuOpen ? 'open' : ''}`}
                          onClick={() =>
                            setStatusMenuProject(menuOpen ? null : group.projectName)
                          }
                        >
                          <span className={`lw-status-dot ${curStatus}`} />
                          <span>{curStatusLabel}</span>
                          <IconChevronDown size={12} />
                        </button>

                        {menuOpen && (
                          <div className="lw-menu" role="menu">
                            {TASK_STATUS_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                role="menuitem"
                                className={`lw-menu-item ${curStatus === opt.value ? 'active' : ''}`}
                                onClick={() => void handleSelectStatus(group, opt.value)}
                              >
                                <span className={`lw-status-dot ${opt.value}`} />
                                <span style={{ flex: 1 }}>{opt.label}</span>
                                {curStatus === opt.value && <IconCheck size={12} />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        className={`lw-btn lw-btn-sm ${logsOpen ? '' : 'lw-btn-ghost'}`}
                        onClick={() =>
                          setExpandedLogs((prev) => ({
                            ...prev,
                            [group.projectName]: !logsOpen,
                          }))
                        }
                      >
                        日志/反思{noteCount > 0 ? ` ${noteCount}` : ''}
                      </button>

                      <button
                        type="button"
                        className="lw-icon-btn"
                        style={{ height: 26, minWidth: 26 }}
                        title="打开原文"
                        onClick={() => onOpenFile(group.fileRelPath)}
                      >
                        <IconFile size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Tasks List */}
                <div className="lw-list">
                  {group.tasks.map((task) => {
                    const rowKey = `${group.fileRelPath}:${task.lineIndex}`
                    const durOpen = durationOpenKey === rowKey
                    const displayText = cleanTaskDisplayText(task.text, task.minutes !== null)

                    const applyDuration = (mins: number | null) => {
                      if (!task.checked && mins !== null) {
                        void handleToggleTask(group, task.lineIndex, mins)
                      } else {
                        void handleSetMinutes(group, task.lineIndex, mins)
                      }
                    }

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
                          {displayText}
                          {task.fromDate && (
                            <span className="lw-muted" style={{ marginLeft: 8 }}>
                              {task.fromDate}
                            </span>
                          )}
                        </div>

                        <div data-duration-menu>
                          {durOpen ? (
                            <form
                              className="lw-popover-row"
                              onSubmit={(e) => {
                                e.preventDefault()
                                const parsed = Number(customMinutes.trim())
                                if (Number.isFinite(parsed) && parsed > 0) {
                                  applyDuration(parsed)
                                }
                              }}
                            >
                              {[15, 30, 45, 60].map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  className="lw-pop-chip"
                                  onClick={() => applyDuration(m)}
                                >
                                  {m} min
                                </button>
                              ))}
                              <input
                                className="lw-inline-input"
                                style={{
                                  width: 44,
                                  fontSize: 12,
                                  padding: '2px 4px',
                                  textAlign: 'center',
                                }}
                                placeholder="min"
                                value={customMinutes}
                                onChange={(e) => setCustomMinutes(e.target.value)}
                                autoFocus
                              />
                              {task.minutes !== null && (
                                <button
                                  type="button"
                                  className="lw-pop-chip"
                                  title="清除耗时"
                                  onClick={() => applyDuration(null)}
                                >
                                  清除
                                </button>
                              )}
                            </form>
                          ) : task.minutes !== null ? (
                            <button
                              type="button"
                              className="lw-time-btn"
                              title="点击修改耗时"
                              onClick={() => {
                                setCustomMinutes(String(task.minutes ?? ''))
                                setDurationOpenKey(rowKey)
                              }}
                            >
                              {task.minutes} min
                            </button>
                          ) : (
                            <div className="lw-hover-actions">
                              <button
                                type="button"
                                className="lw-icon-btn"
                                style={{ height: 24, minWidth: 24, padding: '0 5px' }}
                                title="记录用时"
                                onClick={() => {
                                  setCustomMinutes('')
                                  setDurationOpenKey(rowKey)
                                }}
                              >
                                <IconClock size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Left-aligned inline add task: '+' aligns directly under checkboxes */}
                  <form
                    className="lw-item-row"
                    style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}
                    onSubmit={(e) => {
                      e.preventDefault()
                      void handleAddTask(group.projectName)
                    }}
                  >
                    <span
                      style={{
                        width: 17,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--lw-muted)',
                        flexShrink: 0,
                      }}
                    >
                      <IconPlus size={14} />
                    </span>
                    <input
                      className="lw-inline-input"
                      style={{ flex: 1, padding: 0, fontSize: 13.5 }}
                      value={newTaskInputs[group.projectName] ?? ''}
                      onChange={(e) =>
                        setNewTaskInputs((prev) => ({
                          ...prev,
                          [group.projectName]: e.target.value,
                        }))
                      }
                      placeholder="添加任务"
                    />
                  </form>
                </div>

                {/* Left-aligned Log & Reflection Panel */}
                {group.exists && logsOpen && (
                  <div className="lw-notes-box">
                    {(group.logs.length > 0 || group.reflections.length > 0) && (
                      <div className="lw-stack" style={{ gap: 6 }}>
                        {group.logs.map((l, i) => (
                          <div key={`l-${i}`} className="lw-note-line">
                            <span className="lw-note-tag">日志</span>
                            <span style={{ color: 'var(--lw-text-2)' }}>
                              {cleanDisplayBullet(l)}
                            </span>
                          </div>
                        ))}
                        {group.reflections.map((r, i) => (
                          <div key={`r-${i}`} className="lw-note-line">
                            <span className="lw-note-tag reflection">反思</span>
                            <span style={{ color: 'var(--lw-text)' }}>
                              {cleanDisplayBullet(r)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <form
                      className="lw-row"
                      style={{ gap: 10 }}
                      onSubmit={(e) => {
                        e.preventDefault()
                        void handleAppendNote(group)
                      }}
                    >
                      <div className="lw-seg" role="tablist">
                        <button
                          type="button"
                          className={`lw-seg-btn ${noteKind === 'log' ? 'active' : ''}`}
                          onClick={() =>
                            setNoteKinds((prev) => ({ ...prev, [group.projectName]: 'log' }))
                          }
                        >
                          日志
                        </button>
                        <button
                          type="button"
                          className={`lw-seg-btn ${noteKind === 'reflection' ? 'active' : ''}`}
                          onClick={() =>
                            setNoteKinds((prev) => ({
                              ...prev,
                              [group.projectName]: 'reflection',
                            }))
                          }
                        >
                          反思
                        </button>
                      </div>

                      <input
                        className="lw-inline-input"
                        style={{ flex: 1, fontSize: 13.5, padding: '2px 0' }}
                        value={noteInputs[group.projectName] ?? ''}
                        onChange={(e) =>
                          setNoteInputs((prev) => ({
                            ...prev,
                            [group.projectName]: e.target.value,
                          }))
                        }
                        placeholder={
                          noteKind === 'log' ? '写一条日志，回车保存…' : '写一条反思，回车保存…'
                        }
                      />

                      {(noteInputs[group.projectName] ?? '').trim() && (
                        <button type="submit" className="lw-btn lw-btn-sm lw-btn-primary">
                          记录
                        </button>
                      )}
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

      {/* Quiet Format Warnings Modal */}
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
