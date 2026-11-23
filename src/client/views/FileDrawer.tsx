import React, { useEffect, useState } from 'react'
import { api } from '../api.ts'
import { MarkdownView } from '../components/MarkdownView.tsx'

interface FileDrawerProps {
  relPath: string
  onClose: () => void
  onSaved: () => Promise<void>
  onToast: (msg: string, isError?: boolean) => void
}

export function FileDrawer({ relPath, onClose, onSaved, onToast }: FileDrawerProps) {
  const [content, setContent] = useState('')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setEditing(false)
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
  }, [relPath])

  const dirty = editing && draft !== content

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.writeFile(relPath, draft)
      setContent(draft)
      setEditing(false)
      await onSaved()
      onToast('文件已保存')
    } catch (err) {
      onToast(err instanceof Error ? err.message : String(err), true)
    } finally {
      setSaving(false)
    }
  }

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(relPath)
      onToast('已复制路径')
    } catch {
      onToast(relPath)
    }
  }

  return (
    <div className="lw-backdrop" onClick={onClose}>
      <div className="lw-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="lw-panel-header">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              className="lw-mono"
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={relPath}
            >
              {relPath}
            </div>
          </div>
          <div className="lw-row">
            <button
              type="button"
              className="lw-btn lw-btn-sm lw-btn-ghost"
              onClick={() => void handleCopyPath()}
            >
              复制路径
            </button>
            {!loading && !error && (
              <button
                type="button"
                className={`lw-btn lw-btn-sm ${editing ? '' : 'lw-btn-primary'}`}
                onClick={() => {
                  if (editing) {
                    setDraft(content)
                    setEditing(false)
                  } else {
                    setEditing(true)
                  }
                }}
              >
                {editing ? '取消编辑' : '编辑原文'}
              </button>
            )}
            <button type="button" className="lw-btn lw-btn-sm" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>

        <div className="lw-panel-body">
          {loading ? (
            <div className="lw-muted">读取文件中…</div>
          ) : error ? (
            <div className="lw-banner lw-banner-warn">{error}</div>
          ) : editing ? (
            <textarea
              className="lw-textarea lw-mono"
              style={{ height: '100%', minHeight: 420, fontSize: 13 }}
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
              {dirty ? '有未保存修改 · 按 Ctrl+S 保存' : '内容未改动'}
            </span>
            <button
              type="button"
              className="lw-btn"
              onClick={() => {
                setDraft(content)
                setEditing(false)
              }}
            >
              放弃修改
            </button>
            <button
              type="button"
              className="lw-btn lw-btn-primary"
              disabled={saving || !dirty}
              onClick={() => void handleSave()}
            >
              {saving ? '保存中…' : '保存文件'}
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
