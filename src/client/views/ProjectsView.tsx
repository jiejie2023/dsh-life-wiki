import React, { useState } from 'react'
import type { BoardSnapshot, IdeaSummary, ProjectCard, ProjectStatus } from '../../shared/types.ts'
import { api } from '../api.ts'

type LifeCycleTab = 'doing' | 'ideas' | 'todo' | 'pause' | 'archived'

interface ProjectsViewProps {
  snapshot: BoardSnapshot
  onOpenFile: (relPath: string) => void
  onJumpToToday: () => void
  onRunAction: (action: () => Promise<unknown>, toastText?: string) => Promise<void>
}

export function ProjectsView({
  snapshot,
  onOpenFile,
  onJumpToToday,
  onRunAction,
}: ProjectsViewProps) {
  const [subTab, setSubTab] = useState<LifeCycleTab>('doing')
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({})
  const [newPlanText, setNewPlanText] = useState<Record<string, string>>({})

  // Modals
  const [showNewIdea, setShowNewIdea] = useState(false)
  const [ideaTitle, setIdeaTitle] = useState('')
  const [ideaBody, setIdeaBody] = useState('')

  const [showNewProject, setShowNewProject] = useState(false)
  const [projName, setProjName] = useState('')
  const [projArea, setProjArea] = useState(snapshot.areas[0] ?? '个人')
  const [projTimeframe, setProjTimeframe] = useState('')
  const [projIdea, setProjIdea] = useState('')
  const [projGoal, setProjGoal] = useState('')

  const [promoteTarget, setPromoteTarget] = useState<IdeaSummary | null>(null)
  const [promoteArea, setPromoteArea] = useState(snapshot.areas[0] ?? '个人')
  const [promoteTimeframe, setPromoteTimeframe] = useState('')
  const [promoteGoal, setPromoteGoal] = useState('')

  const [cancelTarget, setCancelTarget] = useState<IdeaSummary | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const [archiveTarget, setArchiveTarget] = useState<ProjectCard | null>(null)
  const [archiveStatus, setArchiveStatus] = useState<'done' | 'cancel'>('done')

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

  const handleCreateIdea = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ideaTitle.trim()) return
    await onRunAction(async () => {
      await api.createIdea(ideaTitle.trim(), ideaBody.trim())
      setIdeaTitle('')
      setIdeaBody('')
      setShowNewIdea(false)
      setSubTab('ideas')
    }, '已记录新想法')
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projName.trim()) return
    await onRunAction(async () => {
      await api.createProject({
        name: projName.trim(),
        area: projArea,
        timeframe: projTimeframe.trim() || undefined,
        idea: projIdea.trim() || undefined,
        goal: projGoal.trim() || undefined,
      })
      setProjName('')
      setProjTimeframe('')
      setProjIdea('')
      setProjGoal('')
      setShowNewProject(false)
      setSubTab('doing')
    }, '已新建项目（五件套已就绪）')
  }

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!promoteTarget) return
    await onRunAction(async () => {
      await api.promoteIdea(promoteTarget.name, {
        area: promoteArea,
        timeframe: promoteTimeframe.trim() || undefined,
        goal: promoteGoal.trim() || undefined,
      })
      setPromoteTarget(null)
      setSubTab('doing')
    }, '想法已正式立项')
  }

  const handleCancelIdea = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cancelTarget) return
    await onRunAction(async () => {
      await api.cancelIdea(cancelTarget.name, cancelReason.trim() || undefined)
      setCancelTarget(null)
      setCancelReason('')
    }, '想法已归档到 99_archives')
  }

  const handleArchiveProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!archiveTarget) return
    await onRunAction(async () => {
      await api.archiveProject(archiveTarget.name, archiveStatus)
      setArchiveTarget(null)
    }, '项目已归档')
  }

  const renderProjectCard = (p: ProjectCard) => {
    const donePlan = p.plan.filter((i) => i.checked).length
    const totalPlan = p.plan.length
    const pct = totalPlan > 0 ? Math.round((donePlan / totalPlan) * 100) : 0
    const planOpen = Boolean(expandedPlans[p.name])

    return (
      <div key={p.homepageRelPath} className="lw-card lw-stack">
        <div className="lw-between">
          <div className="lw-row">
            <h3 className="lw-card-title">{p.name}</h3>
            {p.archived ? (
              <span className="lw-badge">{p.status}</span>
            ) : (
              <select
                className="lw-select"
                style={{ width: 'auto', padding: '2px 8px', fontSize: 12 }}
                value={p.status}
                onChange={(e) =>
                  void onRunAction(
                    () =>
                      api.updateProjectMeta(p.name, {
                        status: e.target.value as ProjectStatus,
                      }),
                    '已更新项目状态',
                  )
                }
              >
                <option value="doing">进行中 doing</option>
                <option value="todo">未开始 todo</option>
                <option value="pause">暂停 pause</option>
                <option value="done">已完成 done</option>
              </select>
            )}
            {p.archived ? (
              p.area && <span className="lw-badge">{p.area}</span>
            ) : (
              <select
                className="lw-select"
                style={{ width: 'auto', padding: '2px 8px', fontSize: 12 }}
                value={p.area || snapshot.areas[0] || ''}
                onChange={(e) =>
                  void onRunAction(
                    () => api.updateProjectMeta(p.name, { area: e.target.value }),
                    '已更新领域',
                  )
                }
              >
                {Array.from(new Set([...snapshot.areas, ...(p.area ? [p.area] : [])])).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            )}
            {p.timeframe && <span className="lw-badge">{p.timeframe}</span>}
            {!p.archived && p.status === 'doing' && p.staleDays !== null && p.staleDays >= 7 && (
              <span className="lw-badge lw-badge-warn">已停滞 {p.staleDays} 天</span>
            )}
          </div>

          <div className="lw-row">
            {p.archived ? (
              <button
                type="button"
                className="lw-btn lw-btn-sm lw-btn-primary"
                onClick={() =>
                  void onRunAction(
                    async () => {
                      await api.restoreProject(p.name)
                    },
                    '项目已恢复到进行中',
                  )
                }
              >
                恢复项目
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="lw-btn lw-btn-sm"
                  onClick={() =>
                    void onRunAction(async () => {
                      await api.createTaskFile(p.name)
                      onJumpToToday()
                    }, '已打开今日任务')
                  }
                >
                  今日开做
                </button>
                <button
                  type="button"
                  className="lw-btn lw-btn-sm lw-btn-ghost"
                  onClick={() => {
                    setArchiveTarget(p)
                    setArchiveStatus('done')
                  }}
                >
                  归档
                </button>
              </>
            )}
          </div>
        </div>

        {(p.goal || p.idea) && (
          <div style={{ fontSize: 13, color: 'var(--lw-text-2)' }}>{p.goal || p.idea}</div>
        )}

        {p.nextStep && !p.archived && (
          <div
            style={{
              fontSize: 13,
              padding: '7px 10px',
              borderRadius: 7,
              background: 'var(--lw-accent-soft)',
              color: 'var(--lw-accent-text)',
            }}
          >
            <strong>下一步：</strong>
            {p.nextStep}
          </div>
        )}

        {totalPlan > 0 && (
          <div className="lw-stack" style={{ gap: 5 }}>
            <div className="lw-between" style={{ fontSize: 12 }}>
              <span className="lw-muted">
                计划进度 {donePlan} / {totalPlan} ({pct}%)
              </span>
              {!p.archived && (
                <button
                  type="button"
                  className="lw-btn lw-btn-sm lw-btn-ghost"
                  onClick={() =>
                    setExpandedPlans((prev) => ({ ...prev, [p.name]: !planOpen }))
                  }
                >
                  {planOpen ? '收起计划' : '展开计划'}
                </button>
              )}
            </div>
            <div className="lw-progress">
              <div className="lw-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {!p.archived && (planOpen || totalPlan === 0) && (
          <div className="lw-stack" style={{ gap: 6 }}>
            {p.plan.length > 0 && (
              <div className="lw-task-list">
                {p.plan.map((item) => (
                  <label key={item.lineIndex} className="lw-task-item" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() =>
                        void onRunAction(() => api.togglePlanItem(p.name, item.lineIndex))
                      }
                    />
                    <span className={`lw-task-text ${item.checked ? 'lw-task-done' : ''}`}>
                      {item.text}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <form
              className="lw-row"
              onSubmit={(e) => {
                e.preventDefault()
                const val = (newPlanText[p.name] ?? '').trim()
                if (!val) return
                void onRunAction(async () => {
                  await api.addPlanItem(p.name, val)
                  setNewPlanText((prev) => ({ ...prev, [p.name]: '' }))
                  setExpandedPlans((prev) => ({ ...prev, [p.name]: true }))
                }, '已添加到项目计划')
              }}
            >
              <input
                className="lw-input"
                style={{ flex: 1 }}
                value={newPlanText[p.name] ?? ''}
                onChange={(e) =>
                  setNewPlanText((prev) => ({ ...prev, [p.name]: e.target.value }))
                }
                placeholder="+ 新增一条项目计划，回车保存"
              />
              <button
                type="submit"
                className="lw-btn lw-btn-sm"
                disabled={!(newPlanText[p.name] ?? '').trim()}
              >
                添加
              </button>
            </form>
          </div>
        )}

        {/* Quick file access */}
        <div className="lw-row" style={{ paddingTop: 4 }}>
          <button
            type="button"
            className="lw-btn lw-btn-sm lw-btn-ghost"
            onClick={() => onOpenFile(p.homepageRelPath)}
          >
            主页
          </button>
          <button
            type="button"
            className="lw-btn lw-btn-sm lw-btn-ghost"
            onClick={() => onOpenFile(p.resourcesRelPath)}
          >
            资料
          </button>
          <button
            type="button"
            className="lw-btn lw-btn-sm lw-btn-ghost"
            onClick={() => onOpenFile(p.outputsRelPath)}
          >
            产出
          </button>
          {p.taskFiles[0] && (
            <button
              type="button"
              className="lw-btn lw-btn-sm lw-btn-ghost"
              onClick={() => onOpenFile(p.taskFiles[0]!.relPath)}
            >
              最新任务 ({p.taskFiles[0]!.date})
            </button>
          )}
          {p.latestReviewRelPath && (
            <button
              type="button"
              className="lw-btn lw-btn-sm lw-btn-ghost"
              onClick={() => onOpenFile(p.latestReviewRelPath!)}
            >
              最新复盘
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="lw-container">
      {/* Sub-tabs & Actions */}
      <div className="lw-between">
        <div className="lw-tabs">
          <button
            type="button"
            className={`lw-tab ${subTab === 'doing' ? 'active' : ''}`}
            onClick={() => setSubTab('doing')}
          >
            进行中 <span className="lw-muted">{doingList.length}</span>
          </button>
          <button
            type="button"
            className={`lw-tab ${subTab === 'ideas' ? 'active' : ''}`}
            onClick={() => setSubTab('ideas')}
          >
            想法 <span className="lw-muted">{snapshot.ideas.length}</span>
          </button>
          <button
            type="button"
            className={`lw-tab ${subTab === 'todo' ? 'active' : ''}`}
            onClick={() => setSubTab('todo')}
          >
            未开始 <span className="lw-muted">{todoList.length}</span>
          </button>
          <button
            type="button"
            className={`lw-tab ${subTab === 'pause' ? 'active' : ''}`}
            onClick={() => setSubTab('pause')}
          >
            暂停/收尾 <span className="lw-muted">{pauseList.length}</span>
          </button>
          <button
            type="button"
            className={`lw-tab ${subTab === 'archived' ? 'active' : ''}`}
            onClick={() => setSubTab('archived')}
          >
            已归档 <span className="lw-muted">{snapshot.archivedProjects.length}</span>
          </button>
        </div>

        <div className="lw-row">
          <button
            type="button"
            className="lw-btn"
            onClick={() => setShowNewIdea(true)}
          >
            + 新建想法
          </button>
          <button
            type="button"
            className="lw-btn lw-btn-primary"
            onClick={() => {
              setProjArea(snapshot.areas[0] ?? '个人')
              setShowNewProject(true)
            }}
          >
            + 新建项目
          </button>
        </div>
      </div>

      {/* Ideas Tab */}
      {subTab === 'ideas' ? (
        snapshot.ideas.length === 0 ? (
          <div className="lw-empty">
            <div style={{ fontWeight: 600, color: 'var(--lw-text)', marginBottom: 6 }}>
              还没有待立项的想法
            </div>
            <div>拿不准要不要做的事，先放在「想法」里观察一阵，确定要做再一键立项。</div>
          </div>
        ) : (
          <div className="lw-grid-2">
            {snapshot.ideas.map((idea) => (
              <div key={idea.relPath} className="lw-card lw-stack">
                <div className="lw-between">
                  <h3 className="lw-card-title">{idea.name}</h3>
                  <span className="lw-badge lw-badge-info">想法</span>
                </div>
                {idea.idea && <div style={{ fontSize: 13 }}>{idea.idea}</div>}
                {idea.judgment && (
                  <div className="lw-muted">
                    <strong>当前判断：</strong>
                    {idea.judgment}
                  </div>
                )}
                <div className="lw-row" style={{ marginTop: 'auto', paddingTop: 6 }}>
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm lw-btn-primary"
                    onClick={() => {
                      setPromoteTarget(idea)
                      setPromoteArea(snapshot.areas[0] ?? '个人')
                      setPromoteTimeframe('')
                      setPromoteGoal('')
                    }}
                  >
                    正式立项
                  </button>
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm"
                    onClick={() => onOpenFile(idea.relPath)}
                  >
                    查看/编辑
                  </button>
                  <button
                    type="button"
                    className="lw-btn lw-btn-sm lw-btn-ghost"
                    onClick={() => {
                      setCancelTarget(idea)
                      setCancelReason('')
                    }}
                  >
                    放弃归档
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : visibleProjects.length === 0 ? (
        <div className="lw-empty">当前分组下没有项目</div>
      ) : (
        <div className="lw-stack" style={{ gap: 14 }}>
          {visibleProjects.map(renderProjectCard)}
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
              <strong>新建想法（放入 00_ideas）</strong>
              <button
                type="button"
                className="lw-btn lw-btn-ghost lw-btn-sm"
                onClick={() => setShowNewIdea(false)}
              >
                关闭
              </button>
            </div>
            <div className="lw-panel-body lw-stack">
              <div>
                <label className="lw-muted">想法标题</label>
                <input
                  className="lw-input"
                  value={ideaTitle}
                  onChange={(e) => setIdeaTitle(e.target.value)}
                  placeholder="例如：写一本个人方法论小册子"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="lw-muted">核心想法（为什么想做、现在怎么看）</label>
                <textarea
                  className="lw-textarea"
                  value={ideaBody}
                  onChange={(e) => setIdeaBody(e.target.value)}
                  placeholder="先把念头写清楚，不需要立刻拆计划…"
                />
              </div>
            </div>
            <div className="lw-panel-footer">
              <button type="button" className="lw-btn" onClick={() => setShowNewIdea(false)}>
                取消
              </button>
              <button type="submit" className="lw-btn lw-btn-primary">
                保存想法
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
              <strong>新建项目（自动生成五件套）</strong>
              <button
                type="button"
                className="lw-btn lw-btn-ghost lw-btn-sm"
                onClick={() => setShowNewProject(false)}
              >
                关闭
              </button>
            </div>
            <div className="lw-panel-body lw-stack">
              <div>
                <label className="lw-muted">项目名称</label>
                <input
                  className="lw-input"
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  placeholder="例如：英语口语提升"
                  autoFocus
                  required
                />
              </div>
              <div className="lw-grid-2">
                <div>
                  <label className="lw-muted">所属领域</label>
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
                  <label className="lw-muted">时间范围（可选）</label>
                  <input
                    className="lw-input"
                    value={projTimeframe}
                    onChange={(e) => setProjTimeframe(e.target.value)}
                    placeholder="例如：2026-Q4 或 长期"
                  />
                </div>
              </div>
              <div>
                <label className="lw-muted">项目目标（做到什么程度算成）</label>
                <textarea
                  className="lw-textarea"
                  value={projGoal}
                  onChange={(e) => setProjGoal(e.target.value)}
                  placeholder="写一个可检验的结果…"
                />
              </div>
              <div>
                <label className="lw-muted">缘起想法（可选）</label>
                <input
                  className="lw-input"
                  value={projIdea}
                  onChange={(e) => setProjIdea(e.target.value)}
                  placeholder="为什么启动这个项目？"
                />
              </div>
            </div>
            <div className="lw-panel-footer">
              <button type="button" className="lw-btn" onClick={() => setShowNewProject(false)}>
                取消
              </button>
              <button type="submit" className="lw-btn lw-btn-primary">
                创建项目
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
              <strong>正式立项：{promoteTarget.name}</strong>
              <button
                type="button"
                className="lw-btn lw-btn-ghost lw-btn-sm"
                onClick={() => setPromoteTarget(null)}
              >
                关闭
              </button>
            </div>
            <div className="lw-panel-body lw-stack">
              <div className="lw-muted">
                立项后将在 <span className="lw-mono">projects/{promoteTarget.name}/</span> 生成标准五件套，并保留原来的想法记录。
              </div>
              <div className="lw-grid-2">
                <div>
                  <label className="lw-muted">所属领域</label>
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
                  <label className="lw-muted">时间范围（可选）</label>
                  <input
                    className="lw-input"
                    value={promoteTimeframe}
                    onChange={(e) => setPromoteTimeframe(e.target.value)}
                    placeholder="例如：2026-Q4"
                  />
                </div>
              </div>
              <div>
                <label className="lw-muted">阶段目标</label>
                <textarea
                  className="lw-textarea"
                  value={promoteGoal}
                  onChange={(e) => setPromoteGoal(e.target.value)}
                  placeholder="立项后第一阶段希望达成什么？"
                />
              </div>
            </div>
            <div className="lw-panel-footer">
              <button type="button" className="lw-btn" onClick={() => setPromoteTarget(null)}>
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
              <button
                type="button"
                className="lw-btn lw-btn-ghost lw-btn-sm"
                onClick={() => setCancelTarget(null)}
              >
                关闭
              </button>
            </div>
            <div className="lw-panel-body lw-stack">
              <div className="lw-muted">
                文件不会被删除，而是移入 <span className="lw-mono">projects/99_archives/</span> 保留记录。
              </div>
              <div>
                <label className="lw-muted">放弃原因（可选）</label>
                <textarea
                  className="lw-textarea"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="为什么决定不做了？以后回顾时很有参考价值。"
                />
              </div>
            </div>
            <div className="lw-panel-footer">
              <button type="button" className="lw-btn" onClick={() => setCancelTarget(null)}>
                取消
              </button>
              <button type="submit" className="lw-btn lw-btn-danger">
                归档放弃
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Archive Project */}
      {archiveTarget && (
        <div className="lw-backdrop lw-backdrop-center" onClick={() => setArchiveTarget(null)}>
          <form
            className="lw-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void handleArchiveProject(e)}
          >
            <div className="lw-panel-header">
              <strong>归档项目：{archiveTarget.name}</strong>
              <button
                type="button"
                className="lw-btn lw-btn-ghost lw-btn-sm"
                onClick={() => setArchiveTarget(null)}
              >
                关闭
              </button>
            </div>
            <div className="lw-panel-body lw-stack">
              <div className="lw-muted">
                归档将把整个项目文件夹移动到 <span className="lw-mono">projects/99_archives/</span>，随时可以一键恢复。
              </div>
              <div className="lw-row">
                <label className="lw-row" style={{ cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="archiveStatus"
                    checked={archiveStatus === 'done'}
                    onChange={() => setArchiveStatus('done')}
                  />
                  顺利完成 (done)
                </label>
                <label className="lw-row" style={{ cursor: 'pointer', marginLeft: 12 }}>
                  <input
                    type="radio"
                    name="archiveStatus"
                    checked={archiveStatus === 'cancel'}
                    onChange={() => setArchiveStatus('cancel')}
                  />
                  主动终止 (cancel)
                </label>
              </div>
            </div>
            <div className="lw-panel-footer">
              <button type="button" className="lw-btn" onClick={() => setArchiveTarget(null)}>
                取消
              </button>
              <button type="submit" className="lw-btn lw-btn-primary">
                确认归档
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
