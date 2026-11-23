# Life Wiki（人生知识库）

面向 **DeepSeek Harness (DSH 0.2.x)** 的本地优先 Markdown 个人项目与知识库插件。

所有项目、每日任务、日记、周复盘、收件箱和知识页都以纯文本 Markdown 文件保存在你自己选定的本地文件夹里，无黑盒数据库、不锁平台，随时可用任意编辑器或 Git 管理。

## 核心功能

- **首次引导初始化**：打开插件后选择一个本机文件夹，支持自动识别已有知识库（不覆盖原文件），或在空目录一键初始化标准四目录结构（可选带示例数据，熟悉后一键清空）。
- **今日（Today）**：按日期切换，管理各活跃项目的当日任务、耗时统计、日志与反思，以及今日日记快速追加。
- **项目（Projects）**：完整的生命周期流转——`想法 (00_ideas)` → `立项 (五件套)` → `进行中 / 暂停` → `归档 / 恢复 (99_archives)`。
- **日记（Diary）**：按月与关键词浏览 `raw/me/diary/`，支持单日文件和配图文件夹展示与随时追加。
- **复盘（Review）**：按 ISO 周次统计各项目完成量与工时，对照本周日记一键汇总生成周复盘草稿，编辑下周重点并确认定稿（`final`）。
- **知识库（Knowledge）**：浏览与新建 `wiki/` 知识页（自动同步 `wiki/index.md` 与 `wiki/log.md`），以及查看 `raw/` 外部原件与 GitHub 仓库分级（`L1/L2/L3`）。
- **全局收件箱（Inbox）**：任意页面随时随手记入 `inbox.md`，一键转为「想法」或「今日任务」。

## 本地目录结构

```text
<你的目录>/
├── inbox.md            # 收件箱
├── projects/
│   ├── 00_ideas/       # 待立项的想法
│   ├── <项目名>/        # 活跃项目（主页、01_tasks、02_resources、03_reviews、04_outputs）
│   └── 99_archives/    # 已完成或放弃的项目
├── raw/
│   └── me/diary/       # 个人日记与配图
├── wiki/               # 提炼的知识页（含 index.md 与 log.md）
└── system/             # 设计说明、规则（schema.md）与模板
```

## 在 DSH Desktop 中安装

1. 构建并打包：
   ```bash
   npm install
   npm run test:all
   npm pack
   ```
2. 在 DSH Desktop 打开 **插件 → 添加插件**，输入本地包路径（例如 `file:D:/Software/dsh-life-wiki/dsh-life-wiki-0.1.0.tgz`）。
3. 刷新后点击左侧栏 **Life Wiki**，选择你的本地目录即可开始使用。

## 独立浏览器预览

```bash
npm run build
npm run preview
# 打开 http://127.0.0.1:4318
```
