import type { ReviewStatus } from '../shared/types.ts'

export interface ReviewWeekItem {
  done: boolean | null
  text: string
}

export interface ReviewDraft {
  status: ReviewStatus
  thisWeekItems: ReviewWeekItem[]
  totalHoursLine: string
  reasons: string[]
  lessons: string[]
  nextWeekItems: string[]
}

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

function getSectionBody(lines: string[], titlePrefix: string): string {
  const sec = findH2Section(lines, titlePrefix)
  if (!sec) return ''
  return lines.slice(sec.startLine, sec.endLine).join('\n').trim()
}

function replaceH2Body(text: string, titlePrefix: string, bodyLines: string[]): string {
  const { lines, eol } = splitLines(text)
  const sec = findH2Section(lines, titlePrefix)
  const cleanBody = [...bodyLines]
  while (cleanBody.length > 0 && cleanBody[cleanBody.length - 1] === '') cleanBody.pop()
  const replacement = cleanBody.length > 0 ? ['', ...cleanBody, ''] : ['']
  if (!sec) {
    const next = [...lines]
    if (next.length > 0 && next[next.length - 1]?.trim() !== '') next.push('')
    next.push(`## ${titlePrefix}`, ...replacement)
    return next.join(eol)
  }
  const next = [...lines.slice(0, sec.startLine), ...replacement, ...lines.slice(sec.endLine)]
  return next.join(eol)
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

  const rawThisWeek = getSectionBody(lines, '本周')
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

  const reasons = parsePlainList(getSectionBody(lines, '原因'))
  const lessons = parsePlainList(getSectionBody(lines, '经验'))
  const nextWeekItems = parsePlainList(getSectionBody(lines, '下周'))

  return {
    status,
    thisWeekItems,
    totalHoursLine,
    reasons,
    lessons,
    nextWeekItems,
  }
}

export function applyReviewSections(originalMarkdown: string, draft: ReviewDraft): string {
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
  next = replaceH2Body(next, '本周', twLines)

  const reasonLines = draft.reasons
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `- ${s}`)
  next = replaceH2Body(next, '原因', reasonLines)

  const lessonLines = draft.lessons
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `- ${s}`)
  next = replaceH2Body(next, '经验', lessonLines)

  const nextWeekLines = draft.nextWeekItems
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s, idx) => `${idx + 1}. ${s}`)
  next = replaceH2Body(next, '下周', nextWeekLines)

  return next
}
