import React, { useState } from 'react'
import type { BoardSnapshot, ReviewSummary } from '../../shared/types.ts'
import { api } from '../api.ts'

interface ReviewViewProps {
  snapshot: BoardSnapshot
  selectedWeek: string
  onWeekChange: (nextWeek: string) => void
  onOpenFile: (relPath: string) => void
  onRunAction: (action: () => Promise<unknown>, toastText?: string) => Promise<void>
}

function isoWeekToUtcMonday(weekStr: string): Date | null {
  const m = weekStr.match(/^(\d{4})-W(\d{2})$/)
  if (!m) return null
  const year = Number(m[1])
  const week = Number(m[2])
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4.getTime() - (jan4Day - 1) * 86400_000)
  return new Date(week1Monday.getTime() + (week - 1) * 7 * 86400_000)
}

function utcDateToIsoWeek(d: Date): string {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400_000 + 1) / 7)
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function shiftIsoWeek(weekStr: string, deltaWeeks: number): string {
  const monday = isoWeekToUtcMonday(weekStr)
  if (!monday) return weekStr
  const shifted = new Date(monday.getTime() + deltaWeeks * 7 * 86400_000)
  return utcDateToIsoWeek(shifted)
}

export function ReviewView({
  snapshot,
  selectedWeek,
  onWeekChange,
  onOpenFile,
  onRunAction,
}: ReviewViewProps) {
  const { reviewCenter } = snapshot
  const [editingNextWeek, setEditingNextWeek] = useState<Record<string, string>>({})

  const weekOptions = Array.from(
    new Set([selectedWeek, snapshot.week, ...reviewCenter.availableWeeks]),
  ).sort((a, b) => b.localeCompare(a))

  const totalDone = reviewCenter.projectMetrics.reduce((s, m) => s + m.doneTasks, 0)
  const totalTasks = reviewCenter.projectMetrics.reduce((s, m) => s + m.totalTasks, 0)
  const totalHours = (
    reviewCenter.projectMetrics.reduce((s, m) => s + m.totalMinutes, 0) / 60
  ).toFixed(1)

  const getNextWeekDraft = (rev: ReviewSummary): string => {
    if (editingNextWeek[rev.relPath] !== undefined) return editingNextWeek[rev.relPath]!
    return rev.nextWeekItems.join('\n')
  }

  const parseLines = (raw: string): string[] =>
    raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)

  return (
    <div className="lw-container">
      {/* Week switcher */}
      <div className="lw-between">
        <div className="lw-row">
          <button
            type="button"
            className="lw-btn lw-btn-sm"
            onClick={() => onWeekChange(shiftIsoWeek(selectedWeek, -1))}
          >
            上一周
          </button>
          <select
            className="lw-select lw-mono"
            style={{ width: 132, padding: '5px 8px' }}
            value={selectedWeek}
            onChange={(e) => onWeekChange(e.target.value)}
          >
            {weekOptions.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="lw-btn lw-btn-sm"
            onClick={() => onWeekChange(shiftIsoWeek(selectedWeek, 1))}
          >
            下一周
          </button>
          <span className="lw-muted lw-mono">
            {reviewCenter.weekRange.start} ~ {reviewCenter.weekRange.end}
          </span>
        </div>

        <div className="lw-row">
          <span className="lw-badge lw-badge-accent">
            本周完成 {totalDone} / {totalTasks} 项
          </span>
          <span className="lw-badge">累计 {totalHours} 小时</span>
          {reviewCenter.draftReviews.length > 0 && (
            <span className="lw-badge lw-badge-warn">
              {reviewCenter.draftReviews.length} 份待确认草稿
            </span>
          )}
        </div>
      </div>

      {/* Main 2-column Review Center */}
      <div className="lw-grid-review">
        {/* Left: Project Weekly Reviews */}
        <div className="lw-stack" style={{ gap: 14 }}>
          {reviewCenter.projectMetrics.length === 0 ? (
            <div className="lw-empty">
              暂无活跃项目，请先到「项目」页建立项目。
            </div>
          ) : (
            reviewCenter.projectMetrics.map((metric) => {
              const rev = metric.review
              const hoursText = (metric.totalMinutes / 60).toFixed(1)

              return (
                <div key={metric.projectName} className="lw-card lw-stack">
                  <div className="lw-between">
                    <div className="lw-row">
                      <h3 className="lw-card-title">{metric.projectName}</h3>
                      <span className="lw-badge">
                        {metric.doneTasks}/{metric.totalTasks} 项
                      </span>
                      <span className="lw-badge">{hoursText} 小时</span>
                      {rev && (
                        <span
                          className={`lw-badge ${
                            rev.status === 'final' ? 'lw-badge-accent' : 'lw-badge-warn'
                          }`}
                        >
                          {rev.status === 'final' ? '已定稿 final' : '待确认 draft'}
                        </span>
                      )}
                    </div>

                    <div className="lw-row">
                      {rev ? (
                        <button
                          type="button"
                          className="lw-btn lw-btn-sm lw-btn-ghost"
                          onClick={() => onOpenFile(rev.relPath)}
                        >
                          打开全文
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="lw-btn lw-btn-sm lw-btn-primary"
                          onClick={() =>
                            void onRunAction(
                              async () => {
                                await api.generateWeeklyReview(metric.projectName, selectedWeek)
                              },
                              `已汇总生成 ${metric.projectName} 本周复盘草稿`,
                            )
                          }
                        >
                          生成本周复盘草稿
                        </button>
                      )}
                    </div>
                  </div>

                  {rev ? (
                    <div className="lw-stack" style={{ gap: 10 }}>
                      {rev.summaryLines.length > 0 && (
                        <div
                          style={{
                            padding: '8px 11px',
                            background: 'var(--lw-surface-2)',
                            borderRadius: 7,
                            fontSize: 13,
                          }}
                        >
                          <div className="lw-muted" style={{ marginBottom: 4, fontWeight: 600 }}>
                            本周完成摘要
                          </div>
                          {rev.summaryLines.slice(0, 6).map((line, i) => (
                            <div key={i}>{line}</div>
                          ))}
                        </div>
                      )}

                      <div>
                        <label className="lw-muted" style={{ display: 'block', marginBottom: 4 }}>
                          下周重点（每行一条）
                        </label>
                        <textarea
                          className="lw-textarea"
                          style={{ minHeight: 68 }}
                          value={getNextWeekDraft(rev)}
                          onChange={(e) =>
                            setEditingNextWeek((prev) => ({
                              ...prev,
                              [rev.relPath]: e.target.value,
                            }))
                          }
                          placeholder="写下下周最关键的 1-3 件事…"
                        />
                      </div>

                      <div className="lw-row">
                        <button
                          type="button"
                          className="lw-btn lw-btn-sm"
                          onClick={() =>
                            void onRunAction(
                              async () => {
                                await api.updateReview(rev.relPath, {
                                  nextWeek: parseLines(getNextWeekDraft(rev)),
                                })
                              },
                              '已保存下周重点',
                            )
                          }
                        >
                          保存下周重点
                        </button>

                        {rev.status !== 'final' ? (
                          <button
                            type="button"
                            className="lw-btn lw-btn-sm lw-btn-primary"
                            onClick={() =>
                              void onRunAction(
                                async () => {
                                  await api.updateReview(rev.relPath, {
                                    nextWeek: parseLines(getNextWeekDraft(rev)),
                                    status: 'final',
                                  })
                                },
                                '复盘已确认定稿 (final)',
                              )
                            }
                          >
                            确认定稿 (final)
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="lw-btn lw-btn-sm lw-btn-ghost"
                            onClick={() =>
                              void onRunAction(
                                () => api.updateReview(rev.relPath, { status: 'draft' }),
                                '已改回草稿状态',
                              )
                            }
                          >
                            改回草稿
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="lw-muted">
                      本周尚未生成复盘。点击右上角「生成本周复盘草稿」将自动读取该周的每日任务与工时。
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Right: This Week's Diary Digest */}
        <div className="lw-card lw-stack">
          <div className="lw-between">
            <h3 className="lw-card-title">本周日记速览</h3>
            <span className="lw-badge">{reviewCenter.weekDiaries.length} 天</span>
          </div>
          <div className="lw-muted">
            写复盘时对照这周真实的日记记录，避免只看任务清单、忽略体感和变化。
          </div>

          {reviewCenter.weekDiaries.length === 0 ? (
            <div className="lw-muted" style={{ padding: '18px 0', textAlign: 'center' }}>
              这一周暂时没有日记记录
            </div>
          ) : (
            <div className="lw-stack" style={{ gap: 10 }}>
              {reviewCenter.weekDiaries.map((d) => (
                <div
                  key={d.relPath}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'var(--lw-surface-2)',
                    border: '1px solid var(--lw-border)',
                  }}
                >
                  <div className="lw-between" style={{ marginBottom: 4 }}>
                    <strong style={{ fontSize: 13 }}>{d.date}</strong>
                    <button
                      type="button"
                      className="lw-btn lw-btn-sm lw-btn-ghost"
                      onClick={() => onOpenFile(d.relPath)}
                    >
                      查看全文
                    </button>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--lw-text-2)', whiteSpace: 'pre-wrap' }}>
                    {d.preview || '（空白）'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
