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
import { InlineText } from './MarkdownView.tsx'

export type ReviewSectionTab = 'progress' | 'reflection' | 'nextWeek'

export const REVIEW_TABS: ReadonlyArray<readonly [ReviewSectionTab, string]> = [
  ['progress', '进展'],
  ['reflection', '反思'],
  ['nextWeek', '下周'],
]

export function ReviewModeTabs({
  mode,
  onChange,
}: {
  mode: ReviewSectionTab
  onChange: (next: ReviewSectionTab) => void
}) {
  return (
    <div className="lw-mode-tabs" role="tablist">
      {REVIEW_TABS.map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={mode === key}
          className={`lw-mode-tab ${mode === key ? 'active' : ''}`}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function EditableReviewLine({
  value,
  disabled,
  baseRelPath,
  className,
  onOpenFile,
  onChange,
  onCommit,
}: {
  value: string
  disabled?: boolean
  baseRelPath?: string
  className?: string
  onOpenFile?: (relPath: string) => void
  onChange: (next: string) => void
  onCommit: () => void
}) {
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!editing || !ref.current) return
    ref.current.style.height = 'auto'
    ref.current.style.height = `${ref.current.scrollHeight}px`
  }, [editing, value])

  if (!editing || disabled) {
    return (
      <div
        className={`${className ?? 'lw-review-text'} ${disabled ? 'readonly' : ''}`}
        onClick={() => {
          if (!disabled) setEditing(true)
        }}
      >
        <InlineText text={value} baseRelPath={baseRelPath} onOpenFile={onOpenFile} />
      </div>
    )
  }

  return (
    <textarea
      ref={ref}
      className="lw-review-edit-box"
      rows={1}
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Escape') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      onBlur={() => {
        setEditing(false)
        onCommit()
      }}
    />
  )
}

export function ReviewSectionBody({
  mode,
  draft,
  relPath,
  readOnly = false,
  onOpenFile,
  onCommitDraft,
  onFlushSave,
}: {
  mode: ReviewSectionTab
  draft: ReviewDraft
  relPath: string
  readOnly?: boolean
  onOpenFile: (relPath: string, opts?: { edit?: boolean }) => void
  onCommitDraft: (next: ReviewDraft, immediate?: boolean) => void
  onFlushSave: () => void
}) {
  const [inputVal, setInputVal] = useState('')

  useEffect(() => {
    setInputVal('')
  }, [mode, relPath])

  if (mode === 'progress') {
    return (
      <div className="lw-list">
        {draft.thisWeekItems.map((item, idx) => {
          const isSubhead = item.done === null && /^\*\*[^*]+\*\*$/.test(item.text.trim())
          const isEmptyPlaceholder =
            item.done === null && /^[（(].*暂无.*[）)]$/.test(item.text.trim())

          return (
            <div
              key={`tw-${idx}`}
              className="lw-item-row"
              style={{ alignItems: 'flex-start', paddingTop: 5, paddingBottom: 5 }}
            >
              {item.done !== null ? (
                <button
                  type="button"
                  className={`lw-check ${item.done ? 'checked' : ''}`}
                  style={{ marginTop: 4 }}
                  disabled={readOnly}
                  title={item.done ? '已完成（点击切为未完成）' : '未完成（点击切为已完成）'}
                  onClick={() => {
                    const nextItems = draft.thisWeekItems.map((it, i) =>
                      i === idx ? { ...it, done: !it.done } : it,
                    )
                    onCommitDraft({ ...draft, thisWeekItems: nextItems }, true)
                  }}
                >
                  {item.done && <IconCheck />}
                </button>
              ) : !isSubhead && !isEmptyPlaceholder ? (
                <span className="lw-bullet-slot" style={{ marginTop: 3 }}>
                  <span className="lw-bullet-dot" />
                </span>
              ) : null}

              <EditableReviewLine
                value={item.text}
                disabled={readOnly}
                baseRelPath={relPath}
                className={
                  isSubhead
                    ? 'lw-review-text lw-review-subhead'
                    : isEmptyPlaceholder
                      ? 'lw-review-text lw-muted'
                      : 'lw-review-text'
                }
                onOpenFile={(p) => onOpenFile(p)}
                onChange={(val) => {
                  const nextItems = draft.thisWeekItems.map((it, i) =>
                    i === idx ? { ...it, text: val } : it,
                  )
                  onCommitDraft({ ...draft, thisWeekItems: nextItems })
                }}
                onCommit={onFlushSave}
              />

              {!readOnly && (
                <div className="lw-hover-actions" style={{ marginTop: 1 }}>
                  <button
                    type="button"
                    className="lw-icon-btn"
                    style={{ height: 22, minWidth: 22, padding: 0 }}
                    title="移除"
                    onClick={() => {
                      const nextItems = draft.thisWeekItems.filter((_, i) => i !== idx)
                      onCommitDraft({ ...draft, thisWeekItems: nextItems }, true)
                    }}
                  >
                    <IconX size={12} />
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {!readOnly && (
          <form
            className="lw-item-row"
            style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}
            onSubmit={(e) => {
              e.preventDefault()
              const text = inputVal.trim()
              if (!text) return
              setInputVal('')
              const cleaned = draft.thisWeekItems.filter(
                (it) => !(it.done === null && /^[（(].*暂无.*[）)]$/.test(it.text.trim())),
              )
              onCommitDraft({ ...draft, thisWeekItems: [...cleaned, { done: true, text }] }, true)
            }}
          >
            <span className="lw-bullet-slot">
              <IconPlus size={14} />
            </span>
            <input
              className="lw-inline-input"
              style={{ flex: 1, padding: 0, fontSize: 13.5 }}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="添加本周进展"
            />
          </form>
        )}
      </div>
    )
  }

  if (mode === 'reflection') {
    return (
      <div className="lw-list">
        {draft.reflections.map((text, idx) => {
          const isSubhead = /^\*\*[^*]+\*\*$/.test(text.trim())
          return (
            <div
              key={`rf-${idx}`}
              className="lw-item-row"
              style={{ alignItems: 'flex-start', paddingTop: 5, paddingBottom: 5 }}
            >
              {!isSubhead && (
                <span className="lw-bullet-slot" style={{ marginTop: 3 }}>
                  <span className="lw-bullet-dot reflection" />
                </span>
              )}
              <EditableReviewLine
                value={text}
                disabled={readOnly}
                baseRelPath={relPath}
                className={isSubhead ? 'lw-review-text lw-review-subhead' : 'lw-review-text'}
                onOpenFile={(p) => onOpenFile(p)}
                onChange={(val) => {
                  const next = draft.reflections.map((s, i) => (i === idx ? val : s))
                  onCommitDraft({ ...draft, reflections: next })
                }}
                onCommit={onFlushSave}
              />
              {!readOnly && (
                <div className="lw-hover-actions" style={{ marginTop: 1 }}>
                  <button
                    type="button"
                    className="lw-icon-btn"
                    style={{ height: 22, minWidth: 22, padding: 0 }}
                    title="移除"
                    onClick={() => {
                      const next = draft.reflections.filter((_, i) => i !== idx)
                      onCommitDraft({ ...draft, reflections: next }, true)
                    }}
                  >
                    <IconX size={12} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {!readOnly && (
          <form
            className="lw-item-row"
            style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}
            onSubmit={(e) => {
              e.preventDefault()
              const text = inputVal.trim()
              if (!text) return
              setInputVal('')
              onCommitDraft({ ...draft, reflections: [...draft.reflections, text] }, true)
            }}
          >
            <span className="lw-bullet-slot">
              <IconPlus size={14} />
            </span>
            <input
              className="lw-inline-input"
              style={{ flex: 1, padding: 0, fontSize: 13.5 }}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="添加问题或反思"
            />
          </form>
        )}
      </div>
    )
  }

  return (
    <div className="lw-list">
      {draft.nextWeekItems.map((text, idx) => (
        <div
          key={`nw-${idx}`}
          className="lw-item-row"
          style={{ alignItems: 'flex-start', paddingTop: 5, paddingBottom: 5 }}
        >
          <span
            className="lw-bullet-slot lw-mono"
            style={{ fontSize: 12, color: 'var(--lw-muted)', marginTop: 3 }}
          >
            {idx + 1}.
          </span>
          <EditableReviewLine
            value={text}
            disabled={readOnly}
            baseRelPath={relPath}
            onOpenFile={(p) => onOpenFile(p)}
            onChange={(val) => {
              const next = draft.nextWeekItems.map((s, i) => (i === idx ? val : s))
              onCommitDraft({ ...draft, nextWeekItems: next })
            }}
            onCommit={onFlushSave}
          />
          {!readOnly && (
            <div className="lw-hover-actions" style={{ marginTop: 1 }}>
              <button
                type="button"
                className="lw-icon-btn"
                style={{ height: 22, minWidth: 22, padding: 0 }}
                title="移除"
                onClick={() => {
                  const next = draft.nextWeekItems.filter((_, i) => i !== idx)
                  onCommitDraft({ ...draft, nextWeekItems: next }, true)
                }}
              >
                <IconX size={12} />
              </button>
            </div>
          )}
        </div>
      ))}
      {!readOnly && (
        <form
          className="lw-item-row"
          style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}
          onSubmit={(e) => {
            e.preventDefault()
            const text = inputVal.trim()
            if (!text) return
            setInputVal('')
            onCommitDraft({ ...draft, nextWeekItems: [...draft.nextWeekItems, text] }, true)
          }}
        >
          <span className="lw-bullet-slot">
            <IconPlus size={14} />
          </span>
          <input
            className="lw-inline-input"
            style={{ flex: 1, padding: 0, fontSize: 13.5 }}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="添加下周重点"
          />
        </form>
      )}
    </div>
  )
}

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
  const [mode, setMode] = useState<ReviewSectionTab>('progress')
  const [menuOpen, setMenuOpen] = useState(false)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [rawContent, setRawContent] = useState<string | null>(null)
  const [draft, setDraft] = useState<ReviewDraft | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

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
      return
    }
    let alive = true
    setLoading(true)
    setMode('progress')
    dirtyRef.current = false
    api
      .readFile(selectedSummary.relPath)
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
        setRawContent(null)
        setDraft(null)
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

  const persistNow = async (nextDraft: ReviewDraft) => {
    if (!selectedSummary || latestRawRef.current === null) return
    const nextMd = applyReviewSections(latestRawRef.current, nextDraft)
    dirtyRef.current = false
    if (nextMd === latestRawRef.current) return
    latestRawRef.current = nextMd
    setRawContent(nextMd)
    setSaving(true)
    try {
      await onRunAction(async () => {
        await api.writeFile(selectedSummary.relPath, nextMd)
      })
    } finally {
      setSaving(false)
    }
  }

  const commitDraft = (next: ReviewDraft, immediate = false) => {
    setDraft(next)
    latestDraftRef.current = next
    dirtyRef.current = true
    if (immediate) {
      void persistNow(next)
    }
  }

  const flushSave = async () => {
    if (!dirtyRef.current || !latestDraftRef.current) return
    await persistNow(latestDraftRef.current)
  }

  const handleSwitchWeek = async (nextWeek: string) => {
    await flushSave()
    setSelectedWeek(nextWeek)
    setMenuOpen(false)
  }

  const handleGenerateCurrentWeek = async () => {
    await flushSave()
    await onRunAction(
      async () => {
        await api.generateWeeklyReview(project.name, currentWeek)
      },
      { toast: `已生成 ${currentWeek} 周复盘` },
    )
    setSelectedWeek(currentWeek)
  }

  if (project.reviewFiles.length === 0 || !selectedSummary) {
    return (
      <div className="lw-empty">
        暂无周复盘
        {!project.archived && (
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              className="lw-btn lw-btn-sm lw-btn-primary"
              onClick={() => void handleGenerateCurrentWeek()}
            >
              生成本周复盘 ({currentWeek})
            </button>
          </div>
        )}
      </div>
    )
  }

  const curIdx = weeksAsc.indexOf(selectedSummary.week)
  const prevWeek = curIdx > 0 ? weeksAsc[curIdx - 1]! : null
  const nextWeekVal = curIdx >= 0 && curIdx < weeksAsc.length - 1 ? weeksAsc[curIdx + 1]! : null
  const hasCurrentWeek = project.reviewFiles.some((r) => r.week === currentWeek)

  return (
    <div className="lw-stack" style={{ gap: 6 }}>
      {/* Single-Row Header: < • 2026-W48 ▾ > | [进展] 反思 下周  • 待审核 ▾  📄 */}
      <div className="lw-section-head">
        <div className="lw-row" style={{ gap: 2 }} data-review-week-menu>
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
          <ReviewModeTabs mode={mode} onChange={setMode} />

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
                      onClick={() => {
                        setStatusMenuOpen(false)
                        if (draft.status !== val) {
                          commitDraft({ ...draft, status: val }, true)
                        }
                      }}
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
          {draft && project.archived && (
            <span className="lw-status-trigger" style={{ cursor: 'default' }}>
              <span className={`lw-status-dot ${draft.status === 'final' ? 'done' : 'todo'}`} />
              <span>{draft.status === 'final' ? '已审核' : '待审核'}</span>
            </span>
          )}
          <button
            type="button"
            className="lw-icon-btn"
            style={{ height: 26, minWidth: 26 }}
            title="打开复盘原文"
            onClick={() => onOpenFile(selectedSummary.relPath)}
          >
            <IconFile size={14} />
          </button>
        </div>
      </div>

      {loading || !draft || rawContent === null ? (
        <div className="lw-muted" style={{ padding: '12px 0' }}>
          读取中…
        </div>
      ) : (
        <ReviewSectionBody
          mode={mode}
          draft={draft}
          relPath={selectedSummary.relPath}
          readOnly={project.archived}
          onOpenFile={onOpenFile}
          onCommitDraft={commitDraft}
          onFlushSave={() => void flushSave()}
        />
      )}
    </div>
  )
}
