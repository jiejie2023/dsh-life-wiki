export type IdeaVerdict = '做' | '再想想' | '不做' | ''

export interface IdeaEvaluation {
  idea: string
  why: string
  ifNot: string
  cost: string
  realChange: string
  extraMotivationLines: string[]
  cognition: string
  verdict: IdeaVerdict
  judgmentReason: string
  judgmentDate: string
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

function extractBoldField(line: string, label: string): string | null {
  const re = new RegExp(`^\\*\\*${label}[：:]?\\*\\*[：:]?\\s*(.*)$`)
  const m = re.exec(line.trim())
  return m ? m[1]!.trim() : null
}

export function parseIdeaSections(markdown: string): IdeaEvaluation {
  const { lines } = splitLines(markdown)
  const idea = getSectionBody(lines, '想法')
  const cognition = getSectionBody(lines, '认知')

  let why = ''
  let ifNot = ''
  let cost = ''
  let realChange = ''
  const extraMotivationLines: string[] = []

  const motSec = findH2Section(lines, '动机')
  if (motSec) {
    for (let i = motSec.startLine; i < motSec.endLine; i += 1) {
      const raw = lines[i] ?? ''
      const t = raw.trim()
      if (!t) continue
      const vWhy = extractBoldField(t, '为什么想做')
      if (vWhy !== null) {
        why = vWhy
        continue
      }
      const vIfNot = extractBoldField(t, '不做会怎样')
      if (vIfNot !== null) {
        ifNot = vIfNot
        continue
      }
      const vCost = extractBoldField(t, '要付出什么')
      if (vCost !== null) {
        cost = vCost
        continue
      }
      const vChange = extractBoldField(t, '做完能带来什么真实变化')
      if (vChange !== null) {
        realChange = vChange
        continue
      }
      extraMotivationLines.push(raw)
    }
  }

  const rawJudgment = getSectionBody(lines, '判断')
  let verdict: IdeaVerdict = ''
  let judgmentReason = rawJudgment
  let judgmentDate = ''

  if (rawJudgment) {
    let working = rawJudgment
    const dateMatch = /[（(]\s*(\d{4}-\d{2}-\d{2})\s*[）)]\s*$/.exec(working)
    if (dateMatch) {
      judgmentDate = dateMatch[1]!
      working = working.slice(0, dateMatch.index).trim()
    }
    const verdictMatch = /^(做|不做|再想想)\s*[：:]\s*(.*)$/.exec(working)
    if (verdictMatch) {
      verdict = verdictMatch[1] as IdeaVerdict
      judgmentReason = verdictMatch[2]!.replace(/[。.]$/, '').trim()
    } else if (working === '做' || working === '不做' || working === '再想想') {
      verdict = working
      judgmentReason = ''
    } else if (/^做\s*\/\s*不做\s*\/\s*再想想/.test(working)) {
      verdict = ''
      judgmentReason = ''
    } else {
      judgmentReason = working
    }
  }

  return {
    idea,
    why,
    ifNot,
    cost,
    realChange,
    extraMotivationLines,
    cognition,
    verdict,
    judgmentReason,
    judgmentDate,
  }
}

export function applyIdeaSections(
  originalMarkdown: string,
  draft: IdeaEvaluation,
  todayIso: string,
): string {
  let next = originalMarkdown
  next = replaceH2Body(next, '想法', draft.idea.trim() ? draft.idea.trim().split('\n') : [])

  const motLines = [
    `**为什么想做：** ${draft.why.trim()}`,
    `**不做会怎样：** ${draft.ifNot.trim()}`,
    `**要付出什么：** ${draft.cost.trim()}`,
    `**做完能带来什么真实变化：** ${draft.realChange.trim()}`,
    ...draft.extraMotivationLines,
  ]
  next = replaceH2Body(next, '动机', motLines)

  next = replaceH2Body(
    next,
    '认知',
    draft.cognition.trim() ? draft.cognition.trim().split('\n') : [],
  )

  const v = draft.verdict || '再想想'
  const r = draft.judgmentReason.trim()
  const d = draft.judgmentDate || todayIso
  const judgmentLine =
    draft.verdict || r ? `${v}：${r ? `${r.replace(/[。.]$/, '')}。` : ''}（${d}）` : ''
  next = replaceH2Body(next, '判断', judgmentLine ? [judgmentLine] : [])

  return next
}
