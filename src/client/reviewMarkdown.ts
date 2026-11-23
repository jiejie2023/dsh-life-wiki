import type { ReviewStatus } from '../shared/types.ts'

export interface ReviewDraft {
  status: ReviewStatus
  thisWeek: string
  totalHoursLine: string
  reason: string
  lesson: string
  nextWeek: string
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
  const thisWeekLines: string[] = []
  for (const line of rawThisWeek.split('\n')) {
    const trimmed = line.trim()
    if (/^本周投入[：:]/.test(trimmed)) {
      totalHoursLine = trimmed
    } else {
      thisWeekLines.push(line)
    }
  }

  const reason = getSectionBody(lines, '原因')
  const lesson = getSectionBody(lines, '经验')
  const rawNextWeek = getSectionBody(lines, '下周')
  const nextWeek = rawNextWeek === '1.' ? '' : rawNextWeek

  return {
    status,
    thisWeek: thisWeekLines.join('\n').trim(),
    totalHoursLine,
    reason,
    lesson,
    nextWeek,
  }
}

export function applyReviewSections(originalMarkdown: string, draft: ReviewDraft): string {
  let next = updateYamlStatus(originalMarkdown, draft.status)

  const twLines = draft.thisWeek.trim() ? draft.thisWeek.trim().split('\n') : []
  const hasHoursAlready = twLines.some((l) => /^本周投入[：:]/.test(l.trim()))
  if (draft.totalHoursLine && !hasHoursAlready) {
    if (twLines.length > 0) twLines.push('')
    twLines.push(draft.totalHoursLine)
  }
  next = replaceH2Body(next, '本周', twLines)
  next = replaceH2Body(next, '原因', draft.reason.trim() ? draft.reason.trim().split('\n') : [])
  next = replaceH2Body(next, '经验', draft.lesson.trim() ? draft.lesson.trim().split('\n') : [])
  next = replaceH2Body(
    next,
    '下周',
    draft.nextWeek.trim() ? draft.nextWeek.trim().split('\n') : [],
  )
  return next
}
