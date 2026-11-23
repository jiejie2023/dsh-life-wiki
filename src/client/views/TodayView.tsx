import React, { useState } from 'react'
import type { BoardSnapshot, ProjectTaskGroup, TaskFileStatus } from '../../shared/types.ts'
import { api } from '../api.ts'

interface TodayViewProps {
  snapshot: BoardSnapshot
  selectedDate: string
  onDateChange: (nextDate: string) => void
  onOpenFile: (relPath: string) => void
  onJumpToDiary: () => void
  onRunAction: (action: () => Promise<unknown>, toastText?: string) => Promise<void>
}

function shiftDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d! + deltaDays))
  return dt.toISOString().slice(0, 10)
}

function todayLocalIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  const [showWarnings, setShowWarnings] = useState(false)
  const [newTaskInputs, setNewTaskInputs] = useState<Record<string, string>>({})
  const [minuteDrafts, setMinuteDrafts] = useState<Record<string, string>>({})
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({})
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})
  const [noteKinds, setNoteKinds] = useState<Record<string, 'log' | 'reflection'>>({})

  const { diary, groups, formatWarnings } = snapshot.today

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
    await onRunAction(async () => {
      await api.appendDiary(trimmed, selectedDate)
      setDiaryText('')
    }, '已追加到日记')
  }

  const handleAddTask = async (projectName: string) => {
    const text = (newTaskInputs[projectName] ?? '').trim()
    if (!text) return
    await onRunAction(async () => {
      await api.addTask(projectName, text, selectedDate)
      setNewTaskInputs((prev) => ({ ...prev, [projectName]: '' }))
    }, '已添加任务')
  }

  const handleToggleTask = async (group: ProjectTaskGroup, lineIndex: number, currentlyChecked: boolean) => {
    const key = `${group.fileRelPath}:${lineIndex}`
    const rawMins = minuteDrafts[key]?.trim()
    const parsedMins =
      !currentlyChecked && rawMins && /^\d+$/.test(rawMins) && Number(rawMins) > 0
        ? Number(rawMins)
        : undefined
    await onRunAction(async () => {
      await api.toggleTask(group.fileRelPath, lineIndex, parsedMins)
      if (parsedMins !== undefined) {
        setMinuteDrafts((prev) => ({ ...prev, [key]: '' }))
      }
    })
  }

  const handleAppendNote = async (group: ProjectTaskGroup) => {
    const text = (noteInputs[group.projectName] ?? '').trim()
    if (!text) return
    const section = noteKinds[group.projectName] ?? 'log'
    await onRunAction(async () => {
      await api.appendTaskEntry(group.fileRelPath, section, text)
      setNoteInputs((prev) => ({ ...prev, [group.projectName]: '' }))
    }, section === 'log' ? '已记录日志' : '已记录反思')
  }

  return (
    <div className="lw-container">
      {/* Date bar & overview stats */}
      <div className="lw-between">
        <div className="lw-row">
          <button
            type="button"
            className="lw-btn lw-btn-sm"
            onClick={() => onDateChange(shiftDate(selectedDate, -1))}
          >
            前一天
          </button>
          <input
            type="date"
            className="lw-input"
            style={{ width: 150, padding: '5px 9px' }}
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) onDateChange(e.target.value)
            }}
          />
          <button
            type="button"
            className="lw-btn lw-btn-sm"
            onClick={() => onDateChange(shiftDate(selectedDate, 1))}
          >
            后一天
          </button>
          {selectedDate !== todayLocalIso() && (
            <button
              type="button"
              className="lw-btn lw-btn-sm lw-btn-ghost"
              onClick={() => onDateChange(todayLocalIso())}
            >
              回到今天
            </button>
          )}
        </div>

        <div className="lw-row">
          <span className="lw-badge lw-badge-accent">
            今日完成 {totalDone} / {totalTasks}
          </span>
          <span className="lw-badge">投入 {totalMinutes} 分钟</span>
          <span className="lw-badge">周次 {snapshot.week}</span>
        </div>
      </div>

      {/* Format warnings */}
      {formatWarnings.length > 0 && (
        <div className="lw-banner lw-banner-warn" style={{ flexDirection: 'column', gap: 6 }}>
          <div className="lw-between" style={{ width: '100%' }}>
            <span>
              检测到 {formatWarnings.length} 个任务文件不符合标准模板格式（不影响浏览，建议修正以便周复盘统计）
            </span>
            <button
              type="button"
              className="lw-btn lw-btn-sm"
              onClick={() => setShowWarnings((v) => !v)}
            >
              {showWarnings ? '收起' : '查看详情'}
            </button>
          </div>
          {showWarnings && (
            <div className="lw-stack" style={{ width: '100%', gap: 4 }}>
              {formatWarnings.map((w) => (
                <div key={w.fileRelPath} className="lw-between" style={{ fontSize: 12.5 }}>
                  <span>
                    <strong>{w.projectName}</strong> ({w.date})：{w.issues.join('；')}
                  </span>
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm"
                    onClick={() => onOpenFile(w.fileRelPath)}
                  >
                    打开修复
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Today's Diary Strip */}
      <div className="lw-card">
        <div className="lw-between" style={{ marginBottom: 8 }}>
          <div className="lw-row">
            <h3 className="lw-card-title">今日日记</h3>
            {diary.exists ? (
              <span className="lw-badge lw-badge-accent">
                已写 {diary.entryCount || 1} 段
              </span>
            ) : (
              <span className="lw-badge">今日未记录</span>
            )}
          </div>
          <div className="lw-row">
            {diary.exists && (
              <button
                type="button"
                className="lw-btn lw-btn-sm lw-btn-ghost"
                onClick={() => onOpenFile(diary.relPath)}
              >
                打开原文
              </button>
            )}
            <button
              type="button"
              className="lw-btn lw-btn-sm lw-btn-ghost"
              onClick={onJumpToDiary}
            >
              全部日记 →
            </button>
          </div>
        </div>

        {diary.exists && diary.preview && (
          <div
            style={{
              fontSize: 13,
              color: 'var(--lw-text-2)',
              marginBottom: 10,
              padding: '7px 10px',
              background: 'var(--lw-surface-2)',
              borderRadius: 7,
            }}
          >
            {diary.preview}
          </div>
        )}

        <form className="lw-row" onSubmit={(e) => void handleDiaryAppend(e)}>
          <input
            className="lw-input"
            style={{ flex: 1 }}
            value={diaryText}
            onChange={(e) => setDiaryText(e.target.value)}
            placeholder="随手记一句今天发生的事、感受或进度，回车追加到日记…"
          />
          <button type="submit" className="lw-btn lw-btn-primary" disabled={!diaryText.trim()}>
            记一笔
          </button>
        </form>
      </div>

      {/* Project Daily Tasks */}
      {groups.length === 0 ? (
        <div className="lw-empty">
          <div style={{ fontWeight: 600, color: 'var(--lw-text)', marginBottom: 6 }}>
            当前还没有进行中的项目
          </div>
          <div>可以先到「项目」页新建项目，或把一个想法正式立项。</div>
        </div>
      ) : (
        <div className="lw-stack" style={{ gap: 14 }}>
          {groups.map((group) => {
            const doneCount = group.tasks.filter((t) => t.checked).length
            const logsOpen = Boolean(expandedLogs[group.projectName])
            const noteKind = noteKinds[group.projectName] ?? 'log'

            return (
              <div key={group.projectName} className="lw-card">
                <div className="lw-card-header">
                  <div className="lw-row">
                    <h3 className="lw-card-title">{group.projectName}</h3>
                    {group.area && <span className="lw-badge">{group.area}</span>}
                    {group.exists && (
                      <select
                        className="lw-select"
                        style={{ width: 'auto', padding: '2px 8px', fontSize: 12 }}
                        value={group.status ?? 'doing'}
                        onChange={(e) =>
                          void onRunAction(
                            () =>
                              api.updateTaskStatus(
                                group.fileRelPath,
                                e.target.value as TaskFileStatus,
                              ),
                            '已更新任务状态',
                          )
                        }
                      >
                        <option value="todo">todo</option>
                        <option value="doing">doing</option>
                        <option value="done">done</option>
                      </select>
                    )}
                    {group.exists && (
                      <span className="lw-muted">
                        {doneCount}/{group.tasks.length} 项 · {group.totalMinutes} 分钟
                      </span>
                    )}
                  </div>

                  <div className="lw-row">
                    {!group.exists ? (
                      <button
                        type="button"
                        className="lw-btn lw-btn-sm"
                        onClick={() =>
                          void onRunAction(
                            async () => {
                              await api.createTaskFile(group.projectName, selectedDate)
                            },
                            '已创建今日任务文件',
                          )
                        }
                      >
                        新建今日文件
                      </button>
                    ) : (
                      <>
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
                          日志与反思 ({group.logs.length + group.reflections.length})
                        </button>
                        <button
                          type="button"
                          className="lw-btn lw-btn-sm lw-btn-ghost"
                          onClick={() => onOpenFile(group.fileRelPath)}
                        >
                          打开原文
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {!group.valid && group.formatIssues.length > 0 && (
                  <div className="lw-banner lw-banner-warn" style={{ marginBottom: 10 }}>
                    格式提示：{group.formatIssues.join('；')}
                  </div>
                )}

                {group.tasks.length > 0 && (
                  <div className="lw-task-list" style={{ marginBottom: 10 }}>
                    {group.tasks.map((task) => {
                      const draftKey = `${group.fileRelPath}:${task.lineIndex}`
                      return (
                        <div key={task.lineIndex} className="lw-task-item">
                          <input
                            type="checkbox"
                            checked={task.checked}
                            onChange={() =>
                              void handleToggleTask(group, task.lineIndex, task.checked)
                            }
                          />
                          <div className={`lw-task-text ${task.checked ? 'lw-task-done' : ''}`}>
                            {task.text}
                          </div>
                          {task.fromDate && (
                            <span className="lw-badge" title="顺延自历史日期">
                              顺延 {task.fromDate}
                            </span>
                          )}
                          {task.checked && task.minutes !== null && (
                            <span className="lw-badge lw-badge-accent">{task.minutes}m</span>
                          )}
                          {!task.checked && (
                            <input
                              className="lw-input"
                              style={{ width: 64, padding: '2px 6px', fontSize: 12 }}
                              placeholder="分钟"
                              title="勾选前可选填耗时（分钟）"
                              value={minuteDrafts[draftKey] ?? ''}
                              onChange={(e) =>
                                setMinuteDrafts((prev) => ({
                                  ...prev,
                                  [draftKey]: e.target.value,
                                }))
                              }
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Quick add task */}
                <form
                  className="lw-row"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void handleAddTask(group.projectName)
                  }}
                >
                  <input
                    className="lw-input"
                    style={{ flex: 1 }}
                    value={newTaskInputs[group.projectName] ?? ''}
                    onChange={(e) =>
                      setNewTaskInputs((prev) => ({
                        ...prev,
                        [group.projectName]: e.target.value,
                      }))
                    }
                    placeholder={
                      group.exists
                        ? '+ 添加今日任务，按回车确认'
                        : '+ 直接输入今天的第一件事，回车将自动建立今日文件'
                    }
                  />
                  <button
                    type="submit"
                    className="lw-btn lw-btn-sm"
                    disabled={!(newTaskInputs[group.projectName] ?? '').trim()}
                  >
                    添加
                  </button>
                </form>

                {/* Logs & Reflections drawer inside card */}
                {group.exists && logsOpen && (
                  <div
                    className="lw-stack"
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: '1px solid var(--lw-border)',
                    }}
                  >
                    {group.logs.length > 0 && (
                      <div>
                        <div className="lw-muted" style={{ fontWeight: 600, marginBottom: 4 }}>
                          日志
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                          {group.logs.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {group.reflections.length > 0 && (
                      <div>
                        <div className="lw-muted" style={{ fontWeight: 600, marginBottom: 4 }}>
                          反思
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                          {group.reflections.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <form
                      className="lw-row"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void handleAppendNote(group)
                      }}
                    >
                      <select
                        className="lw-select"
                        style={{ width: 88 }}
                        value={noteKind}
                        onChange={(e) =>
                          setNoteKinds((prev) => ({
                            ...prev,
                            [group.projectName]:
                              e.target.value === 'reflection' ? 'reflection' : 'log',
                          }))
                        }
                      >
                        <option value="log">日志</option>
                        <option value="reflection">反思</option>
                      </select>
                      <input
                        className="lw-input"
                        style={{ flex: 1 }}
                        value={noteInputs[group.projectName] ?? ''}
                        onChange={(e) =>
                          setNoteInputs((prev) => ({
                            ...prev,
                            [group.projectName]: e.target.value,
                          }))
                        }
                        placeholder={
                          noteKind === 'log'
                            ? '记录今天做了什么进展、遇到什么卡点…'
                            : '记录今天的复盘或下次改进点…'
                        }
                      />
                      <button
                        type="submit"
                        className="lw-btn lw-btn-sm"
                        disabled={!(noteInputs[group.projectName] ?? '').trim()}
                      >
                        记录
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
