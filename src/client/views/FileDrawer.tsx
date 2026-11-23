import React, { useEffect, useState } from 'react'
import { api } from '../api.ts'
import { IconX } from '../components/Icons.tsx'
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
  const [content, setContent] = useState('')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(initialEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setEditing(initialEdit)
    api
      .readFile(relPath)
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
  }, [relPath, initialEdit])

  const dirty = editing && draft !== content

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.writeFile(relPath, draft)
      setContent(draft)
      setEditing(false)
      await onSaved()
      onToast('已保存')
    } catch (err) {
      onToast(err instanceof Error ? err.message : String(err), true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="lw-backdrop" onClick={onClose}>
      <div className="lw-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="lw-panel-header">
          <div
            className="lw-mono lw-meta"
            style={{
              minWidth: 0,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={relPath}
          >
            {relPath}
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
                  } else {
                    setEditing(true)
                  }
                }}
              >
                {editing ? '取消' : '编辑'}
              </button>
            )}
            <button type="button" className="lw-icon-btn" onClick={onClose}>
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
              onChange={(e) => setDraft(e.target.value)}
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
              baseRelPath={relPath}
              onOpenImage={(src) => setLightboxSrc(src)}
            />
          )}
        </div>

        {editing && (
          <div className="lw-panel-footer">
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
