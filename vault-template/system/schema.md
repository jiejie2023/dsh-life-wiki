# 知识库规则

## 目录职责

- `inbox.md`：暂存随手记下的灵感与待分流事项。
- `projects/`：项目目录；主页 `<项目名>.md` 的 YAML 属性写 `status`（`idea / cancel / todo / doing / pause / done`）、`area`、`created`（`YYYY-MM-DD`）、`deadline`（可选），正文记录想法、动机、认知、判断、目标、计划、总结；同级放四个留档子目录：
  - `01_tasks/YYYY-MM-DD.md`：当天任务（`- [ ] [高/中/低] 事情（N min）`）、日志（重要决定以“决定：”开头）、反思；`status` 取 `todo / doing / done`。
  - `02_resources/resources.md`：本项目用到的规范、依据与参考资料登记。
  - `03_reviews/YYYY-Www.md`：周复盘（`## 本周进展` / `## 问题与反思` / `## 下周重点`），审核后 `status` 从 `draft`（待审核）改为 `final`（已审核）。
  - `04_outputs/outputs.md`：对外交付成品登记。
- `projects/00_ideas/`：还没决定做不做的想法，一个想法一个 `.md`。
- `projects/99_archives/`：已完成（`done`）、决定不做（`cancel`）或长期暂停的项目归档。
- `raw/`：不可变原件层。个人日记放在 `raw/me/diary/`（单文件 `YYYY-MM-DD.md` 或图文文件夹 `YYYY-MM-DD/日记.md`，原话照录、按时间往后追加）；外部 GitHub 仓库按 L1 轻收藏 / L2 防闭源冷备（`repository.zip` 留本地不进 Git） / L3 实战二开分级收藏。
- `wiki/`：从原件和实践经验整理出的长期复用知识页，配套维护 `wiki/index.md` 与 `wiki/log.md`。
- `system/`：设计说明、规则与标准模板（`system/templates/`）。

## 领域清单

领域清单：
- 工作
- 学习
- 生活
- 人生方向

## 写入原则

- 保持普通 Markdown 可读，不依赖专用软件才能理解内容。
- 不修改 `raw/` 中已有原件；日记只保留用户原话。
- 用户的决定（想法、动机、判断、目标、计划、下周重点、状态变更）只按用户的话写，AI 的建议不直接写成用户的决定。
