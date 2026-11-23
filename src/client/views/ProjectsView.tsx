import React, { useEffect, useState } from 'react'
import type { BoardSnapshot, IdeaSummary, ProjectCard, ProjectStatus } from '../../shared/types.ts'
import type { RunActionFn } from '../App.tsx'
import { api } from '../api.ts'
import { IconCheck, IconFile, IconPlus, IconProjectPie, IconX } from '../components/Icons.tsx'

type LifeCycleTab = 'doing' | 'ideas' | 'todo' | 'pause' | 'archived'

interface ProjectsViewProps {
  snapshot: BoardSnapshot
  onOpenFile: (relPath: string) => void
  onJumpToToday: () => void
  onRunAction: RunActionFn
}

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

export function ProjectsView({
  snapshot,
  onOpenFile,
  onJumpToToday,
  onRunAction,
}: ProjectsViewProps) {
  const [subTab, setSubTab] = useState<LifeCycleTab>('doing')
  const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null)
  const [selectedArchived, setSelectedArchived] = useState(false)
  const [newPlanText, setNewPlanText] = useState('')

  // Modals
  const [showNewIdea, setShowNewIdea] = useState(false)
  const [ideaTitle, setIdeaTitle] = useState('')
  const [ideaBody, setIdeaBody] = useState('')

  const [showNewProject, setShowNewProject] = useState(false)
  const [projName, setProjName] = useState('')
  const [projArea, setProjArea] = useState(snapshot.areas[0] ?? '个人')
  const [projStart, setProjStart] = useState(() => localTodayIso())
  const [projDeadline, setProjDeadline] = useState('')
  const [projGoal, setProjGoal] = useState('')

  const [promoteTarget, setPromoteTarget] = useState<IdeaSummary | null>(null)
  const [promoteArea, setPromoteArea] = useState(snapshot.areas[0] ?? '个人')
  const [promoteStart, setPromoteStart] = useState(() => localTodayIso())
  const [promoteDeadline, setPromoteDeadline] = useState('')
  const [promoteGoal, setPromoteGoal] = useState('')

  const [cancelTarget, setCancelTarget] = useState<IdeaSummary | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (showNewIdea) setShowNewIdea(false)
      else if (showNewProject) setShowNewProject(false)
      else if (promoteTarget) setPromoteTarget(null)
      else if (cancelTarget) setCancelTarget(null)
      else if (selectedProjectName) setSelectedProjectName(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showNewIdea, showNewProject, promoteTarget, cancelTarget, selectedProjectName])

  const doingList = snapshot.projects.filter((p) => p.status === 'doing')
  const todoList = snapshot.projects.filter((p) => p.status === 'todo')
  const pauseList = snapshot.projects.filter(
    (p) => p.status === 'pause' || p.status === 'done' || p.status === 'cancel',
  )

  const visibleProjects =
    subTab === 'doing'
      ? doingList
      : subTab === 'todo'
        ? todoList
        : subTab === 'pause'
          ? pauseList
          : snapshot.archivedProjects

  const activeDetail: ProjectCard | null = selectedProjectName
    ? ((selectedArchived ? snapshot.archivedProjects : snapshot.projects).find(
        (p) => p.name === selectedProjectName,
      ) ?? null)
    : null

  const openDetail = (p: ProjectCard) => {
    setSelectedProjectName(p.name)
    setSelectedArchived(p.archived)
    setNewPlanText('')
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
                  { lineIndex: -Date.now(), checked: false, text: val, rawLine: `- [ ] ${val}` },
                ],
              },
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
    const start = projStart.trim() || localTodayIso()
    const deadline = projDeadline.trim()
    const goal = projGoal.trim() || undefined
    setProjName('')
    setProjStart(localTodayIso())
    setProjDeadline('')
    setProjGoal('')
    setShowNewProject(false)
    setSubTab('doing')
    await onRunAction(() =>
      api.createProject({
        name,
        area: projArea,
        start,
        deadline,
        goal,
      }),
    )
  }

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!promoteTarget) return
    const target = promoteTarget
    const start = promoteStart.trim() || localTodayIso()
    const deadline = promoteDeadline.trim()
    const goal = promoteGoal.trim() || undefined
    setPromoteTarget(null)
    setSubTab('doing')
    await onRunAction(
      () =>
        api.promoteIdea(target.name, {
          area: promoteArea,
          start,
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

  const updateDetailDate = (project: ProjectCard, field: 'start' | 'deadline', val: string) => {
    void onRunAction(() => api.updateProjectMeta(project.name, { [field]: val }), {
      optimistic: (prev) => ({
        ...prev,
        projects: prev.projects.map((p) =>
          p.name === project.name ? { ...p, [field]: val } : p,
        ),
      }),
    })
  }

  return (
    <div className="lw-canvas">
      {/* Clean Underline Tabs + Single Action */}
      <div className="lw-between" style={{ alignItems: 'flex-end' }}>
        <div className="lw-subtabs" style={{ flex: 1 }}>
          {(
            [
              ['doing', '进行中', doingList.length],
              ['ideas', '想法', snapshot.ideas.length],
              ['todo', '未开始', todoList.length],
              ['pause', '暂停', pauseList.length],
              ['archived', '归档', snapshot.archivedProjects.length],
            ] as Array<[LifeCycleTab, string, number]>
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              className={`lw-subtab ${subTab === key ? 'active' : ''}`}
              onClick={() => setSubTab(key)}
            >
              {label}
              {count > 0 && <span className="lw-muted">{count}</span>}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="lw-btn lw-btn-sm lw-btn-primary"
          onClick={() => {
            if (subTab === 'ideas') {
              setShowNewIdea(true)
            } else {
              setProjArea(snapshot.areas[0] ?? '个人')
              setProjStart(localTodayIso())
              setProjDeadline('')
              setShowNewProject(true)
            }
          }}
        >
          <IconPlus size={13} />
          {subTab === 'ideas' ? '记想法' : '新建项目'}
        </button>
      </div>

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
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{idea.name}</div>
                  {idea.idea && (
                    <div
                      className="lw-meta"
                      style={{
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {idea.idea}
                    </div>
                  )}
                </div>
                <div className="lw-row" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm lw-btn-primary"
                    onClick={() => {
                      setPromoteTarget(idea)
                      setPromoteArea(snapshot.areas[0] ?? '个人')
                      setPromoteStart(localTodayIso())
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
        /* Clean Things 3 Project List */
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
              <div key={p.homepageRelPath} className="lw-project-row" onClick={() => openDetail(p)}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="lw-row" style={{ gap: 9 }}>
                    <IconProjectPie ratio={totalPlan > 0 ? donePlan / totalPlan : 0} size={16} />
                    <span style={{ fontWeight: 600, fontSize: 14.5 }}>{p.name}</span>
                    {p.area && <span className="lw-muted">{p.area}</span>}
                    {p.deadline ? (
                      <span
                        className="lw-muted"
                        style={isOverdue ? { color: 'var(--lw-danger)', fontWeight: 500 } : undefined}
                      >
                        截止 {formatShortDate(p.deadline)}
                      </span>
                    ) : !p.start && p.timeframe ? (
                      <span className="lw-muted">{p.timeframe}</span>
                    ) : null}
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
                      {p.nextStep || p.goal}
                    </div>
                  )}
                </div>

                <div className="lw-row" style={{ gap: 10, flexShrink: 0 }}>
                  {!p.archived && (
                    <div className="lw-hover-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="lw-btn lw-btn-sm"
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
                  {totalPlan > 0 && (
                    <span className="lw-muted" style={{ minWidth: 28, textAlign: 'right' }}>
                      {donePlan}/{totalPlan}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Smooth Project Detail Drawer */}
      {activeDetail && (
        <div className="lw-backdrop" onClick={() => setSelectedProjectName(null)}>
          <div className="lw-drawer lw-drawer-sm" onClick={(e) => e.stopPropagation()}>
            <div className="lw-panel-header">
              <strong style={{ fontSize: 15.5 }}>{activeDetail.name}</strong>
              <button
                type="button"
                className="lw-icon-btn"
                onClick={() => setSelectedProjectName(null)}
              >
                <IconX />
              </button>
            </div>

            <div className="lw-panel-body lw-stack" style={{ gap: 20 }}>
              {!activeDetail.archived ? (
                <div className="lw-stack" style={{ gap: 12 }}>
                  <div className="lw-row" style={{ gap: 6 }}>
                    {(['doing', 'todo', 'pause', 'done'] as ProjectStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        className={`lw-btn lw-btn-sm ${
                          activeDetail.status === st ? 'lw-btn-primary' : 'lw-btn-ghost'
                        }`}
                        onClick={() =>
                          void onRunAction(() => api.updateProjectMeta(activeDetail.name, { status: st }), {
                            optimistic: (prev) => ({
                              ...prev,
                              projects: prev.projects.map((p) =>
                                p.name === activeDetail.name ? { ...p, status: st } : p,
                              ),
                            }),
                          })
                        }
                      >
                        {STATUS_LABELS[st]}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="lw-field-label">领域</label>
                    <select
                      className="lw-select"
                      value={activeDetail.area || snapshot.areas[0] || ''}
                      onChange={(e) => {
                        const area = e.target.value
                        void onRunAction(() => api.updateProjectMeta(activeDetail.name, { area }), {
                          optimistic: (prev) => ({
                            ...prev,
                            projects: prev.projects.map((p) =>
                              p.name === activeDetail.name ? { ...p, area } : p,
                            ),
                          }),
                        })
                      }}
                    >
                      {Array.from(
                        new Set([...snapshot.areas, ...(activeDetail.area ? [activeDetail.area] : [])]),
                      ).map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="lw-field-label">开始日期 (start)</label>
                      <input
                        type="date"
                        className="lw-input"
                        value={activeDetail.start}
                        onChange={(e) => updateDetailDate(activeDetail, 'start', e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="lw-between" style={{ marginBottom: 5 }}>
                        <label className="lw-field-label" style={{ margin: 0 }}>
                          截止日期 (deadline)
                        </label>
                        {activeDetail.deadline && (
                          <button
                            type="button"
                            className="lw-btn lw-btn-sm lw-btn-ghost"
                            style={{ height: 18, padding: '0 4px', fontSize: 11.5 }}
                            onClick={() => updateDetailDate(activeDetail, 'deadline', '')}
                          >
                            清除
                          </button>
                        )}
                      </div>
                      <input
                        type="date"
                        className="lw-input"
                        value={activeDetail.deadline}
                        onChange={(e) => updateDetailDate(activeDetail, 'deadline', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="lw-row">
                  <span className="lw-tag">{STATUS_LABELS[activeDetail.status]}</span>
                  {activeDetail.area && <span className="lw-tag">{activeDetail.area}</span>}
                  {activeDetail.start && <span className="lw-tag">起 {activeDetail.start}</span>}
                  {activeDetail.deadline && <span className="lw-tag">止 {activeDetail.deadline}</span>}
                </div>
              )}

              {activeDetail.goal && (
                <div>
                  <div className="lw-field-label">目标</div>
                  <div style={{ fontSize: 13.5, color: 'var(--lw-text-2)' }}>
                    {activeDetail.goal}
                  </div>
                </div>
              )}

              {/* Plan checklist */}
              <div className="lw-stack" style={{ gap: 6 }}>
                <div className="lw-field-label">计划</div>
                <div className="lw-list">
                  {activeDetail.plan.map((item) => (
                    <div key={item.lineIndex} className="lw-item-row">
                      <button
                        type="button"
                        className={`lw-check ${item.checked ? 'checked' : ''}`}
                        disabled={activeDetail.archived}
                        onClick={() => void handleTogglePlan(activeDetail, item.lineIndex)}
                      >
                        {item.checked && <IconCheck />}
                      </button>
                      <span className={`lw-item-title ${item.checked ? 'lw-item-done' : ''}`}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
                {!activeDetail.archived && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      void handleAddPlan(activeDetail)
                    }}
                  >
                    <input
                      className="lw-inline-input"
                      style={{ paddingLeft: 28, fontSize: 13.5 }}
                      value={newPlanText}
                      onChange={(e) => setNewPlanText(e.target.value)}
                      placeholder="+ 添加计划项"
                    />
                  </form>
                )}
              </div>

              {/* Files */}
              <div className="lw-stack" style={{ gap: 6 }}>
                <div className="lw-field-label">文件</div>
                <div className="lw-row" style={{ gap: 6 }}>
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm"
                    onClick={() => onOpenFile(activeDetail.homepageRelPath)}
                  >
                    <IconFile size={13} /> 主页
                  </button>
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm"
                    onClick={() => onOpenFile(activeDetail.resourcesRelPath)}
                  >
                    资料
                  </button>
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm"
                    onClick={() => onOpenFile(activeDetail.outputsRelPath)}
                  >
                    产出
                  </button>
                  {activeDetail.taskFiles[0] && (
                    <button
                      type="button"
                      className="lw-btn lw-btn-sm"
                      onClick={() => onOpenFile(activeDetail.taskFiles[0]!.relPath)}
                    >
                      最新任务
                    </button>
                  )}
                  {activeDetail.latestReviewRelPath && (
                    <button
                      type="button"
                      className="lw-btn lw-btn-sm"
                      onClick={() => onOpenFile(activeDetail.latestReviewRelPath!)}
                    >
                      最新复盘
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="lw-panel-footer">
              {activeDetail.archived ? (
                <button
                  type="button"
                  className="lw-btn lw-btn-primary"
                  onClick={() =>
                    void onRunAction(
                      async () => {
                        await api.restoreProject(activeDetail.name)
                        setSelectedProjectName(null)
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
                    className="lw-btn lw-btn-ghost"
                    style={{ marginRight: 'auto' }}
                    onClick={() =>
                      void onRunAction(
                        async () => {
                          await api.archiveProject(activeDetail.name, 'done')
                          setSelectedProjectName(null)
                        },
                        { toast: '已归档项目' },
                      )
                    }
                  >
                    归档
                  </button>
                  <button
                    type="button"
                    className="lw-btn lw-btn-primary"
                    onClick={() =>
                      void onRunAction(async () => {
                        await api.createTaskFile(activeDetail.name)
                        setSelectedProjectName(null)
                        onJumpToToday()
                      })
                    }
                  >
                    今日开做
                  </button>
                </>
              )}
            </div>
          </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="lw-field-label">开始日期</label>
                  <input
                    type="date"
                    className="lw-input"
                    value={projStart}
                    onChange={(e) => setProjStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="lw-field-label">截止日期（可选，不填为长期）</label>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="lw-field-label">开始日期</label>
                  <input
                    type="date"
                    className="lw-input"
                    value={promoteStart}
                    onChange={(e) => setPromoteStart(e.target.value)}
                  />
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
              <label className="lw-field-label">原因（可选，将移入 99_archives）</label>
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
