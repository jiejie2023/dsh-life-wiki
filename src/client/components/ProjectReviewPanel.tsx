import React, { useEffect, useRef, useState } from 'react'
import type { ProjectCard, ReviewStatus } from '../../shared/types.ts'
import type { RunActionFn } from '../App.tsx'
import { api } from '../api.ts'
import {
  applyReviewSections,
  parseReviewSections,
  type ReviewDraft,
} from '../reviewMarkdown.ts'
import {
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconFile,
} from './Icons.tsx'

interface ProjectReviewPanelProps {
  project: ProjectCard
  currentWeek: string
  onOpenFile: (relPath: string, opts?: { edit?: boolean }) => void
  onRunAction: RunActionFn
}

function AutoReviewTextarea({
  value,
  disabled,
  onChange,
  onBlur,
  placeholder,
}: {
  value: string
  disabled?: boolean
  onChange: (next: string) => void
  onBlur: () => void
  placeholder: string
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      className="lw-idea-field"
      rows={1}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
    />
  )
}

export function ProjectReviewPanel({
  project,
  currentWeek,
  onOpenFile,
  onRunAction,
}: ProjectReviewPanelProps) {
  const weeksAsc = [...project.reviewFiles]
    .map((r) => r.week)
    .sort((a, b) => a.localeCompare(b))
  const latestWeek = weeksAsc[weeksAsc.length - 1] ?? ''

  const [selectedWeek, setSelectedWeek] = useState<string>(latestWeek)
  const [menuOpen, setMenuOpen] = useState(false)
  const [rawContent, setRawContent] = useState<string | null>(null)
  const [draft, setDraft] = useState<ReviewDraft | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const dirtyRef = useRef(false)
  const latestRawRef = useRef<string | null>(null)
  const latestDraftRef = useRef<ReviewDraft | null>(null)

  // Keep selectedWeek valid when review list changes (e.g. right after generating a new draft)
  useEffect(() => {
    if (project.reviewFiles.length === 0) {
      setSelectedWeek('')
      return
    }
    if (!project.reviewFiles.some((r) => r.week === selectedWeek)) {
      setSelectedWeek(latestWeek)
    }
  }, [project.name, project.reviewFiles.length, latestWeek, selectedWeek])

  const selectedSummary =
    project.reviewFiles.find((r) => r.week === selectedWeek) ?? project.reviewFiles[0] ?? null

  useEffect(() => {
    if (!selectedSummary) {
      setRawContent(null)
      setDraft(null)
      latestRawRef.current = null
      latestDraftRef.current = null
      return
    }
    let alive = true
    setLoading(true)
    dirtyRef.current = false
    api
      .readFile(selectedSummary.relPath)
      .then((res) => {
        if (!alive) return
        setRawContent(res.content)
        latestRawRef.current = res.content
        const parsed = parseReviewSections(res.content)
        setDraft(parsed)
        latestDraftRef.current = parsed
      })
      .catch(() => {
        if (!alive) return
        setRawContent('')
        latestRawRef.current = ''
        const empty = parseReviewSections('')
        setDraft(empty)
        latestDraftRef.current = empty
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [selectedSummary?.relPath])

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (!t?.closest('[data-review-week-menu]')) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const updateDraft = (patch: Partial<ReviewDraft>) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      latestDraftRef.current = next
      dirtyRef.current = true
      return next
    })
  }

  const flushSave = async (overrideDraft?: ReviewDraft) => {
    if (!selectedSummary || project.archived) return
    const base = latestRawRef.current
    const current = overrideDraft ?? latestDraftRef.current
    if (base === null || !current) return
    if (!overrideDraft && !dirtyRef.current) return
    const nextContent = applyReviewSections(base, current)
    if (nextContent === base) {
      dirtyRef.current = false
      return
    }
    dirtyRef.current = false
    setSaving(true)
    try {
      await onRunAction(async () => {
        await api.writeFile(selectedSummary.relPath, nextContent)
        latestRawRef.current = nextContent
        setRawContent(nextContent)
      })
    } finally {
      setSaving(false)
    }
  }

  const handleStatusToggle = (nextStatus: ReviewStatus) => {
    if (!draft || project.archived || draft.status === nextStatus) return
    const next: ReviewDraft = { ...draft, status: nextStatus }
    setDraft(next)
    latestDraftRef.current = next
    dirtyRef.current = true
    void flushSave(next)
  }

  const handleSwitchWeek = async (nextWeek: string) => {
    await flushSave()
    setMenuOpen(false)
    setSelectedWeek(nextWeek)
  }

  const handleGenerateCurrentWeek = async () => {
    await flushSave()
    setMenuOpen(false)
    await onRunAction(
      async () => {
        await api.generateWeeklyReview(project.name, currentWeek)
        setSelectedWeek(currentWeek)
      },
      { toast: `已生成 ${currentWeek} 复盘草稿` },
    )
  }

  if (!selectedSummary) {
    return (
      <div className="lw-empty" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <span>暂无周复盘</span>
        {!project.archived && (
          <button
            type="button"
            className="lw-btn lw-btn-sm lw-btn-primary"
            onClick={() => void handleGenerateCurrentWeek()}
          >
            生成本周草稿 ({currentWeek})
          </button>
        )}
      </div>
    )
  }

  const curIdx = weeksAsc.indexOf(selectedSummary.week)
  const prevWeek = curIdx > 0 ? weeksAsc[curIdx - 1]! : null
  const nextWeekVal = curIdx >= 0 && curIdx < weeksAsc.length - 1 ? weeksAsc[curIdx + 1]! : null
  const hasCurrentWeek = project.reviewFiles.some((r) => r.week === currentWeek)

  return (
    <div className="lw-stack" style={{ gap: 22 }}>
      {/* Single-Row Week Switcher & Status Controls */}
      <div className="lw-section-head">
        <div className="lw-row" style={{ gap: 2, marginLeft: -6 }} data-review-week-menu>
          <button
            type="button"
            className="lw-icon-btn"
            style={{ height: 26, minWidth: 26 }}
            disabled={!prevWeek}
            title={prevWeek ? `上一周 (${prevWeek})` : '没有更早的复盘'}
            onClick={() => prevWeek && void handleSwitchWeek(prevWeek)}
          >
            <IconChevronLeft size={14} />
          </button>

          <div className="lw-menu-wrap">
            <button
              type="button"
              className={`lw-status-trigger ${menuOpen ? 'open' : ''}`}
              style={{ color: 'var(--lw-text)', fontWeight: 600 }}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span
                className={`lw-status-dot ${(draft?.status ?? selectedSummary.status) === 'final' ? 'done' : 'todo'}`}
                style={{ width: 6, height: 6 }}
              />
              <span className="lw-mono">{selectedSummary.week}</span>
              <IconChevronDown size={12} />
            </button>

            {menuOpen && (
              <div className="lw-menu lw-date-menu" role="menu">
                <div className="lw-date-menu-scroll">
                  {[...project.reviewFiles]
                    .sort((a, b) => b.week.localeCompare(a.week))
                    .map((rf) => {
                      const active = rf.week === selectedSummary.week
                      return (
                        <button
                          key={rf.relPath}
                          type="button"
                          role="menuitem"
                          className={`lw-menu-item ${active ? 'active' : ''}`}
                          onClick={() => void handleSwitchWeek(rf.week)}
                        >
                          <span
                            className={`lw-status-dot ${rf.status === 'final' ? 'done' : 'todo'}`}
                            style={{ width: 6, height: 6 }}
                          />
                          <span className="lw-mono" style={{ flex: 1 }}>
                            {rf.week}
                          </span>
                          <span className="lw-muted" style={{ fontSize: 11.5 }}>
                            {rf.status === 'final' ? '已定稿' : '草稿'}
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
                </div>
                {!project.archived && !hasCurrentWeek && (
                  <div className="lw-date-menu-foot">
                    <button
                      type="button"
                      className="lw-btn lw-btn-sm lw-btn-ghost"
                      style={{ height: 24, padding: '0 6px', fontSize: 12, width: '100%' }}
                      onClick={() => void handleGenerateCurrentWeek()}
                    >
                      + 生成本周草稿 ({currentWeek})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            className="lw-icon-btn"
            style={{ height: 26, minWidth: 26 }}
            disabled={!nextWeekVal}
            title={nextWeekVal ? `下一周 (${nextWeekVal})` : '已是最新复盘'}
            onClick={() => nextWeekVal && void handleSwitchWeek(nextWeekVal)}
          >
            <IconChevronRight size={14} />
          </button>
        </div>

        <div className="lw-row" style={{ gap: 4 }}>
          {saving && <span className="lw-muted" style={{ marginRight: 4 }}>保存中…</span>}
          {draft && !project.archived && (
            <>
              <button
                type="button"
                className={`lw-verdict-btn ${draft.status === 'draft' ? 'active-think' : ''}`}
                onClick={() => handleStatusToggle('draft')}
              >
                草稿
              </button>
              <button
                type="button"
                className={`lw-verdict-btn ${draft.status === 'final' ? 'active-go' : ''}`}
                onClick={() => handleStatusToggle('final')}
              >
                已定稿
              </button>
            </>
          )}
          <button
            type="button"
            className="lw-icon-btn"
            style={{ height: 26, minWidth: 26 }}
            title="编辑 Markdown 原文"
            onClick={async () => {
              await flushSave()
              onOpenFile(selectedSummary.relPath, { edit: true })
            }}
          >
            <IconFile size={14} />
          </button>
        </div>
      </div>

      {/* Inline Editable 4-Section Weekly Review */}
      {loading || !draft || rawContent === null ? (
        <div className="lw-muted">读取中…</div>
      ) : (
        <div className="lw-stack" style={{ gap: 22 }}>
          <section className="lw-idea-section">
            <div className="lw-between">
              <span className="lw-idea-q" style={{ fontWeight: 600, color: 'var(--lw-text-2)' }}>
                本周
              </span>
              {draft.totalHoursLine && <span className="lw-muted">{draft.totalHoursLine}</span>}
            </div>
            <AutoReviewTextarea
              value={draft.thisWeek}
              disabled={project.archived}
              onChange={(v) => updateDraft({ thisWeek: v })}
              onBlur={() => void flushSave()}
              placeholder="列出本周推进的事项（✅ / ❌）…"
            />
          </section>

          <section className="lw-idea-section">
            <span className="lw-idea-q" style={{ fontWeight: 600, color: 'var(--lw-text-2)' }}>
              原因
            </span>
            <AutoReviewTextarea
              value={draft.reason}
              disabled={project.archived}
              onChange={(v) => updateDraft({ reason: v })}
              onBlur={() => void flushSave()}
              placeholder="做成了靠什么，没做完卡在哪里…"
            />
          </section>

          <section className="lw-idea-section">
            <span className="lw-idea-q" style={{ fontWeight: 600, color: 'var(--lw-text-2)' }}>
              经验
            </span>
            <AutoReviewTextarea
              value={draft.lesson}
              disabled={project.archived}
              onChange={(v) => updateDraft({ lesson: v })}
              onBlur={() => void flushSave()}
              placeholder="值得以后复用的做法或教训…"
            />
          </section>

          <section className="lw-idea-section">
            <span className="lw-idea-q" style={{ fontWeight: 600, color: 'var(--lw-text-2)' }}>
              下周
            </span>
            <AutoReviewTextarea
              value={draft.nextWeek}
              disabled={project.archived}
              onChange={(v) => updateDraft({ nextWeek: v })}
              onBlur={() => void flushSave()}
              placeholder="下周最关键的 1~3 件事…"
            />
          </section>
        </div>
      )}
    </div>
  )
}
