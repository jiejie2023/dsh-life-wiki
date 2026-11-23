import React, { useEffect, useRef, useState } from 'react'
import type {
  ProjectTaskGroup,
  TaskFileStatus,
  TaskPriority,
} from '../../shared/types.ts'
import {
  IconCheck,
  IconChevronDown,
  IconClock,
  IconFile,
  IconPlus,
} from './Icons.tsx'
import { InlineText } from './MarkdownView.tsx'

export const TASK_STATUS_OPTIONS: Array<{ value: TaskFileStatus; label: string }> = [
  { value: 'todo', label: '未开始' },
  { value: 'doing', label: '进行中' },
  { value: 'done', label: '已完成' },
]

export const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
]

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

export function normalizePriority(p: unknown): TaskPriority {
  return p === 'high' || p === 'low' ? p : 'medium'
}

export function priorityLabel(p: TaskPriority): string {
  return p === 'high' ? '高' : p === 'low' ? '低' : '中'
}

function cleanDisplayBullet(line: string): string {
  return line.replace(/^\s*[-*•·]+\s+/, '').trim()
}

function cleanTaskDisplayText(text: string, hasMinutes: boolean): string {
  let out = text.replace(/^\s*(?:\[\s*(高|中|低|P1|P2|P3)\s*\]|【\s*(高|中|低)\s*】)\s*/i, '')
  if (hasMinutes) {
    out = out
      .replace(/\s*[（(]\s*\d+(?:\.\d+)?\s*(分钟|分|min|小时|h)\s*[）)]\s*$/i, '')
      .trimEnd()
  }
  return out
}

export interface ProjectTaskPanelProps {
  group: ProjectTaskGroup
  /** When provided, renders a section title on the left and mode tabs on the right (Today layout). */
  title?: string
  /** Optional custom left header control (e.g., compact date switcher in Project Tasks tab). */
  headerLeft?: React.ReactNode
  readOnly?: boolean
  autoFocusAdd?: boolean
  onToggleTask: (group: ProjectTaskGroup, lineIndex: number, minutes?: number) => void
  onSetMinutes: (group: ProjectTaskGroup, lineIndex: number, minutes: number | null) => void
  onSetPriority: (group: ProjectTaskGroup, lineIndex: number, priority: TaskPriority) => void
  onAddTask: (projectName: string, text: string, priority: TaskPriority) => void
  onSelectStatus: (group: ProjectTaskGroup, next: TaskFileStatus) => void
  onAppendNote: (group: ProjectTaskGroup, section: 'log' | 'reflection', text: string) => void
  onOpenFile: (relPath: string) => void
}

export function ProjectTaskPanel({
  group,
  title,
  headerLeft,
  readOnly = false,
  autoFocusAdd = false,
  onToggleTask,
  onSetMinutes,
  onSetPriority,
  onAddTask,
  onSelectStatus,
  onAppendNote,
  onOpenFile,
}: ProjectTaskPanelProps) {
  const [mode, setMode] = useState<'task' | 'log' | 'reflection'>(() =>
    group.tasks.length === 0 && group.logs.length > 0 ? 'log' : 'task',
  )
  const [newTaskText, setNewTaskText] = useState('')
  const [draftPrio, setDraftPrio] = useState<TaskPriority>('medium')
  const [newPrioOpen, setNewPrioOpen] = useState(false)
  const [prioOpenKey, setPrioOpenKey] = useState<string | null>(null)
  const [durationOpenKey, setDurationOpenKey] = useState<string | null>(null)
  const [customMinutes, setCustomMinutes] = useState('')
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [logInput, setLogInput] = useState('')
  const [reflectionInput, setReflectionInput] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMode(group.tasks.length === 0 && group.logs.length > 0 ? 'log' : 'task')
    setNewTaskText('')
    setNewPrioOpen(false)
    setPrioOpenKey(null)
    setDurationOpenKey(null)
    setCustomMinutes('')
    setStatusMenuOpen(false)
    setLogInput('')
    setReflectionInput('')
  }, [group.fileRelPath])

  useEffect(() => {
    if (autoFocusAdd && mode === 'task') {
      addInputRef.current?.focus()
    }
  }, [autoFocusAdd, mode])

  useEffect(() => {
    if (!statusMenuOpen && !durationOpenKey && !prioOpenKey && !newPrioOpen) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (statusMenuOpen && !target?.closest('[data-status-menu]')) setStatusMenuOpen(false)
      if (durationOpenKey && !target?.closest('[data-duration-menu]')) setDurationOpenKey(null)
      if (prioOpenKey && !target?.closest('[data-prio-menu]')) setPrioOpenKey(null)
      if (newPrioOpen && !target?.closest('[data-new-prio-menu]')) setNewPrioOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStatusMenuOpen(false)
        setDurationOpenKey(null)
        setPrioOpenKey(null)
        setNewPrioOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [statusMenuOpen, durationOpenKey, prioOpenKey, newPrioOpen])

  const curStatus: TaskFileStatus = group.status ?? 'doing'
  const curStatusLabel =
    TASK_STATUS_OPTIONS.find((o) => o.value === curStatus)?.label ?? '进行中'

  const sortedTasks = [...group.tasks].sort(
    (a, b) =>
      PRIORITY_ORDER[normalizePriority(a.priority)] -
        PRIORITY_ORDER[normalizePriority(b.priority)] || a.lineIndex - b.lineIndex,
  )

  const hasLeftHeader = Boolean(title || headerLeft)

  const modeTabsEl = (
    <div
      className="lw-mode-tabs"
      role="tablist"
      style={hasLeftHeader ? undefined : { marginRight: 0, marginLeft: -8 }}
    >
      {(
        [
          ['task', '任务'],
          ['log', '日志'],
          ['reflection', '反思'],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={mode === key}
          className={`lw-mode-tab ${mode === key ? 'active' : ''}`}
          onClick={() => setMode(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )

  const rightControlsEl = group.exists ? (
    <>
      {!readOnly ? (
        <div className="lw-menu-wrap" data-status-menu>
          <button
            type="button"
            className={`lw-status-trigger ${statusMenuOpen ? 'open' : ''}`}
            onClick={() => setStatusMenuOpen((v) => !v)}
          >
            <span className={`lw-status-dot ${curStatus}`} />
            <span>{curStatusLabel}</span>
            <IconChevronDown size={12} />
          </button>

          {statusMenuOpen && (
            <div className="lw-menu" role="menu">
              {TASK_STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="menuitem"
                  className={`lw-menu-item ${curStatus === opt.value ? 'active' : ''}`}
                  onClick={() => {
                    setStatusMenuOpen(false)
                    onSelectStatus(group, opt.value)
                  }}
                >
                  <span className={`lw-status-dot ${opt.value}`} />
                  <span style={{ flex: 1 }}>{opt.label}</span>
                  {curStatus === opt.value && <IconCheck size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <span className="lw-status-trigger" style={{ cursor: 'default' }}>
          <span className={`lw-status-dot ${curStatus}`} />
          <span>{curStatusLabel}</span>
        </span>
      )}

      <button
        type="button"
        className="lw-icon-btn"
        style={{ height: 26, minWidth: 26 }}
        title="打开原文"
        onClick={() => onOpenFile(group.fileRelPath)}
      >
        <IconFile size={14} />
      </button>
    </>
  ) : null

  return (
    <section className="lw-stack" style={{ gap: 6 }}>
      {/* Header Bar */}
      <div className="lw-section-head">
        {hasLeftHeader ? (
          <>
            {headerLeft ?? <h2 className="lw-section-title">{title}</h2>}
            <div className="lw-row" style={{ gap: 2 }}>
              {modeTabsEl}
              {rightControlsEl}
            </div>
          </>
        ) : (
          <>
            {modeTabsEl}
            <div className="lw-row" style={{ gap: 2 }}>
              {rightControlsEl}
            </div>
          </>
        )}
      </div>

      {/* Body: 任务 / 日志 / 反思 */}
      {mode === 'task' ? (
        <div className="lw-list">
          {sortedTasks.map((task) => {
            const rowKey = `${group.fileRelPath}:${task.lineIndex}`
            const durOpen = durationOpenKey === rowKey
            const prioOpen = prioOpenKey === rowKey
            const taskPrio = normalizePriority(task.priority)
            const displayText = cleanTaskDisplayText(task.text, task.minutes !== null)

            const applyDuration = (mins: number | null) => {
              setDurationOpenKey(null)
              setCustomMinutes('')
              if (!task.checked && mins !== null) {
                onToggleTask(group, task.lineIndex, mins)
              } else {
                onSetMinutes(group, task.lineIndex, mins)
              }
            }

            return (
              <div key={task.lineIndex} className="lw-item-row" style={{ alignItems: 'center' }}>
                <button
                  type="button"
                  className={`lw-check ${task.checked ? 'checked' : ''}`}
                  style={{ marginTop: 0 }}
                  disabled={readOnly}
                  onClick={() => {
                    setDurationOpenKey(null)
                    setCustomMinutes('')
                    onToggleTask(group, task.lineIndex)
                  }}
                  aria-label={task.checked ? '取消完成' : '标记完成'}
                >
                  {task.checked && <IconCheck />}
                </button>

                <div className={`lw-item-title ${task.checked ? 'lw-item-done' : ''}`}>
                  <InlineText
                    text={displayText}
                    baseRelPath={group.fileRelPath}
                    onOpenFile={onOpenFile}
                  />
                  {task.fromDate && (
                    <span className="lw-muted" style={{ marginLeft: 8 }}>
                      {task.fromDate}
                    </span>
                  )}
                </div>

                <div className="lw-row" style={{ gap: 8, flexShrink: 0 }}>
                  <div data-prio-menu style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {prioOpen && !readOnly ? (
                      <div className="lw-prio-picker">
                        {PRIORITY_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            className={`lw-prio-btn ${opt.value}`}
                            onClick={() => {
                              setPrioOpenKey(null)
                              onSetPriority(group, task.lineIndex, opt.value)
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={`lw-prio-btn ${taskPrio}`}
                        title={readOnly ? undefined : '点击修改优先级'}
                        disabled={readOnly}
                        onClick={() => setPrioOpenKey(rowKey)}
                      >
                        {priorityLabel(taskPrio)}
                      </button>
                    )}
                  </div>

                  <div
                    data-duration-menu
                    style={{ minWidth: 48, display: 'flex', justifyContent: 'flex-end' }}
                  >
                    {durOpen && !readOnly ? (
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
                        title={readOnly ? undefined : '点击修改耗时'}
                        disabled={readOnly}
                        onClick={() => {
                          setCustomMinutes(String(task.minutes ?? ''))
                          setDurationOpenKey(rowKey)
                        }}
                      >
                        {task.minutes} min
                      </button>
                    ) : !readOnly ? (
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
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}

          {!readOnly && (
            <form
              className="lw-item-row"
              style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}
              onSubmit={(e) => {
                e.preventDefault()
                const cleaned = newTaskText.trim()
                if (!cleaned) return
                setNewTaskText('')
                setNewPrioOpen(false)
                onAddTask(group.projectName, cleaned, draftPrio)
              }}
            >
              <span className="lw-bullet-slot">
                <IconPlus size={14} />
              </span>
              <input
                ref={addInputRef}
                className="lw-inline-input"
                style={{ flex: 1, padding: 0, fontSize: 13.5 }}
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="添加任务"
              />
              {(newTaskText.trim() || newPrioOpen) && (
                <div className="lw-row" style={{ gap: 8, flexShrink: 0 }} data-new-prio-menu>
                  {newPrioOpen ? (
                    <div className="lw-prio-picker">
                      {PRIORITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`lw-prio-btn ${opt.value}`}
                          onClick={() => {
                            setDraftPrio(opt.value)
                            setNewPrioOpen(false)
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={`lw-prio-btn ${draftPrio}`}
                      title="新任务优先级（点击切换高/中/低）"
                      onClick={() => setNewPrioOpen(true)}
                    >
                      {priorityLabel(draftPrio)}
                    </button>
                  )}
                  <span style={{ minWidth: 48 }} />
                </div>
              )}
            </form>
          )}
        </div>
      ) : mode === 'log' ? (
        <div className="lw-list">
          {group.logs.map((l, i) => (
            <div key={`l-${i}`} className="lw-item-row">
              <span className="lw-bullet-slot">
                <span className="lw-bullet-dot" />
              </span>
              <div className="lw-item-title">
                <InlineText
                  text={cleanDisplayBullet(l)}
                  baseRelPath={group.fileRelPath}
                  onOpenFile={onOpenFile}
                />
              </div>
            </div>
          ))}
          {!readOnly && (
            <form
              className="lw-item-row"
              style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}
              onSubmit={(e) => {
                e.preventDefault()
                const text = logInput.trim()
                if (!text) return
                setLogInput('')
                onAppendNote(group, 'log', text)
              }}
            >
              <span className="lw-bullet-slot">
                <IconPlus size={14} />
              </span>
              <input
                className="lw-inline-input"
                style={{ flex: 1, padding: 0, fontSize: 13.5 }}
                value={logInput}
                onChange={(e) => setLogInput(e.target.value)}
                placeholder="添加日志"
              />
            </form>
          )}
        </div>
      ) : (
        <div className="lw-list">
          {group.reflections.map((r, i) => (
            <div key={`r-${i}`} className="lw-item-row">
              <span className="lw-bullet-slot">
                <span className="lw-bullet-dot reflection" />
              </span>
              <div className="lw-item-title">
                <InlineText
                  text={cleanDisplayBullet(r)}
                  baseRelPath={group.fileRelPath}
                  onOpenFile={onOpenFile}
                />
              </div>
            </div>
          ))}
          {!readOnly && (
            <form
              className="lw-item-row"
              style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}
              onSubmit={(e) => {
                e.preventDefault()
                const text = reflectionInput.trim()
                if (!text) return
                setReflectionInput('')
                onAppendNote(group, 'reflection', text)
              }}
            >
              <span className="lw-bullet-slot">
                <IconPlus size={14} />
              </span>
              <input
                className="lw-inline-input"
                style={{ flex: 1, padding: 0, fontSize: 13.5 }}
                value={reflectionInput}
                onChange={(e) => setReflectionInput(e.target.value)}
                placeholder="添加反思"
              />
            </form>
          )}
        </div>
      )}
    </section>
  )
}
