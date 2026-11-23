import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { BoardSnapshot, IdeaSummary, ProjectCard, ProjectStatus } from '../../shared/types.ts'
import type { RunActionFn } from '../App.tsx'
import { api } from '../api.ts'
import {
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconFile,
  IconPlus,
  IconProjectPie,
  IconX,
} from '../components/Icons.tsx'
import { MarkdownView } from '../components/MarkdownView.tsx'

type LifeCycleTab = 'doing' | 'todo' | 'pause' | 'ideas' | 'archived'
type DetailTab = 'plan' | 'tasks' | 'resources' | 'reviews' | 'outputs'

interface ProjectsViewProps {
  snapshot: BoardSnapshot
  onOpenFile: (relPath: string) => void
  onJumpToToday: () => void
  onRunAction: RunActionFn
}

const STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'todo', label: '未开始' },
  { value: 'doing', label: '进行中' },
  { value: 'pause', label: '暂停' },
  { value: 'done', label: '已完成并归档' },
]

const STATUS_LABELS: Record<ProjectStatus, string> = {
  doing: '进行中',
  todo: '未开始',
  pause: '暂停',
  done: '已完成',
  idea: '想法',
  cancel: '已取消',
}

function localTodayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatShortDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  return `${Number(m[2])}月${Number(m[3])}日`
}

function stripLeadingNumber(text: string): string {
  return text.replace(/^\s*\d+[.、]\s*/, '').trim()
}

export function ProjectsView({
  snapshot,
  onOpenFile,
  onJumpToToday,
  onRunAction,
}: ProjectsViewProps) {
  const [subTab, setSubTab] = useState<LifeCycleTab>('doing')
  const [areaFilter, setAreaFilter] = useState<string>('ALL')

  // Full-page Project Detail state
  const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null)
  const [selectedArchived, setSelectedArchived] = useState(false)
  const [detailTab, setDetailTab] = useState<DetailTab>('plan')
  const [newPlanText, setNewPlanText] = useState('')
  const [goalDraft, setGoalDraft] = useState<string | null>(null)
  const goalRef = useRef<HTMLTextAreaElement | null>(null)

  // Compact metadata popovers inside detail view
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [areaMenuOpen, setAreaMenuOpen] = useState(false)
  const [editingDateField, setEditingDateField] = useState<'created' | 'deadline' | null>(null)

  // Inline markdown content for 资料 / 产出 tabs
  const [inlineDoc, setInlineDoc] = useState<{ path: string; content: string } | null>(null)
  const [inlineDocLoading, setInlineDocLoading] = useState(false)

  // Modals
  const [showNewIdea, setShowNewIdea] = useState(false)
  const [ideaTitle, setIdeaTitle] = useState('')
  const [ideaBody, setIdeaBody] = useState('')

  const [showNewProject, setShowNewProject] = useState(false)
  const [projName, setProjName] = useState('')
  const [projArea, setProjArea] = useState(snapshot.areas[0] ?? '个人')
  const [projDeadline, setProjDeadline] = useState('')
  const [projGoal, setProjGoal] = useState('')

  const [promoteTarget, setPromoteTarget] = useState<IdeaSummary | null>(null)
  const [promoteArea, setPromoteArea] = useState(snapshot.areas[0] ?? '个人')
  const [promoteDeadline, setPromoteDeadline] = useState('')
  const [promoteGoal, setPromoteGoal] = useState('')

  const [cancelTarget, setCancelTarget] = useState<IdeaSummary | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const doingList = useMemo(
    () => snapshot.projects.filter((p) => p.status === 'doing'),
    [snapshot.projects],
  )
  const todoList = useMemo(
    () => snapshot.projects.filter((p) => p.status === 'todo'),
    [snapshot.projects],
  )
  const pauseList = useMemo(
    () => snapshot.projects.filter((p) => p.status === 'pause'),
    [snapshot.projects],
  )
  const archivedList = useMemo(
    () => [
      ...snapshot.projects.filter((p) => p.status === 'done' || p.status === 'cancel'),
      ...snapshot.archivedProjects,
    ],
    [snapshot.projects, snapshot.archivedProjects],
  )

  const currentRawList =
    subTab === 'doing'
      ? doingList
      : subTab === 'todo'
        ? todoList
        : subTab === 'pause'
          ? pauseList
          : archivedList

  const tabAreas = useMemo(() => {
    const set = new Set<string>()
    for (const p of currentRawList) {
      if (p.area) set.add(p.area)
    }
    return Array.from(set)
  }, [currentRawList])

  const visibleProjects = useMemo(() => {
    if (areaFilter === 'ALL' || !tabAreas.includes(areaFilter)) return currentRawList
    return currentRawList.filter((p) => p.area === areaFilter)
  }, [currentRawList, areaFilter, tabAreas])

  const activeDetail: ProjectCard | null = selectedProjectName
    ? ((selectedArchived ? archivedList : snapshot.projects).find(
        (p) => p.name === selectedProjectName,
      ) ??
        snapshot.archivedProjects.find((p) => p.name === selectedProjectName) ??
        null)
    : null

  // Auto-size inline editable goal textarea to fit content cleanly
  const displayedGoal = goalDraft ?? activeDetail?.goal ?? ''
  useEffect(() => {
    const el = goalRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [displayedGoal, activeDetail?.name])

  // Load inline 资料 / 产出 markdown when tab changes
  useEffect(() => {
    if (!activeDetail) return
    if (detailTab !== 'resources' && detailTab !== 'outputs') return
    const targetPath =
      detailTab === 'resources' ? activeDetail.resourcesRelPath : activeDetail.outputsRelPath
    let alive = true
    setInlineDocLoading(true)
    api
      .readFile(targetPath)
      .then((res) => {
        if (alive) setInlineDoc({ path: targetPath, content: res.content })
      })
      .catch(() => {
        if (alive) setInlineDoc({ path: targetPath, content: '' })
      })
      .finally(() => {
        if (alive) setInlineDocLoading(false)
      })
    return () => {
      alive = false
    }
  }, [activeDetail, detailTab, snapshot])

  // Close popovers on outside click
  useEffect(() => {
    if (!statusMenuOpen && !areaMenuOpen && !editingDateField) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (statusMenuOpen && !t?.closest('[data-proj-status]')) setStatusMenuOpen(false)
      if (areaMenuOpen && !t?.closest('[data-proj-area]')) setAreaMenuOpen(false)
      if (editingDateField && !t?.closest('[data-proj-date]')) setEditingDateField(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [statusMenuOpen, areaMenuOpen, editingDateField])

  // Esc key handling
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (showNewIdea) setShowNewIdea(false)
      else if (showNewProject) setShowNewProject(false)
      else if (promoteTarget) setPromoteTarget(null)
      else if (cancelTarget) setCancelTarget(null)
      else if (statusMenuOpen || areaMenuOpen || editingDateField) {
        setStatusMenuOpen(false)
        setAreaMenuOpen(false)
        setEditingDateField(null)
      } else if (selectedProjectName) {
        setSelectedProjectName(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    showNewIdea,
    showNewProject,
    promoteTarget,
    cancelTarget,
    statusMenuOpen,
    areaMenuOpen,
    editingDateField,
    selectedProjectName,
  ])

  const openProjectDetail = (p: ProjectCard) => {
    setSelectedProjectName(p.name)
    setSelectedArchived(p.archived)
    setDetailTab('plan')
    setNewPlanText('')
    setGoalDraft(null)
    setStatusMenuOpen(false)
    setAreaMenuOpen(false)
    setEditingDateField(null)
  }

  const handleTogglePlan = async (project: ProjectCard, lineIndex: number) => {
    await onRunAction(() => api.togglePlanItem(project.name, lineIndex), {
      optimistic: (prev) => ({
        ...prev,
        projects: prev.projects.map((p) =>
          p.name !== project.name
            ? p
            : {
                ...p,
                plan: p.plan.map((item) =>
                  item.lineIndex === lineIndex ? { ...item, checked: !item.checked } : item,
                ),
              },
        ),
      }),
    })
  }

  const handleAddPlan = async (project: ProjectCard) => {
    const val = newPlanText.trim()
    if (!val) return
    setNewPlanText('')
    await onRunAction(() => api.addPlanItem(project.name, val), {
      optimistic: (prev) => ({
        ...prev,
        projects: prev.projects.map((p) =>
          p.name !== project.name
            ? p
            : {
                ...p,
                plan: [
                  ...p.plan,
                  { lineIndex: Date.now(), checked: false, text: val, rawLine: `- [ ] ${val}` },
                ],
              },
        ),
      }),
    })
  }

  const handlePushPlanToToday = async (project: ProjectCard, text: string) => {
    const clean = stripLeadingNumber(text)
    if (!clean) return
    await onRunAction(() => api.addTask(project.name, clean, undefined, 'medium'), {
      toast: '已加入今日任务',
    })
  }

  const handleDetailStatusSelect = async (project: ProjectCard, next: ProjectStatus) => {
    setStatusMenuOpen(false)
    if (next === 'done') {
      await onRunAction(
        async () => {
          await api.archiveProject(project.name, 'done')
          setSelectedProjectName(null)
          setSubTab('archived')
        },
        { toast: `「${project.name}」已完成并归档` },
      )
      return
    }
    if (project.status === next) return
    await onRunAction(() => api.updateProjectMeta(project.name, { status: next }), {
      optimistic: (prev) => ({
        ...prev,
        projects: prev.projects.map((p) =>
          p.name === project.name ? { ...p, status: next } : p,
        ),
      }),
    })
  }

  const handleCreateIdea = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ideaTitle.trim()) return
    const title = ideaTitle.trim()
    const body = ideaBody.trim()
    setIdeaTitle('')
    setIdeaBody('')
    setShowNewIdea(false)
    setSubTab('ideas')
    await onRunAction(() => api.createIdea(title, body))
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projName.trim()) return
    const name = projName.trim()
    const deadline = projDeadline.trim()
    const goal = projGoal.trim() || undefined
    setProjName('')
    setProjDeadline('')
    setProjGoal('')
    setShowNewProject(false)
    setSubTab('doing')
    await onRunAction(() =>
      api.createProject({
        name,
        area: projArea,
        created: localTodayIso(),
        deadline,
        goal,
      }),
    )
  }

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!promoteTarget) return
    const target = promoteTarget
    const deadline = promoteDeadline.trim()
    const goal = promoteGoal.trim() || undefined
    setPromoteTarget(null)
    setSubTab('doing')
    await onRunAction(
      () =>
        api.promoteIdea(target.name, {
          area: promoteArea,
          created: localTodayIso(),
          deadline,
          goal,
        }),
      { toast: `已立项「${target.name}」` },
    )
  }

  const handleCancelIdea = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cancelTarget) return
    const target = cancelTarget
    const reason = cancelReason.trim() || undefined
    setCancelTarget(null)
    setCancelReason('')
    await onRunAction(() => api.cancelIdea(target.name, reason))
  }

  // ==================== FULL-PAGE THINGS 3 PROJECT DETAIL VIEW ====================
  if (activeDetail) {
    const donePlan = activeDetail.plan.filter((i) => i.checked).length
    const totalPlan = activeDetail.plan.length
    const isOverdue =
      !activeDetail.archived &&
      activeDetail.status !== 'done' &&
      Boolean(activeDetail.deadline) &&
      activeDetail.deadline < snapshot.date

    return (
      <div className="lw-canvas">
        {/* Top Back & Actions */}
        <div className="lw-between">
          <button
            type="button"
            className="lw-btn lw-btn-sm lw-btn-ghost"
            style={{ marginLeft: -6, paddingLeft: 4, gap: 4 }}
            onClick={() => setSelectedProjectName(null)}
          >
            <IconChevronLeft size={15} />
            项目
          </button>

          <div className="lw-row" style={{ gap: 6 }}>
            {activeDetail.archived ? (
              <button
                type="button"
                className="lw-btn lw-btn-sm lw-btn-primary"
                onClick={() =>
                  void onRunAction(
                    async () => {
                      await api.restoreProject(activeDetail.name)
                      setSelectedArchived(false)
                      setSubTab('doing')
                    },
                    { toast: '已恢复项目' },
                  )
                }
              >
                恢复项目
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="lw-btn lw-btn-sm lw-btn-ghost"
                  onClick={() =>
                    void onRunAction(
                      async () => {
                        await api.archiveProject(activeDetail.name, 'done')
                        setSelectedProjectName(null)
                        setSubTab('archived')
                      },
                      { toast: '已归档' },
                    )
                  }
                >
                  归档
                </button>
                <button
                  type="button"
                  className="lw-btn lw-btn-sm lw-btn-primary"
                  onClick={() =>
                    void onRunAction(async () => {
                      await api.createTaskFile(activeDetail.name)
                      onJumpToToday()
                    })
                  }
                >
                  今日开做
                </button>
              </>
            )}
            <button
              type="button"
              className="lw-icon-btn"
              title="打开主页原文"
              onClick={() => onOpenFile(activeDetail.homepageRelPath)}
            >
              <IconFile size={15} />
            </button>
          </div>
        </div>

        {/* Title & Compact Metadata Strip */}
        <div className="lw-stack" style={{ gap: 12 }}>
          <div className="lw-row" style={{ gap: 11 }}>
            <IconProjectPie ratio={totalPlan > 0 ? donePlan / totalPlan : 0} size={22} />
            <h1 className="lw-h1">{activeDetail.name}</h1>
          </div>

          <div className="lw-meta-strip">
            {/* Status Dropdown */}
            {!activeDetail.archived ? (
              <div className="lw-menu-wrap" data-proj-status>
                <button
                  type="button"
                  className="lw-chip-btn"
                  onClick={() => setStatusMenuOpen((v) => !v)}
                >
                  <span className={`lw-status-dot ${activeDetail.status}`} />
                  <span>{STATUS_LABELS[activeDetail.status]}</span>
                  <IconChevronDown size={12} />
                </button>
                {statusMenuOpen && (
                  <div className="lw-menu" style={{ left: 0, right: 'auto', minWidth: 148 }}>
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`lw-menu-item ${activeDetail.status === opt.value ? 'active' : ''}`}
                        onClick={() => void handleDetailStatusSelect(activeDetail, opt.value)}
                      >
                        <span className={`lw-status-dot ${opt.value}`} />
                        <span style={{ flex: 1 }}>{opt.label}</span>
                        {activeDetail.status === opt.value && <IconCheck size={12} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <span className="lw-chip-btn" style={{ cursor: 'default' }}>
                <span className={`lw-status-dot ${activeDetail.status}`} />
                {STATUS_LABELS[activeDetail.status]}
              </span>
            )}

            {/* Area Compact Dropdown */}
            {!activeDetail.archived ? (
              <div className="lw-menu-wrap" data-proj-area>
                <button
                  type="button"
                  className="lw-chip-btn"
                  onClick={() => setAreaMenuOpen((v) => !v)}
                >
                  <span>{activeDetail.area || '选择领域'}</span>
                  <IconChevronDown size={12} />
                </button>
                {areaMenuOpen && (
                  <div className="lw-menu" style={{ left: 0, right: 'auto', minWidth: 120 }}>
                    {Array.from(
                      new Set([
                        ...snapshot.areas,
                        ...(activeDetail.area ? [activeDetail.area] : []),
                      ]),
                    ).map((a) => (
                      <button
                        key={a}
                        type="button"
                        className={`lw-menu-item ${activeDetail.area === a ? 'active' : ''}`}
                        onClick={() => {
                          setAreaMenuOpen(false)
                          void onRunAction(
                            () => api.updateProjectMeta(activeDetail.name, { area: a }),
                            {
                              optimistic: (prev) => ({
                                ...prev,
                                projects: prev.projects.map((p) =>
                                  p.name === activeDetail.name ? { ...p, area: a } : p,
                                ),
                              }),
                            },
                          )
                        }}
                      >
                        <span style={{ flex: 1 }}>{a}</span>
                        {activeDetail.area === a && <IconCheck size={12} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : activeDetail.area ? (
              <span className="lw-chip-btn" style={{ cursor: 'default' }}>
                {activeDetail.area}
              </span>
            ) : null}

            {/* Created Date Chip */}
            <div data-proj-date style={{ display: 'inline-flex', alignItems: 'center' }}>
              {editingDateField === 'created' && !activeDetail.archived ? (
                <input
                  type="date"
                  className="lw-input"
                  style={{ width: 142, height: 27, padding: '0 8px', fontSize: 12.5 }}
                  value={activeDetail.created}
                  autoFocus
                  onChange={(e) => {
                    const val = e.target.value
                    setEditingDateField(null)
                    void onRunAction(
                      () => api.updateProjectMeta(activeDetail.name, { created: val }),
                      {
                        optimistic: (prev) => ({
                          ...prev,
                          projects: prev.projects.map((p) =>
                            p.name === activeDetail.name ? { ...p, created: val } : p,
                          ),
                        }),
                      },
                    )
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="lw-chip-btn"
                  disabled={activeDetail.archived}
                  onClick={() => setEditingDateField('created')}
                >
                  创建 {activeDetail.created ? formatShortDate(activeDetail.created) : '未设'}
                </button>
              )}
            </div>

            {/* Deadline Chip */}
            <div data-proj-date style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {editingDateField === 'deadline' && !activeDetail.archived ? (
                <>
                  <input
                    type="date"
                    className="lw-input"
                    style={{ width: 142, height: 27, padding: '0 8px', fontSize: 12.5 }}
                    value={activeDetail.deadline}
                    autoFocus
                    onChange={(e) => {
                      const val = e.target.value
                      setEditingDateField(null)
                      void onRunAction(
                        () => api.updateProjectMeta(activeDetail.name, { deadline: val }),
                        {
                          optimistic: (prev) => ({
                            ...prev,
                            projects: prev.projects.map((p) =>
                              p.name === activeDetail.name ? { ...p, deadline: val } : p,
                            ),
                          }),
                        },
                      )
                    }}
                  />
                  {activeDetail.deadline && (
                    <button
                      type="button"
                      className="lw-btn lw-btn-sm lw-btn-ghost"
                      onClick={() => {
                        setEditingDateField(null)
                        void onRunAction(
                          () => api.updateProjectMeta(activeDetail.name, { deadline: '' }),
                          {
                            optimistic: (prev) => ({
                              ...prev,
                              projects: prev.projects.map((p) =>
                                p.name === activeDetail.name ? { ...p, deadline: '' } : p,
                              ),
                            }),
                          },
                        )
                      }}
                    >
                      清除
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  className={`lw-chip-btn ${isOverdue ? 'overdue' : ''}`}
                  disabled={activeDetail.archived}
                  onClick={() => setEditingDateField('deadline')}
                >
                  {activeDetail.deadline
                    ? `截止 ${formatShortDate(activeDetail.deadline)}`
                    : '+ 截止日期'}
                </button>
              )}
            </div>
          </div>

          {/* Inline Editable Goal */}
          {!activeDetail.archived ? (
            <textarea
              ref={goalRef}
              className="lw-goal-edit"
              rows={1}
              value={goalDraft ?? activeDetail.goal}
              onChange={(e) => setGoalDraft(e.target.value)}
              onBlur={() => {
                if (goalDraft !== null && goalDraft.trim() !== activeDetail.goal.trim()) {
                  const nextGoal = goalDraft.trim()
                  setGoalDraft(null)
                  void onRunAction(
                    () => api.updateProjectMeta(activeDetail.name, { goal: nextGoal }),
                    {
                      optimistic: (prev) => ({
                        ...prev,
                        projects: prev.projects.map((p) =>
                          p.name === activeDetail.name ? { ...p, goal: nextGoal } : p,
                        ),
                      }),
                    },
                  )
                } else {
                  setGoalDraft(null)
                }
              }}
              placeholder="写一句可检验的项目目标…"
            />
          ) : activeDetail.goal ? (
            <div style={{ fontSize: 14, color: 'var(--lw-text-2)' }}>{activeDetail.goal}</div>
          ) : null}
        </div>

        {/* Clean Inner Tabs aligned 1:1 with local 5-piece structure */}
        <div className="lw-tabs-bar">
          <div className="lw-subtabs">
            {(
              [
                ['plan', 'Plan', `${activeDetail.name}.md · ## 计划`],
                ['tasks', 'Tasks', '01_tasks/'],
                ['resources', 'Resources', '02_resources/resources.md'],
                ['reviews', 'Reviews', '03_reviews/'],
                ['outputs', 'Outputs', '04_outputs/outputs.md'],
              ] as Array<[DetailTab, string, string]>
            ).map(([k, label, tip]) => (
              <button
                key={k}
                type="button"
                className={`lw-subtab ${detailTab === k ? 'active' : ''}`}
                title={tip}
                onClick={() => setDetailTab(k)}
              >
                {label}
              </button>
            ))}
          </div>
          {(detailTab === 'resources' || detailTab === 'outputs') && (
            <div className="lw-tabs-bar-right">
              <button
                type="button"
                className="lw-btn lw-btn-sm lw-btn-ghost"
                onClick={() =>
                  onOpenFile(
                    detailTab === 'resources'
                      ? activeDetail.resourcesRelPath
                      : activeDetail.outputsRelPath,
                  )
                }
              >
                编辑原文
              </button>
            </div>
          )}
          {detailTab === 'reviews' && !activeDetail.archived && (
            <div className="lw-tabs-bar-right">
              <button
                type="button"
                className="lw-btn lw-btn-sm lw-btn-ghost"
                onClick={() =>
                  void onRunAction(
                    async () => {
                      const res = await api.generateWeeklyReview(activeDetail.name, snapshot.week)
                      onOpenFile(res.relPath)
                    },
                    { toast: '已生成本周复盘草稿' },
                  )
                }
              >
                生成本周草稿
              </button>
            </div>
          )}
        </div>

        {/* Detail Tab Body */}
        {detailTab === 'plan' ? (
          <div className="lw-list">
            {activeDetail.plan.map((item) => (
              <div key={item.lineIndex} className="lw-item-row" style={{ alignItems: 'center' }}>
                <button
                  type="button"
                  className={`lw-check ${item.checked ? 'checked' : ''}`}
                  style={{ marginTop: 0 }}
                  disabled={activeDetail.archived}
                  onClick={() => void handleTogglePlan(activeDetail, item.lineIndex)}
                >
                  {item.checked && <IconCheck />}
                </button>
                <span className={`lw-item-title ${item.checked ? 'lw-item-done' : ''}`}>
                  {stripLeadingNumber(item.text)}
                </span>
                {!activeDetail.archived && !item.checked && (
                  <div className="lw-hover-actions">
                    <button
                      type="button"
                      className="lw-btn lw-btn-sm lw-btn-ghost"
                      title="把这一步加入今日任务"
                      onClick={() => void handlePushPlanToToday(activeDetail, item.text)}
                    >
                      → 今日
                    </button>
                  </div>
                )}
              </div>
            ))}

            {!activeDetail.archived && (
              <form
                className="lw-item-row"
                style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}
                onSubmit={(e) => {
                  e.preventDefault()
                  void handleAddPlan(activeDetail)
                }}
              >
                <span className="lw-bullet-slot">
                  <IconPlus size={14} />
                </span>
                <input
                  className="lw-inline-input"
                  style={{ flex: 1, padding: 0, fontSize: 13.5 }}
                  value={newPlanText}
                  onChange={(e) => setNewPlanText(e.target.value)}
                  placeholder="添加计划"
                />
              </form>
            )}
          </div>
        ) : detailTab === 'tasks' ? (
          activeDetail.taskFiles.length === 0 ? (
            <div className="lw-empty">暂无任务记录，点右上角「今日开做」开始。</div>
          ) : (
            <div className="lw-list">
              {activeDetail.taskFiles.map((tf) => (
                <div
                  key={tf.relPath}
                  className="lw-project-row"
                  style={{ padding: '11px 12px' }}
                  onClick={() => onOpenFile(tf.relPath)}
                >
                  <div className="lw-row" style={{ gap: 9 }}>
                    <span className={`lw-status-dot ${tf.status ?? 'todo'}`} />
                    <span className="lw-mono" style={{ fontSize: 13.5 }}>
                      {tf.date}
                    </span>
                  </div>
                  <div className="lw-row" style={{ gap: 12 }}>
                    <span className="lw-muted">
                      {tf.doneCount}/{tf.totalCount}
                    </span>
                    {tf.totalMinutes > 0 && (
                      <span className="lw-muted">{tf.totalMinutes} min</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : detailTab === 'resources' || detailTab === 'outputs' ? (
          inlineDocLoading ? (
            <div className="lw-muted">读取中…</div>
          ) : inlineDoc && inlineDoc.content.trim() ? (
            <MarkdownView content={inlineDoc.content} baseRelPath={inlineDoc.path} />
          ) : (
            <div className="lw-empty">暂无记录，点右上角「编辑原文」添加。</div>
          )
        ) : activeDetail.reviewFiles.length === 0 ? (
          <div className="lw-empty">暂无周复盘，点右上角「生成本周草稿」自动汇总本周任务。</div>
        ) : (
          <div className="lw-list">
            {activeDetail.reviewFiles.map((rf) => (
              <div
                key={rf.relPath}
                className="lw-project-row"
                style={{ padding: '11px 12px' }}
                onClick={() => onOpenFile(rf.relPath)}
              >
                <div className="lw-row" style={{ gap: 12 }}>
                  <span className="lw-mono" style={{ fontSize: 13.5, fontWeight: 500 }}>
                    {rf.week}
                  </span>
                  {rf.totalHoursText && <span className="lw-muted">{rf.totalHoursText}</span>}
                </div>
                <span className="lw-muted">{rf.status === 'final' ? '已定稿' : '草稿'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ==================== PROJECT LIST VIEW ====================
  return (
    <div className="lw-canvas">
      {/* Continuous Underline Tabs + Primary Button */}
      <div className="lw-tabs-bar">
        <div className="lw-subtabs">
          {(
            [
              ['doing', '进行中'],
              ['todo', '未开始'],
              ['pause', '暂停'],
              ['ideas', '想法'],
              ['archived', '归档'],
            ] as Array<[LifeCycleTab, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`lw-subtab ${subTab === key ? 'active' : ''}`}
              onClick={() => {
                setSubTab(key)
                setAreaFilter('ALL')
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="lw-tabs-bar-right">
          <button
            type="button"
            className="lw-btn lw-btn-sm lw-btn-primary"
            onClick={() => {
              if (subTab === 'ideas') {
                setShowNewIdea(true)
              } else {
                setProjArea(snapshot.areas[0] ?? '个人')
                setProjDeadline('')
                setShowNewProject(true)
              }
            }}
          >
            <IconPlus size={13} />
            {subTab === 'ideas' ? '记想法' : '新建项目'}
          </button>
        </div>
      </div>

      {/* Quiet Area Filter (only when >= 2 areas exist in current list) */}
      {subTab !== 'ideas' && tabAreas.length >= 2 && (
        <div className="lw-row" style={{ gap: 6, marginTop: -8 }}>
          <button
            type="button"
            className={`lw-mode-tab ${areaFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setAreaFilter('ALL')}
          >
            全部
          </button>
          {tabAreas.map((a) => (
            <button
              key={a}
              type="button"
              className={`lw-mode-tab ${areaFilter === a ? 'active' : ''}`}
              onClick={() => setAreaFilter(a)}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {/* Ideas List */}
      {subTab === 'ideas' ? (
        snapshot.ideas.length === 0 ? (
          <div className="lw-empty">暂无待立项的想法</div>
        ) : (
          <div className="lw-list">
            {snapshot.ideas.map((idea) => (
              <div
                key={idea.relPath}
                className="lw-project-row"
                onClick={() => onOpenFile(idea.relPath)}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="lw-row" style={{ gap: 9 }}>
                    <span
                      style={{
                        width: 15,
                        height: 15,
                        borderRadius: '50%',
                        border: '1.5px dashed var(--lw-muted)',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontWeight: 600, fontSize: 14.5 }}>{idea.name}</span>
                  </div>
                  {idea.idea && (
                    <div
                      className="lw-meta"
                      style={{
                        marginTop: 3,
                        paddingLeft: 24,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {idea.idea}
                    </div>
                  )}
                </div>
                <div className="lw-row lw-hover-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm lw-btn-primary"
                    onClick={() => {
                      setPromoteTarget(idea)
                      setPromoteArea(snapshot.areas[0] ?? '个人')
                      setPromoteDeadline('')
                      setPromoteGoal('')
                    }}
                  >
                    立项
                  </button>
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm lw-btn-ghost"
                    onClick={() => {
                      setCancelTarget(idea)
                      setCancelReason('')
                    }}
                  >
                    放弃
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : visibleProjects.length === 0 ? (
        <div className="lw-empty">当前分组下没有项目</div>
      ) : (
        <div className="lw-list">
          {visibleProjects.map((p) => {
            const donePlan = p.plan.filter((i) => i.checked).length
            const totalPlan = p.plan.length
            const isOverdue =
              !p.archived &&
              p.status !== 'done' &&
              Boolean(p.deadline) &&
              p.deadline < snapshot.date

            return (
              <div
                key={p.homepageRelPath}
                className="lw-project-row"
                onClick={() => openProjectDetail(p)}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="lw-row" style={{ gap: 9 }}>
                    <IconProjectPie ratio={totalPlan > 0 ? donePlan / totalPlan : 0} size={16} />
                    <span style={{ fontWeight: 600, fontSize: 14.5 }}>{p.name}</span>
                  </div>
                  {(p.nextStep || p.goal) && (
                    <div
                      className="lw-meta"
                      style={{
                        marginTop: 3,
                        paddingLeft: 25,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {p.nextStep ? stripLeadingNumber(p.nextStep) : p.goal}
                    </div>
                  )}
                </div>

                <div className="lw-row" style={{ gap: 12, flexShrink: 0 }}>
                  {!p.archived && (
                    <div className="lw-hover-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="lw-btn lw-btn-sm lw-btn-ghost"
                        onClick={() =>
                          void onRunAction(async () => {
                            await api.createTaskFile(p.name)
                            onJumpToToday()
                          })
                        }
                      >
                        今日开做
                      </button>
                    </div>
                  )}
                  {p.area && <span className="lw-muted">{p.area}</span>}
                  {p.deadline ? (
                    <span
                      className="lw-muted"
                      style={isOverdue ? { color: 'var(--lw-danger)', fontWeight: 500 } : undefined}
                    >
                      {formatShortDate(p.deadline)}
                    </span>
                  ) : !p.created && p.timeframe ? (
                    <span className="lw-muted">{p.timeframe}</span>
                  ) : null}
                  {totalPlan > 0 && (
                    <span className="lw-muted" style={{ minWidth: 26, textAlign: 'right' }}>
                      {donePlan}/{totalPlan}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: New Idea */}
      {showNewIdea && (
        <div className="lw-backdrop lw-backdrop-center" onClick={() => setShowNewIdea(false)}>
          <form
            className="lw-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void handleCreateIdea(e)}
          >
            <div className="lw-panel-header">
              <strong>记一个想法</strong>
              <button type="button" className="lw-icon-btn" onClick={() => setShowNewIdea(false)}>
                <IconX />
              </button>
            </div>
            <div className="lw-panel-body lw-stack" style={{ gap: 12 }}>
              <div>
                <label className="lw-field-label">标题</label>
                <input
                  className="lw-input"
                  value={ideaTitle}
                  onChange={(e) => setIdeaTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="lw-field-label">想法</label>
                <textarea
                  className="lw-textarea"
                  value={ideaBody}
                  onChange={(e) => setIdeaBody(e.target.value)}
                />
              </div>
            </div>
            <div className="lw-panel-footer">
              <button
                type="button"
                className="lw-btn lw-btn-ghost"
                onClick={() => setShowNewIdea(false)}
              >
                取消
              </button>
              <button type="submit" className="lw-btn lw-btn-primary">
                保存
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: New Project */}
      {showNewProject && (
        <div className="lw-backdrop lw-backdrop-center" onClick={() => setShowNewProject(false)}>
          <form
            className="lw-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void handleCreateProject(e)}
          >
            <div className="lw-panel-header">
              <strong>新建项目</strong>
              <button
                type="button"
                className="lw-icon-btn"
                onClick={() => setShowNewProject(false)}
              >
                <IconX />
              </button>
            </div>
            <div className="lw-panel-body lw-stack" style={{ gap: 12 }}>
              <div>
                <label className="lw-field-label">名称</label>
                <input
                  className="lw-input"
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="lw-field-label">领域</label>
                  <select
                    className="lw-select"
                    value={projArea}
                    onChange={(e) => setProjArea(e.target.value)}
                  >
                    {snapshot.areas.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="lw-field-label">截止日期（可选）</label>
                  <input
                    type="date"
                    className="lw-input"
                    value={projDeadline}
                    onChange={(e) => setProjDeadline(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="lw-field-label">目标</label>
                <textarea
                  className="lw-textarea"
                  value={projGoal}
                  onChange={(e) => setProjGoal(e.target.value)}
                  placeholder="可选"
                />
              </div>
            </div>
            <div className="lw-panel-footer">
              <button
                type="button"
                className="lw-btn lw-btn-ghost"
                onClick={() => setShowNewProject(false)}
              >
                取消
              </button>
              <button type="submit" className="lw-btn lw-btn-primary">
                创建
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Promote Idea */}
      {promoteTarget && (
        <div className="lw-backdrop lw-backdrop-center" onClick={() => setPromoteTarget(null)}>
          <form
            className="lw-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void handlePromote(e)}
          >
            <div className="lw-panel-header">
              <strong>立项：{promoteTarget.name}</strong>
              <button type="button" className="lw-icon-btn" onClick={() => setPromoteTarget(null)}>
                <IconX />
              </button>
            </div>
            <div className="lw-panel-body lw-stack" style={{ gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="lw-field-label">领域</label>
                  <select
                    className="lw-select"
                    value={promoteArea}
                    onChange={(e) => setPromoteArea(e.target.value)}
                  >
                    {snapshot.areas.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="lw-field-label">截止日期（可选）</label>
                  <input
                    type="date"
                    className="lw-input"
                    value={promoteDeadline}
                    onChange={(e) => setPromoteDeadline(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="lw-field-label">目标</label>
                <textarea
                  className="lw-textarea"
                  value={promoteGoal}
                  onChange={(e) => setPromoteGoal(e.target.value)}
                />
              </div>
            </div>
            <div className="lw-panel-footer">
              <button
                type="button"
                className="lw-btn lw-btn-ghost"
                onClick={() => setPromoteTarget(null)}
              >
                取消
              </button>
              <button type="submit" className="lw-btn lw-btn-primary">
                确认立项
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Cancel Idea */}
      {cancelTarget && (
        <div className="lw-backdrop lw-backdrop-center" onClick={() => setCancelTarget(null)}>
          <form
            className="lw-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void handleCancelIdea(e)}
          >
            <div className="lw-panel-header">
              <strong>放弃想法：{cancelTarget.name}</strong>
              <button type="button" className="lw-icon-btn" onClick={() => setCancelTarget(null)}>
                <IconX />
              </button>
            </div>
            <div className="lw-panel-body">
              <label className="lw-field-label">原因（可选，将移入归档）</label>
              <textarea
                className="lw-textarea"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                autoFocus
              />
            </div>
            <div className="lw-panel-footer">
              <button
                type="button"
                className="lw-btn lw-btn-ghost"
                onClick={() => setCancelTarget(null)}
              >
                取消
              </button>
              <button type="submit" className="lw-btn lw-btn-danger">
                归档放弃
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
