export type ProjectStatus = 'idea' | 'cancel' | 'todo' | 'doing' | 'pause' | 'done'
export type TaskFileStatus = 'todo' | 'doing' | 'done'
export type TaskPriority = 'high' | 'medium' | 'low'
export type ReviewStatus = 'draft' | 'final'

export interface DirectoryInspection {
  path: string
  exists: boolean
  isDirectory: boolean
  isEmpty: boolean
  looksLikeVault: boolean
  hasProjects: boolean
  hasInbox: boolean
  hasSystem: boolean
  entryCount: number
}

export interface DirectoryBrowseResult {
  currentPath: string
  parentPath: string | null
  entries: Array<{ name: string; path: string }>
}

export interface TaskItem {
  lineIndex: number
  checked: boolean
  text: string
  priority: TaskPriority
  minutes: number | null
  fromDate: string | null
  rawLine: string
}

export interface ProjectTaskGroup {
  projectName: string
  projectStatus: ProjectStatus
  area: string
  fileRelPath: string
  exists: boolean
  status: TaskFileStatus | null
  valid: boolean
  formatIssues: string[]
  tasks: TaskItem[]
  logs: string[]
  reflections: string[]
  totalMinutes: number
}

export interface FormatWarning {
  projectName: string
  date: string
  fileRelPath: string
  issues: string[]
}

export interface DiaryEntrySummary {
  date: string
  month: string
  exists: boolean
  relPath: string
  isFolder: boolean
  preview: string
  content: string
  entryCount: number
  images: string[]
}

export interface PlanItem {
  lineIndex: number
  checked: boolean
  text: string
  rawLine: string
}

export interface TaskFileSummary {
  date: string
  relPath: string
  status: TaskFileStatus | null
  valid: boolean
  formatIssues: string[]
  doneCount: number
  totalCount: number
  totalMinutes: number
}

export interface ReviewSummary {
  projectName: string
  week: string
  relPath: string
  status: ReviewStatus | null
  summaryLines: string[]
  totalHoursText: string
  nextWeekItems: string[]
}

export interface ProjectCard {
  name: string
  archived: boolean
  homepageRelPath: string
  status: ProjectStatus
  area: string
  timeframe: string
  idea: string
  goal: string
  plan: PlanItem[]
  nextStep: string | null
  latestTaskDate: string | null
  staleDays: number | null
  latestReviewRelPath: string | null
  latestReviewStatus: ReviewStatus | null
  resourcesRelPath: string
  outputsRelPath: string
  taskFiles: TaskFileSummary[]
  reviewFiles: ReviewSummary[]
}

export interface IdeaSummary {
  name: string
  relPath: string
  status: ProjectStatus
  idea: string
  judgment: string
  motivationChange: string
}

export interface InboxItem {
  lineIndex: number
  checked: boolean
  text: string
  rawLine: string
}

export interface WikiPageSummary {
  title: string
  relPath: string
  updated: string
  sources: string[]
  excerpt: string
}

export interface RawEntrySummary {
  name: string
  kind: 'repo' | 'file' | 'folder'
  relPath: string
  openRelPath: string
  sourceUrl: string
  fetched: string
  tier: 'L1' | 'L2' | 'L3' | null
  category: string
}

export interface WeekProjectMetrics {
  projectName: string
  doneTasks: number
  totalTasks: number
  totalMinutes: number
  review: ReviewSummary | null
}

export interface BoardSnapshot {
  date: string
  week: string
  vaultRoot: string
  vaultName: string
  areas: string[]
  hasSampleData: boolean
  today: {
    diary: DiaryEntrySummary
    groups: ProjectTaskGroup[]
    formatWarnings: FormatWarning[]
  }
  projects: ProjectCard[]
  archivedProjects: ProjectCard[]
  ideas: IdeaSummary[]
  inbox: {
    relPath: string
    items: InboxItem[]
    proposals: string[]
  }
  diaries: DiaryEntrySummary[]
  reviewCenter: {
    week: string
    weekRange: { start: string; end: string }
    availableWeeks: string[]
    projectMetrics: WeekProjectMetrics[]
    weekDiaries: DiaryEntrySummary[]
    draftReviews: ReviewSummary[]
  }
  knowledge: {
    wikiPages: WikiPageSummary[]
    rawEntries: RawEntrySummary[]
  }
  git: {
    isRepo: boolean
    dirtyCount: number
  }
}

export interface VaultSettings {
  dataDir: string | null
  recentDirs: string[]
  defaultSuggestedDir: string
  defaultParentDir: string
}

export interface CommitResult {
  committed: boolean
  hash?: string
  summary: string
}
