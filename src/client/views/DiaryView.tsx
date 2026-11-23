import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { BoardSnapshot, DiaryEntrySummary } from '../../shared/types.ts'
import type { RunActionFn } from '../App.tsx'
import { api, rawFileUrl } from '../api.ts'
import {
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconFile,
  IconSearch,
  IconX,
} from '../components/Icons.tsx'
import { MarkdownView } from '../components/MarkdownView.tsx'

interface DiaryViewProps {
  snapshot: BoardSnapshot
  defaultDate: string
  onOpenFile: (relPath: string, opts?: { edit?: boolean }) => void
  onRunAction: RunActionFn
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const PAGE_SIZE = 24

function formatComposerDate(iso: string, todayIso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  const wd = WEEKDAYS[dt.getDay()] ?? ''
  return iso === todayIso ? `${mo}月${d}日 · ${wd}` : `${y}年${mo}月${d}日 · 补记`
}

function formatMonthLabel(ym: string): string {
  const m = ym.match(/^(\d{4})-(\d{2})$/)
  if (!m) return ym
  return `${m[1]}年${Number(m[2])}月`
}

function parseDayMeta(iso: string): { day: string; weekday: string } {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return { day: iso, weekday: '' }
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return {
    day: String(Number(m[3])).padStart(2, '0'),
    weekday: WEEKDAYS[dt.getDay()] ?? '',
  }
}

interface DiarySegment {
  time: string | null
  body: string
}

/** Splits a diary markdown file into clean timestamped segments (## HH:MM), stripping YAML frontmatter and redundant date H1. */
function parseDiarySegments(raw: string, entryDate: string): DiarySegment[] {
  let body = raw.replace(/\r\n/g, '\n')
  const fmMatch = body.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/)
  if (fmMatch) body = fmMatch[1] ?? ''

  const lines = body.split('\n')
  const segments: DiarySegment[] = []
  let currentTime: string | null = null
  let buf: string[] = []

  const flush = () => {
    const joined = buf.join('\n').trim()
    if (joined || currentTime) {
      if (joined) segments.push({ time: currentTime, body: joined })
    }
    buf = []
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()

    // Skip redundant top-level "# 2026-04-15 Wednesday" date heading (already in the date gutter)
    if (segments.length === 0 && buf.every((b) => !b.trim()) && trimmed.startsWith('# ')) {
      if (trimmed.includes(entryDate)) continue
    }

    const timeMatch = /^##\s+(\d{1,2}:\d{2})(?:\s+(.*))?$/.exec(trimmed)
    if (timeMatch) {
      flush()
      currentTime = timeMatch[1]!
      if (timeMatch[2]?.trim()) {
        buf.push(`**${timeMatch[2].trim()}**`)
      }
      continue
    }
    buf.push(line)
  }
  flush()
  return segments
}

function getUnreferencedImages(entry: DiaryEntrySummary): string[] {
  if (entry.images.length === 0) return []
  return entry.images.filter((imgPath) => {
    const basename = imgPath.split('/').pop() ?? imgPath
    return !entry.content.includes(basename) && !entry.content.includes(encodeURI(basename))
  })
}

export function DiaryView({
  snapshot,
  defaultDate,
  onOpenFile,
  onRunAction,
}: DiaryViewProps) {
  const [writeDate, setWriteDate] = useState(defaultDate)
  const [draft, setDraft] = useState('')
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL')
  const [selectedDayFilter, setSelectedDayFilter] = useState<string | null>(null)
  const [monthMenuOpen, setMonthMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const writeDateRef = useRef<HTMLInputElement | null>(null)
  const jumpDateRef = useRef<HTMLInputElement | null>(null)

  // Auto-size composer textarea cleanly
  useEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(54, el.scrollHeight)}px`
  }, [draft])

  // Close month dropdown or lightbox on outside click / Esc
  useEffect(() => {
    if (!monthMenuOpen && !lightboxSrc) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (monthMenuOpen && !t?.closest('[data-diary-month-menu]')) setMonthMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxSrc) setLightboxSrc(null)
        else setMonthMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [monthMenuOpen, lightboxSrc])

  // Months sorted descending (newest first) and ascending (for < / > stepping)
  const monthsDesc = useMemo(() => {
    const set = new Set<string>()
    for (const d of snapshot.diaries) {
      if (d.month) set.add(d.month)
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [snapshot.diaries])

  const monthsAsc = useMemo(() => [...monthsDesc].reverse(), [monthsDesc])

  // Year -> Months grouping for scalable multi-year dropdown
  const yearGroups = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const ym of monthsDesc) {
      const year = ym.slice(0, 4)
      const list = map.get(year) ?? []
      list.push(ym)
      map.set(year, list)
    }
    return Array.from(map.entries())
  }, [monthsDesc])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return snapshot.diaries.filter((d) => {
      if (selectedDayFilter && d.date !== selectedDayFilter) return false
      if (!selectedDayFilter && selectedMonth !== 'ALL' && d.month !== selectedMonth) return false
      if (!q) return true
      return d.date.includes(q) || d.content.toLowerCase().includes(q)
    })
  }, [snapshot.diaries, selectedMonth, selectedDayFilter, query])

  const visibleEntries = useMemo(
    () => filtered.slice(0, visibleLimit),
    [filtered, visibleLimit],
  )

  // Group visible entries by YYYY-MM for clean month dividers
  const entriesByMonth = useMemo(() => {
    const map = new Map<string, DiaryEntrySummary[]>()
    for (const e of visibleEntries) {
      const ym = e.month || e.date.slice(0, 7)
      const arr = map.get(ym) ?? []
      arr.push(e)
      map.set(ym, arr)
    }
    return Array.from(map.entries())
  }, [visibleEntries])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return
    setDraft('')
    await onRunAction(() => api.appendDiary(trimmed, writeDate))
  }

  // Month stepping logic when filtered to a specific month
  const curMonthIdx = selectedMonth !== 'ALL' ? monthsAsc.indexOf(selectedMonth) : -1
  const prevMonth = curMonthIdx > 0 ? monthsAsc[curMonthIdx - 1]! : null
  const nextMonth =
    curMonthIdx >= 0 && curMonthIdx < monthsAsc.length - 1 ? monthsAsc[curMonthIdx + 1]! : null

  const triggerLabel = selectedDayFilter
    ? selectedDayFilter
    : selectedMonth === 'ALL'
      ? '全部月份'
      : formatMonthLabel(selectedMonth)

  return (
    <div className="lw-canvas">
      {/* Minimal Things 3 Writing Area */}
      <form className="lw-diary-composer" onSubmit={(e) => void handleSubmit(e)}>
        <textarea
          ref={composerRef}
          className="lw-diary-textarea"
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              void handleSubmit()
            }
          }}
          placeholder="写点此刻的想法或生活…"
        />
        <div className="lw-between">
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <button
              type="button"
              className="lw-btn lw-btn-sm lw-btn-ghost"
              style={{
                marginLeft: -6,
                padding: '0 7px',
                height: 26,
                fontSize: 12.5,
                color: writeDate !== snapshot.date ? 'var(--lw-accent-text)' : 'var(--lw-muted)',
              }}
              title="切换记录日期"
              onClick={() => {
                try {
                  writeDateRef.current?.showPicker?.()
                } catch {
                  writeDateRef.current?.focus()
                  writeDateRef.current?.click()
                }
              }}
            >
              <IconCalendar size={12.5} />
              <span>{formatComposerDate(writeDate, snapshot.date)}</span>
            </button>
            <input
              ref={writeDateRef}
              type="date"
              value={writeDate}
              onChange={(e) => {
                if (e.target.value) setWriteDate(e.target.value)
              }}
              style={{
                position: 'absolute',
                opacity: 0,
                pointerEvents: 'none',
                width: 1,
                height: 1,
              }}
            />
          </div>

          <button
            type="submit"
            className="lw-btn lw-btn-sm lw-btn-primary"
            disabled={!draft.trim()}
          >
            记录
          </button>
        </div>
      </form>

      {/* Single-Row Scalable Date Navigation + Quiet Search */}
      <div className="lw-diary-toolbar">
        <div className="lw-row" style={{ gap: 2, marginLeft: -6 }} data-diary-month-menu>
          {selectedMonth !== 'ALL' && !selectedDayFilter && (
            <button
              type="button"
              className="lw-icon-btn"
              style={{ height: 26, minWidth: 26 }}
              disabled={!prevMonth}
              title={prevMonth ? `上个月 (${prevMonth})` : '没有更早的月份'}
              onClick={() => {
                if (prevMonth) {
                  setSelectedMonth(prevMonth)
                  setVisibleLimit(PAGE_SIZE)
                }
              }}
            >
              <IconChevronLeft size={14} />
            </button>
          )}

          <div className="lw-menu-wrap">
            <button
              type="button"
              className={`lw-status-trigger ${monthMenuOpen ? 'open' : ''}`}
              style={{ color: 'var(--lw-text)', fontWeight: 600 }}
              onClick={() => setMonthMenuOpen((v) => !v)}
            >
              <span>{triggerLabel}</span>
              <IconChevronDown size={12} />
            </button>

            {monthMenuOpen && (
              <div className="lw-menu lw-date-menu" role="menu">
                <div className="lw-date-menu-scroll">
                  <button
                    type="button"
                    role="menuitem"
                    className={`lw-menu-item ${selectedMonth === 'ALL' && !selectedDayFilter ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedMonth('ALL')
                      setSelectedDayFilter(null)
                      setVisibleLimit(PAGE_SIZE)
                      setMonthMenuOpen(false)
                    }}
                  >
                    <span style={{ flex: 1 }}>全部月份</span>
                    <span
                      style={{
                        width: 12,
                        display: 'inline-flex',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {selectedMonth === 'ALL' && !selectedDayFilter && <IconCheck size={12} />}
                    </span>
                  </button>

                  {yearGroups.map(([year, yms]) => (
                    <React.Fragment key={year}>
                      <div className="lw-date-month">{year}年</div>
                      {yms.map((ym) => {
                        const active = !selectedDayFilter && selectedMonth === ym
                        const monthNum = Number(ym.slice(5, 7))
                        return (
                          <button
                            key={ym}
                            type="button"
                            role="menuitem"
                            className={`lw-menu-item ${active ? 'active' : ''}`}
                            onClick={() => {
                              setSelectedMonth(ym)
                              setSelectedDayFilter(null)
                              setVisibleLimit(PAGE_SIZE)
                              setMonthMenuOpen(false)
                            }}
                          >
                            <span style={{ flex: 1 }}>{monthNum}月</span>
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

                <div className="lw-date-menu-foot">
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm lw-btn-ghost"
                    style={{ height: 24, padding: '0 6px', fontSize: 12, width: '100%' }}
                    onClick={() => {
                      try {
                        jumpDateRef.current?.showPicker?.()
                      } catch {
                        jumpDateRef.current?.focus()
                        jumpDateRef.current?.click()
                      }
                    }}
                  >
                    <IconCalendar size={12} />
                    跳到指定日期
                  </button>
                </div>
              </div>
            )}
          </div>

          {selectedMonth !== 'ALL' && !selectedDayFilter && (
            <button
              type="button"
              className="lw-icon-btn"
              style={{ height: 26, minWidth: 26 }}
              disabled={!nextMonth}
              title={nextMonth ? `下个月 (${nextMonth})` : '已是最新月份'}
              onClick={() => {
                if (nextMonth) {
                  setSelectedMonth(nextMonth)
                  setVisibleLimit(PAGE_SIZE)
                }
              }}
            >
              <IconChevronRight size={14} />
            </button>
          )}

          {selectedDayFilter && (
            <button
              type="button"
              className="lw-icon-btn"
              style={{ height: 24, minWidth: 24 }}
              title="清除日期筛选"
              onClick={() => setSelectedDayFilter(null)}
            >
              <IconX size={13} />
            </button>
          )}

          <input
            ref={jumpDateRef}
            type="date"
            value={selectedDayFilter ?? defaultDate}
            onChange={(e) => {
              if (e.target.value) {
                setSelectedDayFilter(e.target.value)
                setMonthMenuOpen(false)
              }
            }}
            style={{
              position: 'absolute',
              opacity: 0,
              pointerEvents: 'none',
              width: 1,
              height: 1,
            }}
          />
        </div>

        <div className="lw-diary-search">
          <IconSearch size={13} />
          <input
            className="lw-inline-input"
            style={{ fontSize: 13, padding: 0 }}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setVisibleLimit(PAGE_SIZE)
            }}
            placeholder="搜索"
          />
          {query && (
            <button
              type="button"
              className="lw-icon-btn"
              style={{ height: 20, minWidth: 20, padding: 0 }}
              onClick={() => setQuery('')}
              aria-label="清空搜索"
            >
              <IconX size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Editorial Journal Timeline */}
      {filtered.length === 0 ? (
        <div className="lw-empty">
          {snapshot.diaries.length === 0
            ? '还没有日记，在上面写下第一句吧。'
            : selectedDayFilter
              ? `${selectedDayFilter} 还没有日记记录`
              : '没有匹配的日记'}
        </div>
      ) : (
        <div className="lw-stack" style={{ gap: 28 }}>
          {entriesByMonth.map(([ym, entries]) => (
            <div key={ym} className="lw-stack" style={{ gap: 22 }}>
              {selectedMonth === 'ALL' && !selectedDayFilter && (
                <div className="lw-diary-month-head">{formatMonthLabel(ym)}</div>
              )}

              {entries.map((entry) => {
                const { day, weekday } = parseDayMeta(entry.date)
                const segments = parseDiarySegments(entry.content, entry.date)
                const extraImages = getUnreferencedImages(entry)

                return (
                  <article key={entry.relPath} className="lw-diary-entry lw-diary-day">
                    <div className="lw-diary-gutter">
                      <span className="lw-diary-daynum">{day}</span>
                      <span className="lw-diary-weekday">{weekday}</span>
                    </div>

                    <div className="lw-diary-body">
                      <div className="lw-hover-actions lw-diary-edit-btn">
                        <button
                          type="button"
                          className="lw-icon-btn"
                          style={{ height: 24, minWidth: 24 }}
                          title="编辑原文"
                          onClick={() => onOpenFile(entry.relPath, { edit: true })}
                        >
                          <IconFile size={13.5} />
                        </button>
                      </div>

                      {segments.length === 0 ? (
                        <span className="lw-muted">空白日记</span>
                      ) : (
                        segments.map((seg, idx) => (
                          <div key={`${entry.date}-${idx}`} className="lw-diary-seg">
                            {seg.time && <span className="lw-diary-time">{seg.time}</span>}
                            <MarkdownView
                              content={seg.body}
                              baseRelPath={entry.relPath}
                              hideFrontmatter
                              onOpenImage={(src) => setLightboxSrc(src)}
                              onOpenFile={(rel) => onOpenFile(rel)}
                            />
                          </div>
                        ))
                      )}

                      {extraImages.length > 0 && (
                        <div className="lw-photo-grid">
                          {extraImages.map((imgPath) => {
                            const url = rawFileUrl(imgPath)
                            return (
                              <img
                                key={imgPath}
                                src={url}
                                alt={imgPath}
                                className="lw-photo-thumb"
                                onClick={() => setLightboxSrc(url)}
                              />
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          ))}

          {filtered.length > visibleLimit && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
              <button
                type="button"
                className="lw-btn lw-btn-sm lw-btn-ghost"
                onClick={() => setVisibleLimit((v) => v + PAGE_SIZE)}
              >
                显示更早的日记
              </button>
            </div>
          )}
        </div>
      )}

      {lightboxSrc && (
        <div className="lw-backdrop lw-backdrop-center" onClick={() => setLightboxSrc(null)}>
          <img
            src={lightboxSrc}
            alt="预览"
            style={{
              maxWidth: '92%',
              maxHeight: '88%',
              borderRadius: 10,
              boxShadow: 'var(--lw-shadow-lg)',
            }}
          />
        </div>
      )}
    </div>
  )
}
