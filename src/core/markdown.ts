import { isAbsolute, normalize, relative, resolve } from 'node:path'
import {
  DURATION_SUFFIX_RE,
  mergeEditedTaskBody,
  parseFromDate,
  parseTaskDuration,
  parseTaskPriority,
  priorityToLabel,
  stripTaskPriority,
} from '../shared/taskFormat.ts'
import type {
  InboxItem,
  PlanItem,
  ProjectStatus,
  ReviewStatus,
  TaskFileStatus,
  TaskItem,
  TaskPriority,
} from '../shared/types.ts'

export {
  parseFromDate,
  parseTaskDuration,
  parseTaskPriority,
  priorityToLabel,
  stripTaskPriority,
}

export interface FrontmatterResult {
  hasFrontmatter: boolean
  fields: Record<string, string>
  bodyStartLine: number
  lines: string[]
  eol: '\r\n' | '\n'
}

export interface SectionRange {
  headingLine: number
  startLine: number
  endLine: number
}

const VALID_PROJECT_STATUSES = new Set<ProjectStatus>([
  'idea',
  'cancel',
  'todo',
  'doing',
  'pause',
  'done',
])
const VALID_TASK_STATUSES = new Set<TaskFileStatus>(['todo', 'doing', 'done'])
const VALID_REVIEW_STATUSES = new Set<ReviewStatus>(['draft', 'final'])

export function detectEol(text: string): '\r\n' | '\n' {
  return text.includes('\r\n') ? '\r\n' : '\n'
}

export function splitLines(text: string): { lines: string[]; eol: '\r\n' | '\n' } {
  const eol = detectEol(text)
  return { lines: text.split(/\r?\n/), eol }
}

export function joinLines(lines: string[], eol: '\r\n' | '\n'): string {
  return lines.join(eol)
}

export function parseFrontmatter(text: string): FrontmatterResult {
  const { lines, eol } = splitLines(text)
  if (lines[0]?.trim() !== '---') {
    return { hasFrontmatter: false, fields: {}, bodyStartLine: 0, lines, eol }
  }
  let end = -1
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i]?.trim() === '---') {
      end = i
      break
    }
  }
  if (end === -1) {
    return { hasFrontmatter: false, fields: {}, bodyStartLine: 0, lines, eol }
  }
  const fields: Record<string, string> = {}
  for (let i = 1; i < end; i += 1) {
    const line = lines[i] ?? ''
    const match = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line)
    if (match) {
      fields[match[1]!] = match[2]!.trim().replace(/^['"]|['"]$/g, '')
    }
  }
  return { hasFrontmatter: true, fields, bodyStartLine: end + 1, lines, eol }
}

export function parseFrontmatterList(text: string, fieldName: string): string[] {
  const fm = parseFrontmatter(text)
  if (!fm.hasFrontmatter) return []
  const end = fm.bodyStartLine - 1
  const out: string[] = []
  let active = false
  for (let i = 1; i < end; i += 1) {
    const line = fm.lines[i] ?? ''
    if (!active) {
      if (new RegExp(`^${fieldName}\\s*:\\s*$`).test(line.trim())) {
        active = true
      }
      continue
    }
    const item = /^\s*-\s+(.+)$/.exec(line)
    if (item) {
      out.push(item[1]!.trim())
    } else if (/^[A-Za-z0-9_-]+\s*:/.test(line.trim())) {
      break
    }
  }
  return out
}

export function updateFrontmatterFields(
  text: string,
  updates: Record<string, string>,
): string {
  const parsed = parseFrontmatter(text)
  const lines = [...parsed.lines]
  if (!parsed.hasFrontmatter) {
    const header = ['---', ...Object.entries(updates).map(([k, v]) => `${k}: ${v}`), '---', '']
    return joinLines([...header, ...lines], parsed.eol)
  }
  const endLine = parsed.bodyStartLine - 1
  const remaining = new Map(Object.entries(updates))
  for (let i = 1; i < endLine; i += 1) {
    const match = /^([A-Za-z0-9_-]+)\s*:/.exec(lines[i] ?? '')
    if (match && remaining.has(match[1]!)) {
      const key = match[1]!
      lines[i] = `${key}: ${remaining.get(key)}`
      remaining.delete(key)
    }
  }
  if (remaining.size > 0) {
    const additions = [...remaining.entries()].map(([k, v]) => `${k}: ${v}`)
    lines.splice(endLine, 0, ...additions)
  }
  return joinLines(lines, parsed.eol)
}

export function findSection(lines: string[], titlePrefix: string): SectionRange | null {
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^##\s+(.+)$/.exec((lines[i] ?? '').trim())
    if (!match) continue
    const heading = match[1]!.trim()
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

export function findAnySection(
  lines: string[],
  titlePrefixes: readonly string[],
): SectionRange | null {
  for (const prefix of titlePrefixes) {
    const sec = findSection(lines, prefix)
    if (sec) return sec
  }
  return null
}

export function getSectionText(lines: string[], titlePrefix: string): string {
  const sec = findSection(lines, titlePrefix)
  if (!sec) return ''
  return lines.slice(sec.startLine, sec.endLine).join('\n').trim()
}

export function setCheckboxPriority(line: string, priority: TaskPriority): string {
  const match = /^(\s*-\s+\[[ xX]\]\s+)(.*)$/.exec(line)
  if (!match) throw new Error(`Line is not a markdown checkbox: ${line}`)
  const body = stripTaskPriority(match[2]!)
  return `${match[1]}[${priorityToLabel(priority)}] ${body}`
}

export function setCheckboxText(line: string, nextText: string): string {
  const match = /^(\s*-\s+\[[ xX]\]\s+)(.*)$/.exec(line)
  if (!match) throw new Error(`Line is not a markdown checkbox: ${line}`)
  const body = mergeEditedTaskBody(match[2]!, nextText)
  return `${match[1]}${body}`
}

export function parseTaskFile(content: string): {
  status: TaskFileStatus | null
  valid: boolean
  formatIssues: string[]
  tasks: TaskItem[]
  logs: string[]
  reflections: string[]
  totalMinutes: number
} {
  const fm = parseFrontmatter(content)
  const formatIssues: string[] = []
  const rawStatus = fm.fields.status
  let status: TaskFileStatus | null = null

  if (!fm.hasFrontmatter) {
    formatIssues.push('缺少 YAML frontmatter（--- status: ... ---）')
  } else if (!rawStatus || !VALID_TASK_STATUSES.has(rawStatus as TaskFileStatus)) {
    formatIssues.push('status 字段无效或缺失（应为 todo / doing / done）')
  } else {
    status = rawStatus as TaskFileStatus
  }

  const taskSec = findAnySection(fm.lines, ['任务', '待办'])
  const logSec = findAnySection(fm.lines, ['日志', '记录'])
  const refSec = findSection(fm.lines, '反思')

  if (!taskSec && !logSec) {
    formatIssues.push('缺少 `## 任务` 栏目')
  }

  const tasks: TaskItem[] = []
  if (taskSec) {
    for (let i = taskSec.startLine; i < taskSec.endLine; i += 1) {
      const rawLine = fm.lines[i] ?? ''
      const match = /^-\s+\[([ xX])\]\s+(.*)$/.exec(rawLine.trim())
      if (!match) continue
      const text = match[2]!.trim()
      tasks.push({
        lineIndex: i,
        checked: match[1]!.toLowerCase() === 'x',
        text,
        priority: parseTaskPriority(text),
        minutes: parseTaskDuration(text),
        fromDate: parseFromDate(text),
        rawLine,
      })
    }
    if (
      tasks.length === 0 &&
      fm.lines.slice(taskSec.startLine, taskSec.endLine).some((l) => l.trim().length > 0)
    ) {
      formatIssues.push('`## 任务` 栏未使用标准 `- [ ]` 勾选框')
    }
  }

  const logs: string[] = logSec
    ? fm.lines
        .slice(logSec.startLine, logSec.endLine)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
    : []

  // Fallback for freeform task/log files without standard/alias headings so UI never renders blank
  if (!taskSec && !logSec) {
    const fallbackEnd = refSec ? refSec.headingLine : fm.lines.length
    for (let i = fm.bodyStartLine; i < fallbackEnd; i += 1) {
      const rawLine = fm.lines[i] ?? ''
      const trimmed = rawLine.trim()
      if (!trimmed || /^#\s+/.test(trimmed)) continue
      const match = /^-\s+\[([ xX])\]\s+(.*)$/.exec(trimmed)
      if (match) {
        const text = match[2]!.trim()
        tasks.push({
          lineIndex: i,
          checked: match[1]!.toLowerCase() === 'x',
          text,
          priority: parseTaskPriority(text),
          minutes: parseTaskDuration(text),
          fromDate: parseFromDate(text),
          rawLine,
        })
      } else {
        logs.push(trimmed)
      }
    }
  }

  const reflections = refSec
    ? fm.lines
        .slice(refSec.startLine, refSec.endLine)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
    : []

  return {
    status,
    valid: formatIssues.length === 0,
    formatIssues,
    tasks,
    logs,
    reflections,
    totalMinutes: tasks.reduce((sum, t) => sum + (t.minutes ?? 0), 0),
  }
}

export function parseProjectStatus(value: string | undefined): ProjectStatus {
  if (value && VALID_PROJECT_STATUSES.has(value as ProjectStatus)) {
    return value as ProjectStatus
  }
  return 'todo'
}

export function parseReviewStatus(value: string | undefined): ReviewStatus | null {
  if (value && VALID_REVIEW_STATUSES.has(value as ReviewStatus)) {
    return value as ReviewStatus
  }
  return null
}

export function parsePlanItems(lines: string[]): PlanItem[] {
  const sec = findSection(lines, '计划')
  if (!sec) return []
  const items: PlanItem[] = []
  for (let i = sec.startLine; i < sec.endLine; i += 1) {
    const rawLine = lines[i] ?? ''
    const match = /^-\s+\[([ xX])\]\s+(.*)$/.exec(rawLine.trim())
    if (!match) continue
    const text = match[2]!.trim()
    if (!text.replace(/^\d+[.、]\s*/, '').trim()) continue
    items.push({
      lineIndex: i,
      checked: match[1]!.toLowerCase() === 'x',
      text,
      rawLine,
    })
  }
  return items
}

export function parseInbox(content: string): { items: InboxItem[]; proposals: string[] } {
  const { lines } = splitLines(content)
  const pendingSec = findSection(lines, '待处理')
  const items: InboxItem[] = []
  if (pendingSec) {
    for (let i = pendingSec.startLine; i < pendingSec.endLine; i += 1) {
      const rawLine = lines[i] ?? ''
      const match = /^-\s+\[([ xX])\]\s+(.*)$/.exec(rawLine.trim())
      if (!match) continue
      items.push({
        lineIndex: i,
        checked: match[1]!.toLowerCase() === 'x',
        text: match[2]!.trim(),
        rawLine,
      })
    }
  }
  const propSec = findSection(lines, '提议')
  const proposals: string[] = []
  if (propSec) {
    for (let i = propSec.startLine; i < propSec.endLine; i += 1) {
      const t = (lines[i] ?? '').trim()
      if (!t || t.startsWith('AI 觉得规矩要改')) continue
      proposals.push(t.replace(/^-\s+/, ''))
    }
  }
  return { items, proposals }
}

export function toggleCheckboxLine(line: string, minutes?: number): string {
  const match = /^(\s*-\s+\[)([ xX])(\]\s+)(.*)$/.exec(line)
  if (!match) throw new Error(`Line is not a markdown checkbox: ${line}`)
  const nextChecked = match[2]!.toLowerCase() !== 'x'
  let body = match[4]!
  if (nextChecked && typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0) {
    const rounded = Math.round(minutes)
    if (/[（(]\s*\d+(?:\.\d+)?\s*(分钟|分|min|小时|h)\s*[）)]/i.test(body)) {
      body = body.replace(
        /[（(]\s*\d+(?:\.\d+)?\s*(分钟|分|min|小时|h)\s*[）)]/i,
        `（${rounded} min）`,
      )
    } else {
      body = `${body.trimEnd()}（${rounded} min）`
    }
  }
  return `${match[1]}${nextChecked ? 'x' : ' '}${match[3]}${body}`
}

export function setCheckboxMinutes(line: string, minutes: number | null): string {
  const match = /^(\s*-\s+\[[ xX]\]\s+)(.*)$/.exec(line)
  if (!match) throw new Error(`Line is not a markdown checkbox: ${line}`)
  const cleaned = match[2]!.replace(DURATION_SUFFIX_RE, '').trimEnd()
  if (typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0) {
    return `${match[1]}${cleaned}（${Math.round(minutes)} min）`
  }
  return `${match[1]}${cleaned}`
}

export function appendLineToSection(
  content: string,
  sectionTitle: string,
  newLine: string,
): string {
  const { lines, eol } = splitLines(content)
  const sec = findSection(lines, sectionTitle)
  if (!sec) {
    const next = [...lines]
    if (next.length > 0 && next[next.length - 1]?.trim() !== '') next.push('')
    next.push(`## ${sectionTitle}`, '', newLine, '')
    return joinLines(next, eol)
  }
  let insertAt = sec.endLine
  while (insertAt > sec.startLine && (lines[insertAt - 1] ?? '').trim() === '') {
    insertAt -= 1
  }
  if (insertAt === sec.startLine) {
    lines.splice(insertAt, 0, '', newLine)
  } else {
    lines.splice(insertAt, 0, newLine)
  }
  return joinLines(lines, eol)
}

export function replaceSectionBody(
  content: string,
  sectionTitle: string,
  bodyLines: string[],
  aliases?: readonly string[],
): string {
  const { lines, eol } = splitLines(content)
  const sec = aliases
    ? findAnySection(lines, [sectionTitle, ...aliases])
    : findSection(lines, sectionTitle)
  if (!sec) {
    const next = [...lines]
    if (next.length > 0 && next[next.length - 1]?.trim() !== '') next.push('')
    next.push(`## ${sectionTitle}`, '', ...bodyLines, '')
    return joinLines(next, eol)
  }
  lines.splice(sec.startLine, sec.endLine - sec.startLine, '', ...bodyLines, '')
  return joinLines(lines, eol)
}

export function resolveVaultPath(vaultRoot: string, relPath: string): {
  absPath: string
  normalizedRel: string
} {
  if (!relPath || typeof relPath !== 'string') throw new Error('Path is required')
  if (isAbsolute(relPath)) throw new Error(`Path must be relative to vault: ${relPath}`)
  const cleaned = relPath.replace(/\\/g, '/').replace(/^\/+/, '')
  const rootAbs = resolve(vaultRoot)
  const targetAbs = resolve(rootAbs, cleaned)
  const rel = relative(rootAbs, targetAbs)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Path escapes outside vault: ${relPath}`)
  }
  const normalizedRel = normalize(rel).replace(/\\/g, '/')
  const firstSegment = normalizedRel.split('/')[0] ?? ''
  if (firstSegment === '.agent' || firstSegment === '.git') {
    throw new Error(`Forbidden path inside vault: ${normalizedRel}`)
  }
  return { absPath: targetAbs, normalizedRel }
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatLocalTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export function formatIsoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

export function isoWeekDateRange(weekStr: string): { start: string; end: string } {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekStr)
  if (!match) {
    const today = formatLocalDate(new Date())
    return { start: today, end: today }
  }
  const year = Number(match[1])
  const week = Number(match[2])
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Dow = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4.getTime() - (jan4Dow - 1) * 86_400_000)
  const startDt = new Date(week1Monday.getTime() + (week - 1) * 7 * 86_400_000)
  const endDt = new Date(startDt.getTime() + 6 * 86_400_000)
  return {
    start: startDt.toISOString().slice(0, 10),
    end: endDt.toISOString().slice(0, 10),
  }
}

export function diffDays(olderYmd: string, newerYmd: string): number | null {
  const a = Date.parse(`${olderYmd}T00:00:00Z`)
  const b = Date.parse(`${newerYmd}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.max(0, Math.round((b - a) / 86_400_000))
}
