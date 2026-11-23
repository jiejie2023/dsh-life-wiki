import React, { useEffect, useMemo, useRef, useState } from 'react'
import type {
  BoardSnapshot,
  ProjectTaskGroup,
  TaskFileStatus,
  TaskPriority,
} from '../../shared/types.ts'
import type { RunActionFn } from '../App.tsx'
import { api } from '../api.ts'
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconStar,
  IconX,
} from '../components/Icons.tsx'
import { ProjectTaskPanel, priorityLabel } from '../components/ProjectTaskPanel.tsx'

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
  const [revealedProjects, setRevealedProjects] = useState<Record<string, boolean>>({})
  const [focusProject, setFocusProject] = useState<string | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [warningsModalOpen, setWarningsModalOpen] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const { diary, groups, formatWarnings } = snapshot.today
  const isToday = selectedDate === todayLocalIso()

  useEffect(() => {
    setRevealedProjects({})
    setFocusProject(null)
    setAddMenuOpen(false)
  }, [selectedDate])

  useEffect(() => {
    if (!addMenuOpen && !warningsModalOpen) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (addMenuOpen && !target?.closest('[data-add-project-menu]')) setAddMenuOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (warningsModalOpen) setWarningsModalOpen(false)
        else setAddMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [addMenuOpen, warningsModalOpen])

  const hasTodayWarning = useMemo(
    () => formatWarnings.some((w) => w.date === selectedDate),
    [formatWarnings, selectedDate],
  )

  const { activeGroups, idleGroups } = useMemo(() => {
    const active: ProjectTaskGroup[] = []
    const idle: ProjectTaskGroup[] = []
    for (const g of groups) {
      const hasContent =
        g.tasks.length > 0 ||
        g.logs.length > 0 ||
        g.reflections.length > 0 ||
        (g.exists && !g.valid)
      if (hasContent || revealedProjects[g.projectName]) {
        active.push(g)
      } else {
        idle.push(g)
      }
    }
    return { activeGroups: active, idleGroups: idle }
  }, [groups, revealedProjects])

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

  const handleToggleTask = (group: ProjectTaskGroup, lineIndex: number, minutes?: number) => {
    void onRunAction(() => api.toggleTask(group.fileRelPath, lineIndex, minutes), {
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

  const handleSetMinutes = (
    group: ProjectTaskGroup,
    lineIndex: number,
    minutes: number | null,
  ) => {
    void onRunAction(() => api.setTaskMinutes(group.fileRelPath, lineIndex, minutes), {
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

  const handleSetPriority = (
    group: ProjectTaskGroup,
    lineIndex: number,
    priority: TaskPriority,
  ) => {
    void onRunAction(() => api.setTaskPriority(group.fileRelPath, lineIndex, priority), {
      optimistic: (prev) => ({
        ...prev,
        today: {
          ...prev.today,
          groups: prev.today.groups.map((g) =>
            g.fileRelPath !== group.fileRelPath
              ? g
              : {
                  ...g,
                  tasks: g.tasks.map((t) =>
                    t.lineIndex === lineIndex ? { ...t, priority } : t,
                  ),
                },
          ),
        },
      }),
    })
  }

  const handleAddTask = (projectName: string, text: string, priority: TaskPriority) => {
    void onRunAction(() => api.addTask(projectName, text, selectedDate, priority), {
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
                      lineIndex: Date.now(),
                      checked: false,
                      text: `[${priorityLabel(priority)}] ${text}`,
                      priority,
                      minutes: null,
                      fromDate: null,
                      rawLine: `- [ ] [${priorityLabel(priority)}] ${text}`,
                    },
                  ],
                },
          ),
        },
      }),
    })
  }

  const handleSelectStatus = (group: ProjectTaskGroup, next: TaskFileStatus) => {
    if (group.status === next) return
    void onRunAction(() => api.updateTaskStatus(group.fileRelPath, next), {
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

  const handleAppendNote = (
    group: ProjectTaskGroup,
    section: 'log' | 'reflection',
    text: string,
  ) => {
    void onRunAction(
      async () => {
        const rel = group.exists
          ? group.fileRelPath
          : (await api.createTaskFile(group.projectName, selectedDate)).relPath
        await api.appendTaskEntry(rel, section, text)
      },
      {
        optimistic: (prev) => ({
          ...prev,
          today: {
            ...prev.today,
            groups: prev.today.groups.map((g) => {
              if (g.projectName !== group.projectName) return g
              return section === 'log'
                ? { ...g, exists: true, logs: [...g.logs, text] }
                : { ...g, exists: true, reflections: [...g.reflections, text] }
            }),
          },
        }),
      },
    )
  }

  return (
    <div className="lw-canvas">
      {/* Calm Date Header (Things 3 Gold Star + Date) */}
      <div className="lw-page-head">
        <div className="lw-row" style={{ gap: 8 }}>
          <span style={{ color: 'var(--lw-gold)', display: 'inline-flex', alignItems: 'center' }}>
            <IconStar size={20} />
          </span>
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

        {formatWarnings.length > 0 && (
          <div className="lw-muted" style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              className="lw-btn lw-btn-sm lw-btn-ghost"
              style={{
                color: hasTodayWarning ? 'var(--lw-warn)' : 'var(--lw-text-3)',
                padding: '0 6px',
              }}
              title="查看格式不规范的历史任务文件"
              onClick={() => setWarningsModalOpen(true)}
            >
              {formatWarnings.length} 项格式提醒
            </button>
          </div>
        )}
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
        <div className="lw-empty">
          {groups.length === 0
            ? '还没有项目，去「项目」页新建一个吧。'
            : isToday
              ? '今天暂无任务。'
              : '这一天暂无任务。'}
        </div>
      ) : (
        <div className="lw-stack" style={{ gap: 28 }}>
          {activeGroups.map((group) => (
            <ProjectTaskPanel
              key={group.projectName}
              group={group}
              title={group.projectName}
              autoFocusAdd={focusProject === group.projectName}
              onToggleTask={handleToggleTask}
              onSetMinutes={handleSetMinutes}
              onSetPriority={handleSetPriority}
              onAddTask={handleAddTask}
              onSelectStatus={handleSelectStatus}
              onAppendNote={handleAppendNote}
              onOpenFile={onOpenFile}
            />
          ))}
        </div>
      )}

      {/* Quiet picker to add tasks for projects that have none today */}
      {idleGroups.length > 0 && (
        <div style={{ paddingTop: 4 }}>
          <div className="lw-menu-wrap" data-add-project-menu>
            <button
              type="button"
              className="lw-btn lw-btn-sm lw-btn-ghost"
              style={{ color: 'var(--lw-text-3)', paddingLeft: 2 }}
              onClick={() => setAddMenuOpen((v) => !v)}
            >
              <IconPlus size={13} />
              <span>添加项目任务</span>
              <IconChevronDown size={12} />
            </button>

            {addMenuOpen && (
              <div
                className="lw-menu"
                role="menu"
                style={{
                  left: 0,
                  right: 'auto',
                  minWidth: 200,
                  maxHeight: 260,
                  overflowY: 'auto',
                }}
              >
                {idleGroups.map((g) => (
                  <button
                    key={g.projectName}
                    type="button"
                    role="menuitem"
                    className="lw-menu-item"
                    onClick={() => {
                      setAddMenuOpen(false)
                      setRevealedProjects((prev) => ({ ...prev, [g.projectName]: true }))
                      setFocusProject(g.projectName)
                    }}
                  >
                    <span
                      className={`lw-status-dot ${g.projectStatus === 'doing' ? 'doing' : 'todo'}`}
                    />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.projectName}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
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
