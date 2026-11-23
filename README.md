# Life Wiki（人生知识库）

面向 **DeepSeek Harness (DSH 0.2.x)** 的本地优先 Markdown 个人项目、日记、复盘与知识库插件。

所有项目、每日任务、日记、周复盘、收件箱和知识页都以纯文本 Markdown 保存在你选定的本地文件夹里——无隐藏数据库、不绑定云服务，随时可用 Obsidian、VS Code 或本地 Git 打开与版本回退。

## 核心设计

- **本地 Markdown 即唯一真源**：界面上所有勾选、优先级、耗时、状态和编辑都会直接无损写回对应 `.md` 文件。
- **Things 3 极简视觉**：自动跟随宿主亮色 / 暗色主题，无冗余弹窗与统计噪音。
- **先判断，再动手**：闪念进收件箱，值得做的进想法库写清动机与真实变化，拍板立项后再拆解到每日执行。

## 主要功能

- **引导与多库切换**：支持在任意目录下新建知识库（可选附带 1 个精简示例项目，熟悉后在设置里一键清空），或直接打开已有知识库；左上角始终与本地文件夹名同步。
- **今日（Today）**：按日期切换各活跃项目的当日任务、日志与反思；支持 `高 / 中 / 低` 优先级自动排序（`[高/中/低]`）、可点击修改任务用时（`（N min）`）、状态下拉（未开始 / 进行中 / 已完成）以及顶部快速追加日记。
- **项目（Projects）**：
  - 顶部快速记录新想法，按 `进行中 · 未开始 · 暂停 · 想法 · 归档` 管理完整生命周期，支持按领域筛选。
  - **想法评估页**：点击任意想法直接在线编辑「想法 / 动机四问 / 认知 / 判断（做 / 再想想 / 不做）」，失焦自动保存，右上角一键「立项」或「放弃」。
  - **全页项目详情**：一行紧凑元信息（状态、领域、`created`、`deadline`）、目标就地编辑，以及与本地五件套 1:1 对齐的 `Plan · Tasks · Resources · Reviews · Outputs` 五标签——计划可一键推入今日，任务与周复盘均支持按月/按周切换并原位直接编辑。
- **日记（Diary）**：杂志感双栏时间线，支持按年份/月份分组下拉导航、指定日期跳转、全文搜索、时间戳分段、图片灯箱预览与历史补记。
- **复盘（Review）**：按 ISO 周次横向汇总各活跃项目进展与本周日记，支持行内维护下周重点及 `待审核 / 已审核` 状态切换。
- **知识库（Knowledge）**：浏览、搜索与新建 `wiki/` 知识页（自动维护 `index.md` 与 `log.md`），查看 `raw/` 原件与代码仓库分级收藏（`L1 / L2 / L3`）。
- **全局收件箱（Inbox）**：任意页面随时记入 `inbox.md`，一键转为「想法」或分配为指定项目的今日任务。

## 本地目录结构

```text
<你的知识库目录>/
├── inbox.md                      # 收件箱
├── projects/
│   ├── 00_ideas/                 # 待评估的想法
│   ├── <项目名>/
│   │   ├── <项目名>.md           # 主页（属性、想法、动机、认知、判断、目标、计划、总结）
│   │   ├── 01_tasks/YYYY-MM-DD.md
│   │   ├── 02_resources/resources.md
│   │   ├── 03_reviews/YYYY-Www.md
│   │   └── 04_outputs/outputs.md
│   └── 99_archives/              # 已完成或放弃的项目归档
├── raw/
│   └── me/diary/                 # 个人日记（YYYY-MM-DD.md 或 YYYY-MM-DD/日记.md + 配图）
├── wiki/                         # 可复用知识页（含 index.md 与 log.md）
└── system/                       # 设计说明、规则（schema.md）与标准模板
```

## 安装到 DSH Desktop

### 方式 1：直接安装 Release 安装包（推荐）

1. 从 [GitHub Releases](https://github.com/jiejie2023/dsh-life-wiki/releases) 下载最新的 `dsh-life-wiki-<version>.tgz`。
2. 打开 DSH Desktop → **插件 → 添加插件**，输入本地包路径，例如：
   ```text
   file:/path/to/dsh-life-wiki-0.3.0.tgz
   ```
3. 重启或刷新 DSH 后，点击左侧栏 **Life Wiki**，新建或打开本地目录即可使用。

### 方式 2：从源码构建 / 本地热开发

需要 **Node.js >= 22**。

```bash
git clone https://github.com/jiejie2023/dsh-life-wiki.git
cd dsh-life-wiki
npm install
npm run test:all
npm pack
```

- 打包安装：在 DSH 添加 `file:/path/to/dsh-life-wiki/dsh-life-wiki-0.3.0.tgz`。
- 本地联动开发：在 DSH 添加 `link:/path/to/dsh-life-wiki`，修改前端后运行 `npm run build` 即可热重载（修改后端 `src/host` 或 `src/core` 后需从系统托盘彻底退出并重开 DSH）。

## 独立浏览器预览

```bash
npm run build
npm run preview
# 打开 http://127.0.0.1:4318
```

## License

[MIT](./LICENSE)
