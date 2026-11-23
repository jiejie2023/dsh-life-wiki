import { execFile } from 'node:child_process'
import { access, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import type { DirectoryInspection } from '../shared/types.ts'
import { formatIsoWeek, formatLocalDate } from './markdown.ts'

const execFileAsync = promisify(execFile)

export const DEFAULT_AREAS = ['工作', '学习', '生活', '人生方向'] as const

export const SAMPLE_MARKER_FILE = 'system/.life-wiki-sample.json'

interface SampleManifest {
  projects: string[]
  ideas: string[]
  wikiPages: string[]
  rawDirs: string[]
  diaryFiles: string[]
  inboxSnippets: string[]
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function writeIfMissing(absPath: string, content: string): Promise<void> {
  if (await pathExists(absPath)) return
  await mkdir(dirname(absPath), { recursive: true })
  await writeFile(absPath, content, 'utf8')
}

export async function inspectDirectory(dirInput: string): Promise<DirectoryInspection> {
  const target = resolve(dirInput.trim())
  const st = await stat(target).catch(() => null)
  if (!st) {
    return {
      path: target,
      exists: false,
      isDirectory: false,
      isEmpty: true,
      looksLikeVault: false,
      hasProjects: false,
      hasInbox: false,
      hasSystem: false,
      entryCount: 0,
    }
  }
  if (!st.isDirectory()) {
    return {
      path: target,
      exists: true,
      isDirectory: false,
      isEmpty: false,
      looksLikeVault: false,
      hasProjects: false,
      hasInbox: false,
      hasSystem: false,
      entryCount: 0,
    }
  }
  const entries = (await readdir(target)).filter(
    (name) => name !== '.DS_Store' && name !== 'Thumbs.db' && name !== 'desktop.ini',
  )
  const hasProjects = await pathExists(join(target, 'projects'))
  const hasInbox = await pathExists(join(target, 'inbox.md'))
  const hasSystem = await pathExists(join(target, 'system'))
  return {
    path: target,
    exists: true,
    isDirectory: true,
    isEmpty: entries.length === 0,
    looksLikeVault: hasProjects || hasInbox || hasSystem,
    hasProjects,
    hasInbox,
    hasSystem,
    entryCount: entries.length,
  }
}

function buildDesignMd(): string {
  return `# 设计说明

这套 **Life Wiki（人生知识库）** 帮你**少做不值得做的事**，并把做过的事、写下的日记和读过的资料**沉淀成越用越厚的本地知识**。

## 三条原则

1. **先判断，再动手**：想法先进 \`projects/00_ideas/\`，想清楚动机、认知和真实变化，判断“做”再立项。
2. **少即是多**：根目录只有四个文件夹（\`projects/\`、\`raw/\`、\`wiki/\`、\`system/\`）外加 \`inbox.md\`；领域不建文件夹，只作项目属性。
3. **本地 Markdown 优先**：纯文本文件，不依赖任何云服务或黑盒数据库，用任何编辑器、Obsidian 或本地 Git 都能打开和回退。
`
}

function buildSchemaMd(): string {
  return `# 知识库规则

## 目录职责

- \`inbox.md\`：暂存随手记下的灵感与待分流事项。
- \`projects/\`：项目目录；主页记录一件事从想法到总结的全过程，同级放四个留档子目录：
  - \`01_tasks/YYYY-MM-DD.md\`：当天任务（\`- [ ]\` / \`- [x]\` 与实际用时）、日志（重要决定以“决定：”开头）、反思。
  - \`02_resources/resources.md\`：本项目用到的规范、依据与参考资料登记。
  - \`03_reviews/YYYY-Www.md\`：周复盘（本周 / 原因 / 经验 / 下周），确认后 \`status\` 从 \`draft\` 改为 \`final\`。
  - \`04_outputs/outputs.md\`：对外交付成品登记。
- \`projects/00_ideas/\`：还没决定做不做的想法，一个想法一个 \`.md\`。
- \`projects/99_archives/\`：已完成（\`done\`）、决定不做（\`cancel\`）或长期暂停的项目归档。
- \`raw/\`：不可变原件层。个人日记放在 \`raw/me/diary/\`（单文件 \`YYYY-MM-DD.md\` 或图文文件夹 \`YYYY-MM-DD/日记.md\`，原话照录、按时间往后追加）；外部 GitHub 仓库按 L1 轻收藏 / L2 防闭源冷备（\`repository.zip\` 留本地不进 Git） / L3 实战二开分级收藏。
- \`wiki/\`：从原件和实践经验整理出的长期复用知识页，配套维护 \`wiki/index.md\` 与 \`wiki/log.md\`。
- \`system/\`：设计说明、规则与标准模板。

## 领域清单

领域清单：
${DEFAULT_AREAS.map((a) => `- ${a}`).join('\n')}
`
}

function buildTemplates(): Record<string, string> {
  return {
    'system/templates/project/project-name.md': `---
status: idea
area: 
timeframe: 
---

## 想法

一句话：我想做什么。

## 动机

**为什么想做：** 
**不做会怎样：** 
**要付出什么：** 
**做完能带来什么真实变化：** 

## 认知

这件事是什么、难在哪、大概要花多久。

## 判断

做 / 不做 / 再想想：理由。（YYYY-MM-DD）

## 目标

一句话，写做完时能检查的结果。

## 计划

- [ ] 1. 

## 总结

**结果：** 
**动机回看：** 
**经验：** 
`,
    'system/templates/project/01_tasks/YYYY-MM-DD.md': `---
status: todo
---

## 任务

- [ ] [高] 事情（N min）

## 日志

- 随手一行记一件进展（重要决定以「决定：」开头）

## 反思

- 只写原因、经验或下次调整（不重复日志里写过的事）
`,
    'system/templates/project/02_resources/resources.md': `# 资料登记

- [资料名](https://example.com)：用途说明
`,
    'system/templates/project/03_reviews/YYYY-Www.md': `---
status: draft
---

## 本周

1. ✅/❌ 这件事：一句话说明

本周投入：0 小时

## 原因

## 经验

## 下周

1. 
`,
    'system/templates/project/04_outputs/outputs.md': `# 交付物登记

- [成品名](成品.md)：交给谁 · YYYY-MM-DD · doing
`,
    'system/templates/SOURCE.md': `# 来源记录｜名称

- 原始地址：—
- 获取日期：YYYY-MM-DD
- 版本：—
- 说明：—

## 文件清单

- \`README.md\`
`,
  }
}

export async function initializeVault(
  dirInput: string,
  options: { withSample: boolean; initGit: boolean; now?: Date },
): Promise<{ rootDir: string; gitInitialized: boolean }> {
  const rootDir = resolve(dirInput.trim())
  const now = options.now ?? new Date()
  const today = formatLocalDate(now)
  const yesterdayDate = new Date(now.getTime() - 86_400_000)
  const yesterday = formatLocalDate(yesterdayDate)
  const week = formatIsoWeek(now)

  await mkdir(rootDir, { recursive: true })

  // Core folders
  const dirs = [
    'projects/00_ideas',
    'projects/99_archives',
    'raw/me/diary',
    'wiki',
    'system/templates/project/01_tasks',
    'system/templates/project/02_resources',
    'system/templates/project/03_reviews',
    'system/templates/project/04_outputs',
  ]
  for (const rel of dirs) {
    await mkdir(join(rootDir, rel), { recursive: true })
  }

  // Core files (never overwrite existing user files)
  await writeIfMissing(join(rootDir, 'projects/00_ideas/.gitkeep'), '')
  await writeIfMissing(join(rootDir, 'projects/99_archives/.gitkeep'), '')
  await writeIfMissing(join(rootDir, 'raw/me/diary/.gitkeep'), '')
  await writeIfMissing(
    join(rootDir, '.gitignore'),
    [
      '.obsidian/workspace*.json',
      '.obsidian/cache',
      '.trash/',
      '.DS_Store',
      'Thumbs.db',
      'desktop.ini',
      'raw/**/repository.zip',
      '',
    ].join('\n'),
  )
  await writeIfMissing(join(rootDir, 'system/design.md'), buildDesignMd())
  await writeIfMissing(join(rootDir, 'system/schema.md'), buildSchemaMd())
  for (const [rel, body] of Object.entries(buildTemplates())) {
    await writeIfMissing(join(rootDir, rel), body)
  }

  const inboxDefault = options.withSample
    ? `# Inbox

还没想好放哪的东西，先在这里记一行。随时点「转为想法」或「转到今日任务」。

## 待处理

- [ ] ${today} [示例] 试试点右侧按钮，把这条转成想法或今日任务
- [ ] ${yesterday} [示例] 收集两篇本周想精读的长文章放进 raw/

## 提议
`
    : `# Inbox

还没想好放哪的东西，先在这里记一行。值得认真想的转为想法进 \`projects/00_ideas/\`；处理完的直接删掉。

## 待处理

## 提议
`
  await writeIfMissing(join(rootDir, 'inbox.md'), inboxDefault)

  const wikiIndexDefault = options.withSample
    ? `# Wiki 目录

- [如何开始使用 Life Wiki](如何开始使用 Life Wiki.md)：3 分钟了解先判断再动手、每日任务、日记与周复盘如何串联
`
    : `# Wiki 目录

此目录记录所有可复用的长期知识页。
`
  await writeIfMissing(join(rootDir, 'wiki/index.md'), wikiIndexDefault)
  await writeIfMissing(
    join(rootDir, 'wiki/log.md'),
    `# Wiki 处理记录\n\n## ${today} setup | 初始化 Life Wiki 人生知识库\n\n建立标准四目录结构（projects / raw / wiki / system）与收件箱。\n`,
  )

  if (options.withSample) {
    const manifest: SampleManifest = {
      projects: ['示例-搭建个人主页', '示例-每日阅读与写作'],
      ideas: ['示例-整理年度复盘清单.md'],
      wikiPages: ['如何开始使用 Life Wiki.md'],
      rawDirs: ['example-markdown-guide'],
      diaryFiles: [`${yesterday}.md`],
      inboxSnippets: ['[示例] 试试点右侧按钮', '[示例] 收集两篇本周想精读'],
    }

    // Sample Project 1
    const p1 = 'projects/示例-搭建个人主页'
    await mkdir(join(rootDir, p1, '01_tasks'), { recursive: true })
    await mkdir(join(rootDir, p1, '02_resources'), { recursive: true })
    await mkdir(join(rootDir, p1, '03_reviews'), { recursive: true })
    await mkdir(join(rootDir, p1, '04_outputs'), { recursive: true })
    await writeIfMissing(
      join(rootDir, p1, '示例-搭建个人主页.md'),
      `---
status: doing
area: 工作
timeframe: 本月完成
---

## 想法

做一个极简个人主页，集中展示自己的代表作品、公开文章和联系方式。

## 动机

**为什么想做：** 每次向别人介绍自己都要东拼西凑发一堆链接。
**不做会怎样：** 作品散落各处，缺少一个长期沉淀的窗口。
**要付出什么：** 3~4 个晚上的设计与文案整理时间。
**做完能带来什么真实变化：** 发一个链接就能把自己的能力、思考和作品交代清楚。

## 认知

用静态页面部署最轻，重点不在炫酷特效，而在文字表达和 3 个代表案例。

## 判断

做：投入小、长期复利高。（${yesterday}）

## 目标

上线可访问的个人主页，包含个人简介、3 个代表项目和联系方式。

## 计划

- [x] 1. 确定主页的 3 个核心板块和整体文案大纲
- [ ] 2. 挑选并整理 3 个代表项目的截图与一句话介绍
- [ ] 3. 完成页面部署并绑定域名

## 总结

**结果：** 
**动机回看：** 
**经验：** 
`,
    )
    await writeIfMissing(
      join(rootDir, p1, `01_tasks/${today}.md`),
      `---
status: doing
---

## 任务

- [x] [高] 写完主页第一屏的一句话个人介绍（20 min）
- [ ] [中] 挑选 3 个代表项目并整理截图
- [ ] [低] 核对社交媒体与邮箱联系方式

## 日志

- 决定：第一版只放 3 个最拿得出手的项目，不做博客归档页。

## 反思
`,
    )
    await writeIfMissing(
      join(rootDir, p1, '02_resources/resources.md'),
      `# 资料登记\n\n- [设计说明](../../../system/design.md)：参考“少即是多”原则精简首页内容\n`,
    )
    await writeIfMissing(
      join(rootDir, p1, `03_reviews/${week}.md`),
      `---
status: draft
---

## 本周

1. ✅ 完成主页结构与首屏简介定稿
2. ❌ 3 个代表项目素材尚未全部收齐

本周投入：1.5 小时

## 原因

- 把较多时间花在反复打磨第一屏文案上。

## 经验

- 先用纯文本把内容写顺，再做排版效率高一倍。

## 下周

1. 补齐 3 个项目截图并完成首版上线
`,
    )
    await writeIfMissing(
      join(rootDir, p1, '04_outputs/outputs.md'),
      `# 交付物登记\n\n- 个人主页首版：公开访问 · ${today} · doing\n`,
    )

    // Sample Project 2
    const p2 = 'projects/示例-每日阅读与写作'
    await mkdir(join(rootDir, p2, '01_tasks'), { recursive: true })
    await mkdir(join(rootDir, p2, '02_resources'), { recursive: true })
    await mkdir(join(rootDir, p2, '03_reviews'), { recursive: true })
    await mkdir(join(rootDir, p2, '04_outputs'), { recursive: true })
    await writeIfMissing(
      join(rootDir, p2, '示例-每日阅读与写作.md'),
      `---
status: doing
area: 学习
timeframe: 长期
---

## 想法

每天保持 20 分钟深度阅读，并随手在日记或知识库记下一句收获。

## 动机

**为什么想做：** 刷碎片信息太多，静不下心读完整本书。
**不做会怎样：** 脑子被短视频塞满，表达越来越浅。
**要付出什么：** 每天睡前 20 分钟放下手机。
**做完能带来什么真实变化：** 思维更沉稳，半年能攒出十几篇真正属于自己的知识页。

## 认知

把门槛降到极低（每天 20 分钟、哪怕写 3 句话都算），比追求宏大书单更能坚持。

## 判断

做：长期复利最大的日常习惯。（${yesterday}）

## 目标

每周至少完成 4 天深度阅读，每月整理 2 篇可复用的 \`wiki/\` 知识页。

## 计划

- [x] 1. 选定本月精读的第一本书
- [ ] 2. 每天睡前阅读 20 分钟并在日记里随手记一句（${today} ~ 长期）
- [ ] 3. 周日复盘时把本周最值钱的 1 条思考编进 \`wiki/\`

## 总结

**结果：** 
**动机回看：** 
**经验：** 
`,
    )
    await writeIfMissing(
      join(rootDir, p2, `01_tasks/${today}.md`),
      `---
status: todo
---

## 任务

- [ ] [中] 睡前精读 20 分钟并摘录 1 个核心观点

## 日志

## 反思
`,
    )
    await writeIfMissing(
      join(rootDir, p2, '02_resources/resources.md'),
      `# 资料登记\n\n- [如何开始使用 Life Wiki](../../../wiki/如何开始使用 Life Wiki.md)：日常阅读与沉淀方式参考\n`,
    )
    await writeIfMissing(
      join(rootDir, p2, '04_outputs/outputs.md'),
      `# 交付物登记\n\n- 长期阅读笔记沉淀在 \`wiki/\`\n`,
    )

    // Sample Idea
    await writeIfMissing(
      join(rootDir, 'projects/00_ideas/示例-整理年度复盘清单.md'),
      `---
status: idea
area: 
timeframe: 
---

## 想法

整理一份年底复盘问题清单，回顾今年做对和做错的 5 个关键决定。

## 动机

**为什么想做：** 每年年底一晃就过，不记下来明年容易踩同样的坑。
**不做会怎样：** 重复犯错，看不到自己这一年的真实成长。
**要付出什么：** 约 2 小时安静梳理。
**做完能带来什么真实变化：** 带着清晰的方向和边界进入下一年。

## 认知

可以先翻一遍过去几个月的日记和项目归档，按事实回顾。

## 判断

再想想：等到 12 月中旬再点「立项」。（${today}）

## 目标

## 计划

- [ ] 1. 

## 总结

**结果：** 
**动机回看：** 
**经验：** 
`,
    )

    // Sample Diary
    await writeIfMissing(
      join(rootDir, `raw/me/diary/${yesterday}.md`),
      `---
date: ${yesterday}
---

## 21:40

建好了自己的 Life Wiki（人生知识库）。所有文件都是普通的本地 Markdown，打开文件夹清清楚楚，不用怕被某个软件绑死。先从最简单的每天记两句话、推进一个核心项目开始。
`,
    )

    // Sample Wiki Page
    await writeIfMissing(
      join(rootDir, 'wiki/如何开始使用 Life Wiki.md'),
      `---
title: 如何开始使用 Life Wiki
updated: ${today}
sources:
  - system/design.md
  - system/schema.md
---

# 如何开始使用 Life Wiki

Life Wiki 把日常做事与长期知识沉淀放在同一个本地文件夹里，核心只有 5 个日常动作：

1. **随手记（右上角收件箱）**：闪念先丢 \`inbox.md\`，不打断正在做的事。
2. **先判断（项目 → 想法）**：值得认真做的念头放进 \`00_ideas/\`，写清真实变化后再点「立项」。
3. **每日推进（今日）**：打勾完成具体动作、顺手记下用时与关键决定。
4. **记下生活（日记）**：每天几句话原话记录，留住真实的自己。
5. **每周校准（复盘）**：周日一边看本周项目投入，一边翻本周日记，定好下周重点；值得留下的经验整理进 \`wiki/\`。

> 随时可以点击顶部「设置 → 清空示例数据」，把这些示例项目和文档一键清掉，开始你自己的真实记录。
`,
    )

    // Sample Raw Entry
    await mkdir(join(rootDir, 'raw/example-markdown-guide'), { recursive: true })
    await writeIfMissing(
      join(rootDir, 'raw/example-markdown-guide/README.md'),
      `# 示例原件｜Markdown 收藏说明\n\n\`raw/\` 用来存放不可变的原始资料（网页文章、PDF、开源仓库 README 等）。\n\n代码仓库支持按 **L1 轻收藏 / L2 防闭源冷备 / L3 实战二开** 三档记录在 \`SOURCE.md\` 中。\n`,
    )
    await writeIfMissing(
      join(rootDir, 'raw/example-markdown-guide/SOURCE.md'),
      `# 来源记录｜example-markdown-guide\n\n- 原始地址：https://github.com/example/markdown-guide\n- 获取日期：${today}\n- 版本：main\n- 说明：L1 轻收藏示例：仅留 README 与来源说明，不占本地体积。\n\n## 文件清单\n\n- \`README.md\`\n`,
    )

    await writeFile(
      join(rootDir, SAMPLE_MARKER_FILE),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    )
  }

  let gitInitialized = false
  if (options.initGit && !(await pathExists(join(rootDir, '.git')))) {
    try {
      await execFileAsync('git', ['init'], { cwd: rootDir, windowsHide: true })
      await execFileAsync('git', ['add', '-A'], { cwd: rootDir, windowsHide: true })
      await execFileAsync('git', ['commit', '-m', '[Life Wiki] 初始化人生知识库'], {
        cwd: rootDir,
        windowsHide: true,
      })
      gitInitialized = true
    } catch {
      // Git unavailable or user identity not set; vault still works fine without git
    }
  }

  return { rootDir, gitInitialized }
}

export async function hasSampleDataMarker(rootDir: string): Promise<boolean> {
  return pathExists(join(rootDir, SAMPLE_MARKER_FILE))
}

export async function clearSampleData(rootDirInput: string): Promise<{ removedCount: number }> {
  const rootDir = resolve(rootDirInput)
  const markerPath = join(rootDir, SAMPLE_MARKER_FILE)
  const raw = await readFile(markerPath, 'utf8').catch(() => null)
  if (!raw) return { removedCount: 0 }

  const manifest = JSON.parse(raw) as SampleManifest
  let removedCount = 0

  for (const proj of manifest.projects ?? []) {
    const p = join(rootDir, 'projects', proj)
    if (await pathExists(p)) {
      await rm(p, { recursive: true, force: true })
      removedCount += 1
    }
  }
  for (const idea of manifest.ideas ?? []) {
    const p = join(rootDir, 'projects', '00_ideas', idea)
    if (await pathExists(p)) {
      await rm(p, { force: true })
      removedCount += 1
    }
  }
  for (const page of manifest.wikiPages ?? []) {
    const p = join(rootDir, 'wiki', page)
    if (await pathExists(p)) {
      await rm(p, { force: true })
      removedCount += 1
    }
  }
  for (const rawDir of manifest.rawDirs ?? []) {
    const p = join(rootDir, 'raw', rawDir)
    if (await pathExists(p)) {
      await rm(p, { recursive: true, force: true })
      removedCount += 1
    }
  }
  for (const diary of manifest.diaryFiles ?? []) {
    const p = join(rootDir, 'raw', 'me', 'diary', diary)
    if (await pathExists(p)) {
      await rm(p, { recursive: true, force: true })
      removedCount += 1
    }
  }

  // Remove sample lines from inbox.md and wiki/index.md without deleting user lines
  const inboxPath = join(rootDir, 'inbox.md')
  const inboxRaw = await readFile(inboxPath, 'utf8').catch(() => null)
  if (inboxRaw && manifest.inboxSnippets?.length) {
    const eol = inboxRaw.includes('\r\n') ? '\r\n' : '\n'
    const filtered = inboxRaw
      .split(/\r?\n/)
      .filter((line) => !manifest.inboxSnippets.some((snip) => line.includes(snip)))
    await writeFile(inboxPath, filtered.join(eol), 'utf8')
  }

  const indexPath = join(rootDir, 'wiki', 'index.md')
  const indexRaw = await readFile(indexPath, 'utf8').catch(() => null)
  if (indexRaw && manifest.wikiPages?.length) {
    const eol = indexRaw.includes('\r\n') ? '\r\n' : '\n'
    const filtered = indexRaw
      .split(/\r?\n/)
      .filter((line) => !manifest.wikiPages.some((page) => line.includes(page)))
    await writeFile(indexPath, filtered.join(eol), 'utf8')
  }

  await rm(markerPath, { force: true })
  return { removedCount }
}
