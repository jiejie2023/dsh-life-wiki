import React, { useState } from 'react'
import type { BoardSnapshot, ReviewSummary } from '../../shared/types.ts'
import type { RunActionFn } from '../App.tsx'
import { api } from '../api.ts'
import { IconChevronLeft, IconChevronRight, IconFile } from '../components/Icons.tsx'

interface ReviewViewProps {
  snapshot: BoardSnapshot
  selectedWeek: string
  onWeekChange: (nextWeek: string) => void
  onOpenFile: (relPath: string) => void
  onRunAction: RunActionFn
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
  return utcDateToIsoWeek(new Date(monday.getTime() + deltaWeeks * 7 * 86400_000))
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

  const totalDone = reviewCenter.projectMetrics.reduce((s, m) => s + m.doneTasks, 0)
  const totalTasks = reviewCenter.projectMetrics.reduce((s, m) => s + m.totalTasks, 0)
  const totalHours = (
    reviewCenter.projectMetrics.reduce((s, m) => s + m.totalMinutes, 0) / 60
  ).toFixed(1)

  const getNextWeekDraft = (rev: ReviewSummary): string =>
    editingNextWeek[rev.relPath] !== undefined
      ? editingNextWeek[rev.relPath]!
      : rev.nextWeekItems.join('\n')

  const parseLines = (raw: string): string[] =>
    raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)

  return (
    <div className="lw-canvas-wide">
      {/* Calm Week Header */}
      <div className="lw-page-head">
        <div className="lw-row" style={{ gap: 6 }}>
          <h1 className="lw-h1 lw-mono">{selectedWeek}</h1>
          <button
            type="button"
            className="lw-icon-btn"
            title="上一周"
            onClick={() => onWeekChange(shiftIsoWeek(selectedWeek, -1))}
          >
            <IconChevronLeft />
          </button>
          <button
            type="button"
            className="lw-icon-btn"
            title="下一周"
            onClick={() => onWeekChange(shiftIsoWeek(selectedWeek, 1))}
          >
            <IconChevronRight />
          </button>
          <span className="lw-muted lw-mono" style={{ marginLeft: 4 }}>
            {reviewCenter.weekRange.start.slice(5)} ~ {reviewCenter.weekRange.end.slice(5)}
          </span>
        </div>

        <div className="lw-muted" style={{ display: 'flex', gap: 14 }}>
          <span>
            完成 {totalDone} / {totalTasks}
          </span>
          <span>{totalHours} 小时</span>
        </div>
      </div>

      {/* 2-Column Editorial Spread */}
      <div className="lw-review-grid">
        {/* Left: Project Reviews */}
        <div className="lw-stack" style={{ gap: 22 }}>
          {reviewCenter.projectMetrics.length === 0 ? (
            <div className="lw-empty">暂无活跃项目</div>
          ) : (
            reviewCenter.projectMetrics.map((metric) => {
              const rev = metric.review
              const hoursText = (metric.totalMinutes / 60).toFixed(1)

              return (
                <section
                  key={metric.projectName}
                  className="lw-stack"
                  style={{ gap: 10, paddingBottom: 20, borderBottom: '1px solid var(--lw-border)' }}
                >
                  <div className="lw-between">
                    <div className="lw-row" style={{ gap: 10 }}>
                      <strong style={{ fontSize: 15 }}>{metric.projectName}</strong>
                      <span className="lw-muted">
                        {metric.doneTasks}/{metric.totalTasks} · {hoursText}h
                      </span>
                      {rev && (
                        <span
                          className={`lw-tag ${
                            rev.status === 'final' ? 'lw-tag-accent' : 'lw-tag-warn'
                          }`}
                        >
                          {rev.status === 'final' ? '已定稿' : '草稿'}
                        </span>
                      )}
                    </div>

                    {rev ? (
                      <button
                        type="button"
                        className="lw-icon-btn"
                        title="打开原文"
                        onClick={() => onOpenFile(rev.relPath)}
                      >
                        <IconFile size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="lw-btn lw-btn-sm"
                        onClick={() =>
                          void onRunAction(() =>
                            api.generateWeeklyReview(metric.projectName, selectedWeek),
                          )
                        }
                      >
                        生成草稿
                      </button>
                    )}
                  </div>

                  {rev && (
                    <div className="lw-stack" style={{ gap: 10 }}>
                      {rev.summaryLines.length > 0 && (
                        <div style={{ fontSize: 13.5, color: 'var(--lw-text-2)' }}>
                          {rev.summaryLines.slice(0, 6).map((line, i) => (
                            <div key={i}>{line}</div>
                          ))}
                        </div>
                      )}

                      <div>
                        <label className="lw-field-label">下周重点</label>
                        <textarea
                          className="lw-textarea"
                          style={{ minHeight: 62 }}
                          value={getNextWeekDraft(rev)}
                          onChange={(e) =>
                            setEditingNextWeek((prev) => ({
                              ...prev,
                              [rev.relPath]: e.target.value,
                            }))
                          }
                          placeholder="每行一条"
                        />
                      </div>

                      <div className="lw-row">
                        <button
                          type="button"
                          className="lw-btn lw-btn-sm"
                          onClick={() =>
                            void onRunAction(
                              () =>
                                api.updateReview(rev.relPath, {
                                  nextWeek: parseLines(getNextWeekDraft(rev)),
                                }),
                              { toast: '已保存' },
                            )
                          }
                        >
                          保存
                        </button>
                        {rev.status !== 'final' ? (
                          <button
                            type="button"
                            className="lw-btn lw-btn-sm lw-btn-accent"
                            onClick={() =>
                              void onRunAction(
                                () =>
                                  api.updateReview(rev.relPath, {
                                    nextWeek: parseLines(getNextWeekDraft(rev)),
                                    status: 'final',
                                  }),
                                { toast: '已定稿' },
                              )
                            }
                          >
                            定稿
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="lw-btn lw-btn-sm lw-btn-ghost"
                            onClick={() =>
                              void onRunAction(() =>
                                api.updateReview(rev.relPath, { status: 'draft' }),
                              )
                            }
                          >
                            改回草稿
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              )
            })
          )}
        </div>

        {/* Right: Quiet Week Diary */}
        <aside className="lw-stack" style={{ gap: 12 }}>
          <div className="lw-section-head">
            <h2 className="lw-section-title">本周日记</h2>
            <span className="lw-muted">{reviewCenter.weekDiaries.length} 天</span>
          </div>

          {reviewCenter.weekDiaries.length === 0 ? (
            <div className="lw-muted" style={{ padding: '16px 0' }}>
              本周无日记
            </div>
          ) : (
            <div className="lw-stack" style={{ gap: 12 }}>
              {reviewCenter.weekDiaries.map((d) => (
                <div
                  key={d.relPath}
                  className="lw-project-row"
                  style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4, padding: '10px 10px' }}
                  onClick={() => onOpenFile(d.relPath)}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{d.date}</div>
                  <div
                    className="lw-meta"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {d.preview || '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
