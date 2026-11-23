import React from 'react'
import { rawFileUrl } from '../api.ts'

interface MarkdownViewProps {
  content: string
  baseRelPath?: string
  hideFrontmatter?: boolean
  onOpenImage?: (src: string) => void
  onOpenFile?: (relPath: string) => void
}

function resolveVaultRelPath(baseRelPath: string | undefined, target: string): string | null {
  const withoutAnchor = target.trim().replace(/^<|>$/g, '').split('#')[0]?.trim() ?? ''
  if (!withoutAnchor) return null
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(withoutAnchor)) return null
  const normalizedTarget = withoutAnchor.replace(/\\/g, '/')
  if (
    normalizedTarget.startsWith('raw/') ||
    normalizedTarget.startsWith('projects/') ||
    normalizedTarget.startsWith('wiki/') ||
    normalizedTarget.startsWith('system/')
  ) {
    return normalizedTarget
  }
  const baseDir = baseRelPath ? baseRelPath.replace(/\\/g, '/').split('/').slice(0, -1) : []
  const segments = [...baseDir]
  for (const part of normalizedTarget.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (segments.length === 0) return null
      segments.pop()
    } else {
      segments.push(part)
    }
  }
  return segments.length > 0 ? segments.join('/') : null
}

function resolveRelativeAsset(baseRelPath: string | undefined, target: string): string {
  const cleaned = target.trim().replace(/^<|>$/g, '')
  if (/^https?:\/\//i.test(cleaned) || cleaned.startsWith('data:')) return cleaned
  const resolved = resolveVaultRelPath(baseRelPath, cleaned)
  return resolved ? rawFileUrl(resolved) : cleaned
}

function stripLegacyHtmlTags(text: string): string {
  return text.replace(/<\/?font\b[^>]*>/gi, '')
}

function renderInline(
  rawText: string,
  baseRelPath: string | undefined,
  onOpenImage?: (src: string) => void,
  onOpenFile?: (relPath: string) => void,
): React.ReactNode[] {
  const text = stripLegacyHtmlTags(rawText)
  const nodes: React.ReactNode[] = []
  const tokenRe =
    /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = tokenRe.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    if (match[1] !== undefined && match[2] !== undefined) {
      const src = resolveRelativeAsset(baseRelPath, match[2])
      nodes.push(
        <img
          key={`img-${key++}`}
          src={src}
          alt={match[1]}
          onClick={() => onOpenImage?.(src)}
          style={onOpenImage ? { cursor: 'zoom-in' } : undefined}
        />,
      )
    } else if (match[3] !== undefined && match[4] !== undefined) {
      const href = match[4].trim().replace(/^<|>$/g, '')
      if (/^https?:\/\//i.test(href)) {
        nodes.push(
          <a
            key={`a-${key++}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {match[3]}
          </a>,
        )
      } else {
        const resolved = resolveVaultRelPath(baseRelPath, href)
        if (onOpenFile && resolved && /\.(md|txt|json|yml|yaml)$/i.test(resolved)) {
          nodes.push(
            <button
              key={`vl-${key++}`}
              type="button"
              className="lw-md-link"
              title={resolved}
              onClick={(e) => {
                e.stopPropagation()
                onOpenFile(resolved)
              }}
            >
              {match[3]}
            </button>,
          )
        } else {
          nodes.push(<code key={`ref-${key++}`}>{match[3]}</code>)
        }
      }
    } else if (match[5] !== undefined) {
      nodes.push(<code key={`code-${key++}`}>{match[5]}</code>)
    } else if (match[6] !== undefined) {
      nodes.push(<strong key={`b-${key++}`}>{match[6]}</strong>)
    } else if (match[7] !== undefined) {
      nodes.push(<em key={`i-${key++}`}>{match[7]}</em>)
    }
    lastIndex = tokenRe.lastIndex
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

/** Lightweight inline Markdown renderer for task rows, plan items, review items, and inbox entries. */
export function InlineText({
  text,
  baseRelPath,
  onOpenFile,
}: {
  text: string
  baseRelPath?: string
  onOpenFile?: (relPath: string) => void
}) {
  const cleaned = stripLegacyHtmlTags(text)
  const nodes: React.ReactNode[] = []
  const tokenRe = /\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = tokenRe.exec(cleaned)) !== null) {
    if (match.index > lastIndex) nodes.push(cleaned.slice(lastIndex, match.index))
    if (match[1] !== undefined && match[2] !== undefined) {
      const href = match[2].trim().replace(/^<|>$/g, '')
      if (/^https?:\/\//i.test(href)) {
        nodes.push(
          <a
            key={`a-${key++}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="lw-inline-link"
            onClick={(e) => e.stopPropagation()}
          >
            {match[1]}
          </a>,
        )
      } else {
        const resolved = resolveVaultRelPath(baseRelPath, href)
        if (onOpenFile && resolved && /\.(md|txt|json|yml|yaml)$/i.test(resolved)) {
          nodes.push(
            <button
              key={`vl-${key++}`}
              type="button"
              className="lw-md-link"
              title={resolved}
              onClick={(e) => {
                e.stopPropagation()
                onOpenFile(resolved)
              }}
            >
              {match[1]}
            </button>,
          )
        } else {
          nodes.push(
            <code key={`ref-${key++}`} className="lw-inline-code">
              {match[1]}
            </code>,
          )
        }
      }
    } else if (match[3] !== undefined) {
      nodes.push(
        <code key={`code-${key++}`} className="lw-inline-code">
          {match[3]}
        </code>,
      )
    } else if (match[4] !== undefined) {
      nodes.push(<strong key={`b-${key++}`}>{match[4]}</strong>)
    }
    lastIndex = tokenRe.lastIndex
  }
  if (lastIndex < cleaned.length) nodes.push(cleaned.slice(lastIndex))
  return <>{nodes}</>
}

function isTableSeparatorLine(line: string): boolean {
  const t = line.trim()
  if (!t.includes('-')) return false
  return /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(t)
}

function splitTableRow(line: string): string[] {
  let t = line.trim()
  if (t.startsWith('|')) t = t.slice(1)
  if (t.endsWith('|')) t = t.slice(0, -1)
  return t.split('|').map((cell) => cell.trim())
}

export function MarkdownView({
  content,
  baseRelPath,
  hideFrontmatter,
  onOpenImage,
  onOpenFile,
}: MarkdownViewProps) {
  const normalized = content.replace(/\r\n/g, '\n')
  let body = normalized
  const metaPairs: Array<[string, string]> = []

  const fmMatch = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (fmMatch) {
    for (const line of fmMatch[1]!.split('\n')) {
      const idx = line.indexOf(':')
      if (idx > 0) {
        const val = line.slice(idx + 1).trim()
        if (val) metaPairs.push([line.slice(0, idx).trim(), val])
      }
    }
    body = fmMatch[2] ?? ''
  }

  const lines = body.split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  let blockKey = 0

  while (i < lines.length) {
    const trimmed = lines[i]!.trim()
    if (!trimmed) {
      i += 1
      continue
    }

    if (trimmed.startsWith('```')) {
      const codeLines: string[] = []
      i += 1
      while (i < lines.length && !lines[i]!.trim().startsWith('```')) {
        codeLines.push(lines[i]!)
        i += 1
      }
      i += 1
      blocks.push(
        <pre key={`pre-${blockKey++}`}>
          <code>{codeLines.join('\n')}</code>
        </pre>,
      )
      continue
    }

    // GFM Table
    if (
      trimmed.includes('|') &&
      i + 1 < lines.length &&
      isTableSeparatorLine(lines[i + 1]!)
    ) {
      const headers = splitTableRow(trimmed)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i]!.trim() !== '' && lines[i]!.includes('|')) {
        rows.push(splitTableRow(lines[i]!))
        i += 1
      }
      blocks.push(
        <div key={`tbl-${blockKey++}`} className="lw-md-table-wrap">
          <table>
            <thead>
              <tr>
                {headers.map((h, ci) => (
                  <th key={ci}>{renderInline(h, baseRelPath, onOpenImage, onOpenFile)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {headers.map((_, ci) => (
                    <td key={ci}>
                      {renderInline(row[ci] ?? '', baseRelPath, onOpenImage, onOpenFile)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    const hMatch = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (hMatch) {
      const level = hMatch[1]!.length
      const contentNodes = renderInline(hMatch[2]!, baseRelPath, onOpenImage, onOpenFile)
      if (level === 1) blocks.push(<h1 key={`h-${blockKey++}`}>{contentNodes}</h1>)
      else if (level === 2) blocks.push(<h2 key={`h-${blockKey++}`}>{contentNodes}</h2>)
      else blocks.push(<h3 key={`h-${blockKey++}`}>{contentNodes}</h3>)
      i += 1
      continue
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push(<div key={`hr-${blockKey++}`} className="lw-divider" style={{ margin: '12px 0' }} />)
      i += 1
      continue
    }

    if (trimmed.startsWith('>')) {
      const qLines: string[] = []
      while (i < lines.length && lines[i]!.trim().startsWith('>')) {
        let ql = lines[i]!.trim().replace(/^>\s?/, '')
        ql = ql.replace(/^\[![a-zA-Z0-9_-]+\][+-]?\s*/, '')
        qLines.push(ql)
        i += 1
      }
      blocks.push(
        <blockquote key={`q-${blockKey++}`}>
          {qLines.map((ql, idx) =>
            idx === 0 && ql.trim() ? (
              <div key={idx} style={{ fontWeight: 500, color: 'var(--lw-text)' }}>
                {renderInline(ql, baseRelPath, onOpenImage, onOpenFile)}
              </div>
            ) : (
              <div key={idx}>{renderInline(ql, baseRelPath, onOpenImage, onOpenFile)}</div>
            ),
          )}
        </blockquote>,
      )
      continue
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: React.ReactNode[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i]!.trim())) {
        const raw = lines[i]!.trim().replace(/^[-*]\s+/, '')
        const chk = raw.match(/^\[([ xX])\]\s*(.*)$/)
        if (chk) {
          const checked = chk[1]!.toLowerCase() === 'x'
          items.push(
            <li key={i} style={{ listStyle: 'none', marginLeft: -16 }}>
              <span className="lw-muted" style={{ marginRight: 6 }}>
                {checked ? '✓' : '○'}
              </span>
              <span className={checked ? 'lw-item-done' : undefined}>
                {renderInline(chk[2]!, baseRelPath, onOpenImage, onOpenFile)}
              </span>
            </li>,
          )
        } else {
          items.push(<li key={i}>{renderInline(raw, baseRelPath, onOpenImage, onOpenFile)}</li>)
        }
        i += 1
      }
      blocks.push(<ul key={`ul-${blockKey++}`}>{items}</ul>)
      continue
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: React.ReactNode[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]!.trim())) {
        const raw = lines[i]!.trim().replace(/^\d+\.\s+/, '')
        items.push(<li key={i}>{renderInline(raw, baseRelPath, onOpenImage, onOpenFile)}</li>)
        i += 1
      }
      blocks.push(<ol key={`ol-${blockKey++}`}>{items}</ol>)
      continue
    }

    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !/^(#{1,4}\s|[-*]\s|\d+\.\s|>|```|---+$)/.test(lines[i]!.trim()) &&
      !(lines[i]!.includes('|') && i + 1 < lines.length && isTableSeparatorLine(lines[i + 1]!))
    ) {
      paraLines.push(lines[i]!)
      i += 1
    }
    blocks.push(
      <p key={`p-${blockKey++}`}>
        {paraLines.map((pl, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <br />}
            {renderInline(pl, baseRelPath, onOpenImage, onOpenFile)}
          </React.Fragment>
        ))}
      </p>,
    )
  }

  return (
    <div className="lw-md">
      {!hideFrontmatter && metaPairs.length > 0 && (
        <div className="lw-row" style={{ marginBottom: 14, gap: 6 }}>
          {metaPairs.map(([k, v]) => (
            <span key={k} className="lw-tag">
              {k}: {v}
            </span>
          ))}
        </div>
      )}
      {blocks}
    </div>
  )
}
