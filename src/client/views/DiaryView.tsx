import React, { useMemo, useState } from 'react'
import type { BoardSnapshot } from '../../shared/types.ts'
import { api, rawFileUrl } from '../api.ts'
import { MarkdownView } from '../components/MarkdownView.tsx'

interface DiaryViewProps {
  snapshot: BoardSnapshot
  defaultDate: string
  onOpenFile: (relPath: string) => void
  onRunAction: (action: () => Promise<unknown>, toastText?: string) => Promise<void>
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
    await onRunAction(async () => {
      await api.appendDiary(trimmed, writeDate)
      setDraft('')
    }, `已追加到 ${writeDate} 日记`)
  }

  return (
    <div className="lw-container">
      {/* Quick Write Card */}
      <form className="lw-card lw-stack" onSubmit={(e) => void handleSubmit(e)}>
        <div className="lw-between">
          <div className="lw-row">
            <h3 className="lw-card-title">写一笔日记</h3>
            <input
              type="date"
              className="lw-input"
              style={{ width: 150, padding: '4px 8px' }}
              value={writeDate}
              onChange={(e) => {
                if (e.target.value) setWriteDate(e.target.value)
              }}
            />
          </div>
          <span className="lw-muted">存放在 raw/me/diary/ · 支持 Ctrl+Enter 提交</span>
        </div>
        <textarea
          className="lw-textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              void handleSubmit()
            }
          }}
          placeholder="记录此刻的想法、发生的事或今天的状态…"
        />
        <div className="lw-between">
          <span className="lw-muted">
            每次追加会自动附上当前时间，不会覆盖当天已写内容。
          </span>
          <button
            type="submit"
            className="lw-btn lw-btn-primary"
            disabled={!draft.trim()}
          >
            追加到日记
          </button>
        </div>
      </form>

      {/* Filters */}
      <div className="lw-between">
        <div className="lw-tabs">
          <button
            type="button"
            className={`lw-tab ${selectedMonth === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedMonth('ALL')}
          >
            全部 ({snapshot.diaries.length})
          </button>
          {months.slice(0, 8).map((m) => (
            <button
              key={m}
              type="button"
              className={`lw-tab ${selectedMonth === m ? 'active' : ''}`}
              onClick={() => setSelectedMonth(m)}
            >
              {m}
            </button>
          ))}
        </div>

        <input
          className="lw-input"
          style={{ width: 220 }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索日记内容或日期…"
        />
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="lw-empty">
          {snapshot.diaries.length === 0
            ? '还没有任何日记，在上方写下第一段吧。'
            : '当前筛选条件下没有匹配的日记。'}
        </div>
      ) : (
        <div className="lw-stack" style={{ gap: 14 }}>
          {filtered.map((entry) => (
            <div key={entry.relPath} className="lw-card">
              <div className="lw-card-header">
                <div className="lw-row">
                  <h3 className="lw-card-title">{entry.date}</h3>
                  {entry.entryCount > 0 && (
                    <span className="lw-badge">{entry.entryCount} 条记录</span>
                  )}
                  {entry.images.length > 0 && (
                    <span className="lw-badge lw-badge-info">
                      含 {entry.images.length} 张配图
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="lw-btn lw-btn-sm lw-btn-ghost"
                  onClick={() => onOpenFile(entry.relPath)}
                >
                  编辑原文
                </button>
              </div>

              <MarkdownView
                content={entry.content}
                baseRelPath={entry.relPath}
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
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="lw-backdrop lw-backdrop-center"
          onClick={() => setLightboxSrc(null)}
        >
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
