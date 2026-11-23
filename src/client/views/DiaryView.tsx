import React, { useMemo, useState } from 'react'
import type { BoardSnapshot } from '../../shared/types.ts'
import type { RunActionFn } from '../App.tsx'
import { api, rawFileUrl } from '../api.ts'
import { IconFile, IconSearch } from '../components/Icons.tsx'
import { MarkdownView } from '../components/MarkdownView.tsx'

interface DiaryViewProps {
  snapshot: BoardSnapshot
  defaultDate: string
  onOpenFile: (relPath: string) => void
  onRunAction: RunActionFn
}

export function DiaryView({
  snapshot,
  defaultDate,
  onOpenFile,
  onRunAction,
}: DiaryViewProps) {
  const [writeDate, setWriteDate] = useState(defaultDate)
  const [draft, setDraft] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('ALL')
  const [query, setQuery] = useState('')
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const months = useMemo(() => {
    const set = new Set<string>()
    for (const d of snapshot.diaries) {
      if (d.month) set.add(d.month)
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [snapshot.diaries])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return snapshot.diaries.filter((d) => {
      if (selectedMonth !== 'ALL' && d.month !== selectedMonth) return false
      if (!q) return true
      return d.date.includes(q) || d.content.toLowerCase().includes(q)
    })
  }, [snapshot.diaries, selectedMonth, query])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return
    setDraft('')
    await onRunAction(() => api.appendDiary(trimmed, writeDate))
  }

  return (
    <div className="lw-canvas">
      {/* Minimal Writing Area */}
      <form
        className="lw-surface-box lw-stack"
        style={{ gap: 10 }}
        onSubmit={(e) => void handleSubmit(e)}
      >
        <textarea
          className="lw-inline-input"
          style={{ minHeight: 68, resize: 'vertical', lineHeight: 1.7 }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              void handleSubmit()
            }
          }}
          placeholder="写点什么…"
        />
        <div className="lw-between">
          <input
            type="date"
            className="lw-input"
            style={{ width: 138, padding: '3px 8px', fontSize: 12.5, borderColor: 'transparent', background: 'var(--lw-subtle)' }}
            value={writeDate}
            onChange={(e) => {
              if (e.target.value) setWriteDate(e.target.value)
            }}
          />
          <button
            type="submit"
            className="lw-btn lw-btn-sm lw-btn-primary"
            disabled={!draft.trim()}
          >
            记录
          </button>
        </div>
      </form>

      {/* Clean Month Filter + Quiet Search */}
      <div className="lw-between" style={{ alignItems: 'flex-end' }}>
        <div className="lw-subtabs" style={{ flex: 1, overflowX: 'auto' }}>
          <button
            type="button"
            className={`lw-subtab ${selectedMonth === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedMonth('ALL')}
          >
            全部
            <span className="lw-muted">{snapshot.diaries.length}</span>
          </button>
          {months.slice(0, 6).map((m) => (
            <button
              key={m}
              type="button"
              className={`lw-subtab ${selectedMonth === m ? 'active' : ''}`}
              onClick={() => setSelectedMonth(m)}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="lw-capture" style={{ width: 190, padding: '4px 10px' }}>
          <IconSearch size={13} />
          <input
            className="lw-inline-input"
            style={{ fontSize: 13, padding: '1px 0' }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索"
          />
        </div>
      </div>

      {/* Editorial Timeline */}
      {filtered.length === 0 ? (
        <div className="lw-empty">
          {snapshot.diaries.length === 0 ? '还没有日记' : '没有匹配的日记'}
        </div>
      ) : (
        <div className="lw-stack" style={{ gap: 28 }}>
          {filtered.map((entry) => (
            <article
              key={entry.relPath}
              className="lw-diary-entry lw-stack"
              style={{ gap: 8, paddingBottom: 24, borderBottom: '1px solid var(--lw-border)' }}
            >
              <div className="lw-between">
                <div className="lw-row" style={{ gap: 10 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 650, margin: 0, letterSpacing: '-0.015em' }}>
                    {entry.date}
                  </h2>
                  {entry.images.length > 0 && (
                    <span className="lw-muted">{entry.images.length} 图</span>
                  )}
                </div>
                <div className="lw-hover-actions">
                  <button
                    type="button"
                    className="lw-icon-btn"
                    title="编辑原文"
                    onClick={() => onOpenFile(entry.relPath)}
                  >
                    <IconFile size={14} />
                  </button>
                </div>
              </div>

              <MarkdownView
                content={entry.content}
                baseRelPath={entry.relPath}
                hideFrontmatter
                onOpenImage={(src) => setLightboxSrc(src)}
              />

              {entry.images.length > 0 && (
                <div className="lw-photo-grid">
                  {entry.images.map((imgPath) => {
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
            </article>
          ))}
        </div>
      )}

      {lightboxSrc && (
        <div className="lw-backdrop lw-backdrop-center" onClick={() => setLightboxSrc(null)}>
          <img
            src={lightboxSrc}
            alt="预览"
            style={{
              maxWidth: '92vw',
              maxHeight: '88vh',
              borderRadius: 10,
              boxShadow: 'var(--lw-shadow-lg)',
            }}
          />
        </div>
      )}
    </div>
  )
}
