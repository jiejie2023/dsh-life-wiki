import React, { useEffect, useState } from 'react'
import { api } from '../api.ts'
import { IconChevronLeft, IconX } from '../components/Icons.tsx'
import { MarkdownView } from '../components/MarkdownView.tsx'

interface FileDrawerProps {
  relPath: string
  initialEdit?: boolean
  onClose: () => void
  onSaved: () => Promise<void>
  onToast: (msg: string, isError?: boolean) => void
}

export function FileDrawer({
  relPath,
  initialEdit = false,
  onClose,
  onSaved,
  onToast,
}: FileDrawerProps) {
  const [currentPath, setCurrentPath] = useState(relPath)
  const [navStack, setNavStack] = useState<string[]>([])
  const [content, setContent] = useState('')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(initialEdit)
  const [saving, setSaving] = useState(false)
  const [discardPrompt, setDiscardPrompt] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  useEffect(() => {
    setCurrentPath(relPath)
    setNavStack([])
    setEditing(initialEdit)
    setDiscardPrompt(false)
  }, [relPath, initialEdit])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setDiscardPrompt(false)
    api
      .readFile(currentPath)
      .then((res) => {
        if (!active) return
        setContent(res.content)
        setDraft(res.content)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [currentPath])

  const dirty = editing && draft !== content

  const requestClose = () => {
    if (dirty && !discardPrompt) {
      setDiscardPrompt(true)
      return
    }
    onClose()
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      if (lightboxSrc) {
        setLightboxSrc(null)
        return
      }
      if (dirty && !discardPrompt) {
        setDiscardPrompt(true)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [lightboxSrc, dirty, discardPrompt, onClose])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.writeFile(currentPath, draft)
      setContent(draft)
      setEditing(false)
      setDiscardPrompt(false)
      await onSaved()
      onToast('已保存')
    } catch (err) {
      onToast(err instanceof Error ? err.message : String(err), true)
    } finally {
      setSaving(false)
    }
  }

  const handleNavigate = (nextRelPath: string) => {
    if (!nextRelPath || nextRelPath === currentPath) return
    setNavStack((prev) => [...prev, currentPath])
    setEditing(false)
    setCurrentPath(nextRelPath)
  }

  const handleBack = () => {
    if (navStack.length === 0) return
    const prevPath = navStack[navStack.length - 1]!
    setNavStack((prev) => prev.slice(0, -1))
    setEditing(false)
    setCurrentPath(prevPath)
  }

  return (
    <div className="lw-backdrop" onClick={requestClose}>
      <div className="lw-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="lw-panel-header">
          <div className="lw-row" style={{ minWidth: 0, flex: 1, gap: 4 }}>
            {navStack.length > 0 && (
              <button
                type="button"
                className="lw-icon-btn"
                style={{ height: 24, minWidth: 24, marginLeft: -4 }}
                title="返回上一文档"
                onClick={handleBack}
              >
                <IconChevronLeft size={14} />
              </button>
            )}
            <div
              className="lw-mono lw-meta"
              style={{
                minWidth: 0,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={currentPath}
            >
              {currentPath}
            </div>
          </div>
          <div className="lw-row" style={{ gap: 6 }}>
            {!loading && !error && (
              <button
                type="button"
                className={`lw-btn lw-btn-sm ${editing ? 'lw-btn-ghost' : ''}`}
                onClick={() => {
                  if (editing) {
                    setDraft(content)
                    setEditing(false)
                    setDiscardPrompt(false)
                  } else {
                    setEditing(true)
                  }
                }}
              >
                {editing ? '取消' : '编辑'}
              </button>
            )}
            <button type="button" className="lw-icon-btn" onClick={requestClose}>
              <IconX />
            </button>
          </div>
        </div>

        <div className="lw-panel-body">
          {loading ? (
            <div className="lw-muted">读取中…</div>
          ) : error ? (
            <div style={{ color: 'var(--lw-danger)', fontSize: 13.5 }}>{error}</div>
          ) : editing ? (
            <textarea
              className="lw-textarea lw-mono"
              style={{ height: '100%', minHeight: 460, fontSize: 13, border: 'none', padding: 0 }}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                if (discardPrompt) setDiscardPrompt(false)
              }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                  e.preventDefault()
                  void handleSave()
                }
              }}
              autoFocus
            />
          ) : (
            <MarkdownView
              content={content}
              baseRelPath={currentPath}
              onOpenImage={(src) => setLightboxSrc(src)}
              onOpenFile={handleNavigate}
            />
          )}
        </div>

        {editing && (
          <div className="lw-panel-footer">
            {discardPrompt ? (
              <>
                <span style={{ marginRight: 'auto', fontSize: 12.5, color: 'var(--lw-warn)' }}>
                  有未保存改动
                </span>
                <button
                  type="button"
                  className="lw-btn lw-btn-sm lw-btn-ghost"
                  onClick={onClose}
                >
                  放弃关闭
                </button>
                <button
                  type="button"
                  className="lw-btn lw-btn-sm lw-btn-primary"
                  disabled={saving}
                  onClick={() => void handleSave()}
                >
                  {saving ? '保存中…' : '保存'}
                </button>
              </>
            ) : (
              <>
                <span className="lw-muted" style={{ marginRight: 'auto' }}>
                  {dirty ? 'Ctrl+S 保存' : ''}
                </span>
                <button
                  type="button"
                  className="lw-btn lw-btn-sm lw-btn-primary"
                  disabled={saving || !dirty}
                  onClick={() => void handleSave()}
                >
                  {saving ? '保存中…' : '保存'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {lightboxSrc && (
        <div
          className="lw-backdrop lw-backdrop-center"
          onClick={(e) => {
            e.stopPropagation()
            setLightboxSrc(null)
          }}
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
