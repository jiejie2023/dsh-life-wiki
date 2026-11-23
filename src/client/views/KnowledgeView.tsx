import React, { useMemo, useState } from 'react'
import type { BoardSnapshot } from '../../shared/types.ts'
import type { RunActionFn } from '../App.tsx'
import { api } from '../api.ts'
import { IconExternal, IconPlus, IconSearch, IconX } from '../components/Icons.tsx'

interface KnowledgeViewProps {
  snapshot: BoardSnapshot
  onOpenFile: (relPath: string, opts?: { edit?: boolean }) => void
  onRunAction: RunActionFn
}

export function KnowledgeView({
  snapshot,
  onOpenFile,
  onRunAction,
}: KnowledgeViewProps) {
  const [subTab, setSubTab] = useState<'wiki' | 'raw'>('wiki')
  const [query, setQuery] = useState('')
  const [rawCategory, setRawCategory] = useState('ALL')

  const [showNewWiki, setShowNewWiki] = useState(false)
  const [wikiTitle, setWikiTitle] = useState('')
  const [wikiSources, setWikiSources] = useState('')
  const [wikiBody, setWikiBody] = useState('')

  const { wikiPages, rawEntries } = snapshot.knowledge

  const rawCategories = useMemo(() => {
    const set = new Set<string>()
    for (const r of rawEntries) {
      if (r.category) set.add(r.category)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  }, [rawEntries])

  const filteredWiki = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return wikiPages
    return wikiPages.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.sources.some((s) => s.toLowerCase().includes(q)),
    )
  }, [wikiPages, query])

  const filteredRaw = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rawEntries.filter((r) => {
      if (rawCategory !== 'ALL' && r.category !== rawCategory) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.sourceUrl.toLowerCase().includes(q)
      )
    })
  }, [rawEntries, rawCategory, query])

  const handleCreateWiki = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wikiTitle.trim()) return
    const title = wikiTitle.trim()
    const body = wikiBody.trim()
    const sources = wikiSources
      .split(/[\n,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
    setWikiTitle('')
    setWikiSources('')
    setWikiBody('')
    setShowNewWiki(false)
    await onRunAction(() => api.createWikiPage(title, body, sources))
  }

  return (
    <div className="lw-canvas">
      {/* Continuous Hairline Tabs + Quiet Search + Action */}
      <div className="lw-tabs-bar">
        <div className="lw-subtabs">
          <button
            type="button"
            className={`lw-subtab ${subTab === 'wiki' ? 'active' : ''}`}
            onClick={() => setSubTab('wiki')}
          >
            Wiki
          </button>
          <button
            type="button"
            className={`lw-subtab ${subTab === 'raw' ? 'active' : ''}`}
            onClick={() => setSubTab('raw')}
          >
            原件库
          </button>
        </div>

        <div className="lw-tabs-bar-right">
          <div className="lw-diary-search">
            <IconSearch size={13} />
            <input
              className="lw-inline-input"
              style={{ fontSize: 13, padding: 0 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
          {subTab === 'wiki' && (
            <button
              type="button"
              className="lw-btn lw-btn-sm lw-btn-primary"
              onClick={() => setShowNewWiki(true)}
            >
              <IconPlus size={13} />
              新建
            </button>
          )}
        </div>
      </div>

      {subTab === 'wiki' ? (
        filteredWiki.length === 0 ? (
          <div className="lw-empty">暂无知识页</div>
        ) : (
          <div className="lw-list">
            {filteredWiki.map((page) => (
              <div
                key={page.relPath}
                className="lw-project-row"
                onClick={() => onOpenFile(page.relPath)}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{page.title}</div>
                  {page.excerpt && (
                    <div
                      className="lw-meta"
                      style={{
                        marginTop: 3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {page.excerpt.replace(/[*`#_]/g, '')}
                    </div>
                  )}
                </div>
                {page.updated && <span className="lw-muted">{page.updated}</span>}
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="lw-stack" style={{ gap: 14 }}>
          {rawCategories.length > 1 && (
            <div className="lw-row" style={{ gap: 6, marginTop: -8, marginLeft: -8 }}>
              <button
                type="button"
                className={`lw-mode-tab ${rawCategory === 'ALL' ? 'active' : ''}`}
                onClick={() => setRawCategory('ALL')}
              >
                全部
              </button>
              {rawCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`lw-mode-tab ${rawCategory === cat ? 'active' : ''}`}
                  onClick={() => setRawCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {filteredRaw.length === 0 ? (
            <div className="lw-empty">暂无原件</div>
          ) : (
            <div className="lw-list">
              {filteredRaw.map((entry) => (
                <div
                  key={entry.relPath}
                  className="lw-project-row"
                  style={{ padding: '12px 12px' }}
                  onClick={() => onOpenFile(entry.openRelPath)}
                >
                  <div className="lw-row" style={{ gap: 8, minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        fontWeight: 500,
                        fontSize: 14,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entry.name}
                    </span>
                    {entry.tier && <span className="lw-tag lw-tag-accent">{entry.tier}</span>}
                    {entry.category && <span className="lw-muted">{entry.category}</span>}
                  </div>

                  <div className="lw-row" style={{ gap: 10, flexShrink: 0 }}>
                    {entry.fetched && <span className="lw-muted">{entry.fetched}</span>}
                    {entry.sourceUrl && (
                      <a
                        href={entry.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="lw-icon-btn lw-hover-actions"
                        style={{ height: 26, minWidth: 26 }}
                        title="原始链接"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <IconExternal size={13} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Wiki Page Modal */}
      {showNewWiki && (
        <div className="lw-backdrop lw-backdrop-center" onClick={() => setShowNewWiki(false)}>
          <form
            className="lw-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void handleCreateWiki(e)}
          >
            <div className="lw-panel-header">
              <strong>新建知识页</strong>
              <button type="button" className="lw-icon-btn" onClick={() => setShowNewWiki(false)}>
                <IconX />
              </button>
            </div>
            <div className="lw-panel-body lw-stack" style={{ gap: 12 }}>
              <div>
                <label className="lw-field-label">标题</label>
                <input
                  className="lw-input"
                  value={wikiTitle}
                  onChange={(e) => setWikiTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="lw-field-label">依据原件（可选）</label>
                <input
                  className="lw-input lw-mono"
                  value={wikiSources}
                  onChange={(e) => setWikiSources(e.target.value)}
                  placeholder="raw/..."
                />
              </div>
              <div>
                <label className="lw-field-label">正文</label>
                <textarea
                  className="lw-textarea"
                  style={{ minHeight: 150 }}
                  value={wikiBody}
                  onChange={(e) => setWikiBody(e.target.value)}
                />
              </div>
            </div>
            <div className="lw-panel-footer">
              <button
                type="button"
                className="lw-btn lw-btn-ghost"
                onClick={() => setShowNewWiki(false)}
              >
                取消
              </button>
              <button type="submit" className="lw-btn lw-btn-primary">
                保存
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
