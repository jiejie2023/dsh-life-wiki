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
  IconPlus,
  IconX,
} from './Icons.tsx'

interface ProjectReviewPanelProps {
  project: ProjectCard
  currentWeek: string
  onOpenFile: (relPath: string, opts?: { edit?: boolean }) => void
  onRunAction: RunActionFn
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
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [rawContent, setRawContent] = useState<string | null>(null)
  const [draft, setDraft] = useState<ReviewDraft | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Quick-add inline inputs
  const [newWeekItem, setNewWeekItem] = useState('')
  const [newReason, setNewReason] = useState('')
  const [newLesson, setNewLesson] = useState('')
  const [newNextItem, setNewNextItem] = useState('')

  const dirtyRef = useRef(false)
  const latestRawRef = useRef<string | null>(null)
  const latestDraftRef = useRef<ReviewDraft | null>(null)

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
    setNewWeekItem('')
    setNewReason('')
    setNewLesson('')
    setNewNextItem('')
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
    if (!menuOpen && !statusMenuOpen) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (menuOpen && !t?.closest('[data-review-week-menu]')) setMenuOpen(false)
      if (statusMenuOpen && !t?.closest('[data-review-status-menu]')) setStatusMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setStatusMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen, statusMenuOpen])

  const commitDraft = (next: ReviewDraft, immediateSave = false) => {
    setDraft(next)
    latestDraftRef.current = next
    dirtyRef.current = true
    if (immediateSave) {
      void flushSave(next)
    }
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

  const handleSelectStatus = (nextStatus: ReviewStatus) => {
    setStatusMenuOpen(false)
    if (!draft || project.archived || draft.status === nextStatus) return
    commitDraft({ ...draft, status: nextStatus }, true)
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
      { toast: `已生成 ${currentWeek} 周复盘` },
    )
  }

  if (!selectedSummary) {
    return (
      <div
        className="lw-empty"
        style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}
      >
        <span>暂无周复盘</span>
        {!project.archived && (
          <button
            type="button"
            className="lw-btn lw-btn-sm lw-btn-primary"
            onClick={() => void handleGenerateCurrentWeek()}
          >
            生成本周复盘 ({currentWeek})
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
    <div className="lw-stack" style={{ gap: 24 }}>
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
                      + 生成本周复盘 ({currentWeek})
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

        <div className="lw-row" style={{ gap: 2 }}>
          {saving && (
            <span className="lw-muted" style={{ marginRight: 4 }}>
              保存中…
            </span>
          )}
          {draft && !project.archived && (
            <div className="lw-menu-wrap" data-review-status-menu>
              <button
                type="button"
                className={`lw-status-trigger ${statusMenuOpen ? 'open' : ''}`}
                onClick={() => setStatusMenuOpen((v) => !v)}
              >
                <span className={`lw-status-dot ${draft.status === 'final' ? 'done' : 'todo'}`} />
                <span>{draft.status === 'final' ? '已审核' : '待审核'}</span>
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
                      className={`lw-menu-item ${draft.status === val ? 'active' : ''}`}
                      onClick={() => handleSelectStatus(val)}
                    >
                      <span className={`lw-status-dot ${dotCls}`} />
                      <span style={{ flex: 1 }}>{label}</span>
                      {draft.status === val && <IconCheck size={12} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
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

      {/* Native Things 3 Structured Review Sections (Zero raw Markdown syntax / OS emojis) */}
      {loading || !draft || rawContent === null ? (
        <div className="lw-muted">读取中…</div>
      ) : (
        <div className="lw-stack" style={{ gap: 24 }}>
          {/* 1. 本周 */}
          <section className="lw-stack" style={{ gap: 4 }}>
            <div className="lw-between" style={{ paddingBottom: 4 }}>
              <span className="lw-section-title" style={{ fontSize: 13.5 }}>
                本周
              </span>
              {draft.totalHoursLine && <span className="lw-muted">{draft.totalHoursLine}</span>}
            </div>
            <div className="lw-list">
              {draft.thisWeekItems.map((item, idx) => (
                <div key={`tw-${idx}`} className="lw-item-row" style={{ alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`lw-check ${item.done ? 'checked' : ''}`}
                    style={{ marginTop: 0 }}
                    disabled={project.archived}
                    title={item.done ? '已完成（点击切为未完成）' : '未完成（点击切为已完成）'}
                    onClick={() => {
                      const nextItems = draft.thisWeekItems.map((it, i) =>
                        i === idx ? { ...it, done: !it.done } : it,
                      )
                      commitDraft({ ...draft, thisWeekItems: nextItems }, true)
                    }}
                  >
                    {item.done && <IconCheck />}
                  </button>
                  <input
                    className="lw-inline-input"
                    style={{ flex: 1, padding: 0, fontSize: 14 }}
                    disabled={project.archived}
                    value={item.text}
                    onChange={(e) => {
                      const nextItems = draft.thisWeekItems.map((it, i) =>
                        i === idx ? { ...it, text: e.target.value } : it,
                      )
                      commitDraft({ ...draft, thisWeekItems: nextItems })
                    }}
                    onBlur={() => void flushSave()}
                  />
                  {!project.archived && (
                    <div className="lw-hover-actions">
                      <button
                        type="button"
                        className="lw-icon-btn"
                        style={{ height: 22, minWidth: 22, padding: 0 }}
                        title="移除"
                        onClick={() => {
                          const nextItems = draft.thisWeekItems.filter((_, i) => i !== idx)
                          commitDraft({ ...draft, thisWeekItems: nextItems }, true)
                        }}
                      >
                        <IconX size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {!project.archived && (
                <form
                  className="lw-item-row"
                  style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}
                  onSubmit={(e) => {
                    e.preventDefault()
                    const text = newWeekItem.trim()
                    if (!text) return
                    setNewWeekItem('')
                    commitDraft(
                      {
                        ...draft,
                        thisWeekItems: [...draft.thisWeekItems, { done: true, text }],
                      },
                      true,
                    )
                  }}
                >
                  <span className="lw-bullet-slot">
                    <IconPlus size={14} />
                  </span>
                  <input
                    className="lw-inline-input"
                    style={{ flex: 1, padding: 0, fontSize: 13.5 }}
                    value={newWeekItem}
                    onChange={(e) => setNewWeekItem(e.target.value)}
                    placeholder="添加本周事项"
                  />
                </form>
              )}
            </div>
          </section>

          {/* 2. 原因 */}
          <section className="lw-stack" style={{ gap: 4 }}>
            <span className="lw-section-title" style={{ fontSize: 13.5, paddingBottom: 4 }}>
              原因
            </span>
            <div className="lw-list">
              {draft.reasons.map((text, idx) => (
                <div key={`rs-${idx}`} className="lw-item-row" style={{ alignItems: 'center' }}>
                  <span className="lw-bullet-slot">
                    <span className="lw-bullet-dot" />
                  </span>
                  <input
                    className="lw-inline-input"
                    style={{ flex: 1, padding: 0, fontSize: 14 }}
                    disabled={project.archived}
                    value={text}
                    onChange={(e) => {
                      const next = draft.reasons.map((s, i) => (i === idx ? e.target.value : s))
                      commitDraft({ ...draft, reasons: next })
                    }}
                    onBlur={() => void flushSave()}
                  />
                  {!project.archived && (
                    <div className="lw-hover-actions">
                      <button
                        type="button"
                        className="lw-icon-btn"
                        style={{ height: 22, minWidth: 22, padding: 0 }}
                        title="移除"
                        onClick={() => {
                          const next = draft.reasons.filter((_, i) => i !== idx)
                          commitDraft({ ...draft, reasons: next }, true)
                        }}
                      >
                        <IconX size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {!project.archived && (
                <form
                  className="lw-item-row"
                  style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}
                  onSubmit={(e) => {
                    e.preventDefault()
                    const text = newReason.trim()
                    if (!text) return
                    setNewReason('')
                    commitDraft({ ...draft, reasons: [...draft.reasons, text] }, true)
                  }}
                >
                  <span className="lw-bullet-slot">
                    <IconPlus size={14} />
                  </span>
                  <input
                    className="lw-inline-input"
                    style={{ flex: 1, padding: 0, fontSize: 13.5 }}
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    placeholder="添加原因"
                  />
                </form>
              )}
            </div>
          </section>

          {/* 3. 经验 */}
          <section className="lw-stack" style={{ gap: 4 }}>
            <span className="lw-section-title" style={{ fontSize: 13.5, paddingBottom: 4 }}>
              经验
            </span>
            <div className="lw-list">
              {draft.lessons.map((text, idx) => (
                <div key={`ls-${idx}`} className="lw-item-row" style={{ alignItems: 'center' }}>
                  <span className="lw-bullet-slot">
                    <span className="lw-bullet-dot reflection" />
                  </span>
                  <input
                    className="lw-inline-input"
                    style={{ flex: 1, padding: 0, fontSize: 14 }}
                    disabled={project.archived}
                    value={text}
                    onChange={(e) => {
                      const next = draft.lessons.map((s, i) => (i === idx ? e.target.value : s))
                      commitDraft({ ...draft, lessons: next })
                    }}
                    onBlur={() => void flushSave()}
                  />
                  {!project.archived && (
                    <div className="lw-hover-actions">
                      <button
                        type="button"
                        className="lw-icon-btn"
                        style={{ height: 22, minWidth: 22, padding: 0 }}
                        title="移除"
                        onClick={() => {
                          const next = draft.lessons.filter((_, i) => i !== idx)
                          commitDraft({ ...draft, lessons: next }, true)
                        }}
                      >
                        <IconX size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {!project.archived && (
                <form
                  className="lw-item-row"
                  style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}
                  onSubmit={(e) => {
                    e.preventDefault()
                    const text = newLesson.trim()
                    if (!text) return
                    setNewLesson('')
                    commitDraft({ ...draft, lessons: [...draft.lessons, text] }, true)
                  }}
                >
                  <span className="lw-bullet-slot">
                    <IconPlus size={14} />
                  </span>
                  <input
                    className="lw-inline-input"
                    style={{ flex: 1, padding: 0, fontSize: 13.5 }}
                    value={newLesson}
                    onChange={(e) => setNewLesson(e.target.value)}
                    placeholder="添加经验"
                  />
                </form>
              )}
            </div>
          </section>

          {/* 4. 下周 */}
          <section className="lw-stack" style={{ gap: 4 }}>
            <span className="lw-section-title" style={{ fontSize: 13.5, paddingBottom: 4 }}>
              下周
            </span>
            <div className="lw-list">
              {draft.nextWeekItems.map((text, idx) => (
                <div key={`nw-${idx}`} className="lw-item-row" style={{ alignItems: 'center' }}>
                  <span
                    className="lw-bullet-slot lw-mono"
                    style={{ fontSize: 12, color: 'var(--lw-muted)' }}
                  >
                    {idx + 1}.
                  </span>
                  <input
                    className="lw-inline-input"
                    style={{ flex: 1, padding: 0, fontSize: 14 }}
                    disabled={project.archived}
                    value={text}
                    onChange={(e) => {
                      const next = draft.nextWeekItems.map((s, i) =>
                        i === idx ? e.target.value : s,
                      )
                      commitDraft({ ...draft, nextWeekItems: next })
                    }}
                    onBlur={() => void flushSave()}
                  />
                  {!project.archived && (
                    <div className="lw-hover-actions">
                      <button
                        type="button"
                        className="lw-icon-btn"
                        style={{ height: 22, minWidth: 22, padding: 0 }}
                        title="移除"
                        onClick={() => {
                          const next = draft.nextWeekItems.filter((_, i) => i !== idx)
                          commitDraft({ ...draft, nextWeekItems: next }, true)
                        }}
                      >
                        <IconX size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {!project.archived && (
                <form
                  className="lw-item-row"
                  style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}
                  onSubmit={(e) => {
                    e.preventDefault()
                    const text = newNextItem.trim()
                    if (!text) return
                    setNewNextItem('')
                    commitDraft(
                      { ...draft, nextWeekItems: [...draft.nextWeekItems, text] },
                      true,
                    )
                  }}
                >
                  <span className="lw-bullet-slot">
                    <IconPlus size={14} />
                  </span>
                  <input
                    className="lw-inline-input"
                    style={{ flex: 1, padding: 0, fontSize: 13.5 }}
                    value={newNextItem}
                    onChange={(e) => setNewNextItem(e.target.value)}
                    placeholder="添加下周重点"
                  />
                </form>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
