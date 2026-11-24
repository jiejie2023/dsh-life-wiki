import type { ReviewStatus } from '../shared/types.ts'

export interface ReviewWeekItem {
  done: boolean | null
  text: string
}

export interface ReviewDraft {
  status: ReviewStatus
  thisWeekItems: ReviewWeekItem[]
  totalHoursLine: string
  reflections: string[]
  nextWeekItems: string[]
}

const PROGRESS_HEADINGS = ['本周进展', '本周'] as const
const REFLECTION_HEADINGS = ['问题与反思', '反思'] as const
const LEGACY_REFLECTION_HEADINGS = ['没做的', '原因', '经验'] as const
const NEXT_WEEK_HEADINGS = ['下周重点', '下周'] as const

function splitLines(text: string): { lines: string[]; eol: '\r\n' | '\n' } {
  const eol: '\r\n' | '\n' = text.includes('\r\n') ? '\r\n' : '\n'
  return { lines: text.split(/\r?\n/), eol }
}

function findH2Section(
  lines: string[],
  titlePrefix: string,
): { headingLine: number; startLine: number; endLine: number } | null {
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^##\s+(.+)$/.exec((lines[i] ?? '').trim())
    if (!m) continue
    const heading = m[1]!.trim()
    if (
      heading === titlePrefix ||
      heading.startsWith(`${titlePrefix}（`) ||
      heading.startsWith(`${titlePrefix}(`)
    ) {
      let end = lines.length
      for (let j = i + 1; j < lines.length; j += 1) {
        if (/^##\s+/.test((lines[j] ?? '').trim())) {
          end = j
          break
        }
      }
      return { headingLine: i, startLine: i + 1, endLine: end }
    }
  }
  return null
}

function findAnyH2Section(
  lines: string[],
  prefixes: readonly string[],
): { headingLine: number; startLine: number; endLine: number } | null {
  for (const prefix of prefixes) {
    const sec = findH2Section(lines, prefix)
    if (sec) return sec
  }
  return null
}

function getSectionBody(lines: string[], prefixes: readonly string[]): string {
  const sec = findAnyH2Section(lines, prefixes)
  if (!sec) return ''
  return lines.slice(sec.startLine, sec.endLine).join('\n').trim()
}

function replaceAnyH2Body(
  text: string,
  prefixes: readonly string[],
  defaultTitle: string,
  bodyLines: string[],
): string {
  const { lines, eol } = splitLines(text)
  const sec = findAnyH2Section(lines, prefixes)
  const cleanBody = [...bodyLines]
  while (cleanBody.length > 0 && cleanBody[cleanBody.length - 1] === '') cleanBody.pop()
  const replacement = cleanBody.length > 0 ? ['', ...cleanBody, ''] : ['']
  if (!sec) {
    const next = [...lines]
    if (next.length > 0 && next[next.length - 1]?.trim() !== '') next.push('')
    next.push(`## ${defaultTitle}`, ...replacement)
    return next.join(eol)
  }
  const next = [...lines.slice(0, sec.startLine), ...replacement, ...lines.slice(sec.endLine)]
  return next.join(eol)
}

function migrateLegacyReflections(text: string, bodyLines: string[]): string {
  const { lines, eol } = splitLines(text)
  const cleanBody = [...bodyLines]
  while (cleanBody.length > 0 && cleanBody[cleanBody.length - 1] === '') cleanBody.pop()
  const replacement = cleanBody.length > 0 ? ['', ...cleanBody, ''] : ['']

  const found = LEGACY_REFLECTION_HEADINGS.map((h) => findH2Section(lines, h))
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => a.headingLine - b.headingLine)

  if (found.length === 0) {
    // Insert before ## 下周重点 / ## 下周 if present, else append
    const nextSec = findAnyH2Section(lines, NEXT_WEEK_HEADINGS)
    if (nextSec) {
      const next = [
        ...lines.slice(0, nextSec.headingLine),
        '## 问题与反思',
        ...replacement,
        ...lines.slice(nextSec.headingLine),
      ]
      return next.join(eol)
    }
    const next = [...lines]
    if (next.length > 0 && next[next.length - 1]?.trim() !== '') next.push('')
    next.push('## 问题与反思', ...replacement)
    return next.join(eol)
  }

  // Replace earliest legacy heading with ## 问题与反思 and drop the remaining legacy headings
  const primary = found[0]!
  const dropRanges = found.slice(1)
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    if (i === primary.headingLine) {
      out.push('## 问题与反思', ...replacement)
      i = primary.endLine
      continue
    }
    const drop = dropRanges.find((r) => r.headingLine === i)
    if (drop) {
      i = drop.endLine
      continue
    }
    out.push(lines[i]!)
    i += 1
  }
  return out.join(eol)
}

function updateYamlStatus(text: string, status: ReviewStatus): string {
  const { lines, eol } = splitLines(text)
  if (lines[0]?.trim() === '---') {
    let endIdx = -1
    for (let i = 1; i < lines.length; i += 1) {
      if (lines[i]?.trim() === '---') {
        endIdx = i
        break
      }
    }
    if (endIdx > 0) {
      const next = [...lines]
      let found = false
      for (let i = 1; i < endIdx; i += 1) {
        if (/^status\s*:/.test(next[i] ?? '')) {
          next[i] = `status: ${status}`
          found = true
          break
        }
      }
      if (!found) next.splice(endIdx, 0, `status: ${status}`)
      return next.join(eol)
    }
  }
  return ['---', `status: ${status}`, '---', '', ...lines].join(eol)
}

function stripListPrefix(line: string): string {
  return line
    .trim()
    .replace(/^(?:\d+[.、]\s*|[-*•·]\s+)/, '')
    .trim()
}

export function parseReviewWeekLine(raw: string): ReviewWeekItem | null {
  const cleaned = stripListPrefix(raw)
  if (!cleaned) return null
  if (/^(?:✅|\[x\]|✓|✔)\s*/i.test(cleaned)) {
    const text = cleaned.replace(/^(?:✅|\[x\]|✓|✔)\s*/i, '').trim()
    return text ? { done: true, text } : null
  }
  if (/^(?:❌|\[ \]|✗|×)\s*/i.test(cleaned)) {
    const text = cleaned.replace(/^(?:❌|\[ \]|✗|×)\s*/i, '').trim()
    return text ? { done: false, text } : null
  }
  return { done: null, text: cleaned }
}

function parsePlainList(sectionBody: string): string[] {
  const out: string[] = []
  for (const raw of sectionBody.split('\n')) {
    const text = stripListPrefix(raw)
    if (text) out.push(text)
  }
  return out
}

function extractReflections(lines: string[]): string[] {
  const newSec = findAnyH2Section(lines, REFLECTION_HEADINGS)
  if (newSec) {
    return parsePlainList(lines.slice(newSec.startLine, newSec.endLine).join('\n').trim())
  }
  // Legacy 4-section (+ optional 没做的) read compatibility
  const groups: Array<{ label: string; items: string[] }> = [
    { label: '**未完成**', items: parsePlainList(getSectionBody(lines, ['没做的'])) },
    { label: '**原因**', items: parsePlainList(getSectionBody(lines, ['原因'])) },
    { label: '**经验**', items: parsePlainList(getSectionBody(lines, ['经验'])) },
  ].filter((g) => g.items.length > 0)

  if (groups.length === 0) return []
  if (groups.length === 1) return groups[0]!.items
  const merged: string[] = []
  for (const g of groups) {
    merged.push(g.label, ...g.items)
  }
  return merged
}

function stringArraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export function parseReviewSections(markdown: string): ReviewDraft {
  const { lines } = splitLines(markdown)
  let status: ReviewStatus = 'draft'
  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < lines.length; i += 1) {
      if (lines[i]?.trim() === '---') break
      const m = /^status\s*:\s*(.*)$/.exec(lines[i] ?? '')
      if (m) {
        status = m[1]!.trim() === 'final' ? 'final' : 'draft'
        break
      }
    }
  }

  const rawThisWeek = getSectionBody(lines, PROGRESS_HEADINGS)
  let totalHoursLine = ''
  const thisWeekItems: ReviewWeekItem[] = []
  for (const line of rawThisWeek.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^本周投入[：:]/.test(trimmed)) {
      totalHoursLine = trimmed
      continue
    }
    const item = parseReviewWeekLine(trimmed)
    if (item) thisWeekItems.push(item)
  }

  const reflections = extractReflections(lines)
  const nextWeekItems = parsePlainList(getSectionBody(lines, NEXT_WEEK_HEADINGS))

  return {
    status,
    thisWeekItems,
    totalHoursLine,
    reflections,
    nextWeekItems,
  }
}

export function applyReviewSections(originalMarkdown: string, draft: ReviewDraft): string {
  const origLines = splitLines(originalMarkdown).lines
  const hasNewReflectionHeading = Boolean(findAnyH2Section(origLines, REFLECTION_HEADINGS))
  const origReflections = extractReflections(origLines)

  let next = updateYamlStatus(originalMarkdown, draft.status)

  let numberedIdx = 0
  const twLines = draft.thisWeekItems
    .map((item) => ({ ...item, text: item.text.trim() }))
    .filter((item) => item.text.length > 0)
    .map((item) => {
      if (item.done === null) {
        return /^\*\*[^*]+\*\*$/.test(item.text) ? item.text : `- ${item.text}`
      }
      numberedIdx += 1
      return `${numberedIdx}. ${item.done ? '✅' : '❌'} ${item.text}`
    })

  if (draft.totalHoursLine) {
    if (twLines.length > 0) twLines.push('')
    twLines.push(draft.totalHoursLine)
  }
  next = replaceAnyH2Body(next, PROGRESS_HEADINGS, '本周进展', twLines)

  const cleanedReflections = draft.reflections.map((s) => s.trim()).filter(Boolean)
  const reflectionLines = cleanedReflections.map((s) =>
    /^\*\*[^*]+\*\*$/.test(s) ? s : `- ${s}`,
  )
  if (hasNewReflectionHeading) {
    next = replaceAnyH2Body(next, REFLECTION_HEADINGS, '问题与反思', reflectionLines)
  } else if (!stringArraysEqual(cleanedReflections, origReflections)) {
    // Only upgrade legacy 原因/经验/没做的 to 问题与反思 when user actually edits reflections
    next = migrateLegacyReflections(next, reflectionLines)
  }

  const nextWeekLines = draft.nextWeekItems
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s, idx) => `${idx + 1}. ${s}`)
  next = replaceAnyH2Body(next, NEXT_WEEK_HEADINGS, '下周重点', nextWeekLines)

  return next
}
