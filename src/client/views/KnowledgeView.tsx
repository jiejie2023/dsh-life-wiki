import React, { useEffect, useMemo, useRef, useState } from 'react'
import type {
  BoardSnapshot,
  RawEntryFile,
  RawEntrySummary,
  WikiPageSummary,
} from '../../shared/types.ts'
import type { RunActionFn } from '../App.tsx'
import { api, rawFileUrl } from '../api.ts'
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconExternal,
  IconFile,
  IconFolder,
  IconPlus,
  IconSearch,
  IconX,
} from '../components/Icons.tsx'
import { MarkdownView } from '../components/MarkdownView.tsx'

interface KnowledgeViewProps {
  snapshot: BoardSnapshot
  resetSignal?: number
  onOpenFile: (relPath: string, opts?: { edit?: boolean }) => void
  onRunAction: RunActionFn
}

type DetailState =
  | { kind: 'wiki'; relPath: string }
  | { kind: 'raw-file'; entry: RawEntrySummary; fileRelPath: string; parentFolder?: RawEntrySummary }
  | { kind: 'raw-repo'; entry: RawEntrySummary; activeFileRelPath: string }
  | { kind: 'raw-folder'; entry: RawEntrySummary; showSource: boolean }

const PAGE_STEP = 40

const STANDARD_BUCKET_ORDER: Record<string, number> = {
  web: 0,
  GitHub: 1,
  x: 2,
  me: 90,
  files: 99,
}

function compareBuckets(a: string, b: string): number {
  const ra = STANDARD_BUCKET_ORDER[a] ?? 50
  const rb = STANDARD_BUCKET_ORDER[b] ?? 50
  if (ra !== rb) return ra - rb
  return a.localeCompare(b, 'zh-CN')
}

function formatMonthHeading(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(isoDate)
  if (!m) return '未标日期'
  return `${m[1]}年${Number(m[2])}月`
}

function formatShortDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!m) return isoDate
  return `${m[2]}-${m[3]}`
}

function friendlyFileTabLabel(file: RawEntryFile): string {
  const lower = file.name.toLowerCase()
  if (!file.group) {
    if (/^readme[._-](zh|cn)/i.test(lower)) return 'README (中文)'
    if (lower === 'readme.md') return 'README'
    if (/^readme[._-]en/i.test(lower)) return 'README (EN)'
    if (lower === 'source.md') return 'SOURCE'
  }
  return file.name.replace(/\.md$/i, '')
}

function friendlyNestedFileTitle(file: RawEntryFile): string {
  const base = file.name.split('/').pop() ?? file.name
  return base.replace(/\.md$/i, '')
}

function groupByMonth(items: RawEntrySummary[]): Array<{ month: string; entries: RawEntrySummary[] }> {
  const groups: Array<{ month: string; entries: RawEntrySummary[] }> = []
  const map = new Map<string, RawEntrySummary[]>()
  for (const item of items) {
    const label = formatMonthHeading(item.fetched)
    let list = map.get(label)
    if (!list) {
      list = []
      map.set(label, list)
      groups.push({ month: label, entries: list })
    }
    list.push(item)
  }
  return groups
}

export function KnowledgeView({
  snapshot,
  resetSignal = 0,
  onOpenFile,
  onRunAction,
}: KnowledgeViewProps) {
  const [subTab, setSubTab] = useState<'raw' | 'wiki'>('raw')
  const [rawBucket, setRawBucket] = useState<string>('')
  const [tierFilter, setTierFilter] = useState<'ALL' | 'L3' | 'L2' | 'L1'>('ALL')
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)
  const [citedOnly, setCitedOnly] = useState(false)
  const [visibleLimit, setVisibleLimit] = useState(PAGE_STEP)
  const [query, setQuery] = useState('')

  // Full-page reader / folder detail state
  const [detail, setDetail] = useState<DetailState | null>(null)
  const [docState, setDocState] = useState<{ path: string; content: string } | null>(null)
  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)
  const [editingWiki, setEditingWiki] = useState(false)
  const [wikiEditDraft, setWikiEditDraft] = useState('')
  const [savingWiki, setSavingWiki] = useState(false)
  const [wikiSourcesOpen, setWikiSourcesOpen] = useState(false)
  const [folderQuery, setFolderQuery] = useState('')

  // New Wiki Modal
  const [showNewWiki, setShowNewWiki] = useState(false)
  const [wikiTitle, setWikiTitle] = useState('')
  const [wikiSources, setWikiSources] = useState('')
  const [wikiBody, setWikiBody] = useState('')

  const lastResetRef = useRef(resetSignal)
  useEffect(() => {
    if (resetSignal !== lastResetRef.current) {
      lastResetRef.current = resetSignal
      setDetail(null)
      setEditingWiki(false)
    }
  }, [resetSignal])

  const { wikiPages, rawEntries } = snapshot.knowledge

  // Dynamic buckets directly reflecting local raw/ folder structure
  const rawBuckets = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rawEntries) {
      counts.set(r.category, (counts.get(r.category) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort(([a], [b]) => compareBuckets(a, b))
      .map(([name, count]) => ({ name, count }))
  }, [rawEntries])

  const activeBucket = useMemo(() => {
    if (rawBucket && rawBuckets.some((b) => b.name === rawBucket)) return rawBucket
    return rawBuckets[0]?.name ?? ''
  }, [rawBucket, rawBuckets])

  const selectBucket = (next: string) => {
    setRawBucket(next)
    setTierFilter('ALL')
    setSourceFilter(null)
    setCitedOnly(false)
    setVisibleLimit(PAGE_STEP)
  }

  // Keep detail's RawEntrySummary fresh if snapshot reloads
  const activeDetail: DetailState | null = useMemo(() => {
    if (!detail) return null
    if (detail.kind === 'wiki') return detail
    const freshEntry = rawEntries.find((r) => r.relPath === detail.entry.relPath) ?? detail.entry
    if (detail.kind === 'raw-file') {
      const freshParent = detail.parentFolder
        ? (rawEntries.find((r) => r.relPath === detail.parentFolder!.relPath) ?? detail.parentFolder)
        : undefined
      return { ...detail, entry: freshEntry, parentFolder: freshParent }
    }
    return { ...detail, entry: freshEntry }
  }, [detail, rawEntries])

  // Target markdown file path to fetch for the active detail view
  const activeDocRelPath = useMemo(() => {
    if (!activeDetail) return null
    if (activeDetail.kind === 'wiki') return activeDetail.relPath
    if (activeDetail.kind === 'raw-file') return activeDetail.fileRelPath
    if (activeDetail.kind === 'raw-repo') return activeDetail.activeFileRelPath
    if (activeDetail.kind === 'raw-folder' && activeDetail.showSource) {
      const src = activeDetail.entry.files.find(
        (f) => !f.group && f.name.toLowerCase() === 'source.md',
      )
      return src?.relPath ?? null
    }
    return null
  }, [activeDetail])

  // Load markdown document content when activeDocRelPath changes
  useEffect(() => {
    if (!activeDocRelPath) {
      setDocState(null)
      setDocError(null)
      setDocLoading(false)
      setEditingWiki(false)
      return
    }
    let alive = true
    setDocLoading(true)
    setDocError(null)
    setEditingWiki(false)
    setWikiSourcesOpen(false)
    api
      .readFile(activeDocRelPath)
      .then((res) => {
        if (!alive) return
        setDocState({ path: activeDocRelPath, content: res.content })
        setWikiEditDraft(res.content)
      })
      .catch((err) => {
        if (!alive) return
        setDocState(null)
        setDocError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (alive) setDocLoading(false)
      })
    return () => {
      alive = false
    }
  }, [activeDocRelPath, snapshot])

  const handleSaveWikiInline = async () => {
    if (!activeDetail || activeDetail.kind !== 'wiki' || savingWiki) return
    setSavingWiki(true)
    try {
      await onRunAction(
        async () => {
          await api.writeFile(activeDetail.relPath, wikiEditDraft)
          setDocState({ path: activeDetail.relPath, content: wikiEditDraft })
          setEditingWiki(false)
        },
        { toast: '已保存知识页' },
      )
    } finally {
      setSavingWiki(false)
    }
  }

  // Esc & Cmd/Ctrl+S keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && editingWiki) {
        e.preventDefault()
        void handleSaveWikiInline()
        return
      }
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (showNewWiki) {
        e.preventDefault()
        setShowNewWiki(false)
        return
      }
      if (document.querySelector('.lw-backdrop')) return
      if (editingWiki) {
        e.preventDefault()
        setEditingWiki(false)
        if (docState) setWikiEditDraft(docState.content)
      } else if (activeDetail?.kind === 'raw-file' && activeDetail.parentFolder) {
        e.preventDefault()
        setDetail({ kind: 'raw-folder', entry: activeDetail.parentFolder, showSource: false })
      } else if (activeDetail?.kind === 'raw-folder' && activeDetail.showSource) {
        e.preventDefault()
        setDetail({ ...activeDetail, showSource: false })
      } else if (activeDetail) {
        e.preventDefault()
        setDetail(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showNewWiki, editingWiki, docState, activeDetail, wikiEditDraft, savingWiki])

  // Open an entry inside full-page detail view
  const openRawEntry = (entry: RawEntrySummary, specificFileRelPath?: string) => {
    setFolderQuery('')
    if (entry.kind === 'repo') {
      const target =
        specificFileRelPath && entry.files.some((f) => f.relPath === specificFileRelPath)
          ? specificFileRelPath
          : entry.openRelPath
      setDetail({ kind: 'raw-repo', entry, activeFileRelPath: target })
    } else if (entry.kind === 'folder') {
      if (specificFileRelPath) {
        setDetail({
          kind: 'raw-file',
          entry,
          fileRelPath: specificFileRelPath,
          parentFolder: entry,
        })
      } else {
        setDetail({ kind: 'raw-folder', entry, showSource: false })
      }
    } else {
      setDetail({ kind: 'raw-file', entry, fileRelPath: specificFileRelPath ?? entry.openRelPath })
    }
  }

  const openWikiByRelPath = (relPath: string) => {
    setDetail({ kind: 'wiki', relPath })
  }

  // Smart internal Markdown link router: stay inside Knowledge full-page reader for wiki/raw links
  const handleInternalLinkOpen = (relPath: string) => {
    const norm = relPath.replace(/\\/g, '/').replace(/^\/+/, '')
    if (norm.startsWith('wiki/') && norm !== 'wiki/index.md' && norm !== 'wiki/log.md') {
      openWikiByRelPath(norm)
      return
    }
    if (norm.startsWith('raw/')) {
      const matched = rawEntries.find(
        (r) =>
          r.relPath === norm ||
          r.openRelPath === norm ||
          norm.startsWith(`${r.relPath}/`) ||
          r.files.some((f) => f.relPath === norm),
      )
      if (matched) {
        if (norm === matched.relPath && matched.kind === 'folder') {
          openRawEntry(matched)
        } else {
          openRawEntry(matched, norm.endsWith('.md') || norm.endsWith('.txt') ? norm : undefined)
        }
        return
      }
    }
    onOpenFile(relPath)
  }

  // Bucket-level items & filters (when not in global search)
  const currentBucketAll = useMemo(
    () => rawEntries.filter((r) => r.category === activeBucket),
    [rawEntries, activeBucket],
  )

  const bucketHasCited = useMemo(
    () => currentBucketAll.some((r) => r.citedByWiki.length > 0),
    [currentBucketAll],
  )

  const filteredBucketItems = useMemo(() => {
    return currentBucketAll.filter((r) => {
      if (activeBucket === 'GitHub' && tierFilter !== 'ALL' && r.tier !== tierFilter) return false
      if (sourceFilter && r.sourceGroup !== sourceFilter) return false
      if (citedOnly && r.citedByWiki.length === 0) return false
      return true
    })
  }, [currentBucketAll, activeBucket, tierFilter, sourceFilter, citedOnly])

  const visibleBucketItems = useMemo(
    () => filteredBucketItems.slice(0, visibleLimit),
    [filteredBucketItems, visibleLimit],
  )

  const remainingBucketCount = Math.max(0, filteredBucketItems.length - visibleBucketItems.length)

  // Cross-layer global search results across Wiki + ALL Raw entries + nested folder/repo files
  const trimmedQuery = query.trim().toLowerCase()
  const searchResults = useMemo(() => {
    if (!trimmedQuery) return null
    const wikiHits: WikiPageSummary[] = wikiPages.filter(
      (p) =>
        p.title.toLowerCase().includes(trimmedQuery) ||
        p.excerpt.toLowerCase().includes(trimmedQuery) ||
        p.relPath.toLowerCase().includes(trimmedQuery) ||
        p.sources.some((s) => s.toLowerCase().includes(trimmedQuery)),
    )

    const rawByBucket = new Map<
      string,
      Array<{ entry: RawEntrySummary; matchedFile?: RawEntryFile }>
    >()
    const addHit = (bucket: string, hit: { entry: RawEntrySummary; matchedFile?: RawEntryFile }) => {
      let arr = rawByBucket.get(bucket)
      if (!arr) {
        arr = []
        rawByBucket.set(bucket, arr)
      }
      arr.push(hit)
    }

    for (const entry of rawEntries) {
      const topMatch =
        entry.name.toLowerCase().includes(trimmedQuery) ||
        entry.category.toLowerCase().includes(trimmedQuery) ||
        entry.sourceGroup.toLowerCase().includes(trimmedQuery) ||
        entry.excerpt.toLowerCase().includes(trimmedQuery) ||
        entry.sourceUrl.toLowerCase().includes(trimmedQuery) ||
        entry.relPath.toLowerCase().includes(trimmedQuery)

      if (topMatch) {
        addHit(entry.category, { entry })
      }

      // Also surface matching nested files inside folders/repos (e.g. notion/goals/*, docs/HTTP-API.md)
      if (entry.kind === 'folder' || entry.kind === 'repo') {
        for (const f of entry.files) {
          if (f.name.toLowerCase() === 'source.md') continue
          if (f.relPath === entry.openRelPath && topMatch) continue
          if (
            f.name.toLowerCase().includes(trimmedQuery) ||
            f.group.toLowerCase().includes(trimmedQuery)
          ) {
            addHit(entry.category, { entry, matchedFile: f })
          }
        }
      }
    }

    const bucketGroups = Array.from(rawByBucket.entries())
      .sort(([a], [b]) => compareBuckets(a, b))
      .map(([bucket, hits]) => ({ bucket, hits }))

    const totalHits = wikiHits.length + bucketGroups.reduce((s, g) => s + g.hits.length, 0)
    return { wikiHits, bucketGroups, totalHits }
  }, [trimmedQuery, wikiPages, rawEntries])

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
    await onRunAction(async () => {
      const res = await api.createWikiPage(title, body, sources)
      setSubTab('wiki')
      setDetail({ kind: 'wiki', relPath: res.relPath })
    })
  }

  // ==================== FULL-PAGE DETAIL VIEWS ====================
  if (activeDetail) {
    // 1. Wiki Page Full-Page Reader / Editor
    if (activeDetail.kind === 'wiki') {
      const pageMeta = wikiPages.find((p) => p.relPath === activeDetail.relPath)
      const heading =
        pageMeta?.title ?? activeDetail.relPath.replace(/^wiki\//, '').replace(/\.md$/i, '')

      return (
        <div className="lw-canvas">
          <div className="lw-between">
            <button
              type="button"
              className="lw-btn lw-btn-sm lw-btn-ghost"
              style={{ marginLeft: -6, paddingLeft: 4, gap: 4 }}
              onClick={() => setDetail(null)}
            >
              <IconChevronLeft size={15} />
              Wiki
            </button>

            <div className="lw-row" style={{ gap: 6 }}>
              {editingWiki ? (
                <>
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm lw-btn-ghost"
                    onClick={() => {
                      setEditingWiki(false)
                      if (docState) setWikiEditDraft(docState.content)
                    }}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm lw-btn-primary"
                    disabled={savingWiki}
                    onClick={() => void handleSaveWikiInline()}
                  >
                    {savingWiki ? '保存中…' : '保存'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="lw-btn lw-btn-sm lw-btn-ghost"
                  onClick={() => {
                    if (docState) setWikiEditDraft(docState.content)
                    setEditingWiki(true)
                  }}
                >
                  编辑
                </button>
              )}
            </div>
          </div>

          <div className="lw-stack" style={{ gap: 10 }}>
            <h1 className="lw-h1">{heading}</h1>
            {(pageMeta?.updated || (pageMeta && pageMeta.sources.length > 0)) && (
              <div className="lw-stack" style={{ gap: 8 }}>
                <div className="lw-meta-strip">
                  {pageMeta?.updated && <span className="lw-tag">更新 {pageMeta.updated}</span>}
                  {pageMeta && pageMeta.sources.length > 0 && pageMeta.sources.length <= 3 ? (
                    pageMeta.sources.map((src) => (
                      <button
                        key={src}
                        type="button"
                        className="lw-chip-btn lw-mono"
                        style={{ fontSize: 11.5 }}
                        title={`打开来源 ${src}`}
                        onClick={() => handleInternalLinkOpen(src)}
                      >
                        {src}
                      </button>
                    ))
                  ) : pageMeta && pageMeta.sources.length > 3 ? (
                    <button
                      type="button"
                      className="lw-chip-btn"
                      onClick={() => setWikiSourcesOpen((v) => !v)}
                    >
                      <span>依据原件 ({pageMeta.sources.length})</span>
                      <IconChevronDown size={12} />
                    </button>
                  ) : null}
                </div>

                {wikiSourcesOpen && pageMeta && pageMeta.sources.length > 3 && (
                  <div className="lw-meta-strip">
                    {pageMeta.sources.map((src) => (
                      <button
                        key={src}
                        type="button"
                        className="lw-chip-btn lw-mono"
                        style={{ fontSize: 11.5 }}
                        title={`打开来源 ${src}`}
                        onClick={() => handleInternalLinkOpen(src)}
                      >
                        {src}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {docLoading ? (
            <div className="lw-muted">读取中…</div>
          ) : docError ? (
            <div style={{ color: 'var(--lw-danger)', fontSize: 13.5 }}>{docError}</div>
          ) : editingWiki ? (
            <textarea
              className="lw-textarea lw-mono lw-kb-editor"
              value={wikiEditDraft}
              onChange={(e) => setWikiEditDraft(e.target.value)}
              autoFocus
            />
          ) : (
            <MarkdownView
              content={docState?.content ?? ''}
              baseRelPath={activeDetail.relPath}
              hideFrontmatter
              onOpenFile={handleInternalLinkOpen}
            />
          )}
        </div>
      )
    }

    // 2. Multi-file GitHub Repo Detail View (README / SOURCE / docs tabs)
    if (activeDetail.kind === 'raw-repo') {
      const { entry, activeFileRelPath } = activeDetail
      const activeFileObj =
        entry.files.find((f) => f.relPath === activeFileRelPath) ?? entry.files[0]

      return (
        <div className="lw-canvas">
          <div className="lw-between">
            <button
              type="button"
              className="lw-btn lw-btn-sm lw-btn-ghost"
              style={{ marginLeft: -6, paddingLeft: 4, gap: 4 }}
              onClick={() => setDetail(null)}
            >
              <IconChevronLeft size={15} />
              {entry.category}
            </button>

            <div className="lw-row" style={{ gap: 6 }}>
              {entry.sourceUrl && (
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="lw-btn lw-btn-sm lw-btn-ghost"
                  style={{ textDecoration: 'none' }}
                >
                  <IconExternal size={13} />
                  原始链接
                </a>
              )}
              {activeFileObj?.isMarkdown && (
                <button
                  type="button"
                  className="lw-icon-btn"
                  title="查看/编辑原文"
                  onClick={() => onOpenFile(activeFileObj.relPath, { edit: true })}
                >
                  <IconFile size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="lw-stack" style={{ gap: 10 }}>
            <h1 className="lw-h1">{entry.name}</h1>
            <div className="lw-meta-strip">
              {entry.tier && <span className="lw-tag lw-tag-accent">{entry.tier}</span>}
              {entry.fetched && <span className="lw-tag lw-mono">{entry.fetched}</span>}
              <span className="lw-tag">{entry.files.length} 份文档</span>
              {entry.citedByWiki.map((wTitle) => {
                const targetWiki = wikiPages.find((p) => p.title === wTitle)
                return (
                  <button
                    key={wTitle}
                    type="button"
                    className="lw-chip-btn"
                    title={`跳转至知识页「${wTitle}」`}
                    onClick={() => targetWiki && openWikiByRelPath(targetWiki.relPath)}
                  >
                    已入 Wiki · {wTitle}
                  </button>
                )
              })}
            </div>
          </div>

          {entry.files.length > 1 && (
            <div className="lw-tabs-bar lw-kb-filetabs">
              <div className="lw-subtabs" style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
                {entry.files.map((f) => (
                  <button
                    key={f.relPath}
                    type="button"
                    className={`lw-subtab ${f.relPath === activeFileObj?.relPath ? 'active' : ''}`}
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    title={f.name}
                    onClick={() =>
                      setDetail({ kind: 'raw-repo', entry, activeFileRelPath: f.relPath })
                    }
                  >
                    {friendlyFileTabLabel(f)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeFileObj && !activeFileObj.isMarkdown ? (
            <div className="lw-surface-box lw-between">
              <span className="lw-mono" style={{ fontSize: 13 }}>
                {activeFileObj.name}
              </span>
              <a
                href={rawFileUrl(activeFileObj.relPath)}
                target="_blank"
                rel="noreferrer"
                className="lw-btn lw-btn-sm lw-btn-primary"
                style={{ textDecoration: 'none' }}
              >
                打开文件
              </a>
            </div>
          ) : docLoading ? (
            <div className="lw-muted">读取中…</div>
          ) : docError ? (
            <div style={{ color: 'var(--lw-danger)', fontSize: 13.5 }}>{docError}</div>
          ) : (
            <MarkdownView
              content={docState?.content ?? ''}
              baseRelPath={activeFileObj?.relPath ?? entry.openRelPath}
              hideFrontmatter
              onOpenFile={handleInternalLinkOpen}
            />
          )}
        </div>
      )
    }

    // 3. Multi-file Folder Directory View (e.g., me/life-plan 18 files, me/notion 51 files)
    if (activeDetail.kind === 'raw-folder') {
      const { entry, showSource } = activeDetail
      const sourceFile = entry.files.find(
        (f) => !f.group && f.name.toLowerCase() === 'source.md',
      )
      const contentFiles = entry.files.filter(
        (f) => !(!f.group && f.name.toLowerCase() === 'source.md'),
      )
      const fq = folderQuery.trim().toLowerCase()
      const filteredFiles = fq
        ? contentFiles.filter(
            (f) => f.name.toLowerCase().includes(fq) || f.group.toLowerCase().includes(fq),
          )
        : contentFiles

      const grouped = new Map<string, RawEntryFile[]>()
      for (const f of filteredFiles) {
        const key = f.group || '根目录'
        let arr = grouped.get(key)
        if (!arr) {
          arr = []
          grouped.set(key, arr)
        }
        arr.push(f)
      }
      const groupList = Array.from(grouped.entries())

      return (
        <div className="lw-canvas">
          <div className="lw-between">
            <button
              type="button"
              className="lw-btn lw-btn-sm lw-btn-ghost"
              style={{ marginLeft: -6, paddingLeft: 4, gap: 4 }}
              onClick={() =>
                showSource
                  ? setDetail({ ...activeDetail, showSource: false })
                  : setDetail(null)
              }
            >
              <IconChevronLeft size={15} />
              {showSource ? entry.name : entry.category}
            </button>

            <div className="lw-row" style={{ gap: 6 }}>
              {sourceFile && (
                <button
                  type="button"
                  className={`lw-btn lw-btn-sm ${showSource ? 'lw-btn-primary' : 'lw-btn-ghost'}`}
                  onClick={() => setDetail({ ...activeDetail, showSource: !showSource })}
                >
                  SOURCE
                </button>
              )}
            </div>
          </div>

          <div className="lw-between" style={{ gap: 12 }}>
            <div className="lw-row" style={{ gap: 10 }}>
              <h1 className="lw-h1">{entry.name}</h1>
              <span className="lw-muted">{contentFiles.length} 篇</span>
            </div>

            {!showSource && contentFiles.length > 6 && (
              <div className="lw-diary-search">
                <IconSearch size={13} />
                <input
                  className="lw-inline-input"
                  style={{ fontSize: 13, padding: 0 }}
                  value={folderQuery}
                  onChange={(e) => setFolderQuery(e.target.value)}
                  placeholder="筛选目录内文件"
                />
                {folderQuery && (
                  <button
                    type="button"
                    className="lw-icon-btn"
                    style={{ height: 20, minWidth: 20, padding: 0 }}
                    onClick={() => setFolderQuery('')}
                  >
                    <IconX size={12} />
                  </button>
                )}
              </div>
            )}
          </div>

          {showSource ? (
            docLoading ? (
              <div className="lw-muted">读取中…</div>
            ) : docError ? (
              <div style={{ color: 'var(--lw-danger)', fontSize: 13.5 }}>{docError}</div>
            ) : (
              <MarkdownView
                content={docState?.content ?? ''}
                baseRelPath={sourceFile?.relPath}
                hideFrontmatter
                onOpenFile={handleInternalLinkOpen}
              />
            )
          ) : groupList.length === 0 ? (
            <div className="lw-empty">没有匹配的文件</div>
          ) : (
            <div className="lw-stack" style={{ gap: 20 }}>
              {groupList.map(([grpName, files]) => (
                <section key={grpName} className="lw-stack" style={{ gap: 4 }}>
                  {(groupList.length > 1 || grpName !== '根目录') && (
                    <div className="lw-diary-month-head">
                      {grpName} · {files.length}
                    </div>
                  )}
                  <div className="lw-list">
                    {files.map((f) => (
                      <div
                        key={f.relPath}
                        className="lw-project-row"
                        style={{ padding: '10px 12px' }}
                        onClick={() =>
                          f.isMarkdown
                            ? setDetail({
                                kind: 'raw-file',
                                entry,
                                fileRelPath: f.relPath,
                                parentFolder: entry,
                              })
                            : window.open(rawFileUrl(f.relPath), '_blank', 'noopener,noreferrer')
                        }
                      >
                        <div className="lw-row" style={{ gap: 8, minWidth: 0, flex: 1 }}>
                          <span style={{ color: 'var(--lw-muted)', display: 'inline-flex' }}>
                            <IconFile size={14} />
                          </span>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {friendlyNestedFileTitle(f)}
                          </span>
                        </div>
                        <span style={{ color: 'var(--lw-muted)', display: 'inline-flex' }}>
                          <IconChevronRight size={14} />
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )
    }

    // 4. Single Raw File Full-Page Reader (articles, X posts, oral notes, or note inside folder)
    const { entry, fileRelPath, parentFolder } = activeDetail
    const nestedFileObj = parentFolder?.files.find((f) => f.relPath === fileRelPath)
    const pageHeading = nestedFileObj ? friendlyNestedFileTitle(nestedFileObj) : entry.name
    const backLabel = parentFolder
      ? nestedFileObj?.group
        ? `${parentFolder.name} / ${nestedFileObj.group}`
        : parentFolder.name
      : entry.category
    const nonMdAttachments = entry.files.filter((f) => !f.isMarkdown)

    return (
      <div className="lw-canvas">
        <div className="lw-between">
          <button
            type="button"
            className="lw-btn lw-btn-sm lw-btn-ghost"
            style={{ marginLeft: -6, paddingLeft: 4, gap: 4 }}
            onClick={() =>
              parentFolder
                ? setDetail({ kind: 'raw-folder', entry: parentFolder, showSource: false })
                : setDetail(null)
            }
          >
            <IconChevronLeft size={15} />
            {backLabel}
          </button>

          <div className="lw-row" style={{ gap: 6 }}>
            {!parentFolder && entry.sourceUrl && (
              <a
                href={entry.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="lw-btn lw-btn-sm lw-btn-ghost"
                style={{ textDecoration: 'none' }}
              >
                <IconExternal size={13} />
                打开原网页
              </a>
            )}
            <button
              type="button"
              className="lw-icon-btn"
              title="打开原文文件"
              onClick={() => onOpenFile(fileRelPath, { edit: true })}
            >
              <IconFile size={14} />
            </button>
          </div>
        </div>

        <div className="lw-stack" style={{ gap: 10 }}>
          <h1 className="lw-h1">{pageHeading}</h1>
          <div className="lw-meta-strip">
            <span className="lw-tag">
              {entry.sourceGroup ? `${entry.category} · ${entry.sourceGroup}` : entry.category}
            </span>
            {!parentFolder && entry.fetched && (
              <span className="lw-tag lw-mono">{entry.fetched}</span>
            )}
            {!parentFolder &&
              entry.citedByWiki.map((wTitle) => {
                const targetWiki = wikiPages.find((p) => p.title === wTitle)
                return (
                  <button
                    key={wTitle}
                    type="button"
                    className="lw-chip-btn"
                    title={`跳转至知识页「${wTitle}」`}
                    onClick={() => targetWiki && openWikiByRelPath(targetWiki.relPath)}
                  >
                    已入 Wiki · {wTitle}
                  </button>
                )
              })}
            {!parentFolder &&
              nonMdAttachments.map((att) => (
                <a
                  key={att.relPath}
                  href={rawFileUrl(att.relPath)}
                  target="_blank"
                  rel="noreferrer"
                  className="lw-chip-btn"
                  style={{ textDecoration: 'none' }}
                >
                  <IconExternal size={12} />
                  {att.name}
                </a>
              ))}
          </div>
        </div>

        {docLoading ? (
          <div className="lw-muted">读取中…</div>
        ) : docError ? (
          <div style={{ color: 'var(--lw-danger)', fontSize: 13.5 }}>{docError}</div>
        ) : (
          <MarkdownView
            content={docState?.content ?? ''}
            baseRelPath={fileRelPath}
            hideFrontmatter
            onOpenFile={handleInternalLinkOpen}
          />
        )}
      </div>
    )
  }

  // ==================== LIST VIEW ====================
  const renderRawRow = (entry: RawEntrySummary, keySuffix = '') => {
    const isFolder = entry.kind === 'folder'
    const isRepo = entry.kind === 'repo'

    return (
      <div
        key={`${entry.relPath}${keySuffix}`}
        className="lw-project-row"
        style={{ padding: '12px 12px', alignItems: 'center' }}
        onClick={() => openRawEntry(entry)}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="lw-row" style={{ gap: 8, flexWrap: 'nowrap', minWidth: 0 }}>
            {isFolder && (
              <span style={{ color: 'var(--lw-accent)', display: 'inline-flex', flexShrink: 0 }}>
                <IconFolder size={15} />
              </span>
            )}
            <span
              style={{
                fontWeight: 550,
                fontSize: 14,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.name}
            </span>
            {isRepo && entry.tier && (
              <span className={`lw-tag ${entry.tier === 'L3' ? 'lw-tag-accent' : ''}`}>
                {entry.tier}
              </span>
            )}
            {isFolder && <span className="lw-muted">{entry.fileCount} 篇</span>}
            {!isRepo &&
              !isFolder &&
              entry.sourceGroup &&
              entry.sourceGroup.toLowerCase() !== entry.name.toLowerCase() && (
                <button
                  type="button"
                  className="lw-kb-source-pill"
                  title={`仅看 ${entry.sourceGroup}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (query) setQuery('')
                    if (subTab !== 'raw') setSubTab('raw')
                    setRawBucket(entry.category)
                    setSourceFilter(
                      sourceFilter === entry.sourceGroup ? null : entry.sourceGroup,
                    )
                    setVisibleLimit(PAGE_STEP)
                  }}
                >
                  {entry.sourceGroup}
                </button>
              )}
            {entry.citedByWiki.length > 0 && (
              <span
                className="lw-tag lw-tag-accent"
                title={`已被 Wiki 引用：${entry.citedByWiki.join('、')}`}
              >
                Wiki
              </span>
            )}
          </div>
          {entry.excerpt && (isRepo || isFolder || entry.category === 'me') && (
            <div
              className="lw-meta"
              style={{
                marginTop: 3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.excerpt}
            </div>
          )}
        </div>

        <div className="lw-row" style={{ gap: 8, flexShrink: 0, flexWrap: 'nowrap' }}>
          {entry.fetched && (
            <span className="lw-muted lw-mono" title={entry.fetched}>
              {formatShortDate(entry.fetched)}
            </span>
          )}
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
          {(isFolder || isRepo) && (
            <span style={{ color: 'var(--lw-muted)', display: 'inline-flex' }}>
              <IconChevronRight size={14} />
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="lw-canvas">
      {/* Top Hairline Tabs (Raw | Wiki) + Global Search + Wiki Actions */}
      <div className="lw-tabs-bar">
        <div className="lw-subtabs">
          <button
            type="button"
            className={`lw-subtab ${subTab === 'raw' && !trimmedQuery ? 'active' : ''}`}
            onClick={() => {
              setSubTab('raw')
              if (trimmedQuery) setQuery('')
            }}
          >
            Raw
            <span className="lw-muted" style={{ fontWeight: 400 }}>
              {rawEntries.length}
            </span>
          </button>
          <button
            type="button"
            className={`lw-subtab ${subTab === 'wiki' && !trimmedQuery ? 'active' : ''}`}
            onClick={() => {
              setSubTab('wiki')
              if (trimmedQuery) setQuery('')
            }}
          >
            Wiki
            <span className="lw-muted" style={{ fontWeight: 400 }}>
              {wikiPages.length}
            </span>
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
              placeholder="搜全库"
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
          {subTab === 'wiki' && !trimmedQuery && (
            <>
              <button
                type="button"
                className="lw-btn lw-btn-sm lw-btn-ghost"
                title="查看 wiki/index.md"
                onClick={() => onOpenFile('wiki/index.md')}
              >
                目录
              </button>
              <button
                type="button"
                className="lw-btn lw-btn-sm lw-btn-ghost"
                title="查看 wiki/log.md"
                onClick={() => onOpenFile('wiki/log.md')}
              >
                日志
              </button>
              <button
                type="button"
                className="lw-btn lw-btn-sm lw-btn-primary"
                onClick={() => setShowNewWiki(true)}
              >
                <IconPlus size={13} />
                新建
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cross-Layer Global Search Results */}
      {searchResults ? (
        searchResults.totalHits === 0 ? (
          <div className="lw-empty">未找到与「{query.trim()}」相关的知识页或原件</div>
        ) : (
          <div className="lw-stack" style={{ gap: 22 }}>
            {searchResults.wikiHits.length > 0 && (
              <section className="lw-stack" style={{ gap: 4 }}>
                <div className="lw-diary-month-head">
                  Wiki · {searchResults.wikiHits.length}
                </div>
                <div className="lw-list">
                  {searchResults.wikiHits.map((page) => (
                    <div
                      key={page.relPath}
                      className="lw-project-row"
                      onClick={() => openWikiByRelPath(page.relPath)}
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
                      {page.updated && <span className="lw-muted lw-mono">{page.updated}</span>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {searchResults.bucketGroups.map(({ bucket, hits }) => (
              <section key={bucket} className="lw-stack" style={{ gap: 4 }}>
                <div className="lw-diary-month-head">
                  {bucket} · {hits.length}
                </div>
                <div className="lw-list">
                  {hits.map(({ entry, matchedFile }) =>
                    matchedFile ? (
                      <div
                        key={matchedFile.relPath}
                        className="lw-project-row"
                        style={{ padding: '11px 12px' }}
                        onClick={() => openRawEntry(entry, matchedFile.relPath)}
                      >
                        <div className="lw-row" style={{ gap: 8, minWidth: 0, flex: 1 }}>
                          <span style={{ color: 'var(--lw-muted)', display: 'inline-flex' }}>
                            <IconFile size={14} />
                          </span>
                          <span
                            style={{
                              fontWeight: 550,
                              fontSize: 14,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {friendlyNestedFileTitle(matchedFile)}
                          </span>
                          <span className="lw-muted">
                            {entry.name}
                            {matchedFile.group ? ` / ${matchedFile.group}` : ''}
                          </span>
                        </div>
                        <span style={{ color: 'var(--lw-muted)', display: 'inline-flex' }}>
                          <IconChevronRight size={14} />
                        </span>
                      </div>
                    ) : (
                      renderRawRow(entry)
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>
        )
      ) : subTab === 'wiki' ? (
        wikiPages.length === 0 ? (
          <div className="lw-empty">暂无知识页</div>
        ) : (
          <div className="lw-list">
            {wikiPages.map((page) => (
              <div
                key={page.relPath}
                className="lw-project-row"
                onClick={() => openWikiByRelPath(page.relPath)}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="lw-row" style={{ gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14.5 }}>{page.title}</span>
                    {page.sources.length > 0 && (
                      <span className="lw-muted">{page.sources.length} 份依据</span>
                    )}
                  </div>
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
                <div className="lw-row" style={{ gap: 8, flexShrink: 0 }}>
                  {page.updated && <span className="lw-muted lw-mono">{page.updated}</span>}
                  <span style={{ color: 'var(--lw-muted)', display: 'inline-flex' }}>
                    <IconChevronRight size={14} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : rawBuckets.length === 0 ? (
        <div className="lw-empty">暂无原件</div>
      ) : (
        <div className="lw-stack" style={{ gap: 16 }}>
          {/* Dynamic 1:1 Local raw/ Folder Tabs + Contextual Light Filter */}
          <div className="lw-between" style={{ marginTop: -8, gap: 10 }}>
            <div className="lw-row" style={{ gap: 4, marginLeft: -8 }}>
              {rawBuckets.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  className={`lw-mode-tab ${activeBucket === b.name ? 'active' : ''}`}
                  onClick={() => selectBucket(b.name)}
                >
                  {b.name}
                  <span style={{ opacity: 0.65, marginLeft: 4, fontWeight: 400 }}>{b.count}</span>
                </button>
              ))}
            </div>

            <div className="lw-row" style={{ gap: 4 }}>
              {sourceFilter && (
                <button
                  type="button"
                  className="lw-chip-btn"
                  style={{ height: 24, fontSize: 12 }}
                  onClick={() => setSourceFilter(null)}
                >
                  <span>{sourceFilter}</span>
                  <IconX size={11} />
                </button>
              )}

              {activeBucket === 'GitHub' && (
                <div className="lw-row" style={{ gap: 2 }}>
                  {(['ALL', 'L3', 'L2', 'L1'] as const).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      className={`lw-mode-tab ${tierFilter === tier ? 'active' : ''}`}
                      style={{ height: 24, padding: '0 7px', fontSize: 12 }}
                      onClick={() => {
                        setTierFilter(tier)
                        setVisibleLimit(PAGE_STEP)
                      }}
                    >
                      {tier === 'ALL' ? '全部' : tier}
                    </button>
                  ))}
                </div>
              )}

              {bucketHasCited && (
                <button
                  type="button"
                  className={`lw-mode-tab ${citedOnly ? 'active' : ''}`}
                  style={{ height: 24, padding: '0 7px', fontSize: 12 }}
                  onClick={() => setCitedOnly((v) => !v)}
                >
                  已入 Wiki
                </button>
              )}
            </div>
          </div>

          {filteredBucketItems.length === 0 ? (
            <div className="lw-empty">当前筛选下暂无原件</div>
          ) : activeBucket === 'me' || activeBucket === 'files' ? (
            <div className="lw-list">
              {visibleBucketItems.map((entry) => renderRawRow(entry))}
            </div>
          ) : (
            <div className="lw-stack" style={{ gap: 20 }}>
              {groupByMonth(visibleBucketItems).map(({ month, entries }) => (
                <section key={month} className="lw-stack" style={{ gap: 4 }}>
                  <div className="lw-diary-month-head">
                    {month} · {entries.length}
                  </div>
                  <div className="lw-list">{entries.map((entry) => renderRawRow(entry))}</div>
                </section>
              ))}
            </div>
          )}

          {remainingBucketCount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
              <button
                type="button"
                className="lw-btn lw-btn-sm lw-btn-ghost"
                onClick={() => setVisibleLimit((n) => n + PAGE_STEP)}
              >
                展开更早（剩余 {remainingBucketCount} 条）
              </button>
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
