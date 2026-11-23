import React from 'react'
import { rawFileUrl } from '../api.ts'

interface MarkdownViewProps {
  content: string
  baseRelPath?: string
  hideFrontmatter?: boolean
  onOpenImage?: (src: string) => void
}

function resolveRelativeAsset(baseRelPath: string | undefined, target: string): string {
  const cleaned = target.trim().replace(/^<|>$/g, '')
  if (/^https?:\/\//i.test(cleaned) || cleaned.startsWith('data:')) return cleaned
  const normalizedTarget = cleaned.replace(/\\/g, '/')
  if (
    normalizedTarget.startsWith('raw/') ||
    normalizedTarget.startsWith('projects/') ||
    normalizedTarget.startsWith('wiki/')
  ) {
    return rawFileUrl(normalizedTarget)
  }
  const baseDir = baseRelPath ? baseRelPath.replace(/\\/g, '/').split('/').slice(0, -1) : []
  const segments = [...baseDir]
  for (const part of normalizedTarget.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') segments.pop()
    else segments.push(part)
  }
  return rawFileUrl(segments.join('/'))
}

function renderInline(
  text: string,
  baseRelPath: string | undefined,
  onOpenImage?: (src: string) => void,
): React.ReactNode[] {
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
      const href = match[4].trim()
      if (/^https?:\/\//i.test(href)) {
        nodes.push(
          <a key={`a-${key++}`} href={href} target="_blank" rel="noreferrer">
            {match[3]}
          </a>,
        )
      } else {
        nodes.push(<code key={`ref-${key++}`}>{match[3]}</code>)
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

export function MarkdownView({
  content,
  baseRelPath,
  hideFrontmatter,
  onOpenImage,
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

    const hMatch = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (hMatch) {
      const level = hMatch[1]!.length
      const contentNodes = renderInline(hMatch[2]!, baseRelPath, onOpenImage)
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
        qLines.push(lines[i]!.trim().replace(/^>\s?/, ''))
        i += 1
      }
      blocks.push(
        <blockquote key={`q-${blockKey++}`}>
          {qLines.map((ql, idx) => (
            <div key={idx}>{renderInline(ql, baseRelPath, onOpenImage)}</div>
          ))}
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
                {renderInline(chk[2]!, baseRelPath, onOpenImage)}
              </span>
            </li>,
          )
        } else {
          items.push(<li key={i}>{renderInline(raw, baseRelPath, onOpenImage)}</li>)
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
        items.push(<li key={i}>{renderInline(raw, baseRelPath, onOpenImage)}</li>)
        i += 1
      }
      blocks.push(<ol key={`ol-${blockKey++}`}>{items}</ol>)
      continue
    }

    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !/^(#{1,4}\s|[-*]\s|\d+\.\s|>|```|---+$)/.test(lines[i]!.trim())
    ) {
      paraLines.push(lines[i]!)
      i += 1
    }
    blocks.push(
      <p key={`p-${blockKey++}`}>
        {paraLines.map((pl, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <br />}
            {renderInline(pl, baseRelPath, onOpenImage)}
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
