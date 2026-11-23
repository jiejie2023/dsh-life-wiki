import React, { useEffect, useRef, useState } from 'react'
import type { IdeaSummary } from '../../shared/types.ts'
import type { RunActionFn } from '../App.tsx'
import { api } from '../api.ts'
import {
  applyIdeaSections,
  parseIdeaSections,
  type IdeaEvaluation,
  type IdeaVerdict,
} from '../ideaMarkdown.ts'
import { IconChevronLeft, IconFile } from './Icons.tsx'

interface IdeaDetailViewProps {
  idea: IdeaSummary
  todayIso: string
  onBack: () => void
  onPromote: (idea: IdeaSummary) => void
  onCancel: (idea: IdeaSummary) => void
  onOpenFile: (relPath: string) => void
  onRunAction: RunActionFn
}

function AutoTextarea({
  value,
  onChange,
  onBlur,
  placeholder,
}: {
  value: string
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
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
    />
  )
}

export function IdeaDetailView({
  idea,
  todayIso,
  onBack,
  onPromote,
  onCancel,
  onOpenFile,
  onRunAction,
}: IdeaDetailViewProps) {
  const [rawContent, setRawContent] = useState<string | null>(null)
  const [draft, setDraft] = useState<IdeaEvaluation | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const dirtyRef = useRef(false)
  const latestRawRef = useRef<string | null>(null)
  const latestDraftRef = useRef<IdeaEvaluation | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    dirtyRef.current = false
    api
      .readFile(idea.relPath)
      .then((res) => {
        if (!alive) return
        setRawContent(res.content)
        latestRawRef.current = res.content
        const parsed = parseIdeaSections(res.content)
        setDraft(parsed)
        latestDraftRef.current = parsed
      })
      .catch(() => {
        if (alive) {
          setRawContent('')
          latestRawRef.current = ''
          const empty = parseIdeaSections('')
          setDraft(empty)
          latestDraftRef.current = empty
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [idea.relPath])

  const updateDraft = (patch: Partial<IdeaEvaluation>) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      latestDraftRef.current = next
      dirtyRef.current = true
      return next
    })
  }

  const flushSave = async (overrideDraft?: IdeaEvaluation) => {
    const base = latestRawRef.current
    const current = overrideDraft ?? latestDraftRef.current
    if (base === null || !current) return
    if (!overrideDraft && !dirtyRef.current) return
    const nextContent = applyIdeaSections(base, current, todayIso)
    if (nextContent === base) {
      dirtyRef.current = false
      return
    }
    dirtyRef.current = false
    setSaving(true)
    try {
      await onRunAction(async () => {
        await api.writeFile(idea.relPath, nextContent)
        latestRawRef.current = nextContent
        setRawContent(nextContent)
      })
    } finally {
      setSaving(false)
    }
  }

  const handleVerdictClick = (verdict: IdeaVerdict) => {
    if (!draft) return
    const next: IdeaEvaluation = {
      ...draft,
      verdict,
      judgmentDate: todayIso,
    }
    setDraft(next)
    latestDraftRef.current = next
    dirtyRef.current = true
    void flushSave(next)
  }

  const handleBack = async () => {
    await flushSave()
    onBack()
  }

  const handlePromoteClick = async () => {
    await flushSave()
    onPromote(idea)
  }

  const handleCancelClick = async () => {
    await flushSave()
    onCancel(idea)
  }

  const handleOpenRaw = async () => {
    await flushSave()
    onOpenFile(idea.relPath)
  }

  // Esc goes back cleanly (flushing edits)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      // Let parent modals handle Esc first if one is open; otherwise return
      if (document.querySelector('.lw-backdrop')) return
      e.preventDefault()
      void handleBack()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <div className="lw-canvas">
      {/* Top Back & Decision Actions */}
      <div className="lw-between">
        <button
          type="button"
          className="lw-btn lw-btn-sm lw-btn-ghost"
          style={{ marginLeft: -6, paddingLeft: 4, gap: 4 }}
          onClick={() => void handleBack()}
        >
          <IconChevronLeft size={15} />
          项目
        </button>

        <div className="lw-row" style={{ gap: 6 }}>
          {saving && <span className="lw-muted" style={{ marginRight: 4 }}>保存中…</span>}
          <button
            type="button"
            className="lw-btn lw-btn-sm lw-btn-ghost"
            onClick={() => void handleCancelClick()}
          >
            放弃
          </button>
          <button
            type="button"
            className="lw-btn lw-btn-sm lw-btn-primary"
            onClick={() => void handlePromoteClick()}
          >
            立项
          </button>
          <button
            type="button"
            className="lw-icon-btn"
            title="打开 Markdown 原文"
            onClick={() => void handleOpenRaw()}
          >
            <IconFile size={15} />
          </button>
        </div>
      </div>

      {/* Idea Title */}
      <div className="lw-row" style={{ gap: 11 }}>
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: '1.6px dashed var(--lw-muted)',
            flexShrink: 0,
          }}
        />
        <h1 className="lw-h1">{idea.name}</h1>
      </div>

      {loading || !draft || rawContent === null ? (
        <div className="lw-muted">读取中…</div>
      ) : (
        <div className="lw-stack" style={{ gap: 26 }}>
          {/* 1. 想法 */}
          <section className="lw-idea-section">
            <div className="lw-section-head">
              <h2 className="lw-section-title">想法</h2>
            </div>
            <AutoTextarea
              value={draft.idea}
              onChange={(v) => updateDraft({ idea: v })}
              onBlur={() => void flushSave()}
              placeholder="一句话：我想做什么…"
            />
          </section>

          {/* 2. 动机 (4 guiding questions) */}
          <section className="lw-idea-section">
            <div className="lw-section-head">
              <h2 className="lw-section-title">动机</h2>
            </div>
            <div className="lw-stack" style={{ gap: 14 }}>
              <div>
                <div className="lw-idea-q">为什么想做</div>
                <AutoTextarea
                  value={draft.why}
                  onChange={(v) => updateDraft({ why: v })}
                  onBlur={() => void flushSave()}
                  placeholder="是什么触动了你，想解决什么问题…"
                />
              </div>
              <div>
                <div className="lw-idea-q">不做会怎样</div>
                <AutoTextarea
                  value={draft.ifNot}
                  onChange={(v) => updateDraft({ ifNot: v })}
                  onBlur={() => void flushSave()}
                  placeholder="放着不做会有真实损失，还是其实无所谓…"
                />
              </div>
              <div>
                <div className="lw-idea-q">要付出什么</div>
                <AutoTextarea
                  value={draft.cost}
                  onChange={(v) => updateDraft({ cost: v })}
                  onBlur={() => void flushSave()}
                  placeholder="大概需要多少时间、精力或成本…"
                />
              </div>
              <div>
                <div className="lw-idea-q">做完能带来什么真实变化</div>
                <AutoTextarea
                  value={draft.realChange}
                  onChange={(v) => updateDraft({ realChange: v })}
                  onBlur={() => void flushSave()}
                  placeholder="做完后生活或工作里会多出什么可检验的变化…"
                />
              </div>
            </div>
          </section>

          {/* 3. 认知 */}
          <section className="lw-idea-section">
            <div className="lw-section-head">
              <h2 className="lw-section-title">认知</h2>
            </div>
            <AutoTextarea
              value={draft.cognition}
              onChange={(v) => updateDraft({ cognition: v })}
              onBlur={() => void flushSave()}
              placeholder="这件事是什么、难在哪、大概要花多久…"
            />
          </section>

          {/* 4. 判断 */}
          <section className="lw-idea-section">
            <div className="lw-section-head">
              <h2 className="lw-section-title">判断</h2>
              <div className="lw-row" style={{ gap: 4 }}>
                {(
                  [
                    ['做', 'active-go'],
                    ['再想想', 'active-think'],
                    ['不做', 'active-no'],
                  ] as Array<[IdeaVerdict, string]>
                ).map(([v, activeCls]) => (
                  <button
                    key={v}
                    type="button"
                    className={`lw-verdict-btn ${draft.verdict === v ? activeCls : ''}`}
                    onClick={() => handleVerdictClick(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <AutoTextarea
              value={draft.judgmentReason}
              onChange={(v) => updateDraft({ judgmentReason: v })}
              onBlur={() => void flushSave()}
              placeholder="写下你的判断理由…"
            />
          </section>
        </div>
      )}
    </div>
  )
}
