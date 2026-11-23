import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { clearSampleData, initializeVault, inspectDirectory } from '../src/core/scaffold.ts'
import { createLifeWikiEngine } from '../src/core/vault.ts'

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
      assert.equal(snap.projects.length, 2)
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
        start: '2026-11-24',
        deadline: '2026-12-31',
        goal: '完成音频去静音脚本并发布首版',
      })
      assert.equal(projHome, 'projects/播客剪辑工具/播客剪辑工具.md')
      snap = await engine.getSnapshot('2026-11-24')
      assert.equal(snap.projects[0]?.start, '2026-11-24')
      assert.equal(snap.projects[0]?.deadline, '2026-12-31')

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
})
