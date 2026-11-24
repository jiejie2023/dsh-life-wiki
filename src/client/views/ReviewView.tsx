import React, { useEffect, useMemo, useRef, useState } from 'react'
import type {
  BoardSnapshot,
  DiaryEntrySummary,
  ReviewStatus,
  WeekProjectMetrics,
} from '../../shared/types.ts'
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
} from '../components/Icons.tsx'
import {
  ReviewModeTabs,
  ReviewSectionBody,
  type ReviewSectionTab,
} from '../components/ProjectReviewPanel.tsx'
import {
  applyReviewSections,
  parseReviewSections,
  parseReviewWeekLine,
  type ReviewDraft,
  type ReviewWeekItem,
} from '../reviewMarkdown.ts'

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

function isoWeekRangeShort(weekStr: string): string {
  const monday = isoWeekToUtcMonday(weekStr)
  if (!monday) return ''
  const sunday = new Date(monday.getTime() + 6 * 86400_000)
  return `${monday.toISOString().slice(5, 10)} ~ ${sunday.toISOString().slice(5, 10)}`
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

function cleanDiarySnippet(entry: DiaryEntrySummary): string {
  let body = (entry.content || '').replace(/\r\n/g, '\n')
  const fmMatch = body.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/)
  if (fmMatch) body = fmMatch[1] ?? ''
  const lines = body
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/^>\s*\[![a-zA-Z0-9_-]+\][+-]?\s*/, '')
        .replace(/^>\s?/, '')
        .replace(/<\/?font\b[^>]*>/gi, '')
        .replace(/^!\[[^\]]*\]\([^)]+\)$/, ''),
    )
    .filter((line) => {
      if (!line) return false
      if (/^#{1,4}\s+/.test(line)) return false
      if (/^---+$/.test(line)) return false
      return true
    })
  const text = lines.join(' ').replace(/[*`#_]/g, '').replace(/\s+/g, ' ').trim()
  return text || entry.preview || '（点击查看原文）'
}

interface WeekReviewCardProps {
  metric: WeekProjectMetrics
  onOpenFile: (relPath: string, opts?: { edit?: boolean }) => void
  onRunAction: RunActionFn
}

function WeekReviewCard({ metric, onOpenFile, onRunAction }: WeekReviewCardProps) {
  const rev = metric.review!
  const relPath = rev.relPath

  const [mode, setMode] = useState<ReviewSectionTab>('thisWeek')
  const [rawContent, setRawContent] = useState<string | null>(null)
  const [draft, setDraft] = useState<ReviewDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)

  const dirtyRef = useRef(false)
  const latestRawRef = useRef<string | null>(null)
  const latestDraftRef = useRef<ReviewDraft | null>(null)

  const summaryKey = `${rev.relPath}|${rev.status ?? ''}|${rev.summaryLines.join('\n')}|${rev.nextWeekItems.join('\n')}`

  useEffect(() => {
    let alive = true
    setLoading(true)
    setStatusMenuOpen(false)
    dirtyRef.current = false

    api
      .readFile(relPath)
      .then((res) => {
        if (!alive) return
        const parsed = parseReviewSections(res.content)
        setRawContent(res.content)
        setDraft(parsed)
        latestRawRef.current = res.content
        latestDraftRef.current = parsed
      })
      .catch(() => {
        if (!alive) return
        const fallbackItems = rev.summaryLines
          .map((l) => parseReviewWeekLine(l))
          .filter((x): x is ReviewWeekItem => x !== null)
        const fallback: ReviewDraft = {
          status: rev.status === 'final' ? 'final' : 'draft',
          thisWeekItems: fallbackItems,
          totalHoursLine: rev.totalHoursText,
          reasons: [],
          lessons: [],
          nextWeekItems: rev.nextWeekItems,
        }
        setDraft(fallback)
        latestDraftRef.current = fallback
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [summaryKey, relPath])

  useEffect(() => {
    setMode('thisWeek')
  }, [relPath])

  useEffect(() => {
    if (!statusMenuOpen) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (!t?.closest(`[data-rv-card-status="${relPath}"]`)) setStatusMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStatusMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [statusMenuOpen, relPath])

  const persistNow = async (nextDraft: ReviewDraft) => {
    const base = latestRawRef.current
    if (base === null) return
    const nextMd = applyReviewSections(base, nextDraft)
    dirtyRef.current = false
    if (nextMd === base) return
    latestRawRef.current = nextMd
    setRawContent(nextMd)
    await onRunAction(async () => {
      await api.writeFile(relPath, nextMd)
    })
  }

  const commitDraft = (next: ReviewDraft, immediate = false) => {
    setDraft(next)
    latestDraftRef.current = next
    dirtyRef.current = true
    if (immediate) {
      void persistNow(next)
    }
  }

  const flushSave = () => {
    if (!dirtyRef.current || !latestDraftRef.current) return
    void persistNow(latestDraftRef.current)
  }

  const curStatus: ReviewStatus = draft?.status ?? (rev.status === 'final' ? 'final' : 'draft')
  const hours = metric.totalMinutes > 0 ? `${(metric.totalMinutes / 60).toFixed(1)} 小时` : null
  const ratio = useMemo(() => {
    const items = (draft?.thisWeekItems ?? []).filter((it) => it.done !== null)
    if (items.length > 0) {
      return items.filter((it) => it.done === true).length / items.length
    }
    return metric.totalTasks > 0 ? metric.doneTasks / metric.totalTasks : 0
  }, [draft?.thisWeekItems, metric.doneTasks, metric.totalTasks])

  return (
    <section className="lw-stack" style={{ gap: 6 }}>
      {/* Mirrors TodayView ProjectTaskPanel Header: Title | [本周] 原因 经验 下周  • 待审核 ▾  📄 */}
      <div className="lw-section-head">
        <div className="lw-row" style={{ gap: 9, minWidth: 0 }}>
          <IconProjectPie ratio={ratio} size={16} />
          <h2 className="lw-section-title">{metric.projectName}</h2>
          {hours && <span className="lw-muted">{hours}</span>}
        </div>

        <div className="lw-row" style={{ gap: 2, flexShrink: 0 }}>
          <ReviewModeTabs mode={mode} onChange={setMode} />

          <div className="lw-menu-wrap" data-rv-card-status={relPath}>
            <button
              type="button"
              className={`lw-status-trigger ${statusMenuOpen ? 'open' : ''}`}
              onClick={() => setStatusMenuOpen((v) => !v)}
            >
              <span className={`lw-status-dot ${curStatus === 'final' ? 'done' : 'todo'}`} />
              <span>{curStatus === 'final' ? '已审核' : '待审核'}</span>
              <IconChevronDown size={12} />
            </button>

            {statusMenuOpen && (
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
                    className={`lw-menu-item ${curStatus === val ? 'active' : ''}`}
                    onClick={() => {
                      setStatusMenuOpen(false)
                      if (curStatus === val) return
                      if (draft && rawContent !== null) {
                        commitDraft({ ...draft, status: val }, true)
                      } else {
                        void onRunAction(() => api.updateReview(relPath, { status: val }))
                      }
                    }}
                  >
                    <span className={`lw-status-dot ${dotCls}`} />
                    <span style={{ flex: 1 }}>{label}</span>
                    {curStatus === val && <IconCheck size={12} />}
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
            onClick={() => onOpenFile(relPath, { edit: true })}
          >
            <IconFile size={14} />
          </button>
        </div>
      </div>

      {loading && !draft ? (
        <div className="lw-muted" style={{ padding: '4px 0' }}>
          读取中…
        </div>
      ) : draft ? (
        <ReviewSectionBody
          mode={mode}
          draft={draft}
          relPath={relPath}
          onOpenFile={onOpenFile}
          onCommitDraft={commitDraft}
          onFlushSave={flushSave}
        />
      ) : null}
    </section>
  )
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
  const [generateMenuOpen, setGenerateMenuOpen] = useState(false)

  const isSwitchingWeek = reviewCenter.week !== selectedWeek

  useEffect(() => {
    setGenerateMenuOpen(false)
  }, [selectedWeek])

  useEffect(() => {
    if (!weekMenuOpen && !generateMenuOpen) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (weekMenuOpen && !t?.closest('[data-rv-week-menu]')) setWeekMenuOpen(false)
      if (generateMenuOpen && !t?.closest('[data-rv-gen-menu]')) setGenerateMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setWeekMenuOpen(false)
        setGenerateMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [weekMenuOpen, generateMenuOpen])

  const draftWeekSet = useMemo(() => {
    const s = new Set<string>()
    for (const r of reviewCenter.draftReviews) s.add(r.week)
    return s
  }, [reviewCenter.draftReviews])

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

  const { reviewedMetrics, missingMetrics } = useMemo(() => {
    const reviewed: WeekProjectMetrics[] = []
    const missing: WeekProjectMetrics[] = []
    for (const m of reviewCenter.projectMetrics) {
      if (m.review) reviewed.push(m)
      else missing.push(m)
    }
    return { reviewedMetrics: reviewed, missingMetrics: missing }
  }, [reviewCenter.projectMetrics])

  const displayRange = isSwitchingWeek
    ? isoWeekRangeShort(selectedWeek)
    : `${reviewCenter.weekRange.start.slice(5)} ~ ${reviewCenter.weekRange.end.slice(5)}`

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
                        const hasDraft = draftWeekSet.has(w)
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
                            <span
                              className={`lw-status-dot ${hasDraft ? 'todo' : 'done'}`}
                              style={{ opacity: hasDraft ? 1 : 0.25 }}
                            />
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
            {displayRange}
          </span>
        </div>
      </div>

      {/* 2-Column Editorial Spread */}
      <div
        className="lw-review-grid"
        style={
          isSwitchingWeek
            ? { opacity: 0.45, pointerEvents: 'none', transition: 'opacity 0.12s' }
            : { transition: 'opacity 0.12s' }
        }
      >
        {/* Left: Only Projects with Reviews in Selected Week */}
        <div className="lw-stack" style={{ gap: 28 }}>
          {reviewedMetrics.length === 0 ? (
            <div className="lw-empty">
              {reviewCenter.projectMetrics.length === 0 ? '暂无活跃项目' : '这一周暂无复盘。'}
            </div>
          ) : (
            reviewedMetrics.map((metric) => (
              <WeekReviewCard
                key={`${metric.projectName}:${metric.review!.relPath}`}
                metric={metric}
                onOpenFile={onOpenFile}
                onRunAction={onRunAction}
              />
            ))
          )}

          {missingMetrics.length > 0 && (
            <div style={{ paddingTop: 2 }}>
              <div className="lw-menu-wrap" data-rv-gen-menu>
                <button
                  type="button"
                  className="lw-btn lw-btn-sm lw-btn-ghost"
                  style={{ color: 'var(--lw-text-3)', paddingLeft: 2 }}
                  onClick={() => setGenerateMenuOpen((v) => !v)}
                >
                  <IconPlus size={13} />
                  <span>生成项目复盘</span>
                  <IconChevronDown size={12} />
                </button>

                {generateMenuOpen && (
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
                    {missingMetrics.map((m) => (
                      <button
                        key={m.projectName}
                        type="button"
                        role="menuitem"
                        className="lw-menu-item"
                        onClick={() => {
                          setGenerateMenuOpen(false)
                          void onRunAction(
                            () => api.generateWeeklyReview(m.projectName, selectedWeek),
                            { toast: `已生成 ${m.projectName} ${selectedWeek} 复盘` },
                          )
                        }}
                      >
                        <span className="lw-status-dot doing" />
                        <span
                          style={{
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {m.projectName}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
            <div className="lw-stack" style={{ gap: 4 }}>
              {reviewCenter.weekDiaries.map((d) => (
                <div
                  key={d.relPath}
                  className="lw-project-row"
                  style={{
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: 4,
                    padding: '10px 10px',
                    margin: '0 -10px',
                  }}
                  onClick={() => onOpenFile(d.relPath)}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{formatDiaryDay(d.date)}</div>
                  <div
                    style={{
                      fontSize: 13.5,
                      color: 'var(--lw-text-2)',
                      lineHeight: 1.65,
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {cleanDiarySnippet(d)}
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
