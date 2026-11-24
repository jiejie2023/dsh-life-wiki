import type { TaskItem, TaskPriority } from './types.ts'

export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

export const PRIORITY_PREFIX_RE =
  /^\s*(?:\[\s*(高|中|低|P1|P2|P3)\s*\]|【\s*(高|中|低)\s*】)\s*/i

export const DURATION_SUFFIX_RE =
  /\s*[（(]\s*\d+(?:\.\d+)?\s*(分钟|分|min|小时|h)\s*[）)]\s*$/i

export function normalizePriority(p: unknown): TaskPriority {
  return p === 'high' || p === 'low' ? p : 'medium'
}

export function priorityToLabel(priority: TaskPriority): '高' | '中' | '低' {
  return priority === 'high' ? '高' : priority === 'low' ? '低' : '中'
}

export function parseTaskPriority(text: string): TaskPriority {
  const match = PRIORITY_PREFIX_RE.exec(text)
  const token = (match?.[1] ?? match?.[2] ?? '').toUpperCase()
  if (token === '高' || token === 'P1') return 'high'
  if (token === '低' || token === 'P3') return 'low'
  return 'medium'
}

export function stripTaskPriority(text: string): string {
  return text.replace(PRIORITY_PREFIX_RE, '').trimStart()
}

export function parseTaskDuration(text: string): number | null {
  const match = /[（(]\s*(\d+(?:\.\d+)?)\s*(分钟|分|min|小时|h)\s*[）)]/i.exec(text)
  if (!match) return null
  const num = Number(match[1])
  if (!Number.isFinite(num)) return null
  const unit = match[2]!.toLowerCase()
  return unit === '小时' || unit === 'h' ? Math.round(num * 60) : Math.round(num)
}

export function parseFromDate(text: string): string | null {
  const match = /[（(]\s*来自\s*(\d{2}-\d{2})\s*[）)]/.exec(text)
  return match ? match[1]! : null
}

export function cleanTaskDisplayText(text: string, hasMinutes: boolean): string {
  let out = text.replace(PRIORITY_PREFIX_RE, '')
  if (hasMinutes) {
    out = out.replace(DURATION_SUFFIX_RE, '').trimEnd()
  }
  return out
}

/**
 * Rebuilds the body of a markdown task line after inline editing while preserving
 * existing priority prefix and trailing duration suffix unless explicitly provided.
 */
export function mergeEditedTaskBody(origBody: string, nextText: string): string {
  const cleanedInput = nextText.replace(/\r?\n/g, ' ').trim()
  if (!cleanedInput || !stripTaskPriority(cleanedInput).trim()) {
    throw new Error('任务内容不能为空')
  }

  const origPrioMatch = PRIORITY_PREFIX_RE.exec(origBody)
  const origDurationMatch = DURATION_SUFFIX_RE.exec(origBody)

  const inputHasPrio = PRIORITY_PREFIX_RE.test(cleanedInput)
  const inputHasDuration = DURATION_SUFFIX_RE.test(cleanedInput)

  const prioPrefix = inputHasPrio
    ? ''
    : origPrioMatch
      ? `[${priorityToLabel(parseTaskPriority(origBody))}] `
      : ''
  const durationSuffix = inputHasDuration
    ? ''
    : origDurationMatch
      ? origDurationMatch[0]!.trimEnd()
      : ''

  return `${prioPrefix}${cleanedInput}${durationSuffix}`
}

/**
 * Applies an inline text edit optimistically to a TaskItem, mirroring server-side parsing.
 */
export function applyOptimisticTaskTextEdit(task: TaskItem, nextText: string): TaskItem {
  const merged = mergeEditedTaskBody(task.text, nextText)
  const prefixMatch = /^(\s*-\s+\[[ xX]\]\s+)/.exec(task.rawLine)
  const prefix = prefixMatch ? prefixMatch[1]! : `- [${task.checked ? 'x' : ' '}] `
  return {
    ...task,
    text: merged,
    priority: parseTaskPriority(merged),
    minutes: parseTaskDuration(merged),
    fromDate: parseFromDate(merged),
    rawLine: `${prefix}${merged}`,
  }
}

/**
 * Sorts tasks with unchecked items first, then by priority (high > medium > low),
 * then by original file line order.
 */
export function sortTasks(tasks: readonly TaskItem[]): TaskItem[] {
  return [...tasks].sort(
    (a, b) =>
      Number(a.checked) - Number(b.checked) ||
      PRIORITY_ORDER[normalizePriority(a.priority)] -
        PRIORITY_ORDER[normalizePriority(b.priority)] ||
      a.lineIndex - b.lineIndex,
  )
}
