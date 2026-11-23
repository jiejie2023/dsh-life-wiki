import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { clearSampleData, initializeVault, inspectDirectory } from '../src/core/scaffold.ts'
import { createLifeWikiEngine } from '../src/core/vault.ts'
import { applyIdeaSections, parseIdeaSections } from '../src/client/ideaMarkdown.ts'
import { applyReviewSections, parseReviewSections } from '../src/client/reviewMarkdown.ts'

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

  it('parses and updates weekly review sections losslessly while preserving total hours', () => {
    const sample = [
      '---',
      'status: draft',
      '---',
      '',
      '## 本周',
      '',
      '1. ✅ 完成主页结构',
      '',
      '本周投入：1.5 小时',
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
      '1. 补齐 3 个项目截图',
      '',
    ].join('\n')

    const parsed = parseReviewSections(sample)
    assert.equal(parsed.status, 'draft')
    assert.equal(parsed.totalHoursLine, '本周投入：1.5 小时')
    assert.deepEqual(parsed.thisWeekItems, [{ done: true, text: '完成主页结构' }])
    assert.deepEqual(parsed.reasons, ['花了些时间打磨文案'])
    assert.deepEqual(parsed.lessons, ['先写纯文本再排版'])
    assert.deepEqual(parsed.nextWeekItems, ['补齐 3 个项目截图'])

    const updated = applyReviewSections(sample, {
      ...parsed,
      status: 'final',
      thisWeekItems: [
        ...parsed.thisWeekItems,
        { done: false, text: '3 个项目截图尚未收齐' },
      ],
      lessons: [...parsed.lessons, '每次改动做视觉验收'],
    })
    assert.match(updated, /status: final/)
    assert.match(updated, /1\. ✅ 完成主页结构/)
    assert.match(updated, /2\. ❌ 3 个项目截图尚未收齐/)
    assert.match(updated, /本周投入：1\.5 小时/)
    assert.match(updated, /- 每次改动做视觉验收/)

    const freeform = [
      '---',
      'status: draft',
      '---',
      '',
      '## 本周',
      '',
      '**阶段主题**',
      '- 普通进展说明',
      '1. ✅ 明确完成项',
      '',
    ].join('\n')
    const freeParsed = parseReviewSections(freeform)
    assert.deepEqual(freeParsed.thisWeekItems, [
      { done: null, text: '**阶段主题**' },
      { done: null, text: '普通进展说明' },
      { done: true, text: '明确完成项' },
    ])
    const freeApplied = applyReviewSections(freeform, freeParsed)
    assert.match(freeApplied, /\*\*阶段主题\*\*/)
    assert.match(freeApplied, /- 普通进展说明/)
    assert.match(freeApplied, /1\. ✅ 明确完成项/)
  })
})
