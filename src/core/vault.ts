import { execFile } from 'node:child_process'
import {
  access,
  mkdir,
  readdir,
  readFile,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import type {
  BoardSnapshot,
  CommitResult,
  DiaryEntrySummary,
  FormatWarning,
  IdeaSummary,
  ProjectCard,
  ProjectStatus,
  ProjectTaskGroup,
  RawEntrySummary,
  ReviewStatus,
  ReviewSummary,
  TaskFileStatus,
  TaskFileSummary,
  TaskPriority,
  WeekProjectMetrics,
  WikiPageSummary,
} from '../shared/types.ts'
import {
  appendLineToSection,
  diffDays,
  findSection,
  formatIsoWeek,
  formatLocalDate,
  formatLocalTime,
  getSectionText,
  isoWeekDateRange,
  joinLines,
  parseFrontmatter,
  parseFrontmatterList,
  parseInbox,
  parsePlanItems,
  parseProjectStatus,
  parseReviewStatus,
  parseTaskFile,
  priorityToLabel,
  replaceSectionBody,
  resolveVaultPath,
  setCheckboxMinutes,
  setCheckboxPriority,
  splitLines,
  stripTaskPriority,
  toggleCheckboxLine,
  updateFrontmatterFields,
} from './markdown.ts'
import { DEFAULT_AREAS, hasSampleDataMarker } from './scaffold.ts'

const execFileAsync = promisify(execFile)

const RESERVED_PROJECT_DIRS = new Set(['00_ideas', '99_archives'])
const DATE_FILE_RE = /^(\d{4}-\d{2}-\d{2})\.md$/
const DATE_DIR_RE = /^(\d{4}-\d{2}-\d{2})$/
const WEEK_FILE_RE = /^(\d{4}-W\d{2})\.md$/
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'])

const STATUS_SORT_ORDER: Record<ProjectStatus, number> = {
  doing: 0,
  todo: 1,
  pause: 2,
  idea: 3,
  done: 4,
  cancel: 5,
}

export interface LifeWikiEngineOptions {
  now?: () => Date
}

export interface LifeWikiEngine {
  readonly rootDir: string
  getSnapshot(dateStr?: string, weekStr?: string): Promise<BoardSnapshot>
  readFile(relPath: string): Promise<{ relPath: string; content: string }>
  writeFile(relPath: string, content: string): Promise<void>
  readBinaryFile(relPath: string): Promise<{ buffer: Buffer; mime: string }>
  createTaskFile(projectName: string, dateStr?: string): Promise<string>
  toggleTask(relPath: string, lineIndex: number, minutes?: number): Promise<void>
  setTaskMinutes(relPath: string, lineIndex: number, minutes: number | null): Promise<void>
  setTaskPriority(relPath: string, lineIndex: number, priority: TaskPriority): Promise<void>
  addTask(
    projectName: string,
    text: string,
    dateStr?: string,
    priority?: TaskPriority,
  ): Promise<string>
  updateTaskFileStatus(relPath: string, status: TaskFileStatus): Promise<void>
  appendTaskEntry(relPath: string, section: 'log' | 'reflection', text: string): Promise<void>
  createIdea(title: string, ideaText: string): Promise<string>
  promoteIdeaToProject(
    ideaName: string,
    opts: { area: string; created?: string; deadline?: string; timeframe?: string; goal?: string },
  ): Promise<string>
  cancelIdea(ideaName: string, reason?: string): Promise<string>
  createProject(opts: {
    name: string
    area: string
    created?: string
    deadline?: string
    timeframe?: string
    idea?: string
    goal?: string
  }): Promise<string>
  archiveProject(projectName: string, finalStatus: 'done' | 'cancel'): Promise<string>
  restoreProject(projectName: string): Promise<string>
  updateProjectMeta(
    projectName: string,
    patch: {
      status?: ProjectStatus
      area?: string
      created?: string
      deadline?: string
      timeframe?: string
      goal?: string
    },
  ): Promise<void>
  togglePlanItem(projectName: string, lineIndex: number): Promise<void>
  addPlanItem(projectName: string, text: string): Promise<void>
  addInboxItem(text: string, dateStr?: string): Promise<void>
  toggleInboxItem(lineIndex: number): Promise<void>
  deleteInboxItem(lineIndex: number): Promise<void>
  inboxToIdea(lineIndex: number, titleOverride?: string): Promise<string>
  inboxToTask(lineIndex: number, projectName: string, dateStr?: string): Promise<string>
  generateWeeklyReviewDraft(projectName: string, weekStr?: string): Promise<string>
  updateReview(
    relPath: string,
    patch: { nextWeek?: string[]; status?: ReviewStatus },
  ): Promise<void>
  appendDiary(text: string, dateStr?: string, timeStr?: string): Promise<string>
  createWikiPage(title: string, body: string, sources?: string[]): Promise<string>
  updateAreas(areas: string[]): Promise<string[]>
  commitSnapshot(message?: string): Promise<CommitResult>
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function readUtf8IfExists(p: string): Promise<string | null> {
  try {
    return await readFile(p, 'utf8')
  } catch {
    return null
  }
}

function sanitizeSegment(name: string): string {
  const cleaned = name.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new Error(`非法名称：${name}`)
  }
  return cleaned
}

function mimeForExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.svg':
      return 'image/svg+xml'
    default:
      return 'application/octet-stream'
  }
}

async function readAreas(rootDir: string): Promise<string[]> {
  const schema = await readUtf8IfExists(join(rootDir, 'system', 'schema.md'))
  if (!schema) return [...DEFAULT_AREAS]
  const { lines } = splitLines(schema)
  const idx = lines.findIndex((l) => l.trim().startsWith('领域清单'))
  if (idx === -1) return [...DEFAULT_AREAS]
  const areas: string[] = []
  for (let i = idx + 1; i < lines.length; i += 1) {
    const line = (lines[i] ?? '').trim()
    if (!line) {
      if (areas.length > 0) break
      continue
    }
    const m = /^-\s+(.+)$/.exec(line)
    if (!m) break
    areas.push(m[1]!.trim())
  }
  return areas.length > 0 ? areas : [...DEFAULT_AREAS]
}

async function scanAllDiaries(rootDir: string): Promise<DiaryEntrySummary[]> {
  const diaryDir = join(rootDir, 'raw', 'me', 'diary')
  if (!(await exists(diaryDir))) return []
  const entries = await readdir(diaryDir, { withFileTypes: true })
  const byDate = new Map<string, DiaryEntrySummary>()

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const m = DATE_DIR_RE.exec(entry.name)
      if (!m) continue
      const date = m[1]!
      const folderAbs = join(diaryDir, entry.name)
      const files = await readdir(folderAbs)
      const images = files
        .filter((f) => IMAGE_EXTS.has(extname(f).toLowerCase()))
        .sort()
        .map((f) => `raw/me/diary/${date}/${f}`)
      const mdFile = files.includes('日记.md')
        ? '日记.md'
        : files.find((f) => f.endsWith('.md'))
      const relPath = `raw/me/diary/${date}/${mdFile ?? '日记.md'}`
      const content = (await readUtf8IfExists(join(rootDir, relPath))) ?? ''
      byDate.set(date, summarizeDiary(date, relPath, true, content, images))
    } else {
      const m = DATE_FILE_RE.exec(entry.name)
      if (!m) continue
      const date = m[1]!
      if (byDate.has(date)) continue
      const relPath = `raw/me/diary/${entry.name}`
      const content = (await readUtf8IfExists(join(rootDir, relPath))) ?? ''
      byDate.set(date, summarizeDiary(date, relPath, false, content, []))
    }
  }

  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date))
}

function summarizeDiary(
  date: string,
  relPath: string,
  isFolder: boolean,
  content: string,
  images: string[],
): DiaryEntrySummary {
  const fm = parseFrontmatter(content)
  const bodyLines = fm.lines.slice(fm.bodyStartLine)
  const timeHeadings = bodyLines.filter((l) => /^##\s+\d{1,2}:\d{2}/.test(l.trim()))
  const plainLines = bodyLines
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('## ') && !l.startsWith('!['))
  const entryCount = timeHeadings.length > 0 ? timeHeadings.length : plainLines.length > 0 ? 1 : 0
  const preview = plainLines.slice(-2).join(' ').slice(0, 160)
  return {
    date,
    month: date.slice(0, 7),
    exists: true,
    relPath,
    isFolder,
    preview,
    content,
    entryCount,
    images,
  }
}

async function readReviewFile(
  rootDir: string,
  projectName: string,
  week: string,
  relPath: string,
): Promise<ReviewSummary> {
  const content = (await readUtf8IfExists(join(rootDir, relPath))) ?? ''
  const fm = parseFrontmatter(content)
  const status = parseReviewStatus(fm.fields.status)

  const thisWeekSec = findSection(fm.lines, '本周')
  const summaryLines: string[] = []
  let totalHoursText = ''
  if (thisWeekSec) {
    for (let i = thisWeekSec.startLine; i < thisWeekSec.endLine; i += 1) {
      const t = (fm.lines[i] ?? '').trim()
      if (!t) continue
      if (t.startsWith('本周投入')) totalHoursText = t
      else summaryLines.push(t)
    }
  }

  const nextSec = findSection(fm.lines, '下周')
  const nextWeekItems: string[] = []
  if (nextSec) {
    for (let i = nextSec.startLine; i < nextSec.endLine; i += 1) {
      const t = (fm.lines[i] ?? '').trim()
      if (!t) continue
      const stripped = t.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').trim()
      if (stripped) nextWeekItems.push(stripped)
    }
  }

  return {
    projectName,
    week,
    relPath,
    status,
    summaryLines: summaryLines.slice(0, 10),
    totalHoursText,
    nextWeekItems,
  }
}

async function scanWikiPages(rootDir: string): Promise<WikiPageSummary[]> {
  const wikiDir = join(rootDir, 'wiki')
  if (!(await exists(wikiDir))) return []
  const files = (await readdir(wikiDir))
    .filter((f) => f.endsWith('.md') && f !== 'index.md' && f !== 'log.md')
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))

  const pages: WikiPageSummary[] = []
  for (const file of files) {
    const relPath = `wiki/${file}`
    const content = (await readUtf8IfExists(join(rootDir, relPath))) ?? ''
    const fm = parseFrontmatter(content)
    const sources = parseFrontmatterList(content, 'sources')
    const bodyLines = fm.lines
      .slice(fm.bodyStartLine)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('>'))
    pages.push({
      title: fm.fields.title || file.replace(/\.md$/i, ''),
      relPath,
      updated: fm.fields.updated || '',
      sources,
      excerpt: bodyLines.slice(0, 2).join(' ').slice(0, 150),
    })
  }
  return pages
}

async function scanRawEntries(rootDir: string): Promise<RawEntrySummary[]> {
  const rawDir = join(rootDir, 'raw')
  if (!(await exists(rawDir))) return []
  const top = await readdir(rawDir, { withFileTypes: true })
  const results: RawEntrySummary[] = []

  for (const entry of top) {
    if (entry.name === '.gitkeep') continue
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const relPath = `raw/${entry.name}`
      const content = (await readUtf8IfExists(join(rootDir, relPath))) ?? ''
      const fm = parseFrontmatter(content)
      results.push({
        name: entry.name.replace(/\.md$/i, ''),
        kind: 'file',
        relPath,
        openRelPath: relPath,
        sourceUrl: fm.fields.source || '',
        fetched: fm.fields.fetched || '',
        tier: null,
        category: '单文件',
      })
      continue
    }
    if (!entry.isDirectory()) continue

    // Skip diary inside raw/me/ (diary has its own top-level tab!)
    if (entry.name === 'me') {
      const meFiles = await readdir(join(rawDir, 'me'), { withFileTypes: true })
      for (const item of meFiles) {
        if (item.name === 'diary' || item.name === '.gitkeep') continue
        if (item.isFile() && item.name.endsWith('.md')) {
          const relPath = `raw/me/${item.name}`
          results.push({
            name: item.name.replace(/\.md$/i, ''),
            kind: 'file',
            relPath,
            openRelPath: relPath,
            sourceUrl: '',
            fetched: item.name.slice(0, 10),
            tier: null,
            category: '个人口述',
          })
        } else if (item.isDirectory()) {
          const relPath = `raw/me/${item.name}`
          const sourceRel = `${relPath}/SOURCE.md`
          results.push({
            name: item.name,
            kind: 'folder',
            relPath,
            openRelPath: (await exists(join(rootDir, sourceRel))) ? sourceRel : relPath,
            sourceUrl: '',
            fetched: '',
            tier: null,
            category: '旧笔记导入',
          })
        }
      }
      continue
    }

    // Group containers: web/ and x/
    if (entry.name === 'web' || entry.name === 'x') {
      const groupDir = join(rawDir, entry.name)
      const subs = await readdir(groupDir, { withFileTypes: true })
      for (const sub of subs) {
        if (!sub.isDirectory()) continue
        const subFiles = await readdir(join(groupDir, sub.name))
        const mdFile = subFiles.find((f) => f.endsWith('.md') && f !== 'SOURCE.md')
        const sourceMd = subFiles.includes('SOURCE.md') ? 'SOURCE.md' : null
        const targetFile = mdFile ?? sourceMd
        if (!targetFile) continue
        const openRelPath = `raw/${entry.name}/${sub.name}/${targetFile}`
        const content = (await readUtf8IfExists(join(rootDir, openRelPath))) ?? ''
        const fm = parseFrontmatter(content)
        results.push({
          name: `${sub.name}${subFiles.length > 1 ? ` (${subFiles.length})` : ''}`,
          kind: 'file',
          relPath: `raw/${entry.name}/${sub.name}`,
          openRelPath,
          sourceUrl: fm.fields.source || '',
          fetched: fm.fields.fetched || '',
          tier: null,
          category: entry.name === 'web' ? '网页原件' : 'X 帖文',
        })
      }
      continue
    }

    // GitHub repository / directory snapshot
    const repoDir = join(rawDir, entry.name)
    const files = await readdir(repoDir)
    const sourcePath = join(repoDir, 'SOURCE.md')
    const sourceContent = (await readUtf8IfExists(sourcePath)) ?? ''
    const urlMatch = /-\s*原始地址[：:]\s*(\S+)/.exec(sourceContent)
    const dateMatch = /-\s*获取日期[：:]\s*(\S+)/.exec(sourceContent)
    const hasZip = files.includes('repository.zip')
    const hasForkOrLocal = /Fork|D:\\Software/i.test(sourceContent)
    const tier: 'L1' | 'L2' | 'L3' = hasForkOrLocal ? 'L3' : hasZip ? 'L2' : 'L1'
    const readmeFile =
      files.find((f) => /^readme\.zh/i.test(f) || /^readme_cn/i.test(f)) ??
      files.find((f) => /^readme\.md$/i.test(f)) ??
      (files.includes('SOURCE.md') ? 'SOURCE.md' : files[0])

    if (readmeFile) {
      results.push({
        name: entry.name,
        kind: 'repo',
        relPath: `raw/${entry.name}`,
        openRelPath: `raw/${entry.name}/${readmeFile}`,
        sourceUrl: urlMatch && urlMatch[1] !== '—' ? urlMatch[1]! : '',
        fetched: dateMatch && dateMatch[1] !== '—' ? dateMatch[1]! : '',
        tier,
        category: '代码仓库',
      })
    }
  }

  return results.sort((a, b) => a.category.localeCompare(b.category, 'zh-CN') || a.name.localeCompare(b.name, 'zh-CN'))
}

async function readGitStatus(rootDir: string): Promise<{ isRepo: boolean; dirtyCount: number }> {
  if (!(await exists(join(rootDir, '.git')))) return { isRepo: false, dirtyCount: 0 }
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], {
      cwd: rootDir,
      windowsHide: true,
    })
    const lines = stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    return { isRepo: true, dirtyCount: lines.length }
  } catch {
    return { isRepo: true, dirtyCount: 0 }
  }
}

export function createLifeWikiEngine(
  rootDirInput: string,
  options: LifeWikiEngineOptions = {},
): LifeWikiEngine {
  const rootDir = resolve(rootDirInput)
  const now = options.now ?? (() => new Date())

  async function readVaultFile(relPath: string): Promise<{ relPath: string; content: string }> {
    const { absPath, normalizedRel } = resolveVaultPath(rootDir, relPath)
    const content = await readFile(absPath, 'utf8')
    return { relPath: normalizedRel, content }
  }

  async function writeVaultFile(relPath: string, content: string): Promise<void> {
    const { absPath } = resolveVaultPath(rootDir, relPath)
    await mkdir(dirname(absPath), { recursive: true })
    await writeFile(absPath, content, 'utf8')
  }

  async function readBinaryFile(relPath: string): Promise<{ buffer: Buffer; mime: string }> {
    const { absPath } = resolveVaultPath(rootDir, relPath)
    const buffer = await readFile(absPath)
    return { buffer, mime: mimeForExt(extname(absPath)) }
  }

  async function createTaskFile(projectName: string, dateStr?: string): Promise<string> {
    const safeProject = sanitizeSegment(projectName)
    const date = dateStr ?? formatLocalDate(now())
    const relPath = `projects/${safeProject}/01_tasks/${date}.md`
    const { absPath } = resolveVaultPath(rootDir, relPath)
    if (!(await exists(absPath))) {
      await writeVaultFile(
        relPath,
        ['---', 'status: todo', '---', '', '## 任务', '', '## 日志', '', '## 反思', ''].join('\n'),
      )
    }
    return relPath
  }

  async function scaffoldProjectSubdirs(projectName: string, decisionLine: string): Promise<void> {
    const current = now()
    const today = formatLocalDate(current)
    const week = formatIsoWeek(current)
    const base = `projects/${projectName}`

    await mkdir(join(rootDir, base, '01_tasks'), { recursive: true })
    await mkdir(join(rootDir, base, '02_resources'), { recursive: true })
    await mkdir(join(rootDir, base, '03_reviews'), { recursive: true })
    await mkdir(join(rootDir, base, '04_outputs'), { recursive: true })

    const taskRel = `${base}/01_tasks/${today}.md`
    if (!(await exists(join(rootDir, taskRel)))) {
      await writeVaultFile(
        taskRel,
        [
          '---',
          'status: doing',
          '---',
          '',
          '## 任务',
          '',
          '## 日志',
          '',
          `- 决定：${decisionLine}`,
          '',
          '## 反思',
          '',
        ].join('\n'),
      )
    }

    const resRel = `${base}/02_resources/resources.md`
    if (!(await exists(join(rootDir, resRel)))) {
      await writeVaultFile(resRel, '# 资料登记\n\n')
    }

    const revRel = `${base}/03_reviews/${week}.md`
    if (!(await exists(join(rootDir, revRel)))) {
      await writeVaultFile(
        revRel,
        [
          '---',
          'status: draft',
          '---',
          '',
          '## 本周',
          '',
          '本周投入：0 小时',
          '',
          '## 原因',
          '',
          '## 经验',
          '',
          '## 下周',
          '',
          '1. ',
          '',
        ].join('\n'),
      )
    }

    const outRel = `${base}/04_outputs/outputs.md`
    if (!(await exists(join(rootDir, outRel)))) {
      await writeVaultFile(outRel, '# 交付物登记\n\n')
    }
  }

  async function scanProjectFolder(
    baseRel: string,
    projectName: string,
    archived: boolean,
    dateStr: string,
    selectedWeek: string,
    weekRange: { start: string; end: string },
    formatWarnings: FormatWarning[],
    todayGroups: ProjectTaskGroup[],
    draftReviews: ReviewSummary[],
    availableWeeksSet: Set<string>,
    weekMetrics: WeekProjectMetrics[],
  ): Promise<ProjectCard | null> {
    const homepageRelPath = `${baseRel}/${projectName}.md`
    const homepageContent = await readUtf8IfExists(join(rootDir, homepageRelPath))
    if (homepageContent === null) return null

    const fm = parseFrontmatter(homepageContent)
    const status = parseProjectStatus(fm.fields.status)
    const area = fm.fields.area ?? ''
    const created = fm.fields.created ?? fm.fields.start ?? ''
    const deadline = fm.fields.deadline ?? ''
    const timeframe = fm.fields.timeframe ?? ''
    const idea = getSectionText(fm.lines, '想法')
    const goal = getSectionText(fm.lines, '目标')
    const plan = parsePlanItems(fm.lines)
    const nextStep = plan.find((p) => !p.checked)?.text ?? null

    // Scan 01_tasks/
    const tasksDirRel = `${baseRel}/01_tasks`
    const tasksDirAbs = join(rootDir, tasksDirRel)
    const taskFiles: TaskFileSummary[] = []
    let todayParsed: ReturnType<typeof parseTaskFile> | null = null
    let todayExists = false
    let weekDone = 0
    let weekTotal = 0
    let weekMinutes = 0

    if (await exists(tasksDirAbs)) {
      const files = await readdir(tasksDirAbs)
      const dateFiles = files
        .map((name) => ({ name, match: DATE_FILE_RE.exec(name) }))
        .filter((x): x is { name: string; match: RegExpExecArray } => x.match !== null)
        .sort((a, b) => b.name.localeCompare(a.name))

      for (const item of dateFiles) {
        const fileDate = item.match[1]!
        const fileRelPath = `${tasksDirRel}/${item.name}`
        const raw = (await readUtf8IfExists(join(rootDir, fileRelPath))) ?? ''
        const parsed = parseTaskFile(raw)

        if (!archived && !parsed.valid) {
          formatWarnings.push({
            projectName,
            date: fileDate,
            fileRelPath,
            issues: parsed.formatIssues,
          })
        }

        if (!archived && fileDate === dateStr) {
          todayExists = true
          todayParsed = parsed
        }

        if (!archived && fileDate >= weekRange.start && fileDate <= weekRange.end) {
          weekDone += parsed.tasks.filter((t) => t.checked).length
          weekTotal += parsed.tasks.length
          weekMinutes += parsed.totalMinutes
        }

        taskFiles.push({
          date: fileDate,
          relPath: fileRelPath,
          status: parsed.status,
          valid: parsed.valid,
          formatIssues: parsed.formatIssues,
          doneCount: parsed.tasks.filter((t) => t.checked).length,
          totalCount: parsed.tasks.length,
          totalMinutes: parsed.totalMinutes,
        })
      }
    }

    // Scan 03_reviews/
    const reviewsDirRel = `${baseRel}/03_reviews`
    const reviewsDirAbs = join(rootDir, reviewsDirRel)
    const reviewFiles: ReviewSummary[] = []
    let selectedWeekReview: ReviewSummary | null = null
    if (await exists(reviewsDirAbs)) {
      const files = await readdir(reviewsDirAbs)
      const weekFiles = files
        .map((name) => ({ name, match: WEEK_FILE_RE.exec(name) }))
        .filter((x): x is { name: string; match: RegExpExecArray } => x.match !== null)
        .sort((a, b) => b.name.localeCompare(a.name))

      for (const item of weekFiles) {
        const week = item.match[1]!
        availableWeeksSet.add(week)
        const fileRelPath = `${reviewsDirRel}/${item.name}`
        const review = await readReviewFile(rootDir, projectName, week, fileRelPath)
        reviewFiles.push(review)
        if (week === selectedWeek) selectedWeekReview = review
        if (!archived && review.status === 'draft') {
          draftReviews.push(review)
        }
      }
    }

    if (!archived && (status === 'doing' || status === 'todo' || todayExists)) {
      todayGroups.push({
        projectName,
        projectStatus: status,
        area,
        fileRelPath: `${baseRel}/01_tasks/${dateStr}.md`,
        exists: todayExists,
        status: todayParsed?.status ?? null,
        valid: todayExists ? (todayParsed?.valid ?? false) : true,
        formatIssues: todayParsed?.formatIssues ?? [],
        tasks: todayParsed?.tasks ?? [],
        logs: todayParsed?.logs ?? [],
        reflections: todayParsed?.reflections ?? [],
        totalMinutes: todayParsed?.totalMinutes ?? 0,
      })
    }

    if (!archived && (status === 'doing' || weekTotal > 0 || selectedWeekReview !== null)) {
      weekMetrics.push({
        projectName,
        doneTasks: weekDone,
        totalTasks: weekTotal,
        totalMinutes: weekMinutes,
        review: selectedWeekReview,
      })
    }

    const latestTaskDate = taskFiles[0]?.date ?? null
    const staleDays = latestTaskDate ? diffDays(latestTaskDate, dateStr) : null
    const latestReview = reviewFiles[0] ?? null

    return {
      name: projectName,
      archived,
      homepageRelPath,
      status,
      area,
      created,
      deadline,
      timeframe,
      idea,
      goal,
      plan,
      nextStep,
      latestTaskDate,
      staleDays,
      latestReviewRelPath: latestReview?.relPath ?? null,
      latestReviewStatus: latestReview?.status ?? null,
      resourcesRelPath: `${baseRel}/02_resources/resources.md`,
      outputsRelPath: `${baseRel}/04_outputs/outputs.md`,
      taskFiles: taskFiles.slice(0, 14),
      reviewFiles: reviewFiles.slice(0, 10),
    }
  }

  async function getSnapshot(dateStrInput?: string, weekStrInput?: string): Promise<BoardSnapshot> {
    const current = now()
    const dateStr = dateStrInput ?? formatLocalDate(current)
    const weekStr = weekStrInput ?? formatIsoWeek(new Date(`${dateStr}T00:00:00`))
    const weekRange = isoWeekDateRange(weekStr)

    const [areas, hasSampleData, diaries, wikiPages, rawEntries, git] = await Promise.all([
      readAreas(rootDir),
      hasSampleDataMarker(rootDir),
      scanAllDiaries(rootDir),
      scanWikiPages(rootDir),
      scanRawEntries(rootDir),
      readGitStatus(rootDir),
    ])

    const todayDiary: DiaryEntrySummary = diaries.find((d) => d.date === dateStr) ?? {
      date: dateStr,
      month: dateStr.slice(0, 7),
      exists: false,
      relPath: `raw/me/diary/${dateStr}.md`,
      isFolder: false,
      preview: '',
      content: '',
      entryCount: 0,
      images: [],
    }

    const projects: ProjectCard[] = []
    const archivedProjects: ProjectCard[] = []
    const todayGroups: ProjectTaskGroup[] = []
    const formatWarnings: FormatWarning[] = []
    const draftReviews: ReviewSummary[] = []
    const weekMetrics: WeekProjectMetrics[] = []
    const availableWeeksSet = new Set<string>([weekStr])

    const projectsDir = join(rootDir, 'projects')
    if (await exists(projectsDir)) {
      const entries = await readdir(projectsDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory() || RESERVED_PROJECT_DIRS.has(entry.name)) continue
        const card = await scanProjectFolder(
          `projects/${entry.name}`,
          entry.name,
          false,
          dateStr,
          weekStr,
          weekRange,
          formatWarnings,
          todayGroups,
          draftReviews,
          availableWeeksSet,
          weekMetrics,
        )
        if (card) projects.push(card)
      }
    }

    const archivesDir = join(rootDir, 'projects', '99_archives')
    if (await exists(archivesDir)) {
      const entries = await readdir(archivesDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const card = await scanProjectFolder(
          `projects/99_archives/${entry.name}`,
          entry.name,
          true,
          dateStr,
          weekStr,
          weekRange,
          formatWarnings,
          todayGroups,
          draftReviews,
          availableWeeksSet,
          weekMetrics,
        )
        if (card) archivedProjects.push(card)
      }
    }

    projects.sort(
      (a, b) =>
        STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status] ||
        a.name.localeCompare(b.name, 'zh-CN'),
    )
    archivedProjects.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    todayGroups.sort((a, b) => {
      if (a.exists !== b.exists) return a.exists ? -1 : 1
      return (
        STATUS_SORT_ORDER[a.projectStatus] - STATUS_SORT_ORDER[b.projectStatus] ||
        a.projectName.localeCompare(b.projectName, 'zh-CN')
      )
    })
    formatWarnings.sort((a, b) => b.date.localeCompare(a.date))

    // Inbox
    const inboxContent = (await readUtf8IfExists(join(rootDir, 'inbox.md'))) ?? ''
    const inbox = parseInbox(inboxContent)

    // Ideas (00_ideas)
    const ideasDir = join(rootDir, 'projects', '00_ideas')
    const ideas: IdeaSummary[] = []
    if (await exists(ideasDir)) {
      const ideaFiles = (await readdir(ideasDir))
        .filter((f) => f.endsWith('.md'))
        .sort((a, b) => a.localeCompare(b, 'zh-CN'))
      for (const file of ideaFiles) {
        const relPath = `projects/00_ideas/${file}`
        const raw = (await readUtf8IfExists(join(rootDir, relPath))) ?? ''
        const fm = parseFrontmatter(raw)
        const motivation = getSectionText(fm.lines, '动机')
        const changeMatch = /\*\*做完能带来什么真实变化[：:]\*\*\s*(.+)/.exec(motivation)
        ideas.push({
          name: file.replace(/\.md$/i, ''),
          relPath,
          status: parseProjectStatus(fm.fields.status ?? 'idea'),
          idea: getSectionText(fm.lines, '想法'),
          judgment: getSectionText(fm.lines, '判断'),
          motivationChange: changeMatch ? changeMatch[1]!.trim() : '',
        })
      }
    }

    const weekDiaries = diaries.filter(
      (d) => d.date >= weekRange.start && d.date <= weekRange.end,
    )
    const availableWeeks = [...availableWeeksSet].sort((a, b) => b.localeCompare(a))

    return {
      date: dateStr,
      week: weekStr,
      vaultRoot: rootDir,
      vaultName: basename(rootDir) || rootDir,
      areas,
      hasSampleData,
      today: {
        diary: todayDiary,
        groups: todayGroups,
        formatWarnings,
      },
      projects,
      archivedProjects,
      ideas,
      inbox: {
        relPath: 'inbox.md',
        items: inbox.items,
        proposals: inbox.proposals,
      },
      diaries,
      reviewCenter: {
        week: weekStr,
        weekRange,
        availableWeeks,
        projectMetrics: weekMetrics,
        weekDiaries,
        draftReviews,
      },
      knowledge: {
        wikiPages,
        rawEntries,
      },
      git,
    }
  }

  async function createIdea(title: string, ideaText: string): Promise<string> {
    const safeTitle = sanitizeSegment(title.replace(/\.md$/i, ''))
    const relPath = `projects/00_ideas/${safeTitle}.md`
    const { absPath } = resolveVaultPath(rootDir, relPath)
    if (await exists(absPath)) throw new Error(`想法已存在：${safeTitle}`)
    const date = formatLocalDate(now())
    await writeVaultFile(
      relPath,
      [
        '---',
        'status: idea',
        'area: ',
        `created: ${date}`,
        'deadline: ',
        '---',
        '',
        '## 想法',
        '',
        ideaText.trim() || safeTitle,
        '',
        '## 动机',
        '',
        '**为什么想做：** ',
        '**不做会怎样：** ',
        '**要付出什么：** ',
        '**做完能带来什么真实变化：** ',
        '',
        '## 认知',
        '',
        '',
        '## 判断',
        '',
        `再想想：待补充动机与认知。（${date}）`,
        '',
        '## 目标',
        '',
        '## 计划',
        '',
        '## 总结',
        '',
        '**结果：** ',
        '**动机回看：** ',
        '**经验：** ',
        '',
      ].join('\n'),
    )
    return relPath
  }

  async function addTask(
    projectName: string,
    text: string,
    dateStr?: string,
    priority: TaskPriority = 'medium',
  ): Promise<string> {
    const cleaned = stripTaskPriority(text.trim())
    if (!cleaned) throw new Error('任务内容不能为空')
    const relPath = await createTaskFile(projectName, dateStr)
    const { content } = await readVaultFile(relPath)
    const updated = appendLineToSection(
      content,
      '任务',
      `- [ ] [${priorityToLabel(priority)}] ${cleaned}`,
    )
    await writeVaultFile(relPath, updated)
    return relPath
  }

  async function deleteInboxItem(lineIndex: number): Promise<void> {
    const { content } = await readVaultFile('inbox.md')
    const { lines, eol } = splitLines(content)
    if (lineIndex < 0 || lineIndex >= lines.length) {
      throw new Error(`Invalid inbox line index: ${lineIndex}`)
    }
    if (!/^\s*-\s+\[[ xX]\]\s+/.test(lines[lineIndex]!)) {
      throw new Error('Target line is not an inbox checklist item')
    }
    lines.splice(lineIndex, 1)
    await writeVaultFile('inbox.md', joinLines(lines, eol))
  }

  return {
    rootDir,
    getSnapshot,
    readFile: readVaultFile,
    writeFile: writeVaultFile,
    readBinaryFile,
    createTaskFile,
    createIdea,
    addTask,
    deleteInboxItem,

    async toggleTask(relPath, lineIndex, minutes) {
      const { content } = await readVaultFile(relPath)
      const { lines, eol } = splitLines(content)
      if (lineIndex < 0 || lineIndex >= lines.length) {
        throw new Error(`Invalid task line index: ${lineIndex}`)
      }
      lines[lineIndex] = toggleCheckboxLine(lines[lineIndex]!, minutes)
      await writeVaultFile(relPath, joinLines(lines, eol))
    },

    async setTaskMinutes(relPath, lineIndex, minutes) {
      const { content } = await readVaultFile(relPath)
      const { lines, eol } = splitLines(content)
      if (lineIndex < 0 || lineIndex >= lines.length) {
        throw new Error(`Invalid task line index: ${lineIndex}`)
      }
      lines[lineIndex] = setCheckboxMinutes(lines[lineIndex]!, minutes)
      await writeVaultFile(relPath, joinLines(lines, eol))
    },

    async setTaskPriority(relPath, lineIndex, priority) {
      const { content } = await readVaultFile(relPath)
      const { lines, eol } = splitLines(content)
      if (lineIndex < 0 || lineIndex >= lines.length) {
        throw new Error(`Invalid task line index: ${lineIndex}`)
      }
      lines[lineIndex] = setCheckboxPriority(lines[lineIndex]!, priority)
      await writeVaultFile(relPath, joinLines(lines, eol))
    },

    async updateTaskFileStatus(relPath, status) {
      const { content } = await readVaultFile(relPath)
      await writeVaultFile(relPath, updateFrontmatterFields(content, { status }))
    },

    async appendTaskEntry(relPath, section, text) {
      const cleaned = text.trim()
      if (!cleaned) throw new Error('内容不能为空')
      const { content } = await readVaultFile(relPath)
      const heading = section === 'log' ? '日志' : '反思'
      const line = cleaned.startsWith('- ') ? cleaned : `- ${cleaned}`
      await writeVaultFile(relPath, appendLineToSection(content, heading, line))
    },

    async promoteIdeaToProject(ideaName, opts) {
      const safe = sanitizeSegment(ideaName.replace(/\.md$/i, ''))
      const oldRel = `projects/00_ideas/${safe}.md`
      const newDirAbs = resolveVaultPath(rootDir, `projects/${safe}`).absPath
      if (await exists(newDirAbs)) throw new Error(`项目已存在：${safe}`)

      const { content: orig } = await readVaultFile(oldRel)
      const today = formatLocalDate(now())
      let updated = updateFrontmatterFields(orig, {
        status: 'doing',
        area: opts.area.trim(),
        created: (opts.created ?? today).trim(),
        deadline: (opts.deadline ?? '').trim(),
      })
      if (opts.goal?.trim()) {
        updated = replaceSectionBody(updated, '目标', [opts.goal.trim()])
      }
      const existingJudgment = getSectionText(splitLines(updated).lines, '判断')
      if (!existingJudgment.startsWith('做')) {
        updated = replaceSectionBody(updated, '判断', [`做：经评估正式立项。（${today}）`])
      }

      const newHomeRel = `projects/${safe}/${safe}.md`
      await mkdir(newDirAbs, { recursive: true })
      await writeVaultFile(newHomeRel, updated)
      const { absPath: oldAbs } = resolveVaultPath(rootDir, oldRel)
      const { rm } = await import('node:fs/promises')
      await rm(oldAbs, { force: true })

      await scaffoldProjectSubdirs(safe, `立项「${safe}」，从想法转为正式项目。`)
      return newHomeRel
    },

    async cancelIdea(ideaName, reason) {
      const safe = sanitizeSegment(ideaName.replace(/\.md$/i, ''))
      const oldRel = `projects/00_ideas/${safe}.md`
      const { content: orig } = await readVaultFile(oldRel)
      const today = formatLocalDate(now())
      let updated = updateFrontmatterFields(orig, { status: 'cancel' })
      updated = replaceSectionBody(updated, '判断', [
        `不做：${reason?.trim() || '经评估暂不值得投入'}。（${today}）`,
      ])
      const archiveRel = `projects/99_archives/${safe}.md`
      await writeVaultFile(archiveRel, updated)
      const { absPath: oldAbs } = resolveVaultPath(rootDir, oldRel)
      const { rm } = await import('node:fs/promises')
      await rm(oldAbs, { force: true })
      return archiveRel
    },

    async createProject(opts) {
      const safe = sanitizeSegment(opts.name)
      const dirAbs = resolveVaultPath(rootDir, `projects/${safe}`).absPath
      if (await exists(dirAbs)) throw new Error(`项目已存在：${safe}`)
      const today = formatLocalDate(now())
      const homeRel = `projects/${safe}/${safe}.md`
      await writeVaultFile(
        homeRel,
        [
          '---',
          'status: doing',
          `area: ${opts.area.trim()}`,
          `created: ${(opts.created ?? today).trim()}`,
          `deadline: ${(opts.deadline ?? '').trim()}`,
          '---',
          '',
          '## 想法',
          '',
          opts.idea?.trim() || safe,
          '',
          '## 动机',
          '',
          '**为什么想做：** ',
          '**不做会怎样：** ',
          '**要付出什么：** ',
          '**做完能带来什么真实变化：** ',
          '',
          '## 认知',
          '',
          '',
          '## 判断',
          '',
          `做：直接立项开始推进。（${today}）`,
          '',
          '## 目标',
          '',
          opts.goal?.trim() || '',
          '',
          '## 计划',
          '',
          '## 总结',
          '',
          '**结果：** ',
          '**动机回看：** ',
          '**经验：** ',
          '',
        ].join('\n'),
      )
      await scaffoldProjectSubdirs(safe, `立项「${safe}」。`)
      return homeRel
    },

    async archiveProject(projectName, finalStatus) {
      const safe = sanitizeSegment(projectName)
      const srcDir = resolveVaultPath(rootDir, `projects/${safe}`).absPath
      const dstDir = resolveVaultPath(rootDir, `projects/99_archives/${safe}`).absPath
      if (!(await exists(srcDir))) throw new Error(`找不到项目：${safe}`)
      if (await exists(dstDir)) throw new Error(`归档目录已存在同名项目：${safe}`)

      const homeRel = `projects/${safe}/${safe}.md`
      if (await exists(join(rootDir, homeRel))) {
        const { content } = await readVaultFile(homeRel)
        await writeVaultFile(homeRel, updateFrontmatterFields(content, { status: finalStatus }))
      }
      await mkdir(dirname(dstDir), { recursive: true })
      await rename(srcDir, dstDir)
      return `projects/99_archives/${safe}`
    },

    async restoreProject(projectName) {
      const safe = sanitizeSegment(projectName)
      const srcDir = resolveVaultPath(rootDir, `projects/99_archives/${safe}`).absPath
      const dstDir = resolveVaultPath(rootDir, `projects/${safe}`).absPath
      if (!(await exists(srcDir))) throw new Error(`找不到已归档项目：${safe}`)
      if (await exists(dstDir)) throw new Error(`活跃项目中已存在同名项目：${safe}`)

      await rename(srcDir, dstDir)
      const homeRel = `projects/${safe}/${safe}.md`
      if (await exists(join(rootDir, homeRel))) {
        const { content } = await readVaultFile(homeRel)
        await writeVaultFile(homeRel, updateFrontmatterFields(content, { status: 'doing' }))
      }
      return `projects/${safe}`
    },

    async updateProjectMeta(projectName, patch) {
      const safe = sanitizeSegment(projectName)
      const relPath = `projects/${safe}/${safe}.md`
      const { content } = await readVaultFile(relPath)
      const updates: Record<string, string> = {}
      if (patch.status !== undefined) updates.status = patch.status
      if (patch.area !== undefined) updates.area = patch.area
      if (patch.created !== undefined) updates.created = patch.created
      if (patch.deadline !== undefined) updates.deadline = patch.deadline
      if (patch.timeframe !== undefined) updates.timeframe = patch.timeframe
      let next = Object.keys(updates).length > 0 ? updateFrontmatterFields(content, updates) : content
      if (patch.goal !== undefined) {
        next = replaceSectionBody(next, '目标', [patch.goal.trim()])
      }
      await writeVaultFile(relPath, next)
    },

    async togglePlanItem(projectName, lineIndex) {
      const safe = sanitizeSegment(projectName)
      const relPath = `projects/${safe}/${safe}.md`
      const { content } = await readVaultFile(relPath)
      const { lines, eol } = splitLines(content)
      if (lineIndex < 0 || lineIndex >= lines.length) {
        throw new Error(`Invalid plan line index: ${lineIndex}`)
      }
      lines[lineIndex] = toggleCheckboxLine(lines[lineIndex]!)
      await writeVaultFile(relPath, joinLines(lines, eol))
    },

    async addPlanItem(projectName, text) {
      const cleaned = text.trim()
      if (!cleaned) throw new Error('计划内容不能为空')
      const safe = sanitizeSegment(projectName)
      const relPath = `projects/${safe}/${safe}.md`
      const { content } = await readVaultFile(relPath)
      const parsed = splitLines(content)
      const sec = findSection(parsed.lines, '计划')
      let cleanedContent = content
      if (sec) {
        const filtered = [...parsed.lines]
        let removed = false
        for (let i = sec.endLine - 1; i >= sec.startLine; i -= 1) {
          const m = /^-\s+\[[ xX]\]\s*(.*)$/.exec((filtered[i] ?? '').trim())
          if (m && !m[1]!.replace(/^\d+[.、]\s*/, '').trim()) {
            filtered.splice(i, 1)
            removed = true
          }
        }
        if (removed) cleanedContent = joinLines(filtered, parsed.eol)
      }
      const existing = parsePlanItems(splitLines(cleanedContent).lines)
      const nextNum = existing.length + 1
      const hasNumber = /^\d+\.\s+/.test(cleaned)
      const newLine = `- [ ] ${hasNumber ? cleaned : `${nextNum}. ${cleaned}`}`
      await writeVaultFile(relPath, appendLineToSection(cleanedContent, '计划', newLine))
    },

    async addInboxItem(text, dateStr) {
      const cleaned = text.trim()
      if (!cleaned) throw new Error('收件箱内容不能为空')
      const date = dateStr ?? formatLocalDate(now())
      const existing =
        (await readUtf8IfExists(join(rootDir, 'inbox.md'))) ??
        '# Inbox\n\n## 待处理\n\n## 提议\n'
      const line = /^- \[[ xX]\] /.test(cleaned) ? cleaned : `- [ ] ${date} ${cleaned}`
      await writeVaultFile('inbox.md', appendLineToSection(existing, '待处理', line))
    },

    async toggleInboxItem(lineIndex) {
      const { content } = await readVaultFile('inbox.md')
      const { lines, eol } = splitLines(content)
      if (lineIndex < 0 || lineIndex >= lines.length) {
        throw new Error(`Invalid inbox line index: ${lineIndex}`)
      }
      lines[lineIndex] = toggleCheckboxLine(lines[lineIndex]!)
      await writeVaultFile('inbox.md', joinLines(lines, eol))
    },

    async inboxToIdea(lineIndex, titleOverride) {
      const { content } = await readVaultFile('inbox.md')
      const { lines } = splitLines(content)
      const line = lines[lineIndex]
      if (!line) throw new Error(`Invalid inbox line index: ${lineIndex}`)
      const cleaned = line
        .trim()
        .replace(/^-\s+\[[ xX]\]\s+/, '')
        .replace(/^\d{4}-\d{2}-\d{2}\s+/, '')
        .trim()
      const title = sanitizeSegment(
        (titleOverride?.trim() || cleaned.slice(0, 24)).replace(/\.md$/i, ''),
      )
      const ideaPath = await createIdea(title, cleaned)
      await deleteInboxItem(lineIndex)
      return ideaPath
    },

    async inboxToTask(lineIndex, projectName, dateStr) {
      const { content } = await readVaultFile('inbox.md')
      const { lines } = splitLines(content)
      const line = lines[lineIndex]
      if (!line) throw new Error(`Invalid inbox line index: ${lineIndex}`)
      const cleaned = line
        .trim()
        .replace(/^-\s+\[[ xX]\]\s+/, '')
        .replace(/^\d{4}-\d{2}-\d{2}\s+/, '')
        .trim()
      const taskPath = await addTask(projectName, cleaned, dateStr)
      await deleteInboxItem(lineIndex)
      return taskPath
    },

    async generateWeeklyReviewDraft(projectName, weekStrInput) {
      const safe = sanitizeSegment(projectName)
      const weekStr = weekStrInput ?? formatIsoWeek(now())
      const range = isoWeekDateRange(weekStr)
      const tasksDirAbs = resolveVaultPath(rootDir, `projects/${safe}/01_tasks`).absPath
      const summaryItems: string[] = []
      let totalMinutes = 0

      if (await exists(tasksDirAbs)) {
        const files = (await readdir(tasksDirAbs))
          .filter((f) => DATE_FILE_RE.test(f))
          .sort()
        for (const f of files) {
          const d = f.slice(0, 10)
          if (d < range.start || d > range.end) continue
          const raw = (await readUtf8IfExists(join(tasksDirAbs, f))) ?? ''
          const parsed = parseTaskFile(raw)
          totalMinutes += parsed.totalMinutes
          for (const t of parsed.tasks) {
            summaryItems.push(`${summaryItems.length + 1}. ${t.checked ? '✅' : '❌'} ${t.text}`)
          }
        }
      }

      const hoursText =
        totalMinutes >= 60
          ? `${(totalMinutes / 60).toFixed(1)} 小时（${totalMinutes} 分钟）`
          : `${totalMinutes} 分钟（${(totalMinutes / 60).toFixed(1)} 小时）`

      const relPath = `projects/${safe}/03_reviews/${weekStr}.md`
      const body = [
        '---',
        'status: draft',
        '---',
        '',
        `## 本周（${range.start.slice(5)} ~ ${range.end.slice(5)}）`,
        '',
        ...(summaryItems.length > 0 ? summaryItems : ['1. （本周暂无已记录任务）']),
        '',
        `本周投入：${hoursText}`,
        '',
        '## 原因',
        '',
        '## 经验',
        '',
        '## 下周',
        '',
        '1. ',
        '',
      ].join('\n')
      await writeVaultFile(relPath, body)
      return relPath
    },

    async updateReview(relPath, patch) {
      let { content } = await readVaultFile(relPath)
      if (patch.status !== undefined) {
        content = updateFrontmatterFields(content, { status: patch.status })
      }
      if (patch.nextWeek !== undefined) {
        const numbered = patch.nextWeek
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
          .map((item, idx) => `${idx + 1}. ${item.replace(/^\d+\.\s*/, '')}`)
        content = replaceSectionBody(content, '下周', numbered.length > 0 ? numbered : ['1. '])
      }
      await writeVaultFile(relPath, content)
    },

    async appendDiary(text, dateStr, timeStr) {
      const verbatim = text.trim()
      if (!verbatim) throw new Error('日记内容不能为空')
      const current = now()
      const date = dateStr ?? formatLocalDate(current)
      const time = timeStr ?? formatLocalTime(current)

      const folderAbs = join(rootDir, 'raw', 'me', 'diary', date)
      const folderSt = await stat(folderAbs).catch(() => null)
      const relPath = folderSt?.isDirectory()
        ? `raw/me/diary/${date}/日记.md`
        : `raw/me/diary/${date}.md`
      const existing = await readUtf8IfExists(join(rootDir, relPath))

      if (existing === null) {
        await writeVaultFile(
          relPath,
          ['---', `date: ${date}`, '---', '', `## ${time}`, '', verbatim, ''].join('\n'),
        )
        return relPath
      }

      const eol = existing.includes('\r\n') ? '\r\n' : '\n'
      const trimmedEnd = existing.replace(/\s+$/, '')
      await writeVaultFile(relPath, `${trimmedEnd}${eol}${eol}## ${time}${eol}${eol}${verbatim}${eol}`)
      return relPath
    },

    async createWikiPage(title, body, sources = []) {
      const safe = sanitizeSegment(title.replace(/\.md$/i, ''))
      const relPath = `wiki/${safe}.md`
      const { absPath } = resolveVaultPath(rootDir, relPath)
      if (await exists(absPath)) throw new Error(`知识页已存在：${safe}`)
      const today = formatLocalDate(now())
      const sourcesBlock =
        sources.length > 0 ? ['sources:', ...sources.map((s) => `  - ${s}`)] : ['sources: []']
      const page = [
        '---',
        `title: ${safe}`,
        `updated: ${today}`,
        ...sourcesBlock,
        '---',
        '',
        `# ${safe}`,
        '',
        body.trim(),
        '',
      ].join('\n')
      await writeVaultFile(relPath, page)

      // Update wiki/index.md and wiki/log.md
      const indexExisting = (await readUtf8IfExists(join(rootDir, 'wiki/index.md'))) ?? '# Wiki 目录\n'
      const indexEol = indexExisting.includes('\r\n') ? '\r\n' : '\n'
      const summary = body.trim().split(/\r?\n/)[0]?.slice(0, 48) || '新建知识页'
      await writeVaultFile(
        'wiki/index.md',
        `${indexExisting.replace(/\s+$/, '')}${indexEol}- [${safe}](${safe}.md)：${summary}${indexEol}`,
      )

      const logExisting = (await readUtf8IfExists(join(rootDir, 'wiki/log.md'))) ?? '# Wiki 处理记录\n'
      const logEol = logExisting.includes('\r\n') ? '\r\n' : '\n'
      await writeVaultFile(
        'wiki/log.md',
        `${logExisting.replace(/\s+$/, '')}${logEol}${logEol}## ${today} create | ${safe}${logEol}${logEol}在 Life Wiki 界面新建知识页 [${safe}](${safe}.md)。${logEol}`,
      )
      return relPath
    },

    async updateAreas(areasInput) {
      const cleaned = [
        ...new Set(
          areasInput
            .map((a) => a.trim())
            .filter((a) => a.length > 0),
        ),
      ]
      if (cleaned.length === 0) throw new Error('至少保留一个领域')
      const schemaRel = 'system/schema.md'
      const existing =
        (await readUtf8IfExists(join(rootDir, schemaRel))) ?? '# 知识库规则\n\n领域清单：\n'
      const { lines, eol } = splitLines(existing)
      const idx = lines.findIndex((l) => l.trim().startsWith('领域清单'))
      const bulletLines = cleaned.map((a) => `- ${a}`)

      if (idx === -1) {
        const next = [...lines, '', '## 领域清单', '', '领域清单：', ...bulletLines, '']
        await writeVaultFile(schemaRel, joinLines(next, eol))
      } else {
        let end = idx + 1
        while (end < lines.length && ((lines[end] ?? '').trim() === '' || /^-\s+/.test((lines[end] ?? '').trim()))) {
          if ((lines[end] ?? '').trim() === '' && end > idx + 1) break
          end += 1
        }
        lines.splice(idx + 1, end - (idx + 1), ...bulletLines)
        await writeVaultFile(schemaRel, joinLines(lines, eol))
      }
      return cleaned
    },

    async commitSnapshot(message) {
      const status = await readGitStatus(rootDir)
      if (!status.isRepo) {
        return { committed: false, summary: '当前目录未启用本地 Git' }
      }
      if (status.dirtyCount === 0) {
        return { committed: false, summary: '没有待提交的改动' }
      }
      const msg = message?.trim() || `[Life Wiki] 手动提交快照 (${formatLocalDate(now())})`
      await execFileAsync('git', ['add', '-A'], { cwd: rootDir, windowsHide: true })
      await execFileAsync('git', ['commit', '-m', msg], { cwd: rootDir, windowsHide: true })
      const { stdout } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], {
        cwd: rootDir,
        windowsHide: true,
      })
      const hash = stdout.trim()
      return { committed: true, hash, summary: `已提交快照 ${hash}` }
    },
  }
}
