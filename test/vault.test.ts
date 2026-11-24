import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { clearSampleData, initializeVault, inspectDirectory } from '../src/core/scaffold.ts'
import { parseTaskFile } from '../src/core/markdown.ts'
import { createLifeWikiEngine } from '../src/core/vault.ts'
import { applyIdeaSections, parseIdeaSections } from '../src/client/ideaMarkdown.ts'
import { applyReviewSections, parseReviewSections } from '../src/client/reviewMarkdown.ts'
import { applyOptimisticTaskTextEdit, sortTasks } from '../src/shared/taskFormat.ts'
import type { TaskItem } from '../src/shared/types.ts'

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'life-wiki-test-'))
  try {
    await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe('LifeWiki Onboarding & Sample Cleanup (Seam 1A)', () => {
  it('inspects empty folder, initializes sample vault, clears sample while preserving user items', async () => {
    await withTempDir(async (dir) => {
      const before = await inspectDirectory(dir)
      assert.equal(before.isEmpty, true)
      assert.equal(before.looksLikeVault, false)

      const now = new Date('2026-11-24T09:30:00+08:00')
      await initializeVault(dir, { withSample: true, initGit: false, now })

      const after = await inspectDirectory(dir)
      assert.equal(after.looksLikeVault, true)
      assert.equal(after.hasProjects, true)
      assert.equal(after.hasInbox, true)

      const engine = createLifeWikiEngine(dir, { now: () => now })
      let snap = await engine.getSnapshot('2026-11-24')
      assert.equal(snap.hasSampleData, true)
      assert.equal(snap.projects.length, 1)
      assert.equal(snap.ideas.length, 1)
      assert.equal(snap.knowledge.wikiPages.length, 1)
      assert.equal(snap.knowledge.rawEntries.length, 1)
      assert.equal(snap.diaries.length, 1)

      // Add a user-owned project and inbox item before clearing sample data
      await engine.createProject({
        name: '我的真实项目',
        area: '工作',
        timeframe: '本月',
        idea: '用户自己创建的项目',
        goal: '保留不被示例清理误删',
      })
      await engine.addInboxItem('用户自己的灵感', '2026-11-24')

      const cleared = await clearSampleData(dir)
      assert.ok(cleared.removedCount >= 5)

      snap = await engine.getSnapshot('2026-11-24')
      assert.equal(snap.hasSampleData, false)
      assert.equal(snap.projects.length, 1)
      assert.equal(snap.projects[0]?.name, '我的真实项目')
      assert.equal(snap.ideas.length, 0)
      assert.equal(snap.inbox.items.length, 1)
      assert.match(snap.inbox.items[0]!.text, /用户自己的灵感/)
    })
  })
})

describe('LifeWiki Full Manual Closed-Loop (Seam 1B)', () => {
  it('runs complete loop: inbox -> idea -> promote -> task -> weekly review -> archive -> wiki -> areas', async () => {
    await withTempDir(async (dir) => {
      const now = new Date('2026-11-24T10:00:00+08:00') // 2026-W48
      await initializeVault(dir, { withSample: false, initGit: false, now })
      const engine = createLifeWikiEngine(dir, { now: () => now })

      // 1. Customize areas and verify persistence in system/schema.md
      await engine.updateAreas(['工作', '学习', '健康', '副业'])
      let snap = await engine.getSnapshot('2026-11-24')
      assert.deepEqual(snap.areas, ['工作', '学习', '健康', '副业'])

      // 2. Inbox -> Idea -> Promote to full 5-piece project
      await engine.addInboxItem('做一款播客剪辑小工具', '2026-11-24')
      snap = await engine.getSnapshot('2026-11-24')
      const inboxLine = snap.inbox.items[0]!.lineIndex
      const ideaPath = await engine.inboxToIdea(inboxLine, '播客剪辑工具')
      assert.equal(ideaPath, 'projects/00_ideas/播客剪辑工具.md')

      const projHome = await engine.promoteIdeaToProject('播客剪辑工具', {
        area: '副业',
        created: '2026-11-24',
        deadline: '2026-12-31',
        goal: '完成音频去静音脚本并发布首版',
      })
      assert.equal(projHome, 'projects/播客剪辑工具/播客剪辑工具.md')
      snap = await engine.getSnapshot('2026-11-24')
      assert.equal(snap.projects[0]?.created, '2026-11-24')
      assert.equal(snap.projects[0]?.deadline, '2026-12-31')

      // 2b. Inline update project goal & verify plan ignores empty placeholder items
      await engine.updateProjectMeta('播客剪辑工具', {
        goal: '完成音频去静音脚本、补齐测试并发布首版',
      })
      snap = await engine.getSnapshot('2026-11-24')
      assert.equal(snap.projects[0]?.goal, '完成音频去静音脚本、补齐测试并发布首版')
      assert.equal(snap.projects[0]?.plan.length, 0)
      await engine.addPlanItem('播客剪辑工具', '设计 CLI 参数与去静音阈值')
      snap = await engine.getSnapshot('2026-11-24')
      assert.equal(snap.projects[0]?.plan.length, 1)
      assert.match(snap.projects[0]!.plan[0]!.text, /设计 CLI 参数与去静音阈值/)

      // 3. Add and complete tasks with priority & minutes + append diary
      const taskFile = await engine.addTask(
        '播客剪辑工具',
        '调研 ffmpeg 静音检测参数',
        '2026-11-24',
        'high',
      )
      snap = await engine.getSnapshot('2026-11-24')
      const grp = snap.today.groups.find((g) => g.projectName === '播客剪辑工具')!
      assert.equal(grp.tasks[0]?.priority, 'high')
      await engine.setTaskPriority(taskFile, grp.tasks[0]!.lineIndex, 'low')
      await engine.toggleTask(taskFile, grp.tasks[0]!.lineIndex, 45)
      await engine.setTaskMinutes(taskFile, grp.tasks[0]!.lineIndex, 60)
      const taskRaw60 = await readFile(join(dir, taskFile), 'utf8')
      assert.match(taskRaw60, /\[低\].*（60 min）/)
      snap = await engine.getSnapshot('2026-11-24')
      assert.equal(snap.today.groups.find((g) => g.projectName === '播客剪辑工具')?.totalMinutes, 60)
      assert.equal(snap.today.groups.find((g) => g.projectName === '播客剪辑工具')?.tasks[0]?.priority, 'low')
      await engine.setTaskMinutes(taskFile, grp.tasks[0]!.lineIndex, 45)
      await engine.appendDiary('今天推进了播客工具调研，效率不错。', '2026-11-24', '21:10')

      // 4. Auto-generate weekly review draft from this week's tasks & finalize it
      const reviewPath = await engine.generateWeeklyReviewDraft('播客剪辑工具', '2026-W48')
      assert.equal(reviewPath, 'projects/播客剪辑工具/03_reviews/2026-W48.md')
      const reviewRaw = await readFile(join(dir, reviewPath), 'utf8')
      assert.match(reviewRaw, /调研 ffmpeg 静音检测参数/)
      assert.match(reviewRaw, /0\.8 小时|45 分钟/)

      await engine.updateReview(reviewPath, { status: 'final', nextWeek: ['写出第一版 CLI'] })

      // 5. Create wiki page and verify index.md & log.md updated
      const wikiPath = await engine.createWikiPage('ffmpeg 静音检测笔记', '使用 silencedetect 滤镜。', [
        'projects/播客剪辑工具/01_tasks/2026-11-24.md',
      ])
      assert.equal(wikiPath, 'wiki/ffmpeg 静音检测笔记.md')
      const idxRaw = await readFile(join(dir, 'wiki/index.md'), 'utf8')
      assert.match(idxRaw, /ffmpeg 静音检测笔记/)

      // 6. Archive project -> moves into 99_archives/ -> restore back
      await engine.archiveProject('播客剪辑工具', 'done')
      snap = await engine.getSnapshot('2026-11-24')
      assert.equal(snap.projects.length, 0)
      assert.equal(snap.archivedProjects.length, 1)
      assert.equal(snap.archivedProjects[0]?.status, 'done')

      await engine.restoreProject('播客剪辑工具')
      snap = await engine.getSnapshot('2026-11-24')
      assert.equal(snap.projects.length, 1)
      assert.equal(snap.projects[0]?.status, 'doing')
      assert.equal(snap.reviewCenter.weekDiaries.length, 1)
      assert.equal(snap.knowledge.wikiPages.length, 1)
    })
  })

  it('parses and updates idea evaluation sections losslessly while preserving frontmatter and other sections', () => {
    const sample = [
      '---',
      'status: idea',
      'area: ',
      'created: 2026-11-24',
      'deadline: ',
      '---',
      '',
      '## 想法',
      '',
      '整理年底复盘清单',
      '',
      '## 动机',
      '',
      '**为什么想做：** 每年年底容易一晃而过',
      '**不做会怎样：** 重复踩坑',
      '**要付出什么：** 2 小时',
      '**做完能带来什么真实变化：** 带着清晰方向进入下一年',
      '',
      '## 认知',
      '',
      '先翻过去三个月日记',
      '',
      '## 判断',
      '',
      '再想想：周末再确认。（2026-11-20）',
      '',
      '## 目标',
      '',
      '保留原目标',
      '',
    ].join('\n')

    const parsed = parseIdeaSections(sample)
    assert.equal(parsed.idea, '整理年底复盘清单')
    assert.equal(parsed.why, '每年年底容易一晃而过')
    assert.equal(parsed.realChange, '带着清晰方向进入下一年')
    assert.equal(parsed.verdict, '再想想')
    assert.equal(parsed.judgmentReason, '周末再确认')

    const updated = applyIdeaSections(
      sample,
      { ...parsed, cost: '半天安静时间', verdict: '做', judgmentReason: '投入小回报高' },
      '2026-11-24',
    )
    assert.match(updated, /created: 2026-11-24/)
    assert.match(updated, /\*\*要付出什么：\*\* 半天安静时间/)
    assert.match(updated, /做：投入小回报高。（2026-11-20）/)
    assert.match(updated, /## 目标\n\n保留原目标/)
  })

  it('parses and updates weekly review sections (3-section + legacy 4-section compat)', () => {
    // 1. New 3-section review (本周进展 / 问题与反思 / 下周重点)
    const modern = [
      '---',
      'status: draft',
      '---',
      '',
      '## 本周进展（11-23 ~ 11-29）',
      '',
      '1. ✅ 完成主页结构',
      '',
      '本周投入：1.5 小时',
      '',
      '## 问题与反思',
      '',
      '- 先写纯文本再排版效率高一倍',
      '',
      '## 下周重点',
      '',
      '1. 补齐 3 个项目截图',
      '',
    ].join('\n')

    const parsedModern = parseReviewSections(modern)
    assert.equal(parsedModern.status, 'draft')
    assert.equal(parsedModern.totalHoursLine, '本周投入：1.5 小时')
    assert.deepEqual(parsedModern.thisWeekItems, [{ done: true, text: '完成主页结构' }])
    assert.deepEqual(parsedModern.reflections, ['先写纯文本再排版效率高一倍'])
    assert.deepEqual(parsedModern.nextWeekItems, ['补齐 3 个项目截图'])

    const updatedModern = applyReviewSections(modern, {
      ...parsedModern,
      status: 'final',
      thisWeekItems: [
        ...parsedModern.thisWeekItems,
        { done: false, text: '3 个项目截图尚未收齐' },
      ],
      reflections: [...parsedModern.reflections, '每次改动做视觉验收'],
    })
    assert.match(updatedModern, /status: final/)
    assert.match(updatedModern, /## 本周进展（11-23 ~ 11-29）/)
    assert.match(updatedModern, /1\. ✅ 完成主页结构/)
    assert.match(updatedModern, /2\. ❌ 3 个项目截图尚未收齐/)
    assert.match(updatedModern, /本周投入：1\.5 小时/)
    assert.match(updatedModern, /## 问题与反思[\s\S]*- 每次改动做视觉验收/)
    assert.match(updatedModern, /## 下周重点/)

    // 2. Legacy 4-section (+ 没做的 + custom section) read compat & lossless non-reflection edits
    const legacy = [
      '---',
      'status: draft',
      '---',
      '',
      '## 本周（11-10 ~ 11-15）',
      '',
      '**阶段主题**',
      '- 普通进展说明',
      '1. ✅ 明确完成项',
      '',
      '## 原因',
      '',
      '- 花了些时间打磨文案',
      '',
      '## 经验',
      '',
      '- 先写纯文本再排版',
      '',
      '## 下周',
      '',
      '1. 补齐截图',
      '',
      '## 没做的',
      '',
      '- ❌ 排版还停着',
      '',
      '## 飞书同步',
      '',
      '已同步 12 条',
      '',
    ].join('\n')

    const parsedLegacy = parseReviewSections(legacy)
    assert.deepEqual(parsedLegacy.thisWeekItems, [
      { done: null, text: '**阶段主题**' },
      { done: null, text: '普通进展说明' },
      { done: true, text: '明确完成项' },
    ])
    assert.deepEqual(parsedLegacy.reflections, [
      '**未完成**',
      '❌ 排版还停着',
      '**原因**',
      '花了些时间打磨文案',
      '**经验**',
      '先写纯文本再排版',
    ])

    // Editing only status / progress keeps legacy sections & custom sections byte-intact
    const legacyStatusOnly = applyReviewSections(legacy, { ...parsedLegacy, status: 'final' })
    assert.match(legacyStatusOnly, /status: final/)
    assert.match(legacyStatusOnly, /## 原因/)
    assert.match(legacyStatusOnly, /## 经验/)
    assert.match(legacyStatusOnly, /## 没做的/)
    assert.match(legacyStatusOnly, /## 飞书同步\n\n已同步 12 条/)

    // Editing reflections cleanly migrates legacy reflection blocks into ## 问题与反思 while keeping custom sections
    const legacyMigrated = applyReviewSections(legacy, {
      ...parsedLegacy,
      reflections: [...parsedLegacy.reflections, '新加一条反思'],
    })
    assert.match(legacyMigrated, /## 问题与反思/)
    assert.match(legacyMigrated, /- 新加一条反思/)
    assert.doesNotMatch(legacyMigrated, /^## 原因$/m)
    assert.doesNotMatch(legacyMigrated, /^## 经验$/m)
    assert.doesNotMatch(legacyMigrated, /^## 没做的$/m)
    assert.match(legacyMigrated, /## 飞书同步\n\n已同步 12 条/)
  })

  it('sorts projects, today groups, and review metrics consistently by most recent activity', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'life-wiki-sort-'))
    try {
      await initializeVault(dir, {
        withSample: false,
        initGit: false,
        now: new Date('2026-11-24T09:00:00'),
      })
      const engine = createLifeWikiEngine(dir, { now: () => new Date('2026-11-24T09:00:00') })

      await engine.createProject({ name: '海晞项目', area: '工作', created: '2026-10-01' })
      await engine.createProject({ name: 'AlphaPlugin', area: '工作', created: '2026-11-01' })
      await engine.createProject({ name: '长期记录', area: '生活', created: '2026-10-05' })

      // Make all three 'doing'
      await engine.updateProjectMeta('海晞项目', { status: 'doing' })
      await engine.updateProjectMeta('AlphaPlugin', { status: 'doing' })
      await engine.updateProjectMeta('长期记录', { status: 'doing' })

      // Give distinct latest activity dates: AlphaPlugin (11-24) > 海晞项目 (11-22) > 长期记录 (11-10)
      // First clear the auto-created 2026-11-24 task & W48 review stubs on older ones
      const { rm } = await import('node:fs/promises')
      await rm(join(dir, 'projects/海晞项目/01_tasks/2026-11-24.md'), { force: true })
      await rm(join(dir, 'projects/海晞项目/03_reviews/2026-W48.md'), { force: true })
      await rm(join(dir, 'projects/长期记录/01_tasks/2026-11-24.md'), { force: true })
      await rm(join(dir, 'projects/长期记录/03_reviews/2026-W48.md'), { force: true })

      await engine.addTask('AlphaPlugin', '今天推进插件', '2026-11-24', 'high')
      await engine.addTask('海晞项目', '前天做的任务', '2026-11-22', 'medium')
      await engine.addTask('长期记录', '两周前的记录', '2026-11-10', 'low')

      const snap = await engine.getSnapshot('2026-11-24', '2026-W48')
      assert.deepEqual(
        snap.projects.map((p) => p.name),
        ['AlphaPlugin', '海晞项目', '长期记录'],
      )
      assert.deepEqual(
        snap.reviewCenter.projectMetrics.map((m) => m.projectName),
        ['AlphaPlugin', '海晞项目', '长期记录'],
      )
      assert.deepEqual(
        snap.today.groups.map((g) => g.projectName),
        ['AlphaPlugin', '海晞项目', '长期记录'],
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('sorts unchecked tasks before checked tasks then by priority, and supports editing and deleting tasks losslessly', async () => {
    const sampleItems: TaskItem[] = [
      {
        lineIndex: 5,
        checked: true,
        text: '[高] 已完成高优',
        priority: 'high',
        minutes: 30,
        fromDate: null,
        rawLine: '- [x] [高] 已完成高优（30 min）',
      },
      {
        lineIndex: 6,
        checked: true,
        text: '[中] 已完成中优',
        priority: 'medium',
        minutes: null,
        fromDate: null,
        rawLine: '- [x] [中] 已完成中优',
      },
      {
        lineIndex: 7,
        checked: false,
        text: '[低] 未完成低优',
        priority: 'low',
        minutes: null,
        fromDate: null,
        rawLine: '- [ ] [低] 未完成低优',
      },
      {
        lineIndex: 8,
        checked: false,
        text: '[高] 未完成高优',
        priority: 'high',
        minutes: null,
        fromDate: null,
        rawLine: '- [ ] [高] 未完成高优',
      },
      {
        lineIndex: 9,
        checked: false,
        text: '[中] 未完成中优',
        priority: 'medium',
        minutes: null,
        fromDate: null,
        rawLine: '- [ ] [中] 未完成中优',
      },
    ]

    assert.deepEqual(
      sortTasks(sampleItems).map((t) => t.lineIndex),
      [8, 9, 7, 5, 6],
    )

    // Optimistic text edit preserves priority & trailing duration
    const optEdited = applyOptimisticTaskTextEdit(sampleItems[0]!, '已完成高优-改名')
    assert.equal(optEdited.priority, 'high')
    assert.equal(optEdited.text, '[高] 已完成高优-改名')

    await withTempDir(async (dir) => {
      const now = new Date('2026-11-24T10:00:00+08:00')
      await initializeVault(dir, { withSample: false, initGit: false, now })
      const engine = createLifeWikiEngine(dir, { now: () => now })
      await engine.createProject({ name: '效率优化', area: '工作' })

      const relPath = await engine.addTask('效率优化', '旧任务标题', '2026-11-24', 'high')
      await engine.addTask('效率优化', '待删除任务', '2026-11-24', 'low')

      let snap = await engine.getSnapshot('2026-11-24')
      let tasks = snap.today.groups.find((g) => g.projectName === '效率优化')!.tasks
      assert.equal(tasks.length, 2)

      // Add duration + toggle first task, then edit text -> priority & minutes & checkbox stay intact
      await engine.toggleTask(relPath, tasks[0]!.lineIndex, 45)
      await engine.updateTaskText(relPath, tasks[0]!.lineIndex, '新任务标题\n补充说明')

      let raw = await readFile(join(dir, relPath), 'utf8')
      assert.match(raw, /- \[x\] \[高\] 新任务标题 补充说明（45 min）/)

      // Reject blank text
      await assert.rejects(() => engine.updateTaskText(relPath, tasks[0]!.lineIndex, '   '))
      await assert.rejects(() => engine.updateTaskText(relPath, tasks[0]!.lineIndex, '[高]   '))

      // Delete second task
      snap = await engine.getSnapshot('2026-11-24')
      tasks = snap.today.groups.find((g) => g.projectName === '效率优化')!.tasks
      assert.equal(tasks.length, 2)
      assert.equal(tasks[0]?.minutes, 45)
      assert.equal(tasks[0]?.priority, 'high')

      await engine.deleteTask(relPath, tasks[1]!.lineIndex)
      raw = await readFile(join(dir, relPath), 'utf8')
      assert.doesNotMatch(raw, /待删除任务/)
      assert.match(raw, /新任务标题 补充说明/)

      snap = await engine.getSnapshot('2026-11-24')
      assert.equal(snap.today.groups.find((g) => g.projectName === '效率优化')!.tasks.length, 1)
    })
  })

  it('parses legacy task/log aliases (待办/记录) and freeform fallback task files gracefully', () => {
    const aliasDoc = [
      '---',
      'status: doing',
      '---',
      '',
      '## 待办',
      '',
      '- [x] 跑通对标流程',
      '- [ ] 明天继续拆爆款',
      '',
      '## 记录',
      '',
      '- 11:30 完成了第一批整理',
      '',
    ].join('\n')

    const parsedAlias = parseTaskFile(aliasDoc)
    assert.equal(parsedAlias.valid, true)
    assert.equal(parsedAlias.tasks.length, 2)
    assert.equal(parsedAlias.tasks[0]?.checked, true)
    assert.equal(parsedAlias.logs.length, 1)
    assert.match(parsedAlias.logs[0]!, /完成了第一批整理/)

    const freeformDoc = [
      '# 2026-11-24 任务记录',
      '',
      '## 1. 定时任务执行',
      '',
      '- [x] 自动精选 10 条',
      '- 已私信通知确认',
      '',
    ].join('\n')

    const parsedFreeform = parseTaskFile(freeformDoc)
    assert.equal(parsedFreeform.valid, false)
    assert.ok(parsedFreeform.formatIssues.length >= 2)
    assert.equal(parsedFreeform.tasks.length, 1)
    assert.equal(parsedFreeform.tasks[0]?.text, '自动精选 10 条')
    assert.equal(parsedFreeform.logs.length, 2)
    assert.equal(parsedFreeform.logs[0], '## 1. 定时任务执行')
  })

  it('scans raw/ dynamically by local source folders, expands multi-article dirs, extracts repo files/tiers, and links wiki citations', async () => {
    await withTempDir(async (dir) => {
      const now = new Date('2026-11-25T09:00:00+08:00')
      await initializeVault(dir, { withSample: false, initGit: false, now })

      // 1. Multi-article web source directory (should expand to 2 independent entries with real titles)
      await mkdir(join(dir, 'raw/web/anthropic'), { recursive: true })
      await writeFile(
        join(dir, 'raw/web/anthropic/building-effective-agents.md'),
        [
          '---',
          'source: https://www.anthropic.com/research/building-effective-agents',
          'fetched: 2026-10-12',
          '---',
          '',
          'Title: Building effective agents',
          '',
          'Core guidance on agent workflows.',
        ].join('\n'),
        'utf8',
      )
      await writeFile(
        join(dir, 'raw/web/anthropic/context-engineering.md'),
        [
          '---',
          'source: https://www.anthropic.com/engineering/context',
          'fetched: 2026-11-20',
          '---',
          '',
          'Title: Effective context engineering',
          '',
          'Context is a finite resource.',
        ].join('\n'),
        'utf8',
      )

      // 2. User-created dynamic source folder (raw/bilibili/) -> automatically becomes 'bilibili' bucket
      await mkdir(join(dir, 'raw/bilibili/up主'), { recursive: true })
      await writeFile(
        join(dir, 'raw/bilibili/up主/2026-11-24_剪辑流程拆解.md'),
        [
          '---',
          'source: https://www.bilibili.com/video/BV123456',
          'fetched: 2026-11-24',
          '---',
          '',
          '# 剪辑流程拆解',
          '',
          '完整步骤记录。',
        ].join('\n'),
        'utf8',
      )

      // 3. GitHub repo L2 (mentions English "fork" in description + has repository.zip -> must be L2, not L3!)
      await mkdir(join(dir, 'raw/cool-plugin/docs'), { recursive: true })
      await writeFile(join(dir, 'raw/cool-plugin/README.md'), '# Cool Plugin\n', 'utf8')
      await writeFile(join(dir, 'raw/cool-plugin/README.zh-CN.md'), '# 酷炫插件\n', 'utf8')
      await writeFile(join(dir, 'raw/cool-plugin/docs/API.md'), '# API Docs\n', 'utf8')
      await writeFile(join(dir, 'raw/cool-plugin/repository.zip'), 'PK', 'utf8')
      await writeFile(
        join(dir, 'raw/cool-plugin/SOURCE.md'),
        [
          '# 来源记录｜cool-plugin',
          '',
          '- 原始地址：https://github.com/example/cool-plugin',
          '- 获取日期：2026-11-22',
          '- 收藏档位：**L2 防闭源冷备**',
          '',
          '## 说明',
          '',
          '**简介**——这是一个增强版 fork 插件，用于演示冷备与多文档切换。',
        ].join('\n'),
        'utf8',
      )

      // 4. Nested personal archive under raw/me/notion/
      await mkdir(join(dir, 'raw/me/notion/goals'), { recursive: true })
      await writeFile(join(dir, 'raw/me/notion/SOURCE.md'), '# 来源记录｜notion\n', 'utf8')
      await writeFile(join(dir, 'raw/me/notion/goals/年度目标.md'), '# 年度目标\n', 'utf8')

      const engine = createLifeWikiEngine(dir, { now: () => now })
      await engine.createWikiPage('Agent 架构笔记', '结合两篇来源总结。', [
        'raw/web/anthropic/building-effective-agents.md',
        'raw/cool-plugin/docs/API.md',
      ])

      const snap = await engine.getSnapshot('2026-11-25')
      const raw = snap.knowledge.rawEntries

      // Both Anthropic articles expanded cleanly under 'web' with real titles
      const webItems = raw.filter((r) => r.category === 'web')
      assert.equal(webItems.length, 2)
      assert.equal(webItems[0]?.name, 'Effective context engineering')
      assert.equal(webItems[1]?.name, 'Building effective agents')
      assert.equal(webItems[1]?.sourceGroup, 'anthropic')
      assert.deepEqual(webItems[1]?.citedByWiki, ['Agent 架构笔记'])

      // Custom bilibili folder automatically surfaced as 'bilibili' bucket
      const biliItems = raw.filter((r) => r.category === 'bilibili')
      assert.equal(biliItems.length, 1)
      assert.equal(biliItems[0]?.name, '剪辑流程拆解')
      assert.equal(biliItems[0]?.sourceGroup, 'up主')

      // GitHub repo accurately classified as L2, prefers Chinese README, exposes all docs, links Wiki citation
      const repo = raw.find((r) => r.category === 'GitHub' && r.name === 'cool-plugin')!
      assert.ok(repo)
      assert.equal(repo.tier, 'L2')
      assert.equal(repo.openRelPath, 'raw/cool-plugin/README.zh-CN.md')
      assert.equal(repo.files.length, 4)
      assert.match(repo.excerpt, /这是一个增强版 fork 插件/)
      assert.deepEqual(repo.citedByWiki, ['Agent 架构笔记'])

      // Nested raw/me/notion/ files exposed inside folder entry
      const notion = raw.find((r) => r.category === 'me' && r.name === 'notion')!
      assert.ok(notion)
      assert.equal(notion.kind, 'folder')
      assert.equal(notion.fileCount, 1)
      assert.ok(notion.files.some((f) => f.relPath === 'raw/me/notion/goals/年度目标.md'))
    })
  })
})
