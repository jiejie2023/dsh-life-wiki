import React, { useEffect, useMemo, useState } from 'react'
import type { BoardSnapshot, ReviewStatus, ReviewSummary } from '../../shared/types.ts'
import type { RunActionFn } from '../App.tsx'
import { api } from '../api.ts'
import {
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconFile,
  IconPlus,
  IconProjectPie,
  IconX,
} from '../components/Icons.tsx'
import { parseReviewWeekLine } from '../reviewMarkdown.ts'

interface ReviewViewProps {
  snapshot: BoardSnapshot
  selectedWeek: string
  onWeekChange: (nextWeek: string) => void
  onOpenFile: (relPath: string, opts?: { edit?: boolean }) => void
  onRunAction: RunActionFn
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

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

function formatDiaryDay(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return `${Number(m[2])}月${Number(m[3])}日 · ${WEEKDAYS[dt.getDay()] ?? ''}`
}

export function ReviewView({
  snapshot,
  selectedWeek,
  onWeekChange,
  onOpenFile,
  onRunAction,
}: ReviewViewProps) {
  const { reviewCenter } = snapshot
  const [weekMenuOpen, setWeekMenuOpen] = useState(false)
  const [statusMenuRelPath, setStatusMenuRelPath] = useState<string | null>(null)
  const [nextWeekDrafts, setNextWeekDrafts] = useState<Record<string, string[]>>({})
  const [newNextInputs, setNewNextInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!weekMenuOpen && !statusMenuRelPath) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (weekMenuOpen && !t?.closest('[data-rv-week-menu]')) setWeekMenuOpen(false)
      if (statusMenuRelPath && !t?.closest('[data-rv-status-menu]')) setStatusMenuRelPath(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setWeekMenuOpen(false)
        setStatusMenuRelPath(null)
      }
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [weekMenuOpen, statusMenuRelPath])

  // Year-grouped available weeks for scalable long-term navigation
  const weeksByYear = useMemo(() => {
    const all = Array.from(new Set([snapshot.week, selectedWeek, ...reviewCenter.availableWeeks]))
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a))
    const map = new Map<string, string[]>()
    for (const w of all) {
      const y = w.slice(0, 4)
      const list = map.get(y) ?? []
      list.push(w)
      map.set(y, list)
    }
    return Array.from(map.entries())
  }, [snapshot.week, selectedWeek, reviewCenter.availableWeeks])

  const getNextItems = (rev: ReviewSummary): string[] =>
    nextWeekDrafts[rev.relPath] !== undefined ? nextWeekDrafts[rev.relPath]! : rev.nextWeekItems

  const saveNextItems = (rev: ReviewSummary, items: string[]) => {
    const cleaned = items.map((s) => s.trim()).filter(Boolean)
    setNextWeekDrafts((prev) => ({ ...prev, [rev.relPath]: cleaned }))
    void onRunAction(() => api.updateReview(rev.relPath, { nextWeek: cleaned }))
  }

  const handleSelectStatus = (rev: ReviewSummary, nextStatus: ReviewStatus) => {
    setStatusMenuRelPath(null)
    if (rev.status === nextStatus) return
    void onRunAction(() => api.updateReview(rev.relPath, { status: nextStatus }))
  }

  return (
    <div className="lw-canvas-wide">
      {/* Calm Single-Row Week Switcher */}
      <div className="lw-page-head">
        <div className="lw-row" style={{ gap: 4 }} data-rv-week-menu>
          <button
            type="button"
            className="lw-icon-btn"
            style={{ marginLeft: -6 }}
            title="上一周"
            onClick={() => onWeekChange(shiftIsoWeek(selectedWeek, -1))}
          >
            <IconChevronLeft />
          </button>

          <div className="lw-menu-wrap">
            <button
              type="button"
              className={`lw-status-trigger ${weekMenuOpen ? 'open' : ''}`}
              style={{ height: 34, padding: '0 8px' }}
              onClick={() => setWeekMenuOpen((v) => !v)}
            >
              <span className="lw-h1 lw-mono" style={{ fontSize: 22 }}>
                {selectedWeek}
              </span>
              <IconChevronDown size={14} />
            </button>

            {weekMenuOpen && (
              <div className="lw-menu lw-date-menu" role="menu">
                <div className="lw-date-menu-scroll">
                  {weeksByYear.map(([year, weeks]) => (
                    <React.Fragment key={year}>
                      <div className="lw-date-month">{year}年</div>
                      {weeks.map((w) => {
                        const active = w === selectedWeek
                        return (
                          <button
                            key={w}
                            type="button"
                            role="menuitem"
                            className={`lw-menu-item ${active ? 'active' : ''}`}
                            onClick={() => {
                              onWeekChange(w)
                              setWeekMenuOpen(false)
                            }}
                          >
                            <span className="lw-mono" style={{ flex: 1 }}>
                              {w}
                            </span>
                            <span
                              style={{
                                width: 12,
                                display: 'inline-flex',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {active && <IconCheck size={12} />}
                            </span>
                          </button>
                        )
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="lw-icon-btn"
            title="下一周"
            onClick={() => onWeekChange(shiftIsoWeek(selectedWeek, 1))}
          >
            <IconChevronRight />
          </button>

          <span className="lw-muted lw-mono" style={{ marginLeft: 8 }}>
            {reviewCenter.weekRange.start.slice(5)} ~ {reviewCenter.weekRange.end.slice(5)}
          </span>
        </div>
      </div>

      {/* 2-Column Editorial Spread */}
      <div className="lw-review-grid">
        {/* Left: Project Reviews */}
        <div className="lw-stack" style={{ gap: 28 }}>
          {reviewCenter.projectMetrics.length === 0 ? (
            <div className="lw-empty">暂无活跃项目</div>
          ) : (
            reviewCenter.projectMetrics.map((metric) => {
              const rev = metric.review
              const hours = metric.totalMinutes > 0 ? (metric.totalMinutes / 60).toFixed(1) : null
              const ratio = metric.totalTasks > 0 ? metric.doneTasks / metric.totalTasks : 0
              const nextItems = rev ? getNextItems(rev) : []
              const summaryItems = rev
                ? rev.summaryLines
                    .map((l) => parseReviewWeekLine(l))
                    .filter((x): x is { done: boolean; text: string } => x !== null)
                : []

              return (
                <section key={metric.projectName} className="lw-stack" style={{ gap: 10 }}>
                  <div className="lw-section-head">
                    <div className="lw-row" style={{ gap: 9 }}>
                      <IconProjectPie ratio={ratio} size={16} />
                      <h2 className="lw-section-title">{metric.projectName}</h2>
                      {hours && <span className="lw-muted">{hours} 小时</span>}
                    </div>

                    {rev ? (
                      <div className="lw-row" style={{ gap: 2 }}>
                        <div className="lw-menu-wrap" data-rv-status-menu>
                          <button
                            type="button"
                            className={`lw-status-trigger ${statusMenuRelPath === rev.relPath ? 'open' : ''}`}
                            onClick={() =>
                              setStatusMenuRelPath(
                                statusMenuRelPath === rev.relPath ? null : rev.relPath,
                              )
                            }
                          >
                            <span
                              className={`lw-status-dot ${rev.status === 'final' ? 'done' : 'todo'}`}
                            />
                            <span>{rev.status === 'final' ? '已审核' : '待审核'}</span>
                            <IconChevronDown size={12} />
                          </button>

                          {statusMenuRelPath === rev.relPath && (
                            <div className="lw-menu" role="menu">
                              {(
                                [
                                  ['draft', '待审核', 'todo'],
                                  ['final', '已审核', 'done'],
                                ] as const
                              ).map(([val, label, dotCls]) => (
                                <button
                                  key={val}
                                  type="button"
                                  role="menuitem"
                                  className={`lw-menu-item ${rev.status === val ? 'active' : ''}`}
                                  onClick={() => handleSelectStatus(rev, val)}
                                >
                                  <span className={`lw-status-dot ${dotCls}`} />
                                  <span style={{ flex: 1 }}>{label}</span>
                                  {rev.status === val && <IconCheck size={12} />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          className="lw-icon-btn"
                          style={{ height: 26, minWidth: 26 }}
                          title="编辑复盘原文"
                          onClick={() => onOpenFile(rev.relPath, { edit: true })}
                        >
                          <IconFile size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="lw-btn lw-btn-sm lw-btn-ghost"
                        onClick={() =>
                          void onRunAction(
                            () => api.generateWeeklyReview(metric.projectName, selectedWeek),
                            { toast: `已生成 ${metric.projectName} 本周复盘` },
                          )
                        }
                      >
                        生成本周复盘
                      </button>
                    )}
                  </div>

                  {rev && (
                    <div className="lw-stack" style={{ gap: 12 }}>
                      {summaryItems.length > 0 && (
                        <div className="lw-list">
                          {summaryItems.slice(0, 6).map((item, idx) => (
                            <div
                              key={idx}
                              className="lw-item-row"
                              style={{ alignItems: 'center', paddingTop: 5, paddingBottom: 5 }}
                            >
                              <span
                                className={`lw-check ${item.done ? 'checked' : ''}`}
                                style={{ marginTop: 0, cursor: 'default' }}
                              >
                                {item.done && <IconCheck />}
                              </span>
                              <span className="lw-item-title">{item.text}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Inline Editable Next Week Priorities */}
                      <div className="lw-stack" style={{ gap: 2 }}>
                        <div className="lw-idea-q" style={{ paddingTop: 2 }}>
                          下周重点
                        </div>
                        <div className="lw-list">
                          {nextItems.map((text, idx) => (
                            <div
                              key={`nw-${idx}`}
                              className="lw-item-row"
                              style={{ alignItems: 'center', paddingTop: 5, paddingBottom: 5 }}
                            >
                              <span
                                className="lw-bullet-slot lw-mono"
                                style={{ fontSize: 12, color: 'var(--lw-muted)' }}
                              >
                                {idx + 1}.
                              </span>
                              <input
                                className="lw-inline-input"
                                style={{ flex: 1, padding: 0, fontSize: 13.5 }}
                                value={text}
                                onChange={(e) => {
                                  const next = nextItems.map((s, i) =>
                                    i === idx ? e.target.value : s,
                                  )
                                  setNextWeekDrafts((prev) => ({ ...prev, [rev.relPath]: next }))
                                }}
                                onBlur={() => saveNextItems(rev, nextItems)}
                              />
                              <div className="lw-hover-actions">
                                <button
                                  type="button"
                                  className="lw-icon-btn"
                                  style={{ height: 22, minWidth: 22, padding: 0 }}
                                  title="移除"
                                  onClick={() =>
                                    saveNextItems(
                                      rev,
                                      nextItems.filter((_, i) => i !== idx),
                                    )
                                  }
                                >
                                  <IconX size={12} />
                                </button>
                              </div>
                            </div>
                          ))}

                          <form
                            className="lw-item-row"
                            style={{ alignItems: 'center', paddingTop: 5, paddingBottom: 5 }}
                            onSubmit={(e) => {
                              e.preventDefault()
                              const val = (newNextInputs[rev.relPath] ?? '').trim()
                              if (!val) return
                              setNewNextInputs((prev) => ({ ...prev, [rev.relPath]: '' }))
                              saveNextItems(rev, [...nextItems, val])
                            }}
                          >
                            <span className="lw-bullet-slot">
                              <IconPlus size={14} />
                            </span>
                            <input
                              className="lw-inline-input"
                              style={{ flex: 1, padding: 0, fontSize: 13.5 }}
                              value={newNextInputs[rev.relPath] ?? ''}
                              onChange={(e) =>
                                setNewNextInputs((prev) => ({
                                  ...prev,
                                  [rev.relPath]: e.target.value,
                                }))
                              }
                              placeholder="添加下周重点"
                            />
                          </form>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              )
            })
          )}
        </div>

        {/* Right: Quiet Week Diary */}
        <aside className="lw-stack" style={{ gap: 14 }}>
          <div className="lw-section-head">
            <h2 className="lw-section-title">本周日记</h2>
          </div>

          {reviewCenter.weekDiaries.length === 0 ? (
            <div className="lw-muted">本周暂无日记</div>
          ) : (
            <div className="lw-stack" style={{ gap: 16 }}>
              {reviewCenter.weekDiaries.map((d) => (
                <div
                  key={d.relPath}
                  style={{
                    cursor: 'pointer',
                    paddingBottom: 14,
                    borderBottom: '1px solid var(--lw-border)',
                  }}
                  onClick={() => onOpenFile(d.relPath)}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    {formatDiaryDay(d.date)}
                  </div>
                  <div
                    style={{
                      fontSize: 13.5,
                      color: 'var(--lw-text-2)',
                      lineHeight: 1.65,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {d.preview || '（点击查看原文）'}
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
