import React, { useMemo, useState } from 'react'
import type { BoardSnapshot } from '../../shared/types.ts'
import { api } from '../api.ts'

interface KnowledgeViewProps {
  snapshot: BoardSnapshot
  onOpenFile: (relPath: string) => void
  onRunAction: (action: () => Promise<unknown>, toastText?: string) => Promise<void>
}

export function KnowledgeView({
  snapshot,
  onOpenFile,
  onRunAction,
}: KnowledgeViewProps) {
  const [subTab, setSubTab] = useState<'wiki' | 'raw'>('wiki')
  const [query, setQuery] = useState('')
  const [rawCategory, setRawCategory] = useState('ALL')

  // New wiki page modal
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
    const sources = wikiSources
      .split(/[\n,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
    await onRunAction(async () => {
      await api.createWikiPage(wikiTitle.trim(), wikiBody.trim(), sources)
      setWikiTitle('')
      setWikiSources('')
      setWikiBody('')
      setShowNewWiki(false)
      setSubTab('wiki')
    }, '已创建知识页，并同步更新 wiki/index.md 与 log.md')
  }

  return (
    <div className="lw-container">
      {/* Top toolbar */}
      <div className="lw-between">
        <div className="lw-tabs">
          <button
            type="button"
            className={`lw-tab ${subTab === 'wiki' ? 'active' : ''}`}
            onClick={() => setSubTab('wiki')}
          >
            Wiki 知识页 <span className="lw-muted">{wikiPages.length}</span>
          </button>
          <button
            type="button"
            className={`lw-tab ${subTab === 'raw' ? 'active' : ''}`}
            onClick={() => setSubTab('raw')}
          >
            Raw 原件库 <span className="lw-muted">{rawEntries.length}</span>
          </button>
        </div>

        <div className="lw-row">
          <input
            className="lw-input"
            style={{ width: 220 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={subTab === 'wiki' ? '搜索知识页标题或内容…' : '搜索原件名、来源网址…'}
          />
          {subTab === 'wiki' && (
            <>
              <button
                type="button"
                className="lw-btn lw-btn-sm lw-btn-ghost"
                onClick={() => onOpenFile('wiki/index.md')}
              >
                目录 index
              </button>
              <button
                type="button"
                className="lw-btn lw-btn-primary"
                onClick={() => setShowNewWiki(true)}
              >
                + 新建知识页
              </button>
            </>
          )}
        </div>
      </div>

      {/* Wiki Sub-tab */}
      {subTab === 'wiki' ? (
        filteredWiki.length === 0 ? (
          <div className="lw-empty">
            {wikiPages.length === 0
              ? 'wiki/ 里还没有知识页，点击右上角「+ 新建知识页」沉淀第一篇长期知识。'
              : '没有找到匹配的知识页。'}
          </div>
        ) : (
          <div className="lw-grid-2">
            {filteredWiki.map((page) => (
              <div
                key={page.relPath}
                className="lw-card lw-stack"
                style={{ cursor: 'pointer' }}
                onClick={() => onOpenFile(page.relPath)}
              >
                <div className="lw-between">
                  <h3 className="lw-card-title">{page.title}</h3>
                  {page.updated && <span className="lw-muted">{page.updated}</span>}
                </div>
                {page.excerpt && (
                  <div style={{ fontSize: 13, color: 'var(--lw-text-2)' }}>{page.excerpt}</div>
                )}
                {page.sources.length > 0 && (
                  <div className="lw-row" style={{ marginTop: 'auto', paddingTop: 4 }}>
                    {page.sources.slice(0, 3).map((src) => (
                      <span key={src} className="lw-badge lw-mono">
                        {src}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        /* Raw Sub-tab */
        <div className="lw-stack" style={{ gap: 12 }}>
          {rawCategories.length > 0 && (
            <div className="lw-row">
              <button
                type="button"
                className={`lw-btn lw-btn-sm ${rawCategory === 'ALL' ? 'lw-btn-primary' : ''}`}
                onClick={() => setRawCategory('ALL')}
              >
                全部分类
              </button>
              {rawCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`lw-btn lw-btn-sm ${rawCategory === cat ? 'lw-btn-primary' : ''}`}
                  onClick={() => setRawCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {filteredRaw.length === 0 ? (
            <div className="lw-empty">
              {rawEntries.length === 0
                ? 'raw/ 目录里还没有收藏的外部原件（文章、书摘或 GitHub 仓库）。直接把 Markdown 文件或仓库放到 raw/ 下即可自动显示。'
                : '当前筛选下没有原件。'}
            </div>
          ) : (
            <div className="lw-stack" style={{ gap: 10 }}>
              {filteredRaw.map((entry) => (
                <div key={entry.relPath} className="lw-card lw-between">
                  <div className="lw-stack" style={{ gap: 4, minWidth: 0 }}>
                    <div className="lw-row">
                      <strong style={{ fontSize: 14.5 }}>{entry.name}</strong>
                      <span className="lw-badge">
                        {entry.kind === 'repo'
                          ? 'GitHub 仓库'
                          : entry.kind === 'folder'
                            ? '文件夹'
                            : '原件文件'}
                      </span>
                      {entry.tier && (
                        <span className="lw-badge lw-badge-accent">{entry.tier}</span>
                      )}
                      {entry.category && <span className="lw-badge">{entry.category}</span>}
                      {entry.fetched && <span className="lw-muted">收录 {entry.fetched}</span>}
                    </div>
                    <div className="lw-row" style={{ fontSize: 12.5 }}>
                      <span className="lw-muted lw-mono">{entry.relPath}</span>
                      {entry.sourceUrl && (
                        <a
                          href={entry.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--lw-accent-text)' }}
                        >
                          原始链接 ↗
                        </a>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm"
                    onClick={() => onOpenFile(entry.openRelPath)}
                  >
                    阅读
                  </button>
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
              <strong>新建 Wiki 知识页</strong>
              <button
                type="button"
                className="lw-btn lw-btn-ghost lw-btn-sm"
                onClick={() => setShowNewWiki(false)}
              >
                关闭
              </button>
            </div>
            <div className="lw-panel-body lw-stack">
              <div>
                <label className="lw-muted">页面标题（将保存为 wiki/标题.md）</label>
                <input
                  className="lw-input"
                  value={wikiTitle}
                  onChange={(e) => setWikiTitle(e.target.value)}
                  placeholder="例如：深度模块设计原则"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="lw-muted">依据原件路径（可选，多条用逗号或换行分隔）</label>
                <input
                  className="lw-input lw-mono"
                  value={wikiSources}
                  onChange={(e) => setWikiSources(e.target.value)}
                  placeholder="例如：raw/articles/某篇文章.md"
                />
              </div>
              <div>
                <label className="lw-muted">正文（支持 Markdown）</label>
                <textarea
                  className="lw-textarea"
                  style={{ minHeight: 160 }}
                  value={wikiBody}
                  onChange={(e) => setWikiBody(e.target.value)}
                  placeholder="用自己的话总结核心结论、边界与用法…"
                />
              </div>
            </div>
            <div className="lw-panel-footer">
              <button type="button" className="lw-btn" onClick={() => setShowNewWiki(false)}>
                取消
              </button>
              <button type="submit" className="lw-btn lw-btn-primary">
                保存并写入索引
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
