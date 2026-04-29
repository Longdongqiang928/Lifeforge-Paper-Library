# Lifeforge Paper Library

[English README](./README.md)

`Paper Library` 是一个运行在 [LifeForge](https://github.com/Lifeforge-app/lifeforge) 中的自定义文献模块，用于构建共享论文池、补全与校对摘要、结合 Zotero 文献库做推荐排序，并为高相关论文生成轻量 AI 阅读辅助结果。

它位于 `apps/longdongqiang--paper-library`，并且使用独立 Git 仓库管理，不和主 LifeForge 仓库混在一起。

## 模块作用

`Paper Library` 把四类流程整合在一个模块里：

- 从配置好的 RSS 源抓取论文
- 补全或修复缺失摘要
- 基于用户自己的 Zotero 文献库进行推荐
- 为高相关论文生成：
  - `TL;DR`
  - `Translated Title`
  - `Translated Abstract`

在前端界面上，当前模块提供：

- 按分数排序的 `Papers` 首页
- 列表内论文详情弹窗，支持跨页前后切换
- 带文件夹的 `Favorites`
- 用于人工校对摘要的 `Review`
- `Import` 导入页
- `Run` 手动运行与查看历史
- `Settings` 配置页

## 主要特性

- 共享论文池 + 用户私有结果分层
  - 论文主数据只保存一份
  - 推荐分数、增强结果、收藏夹仍然按用户隔离
- 摘要优先的流水线设计
  - `abstract` 已经是独立阶段，不再和 `fetch` 混在一起
  - 缺摘要论文可以自动补，也可以人工修正
- 收藏工作流更完整
  - 可以把论文保存到指定文件夹
  - 支持新建、重命名、删除、移动文件夹
- 不再依赖文件中间产物
  - JSON / JSONL 直接写入 PocketBase
  - 导入得到的推荐/增强结果会明确标记为 `imported`
- 模块内自带调度器
  - 不需要修改 LifeForge 宿主任务系统
- 前端风格与主系统一致
  - 使用主系统的主题色、卡片、按钮和 modal 体系

## 优势

- 把抓取、补摘要、推荐、增强、收藏、人工校对放在同一个地方，不需要在脚本、JSONL、多个页面之间来回切换。
- 能通过阶段输入哈希跳过未变化内容，减少重复处理。
- 同时支持自动化和人工控制：
  - 可定时运行
  - 可人工 review 摘要、手动 rerun
- 面向真实阅读流程：
  - 分数优先浏览
  - 收藏夹归类
  - 外链直达原文
  - 先修摘要，再做推荐和增强

## 当前范围

当前模块已经包含：

- 论文列表页与详情页
- 列表内详情弹窗，支持前后篇导航
- 收藏夹与文件夹管理
- JSON / JSONL 导入
- 摘要检查与人工修正页
- 四阶段流水线：
  - `fetch`：抓 RSS 并把新论文写入 PocketBase
  - `abstract`：为缺失摘要的论文补摘要
  - `recommend`：结合 Zotero 文献库做推荐排序
  - `enhance`：生成 `TL;DR`、`Translated Title`、`Translated Abstract`
- 共享论文池 + 用户 overlay 数据模型
- 手动运行与自动调度
- RSS / 摘要 / Zotero / AI 相关配置页

## 模块结构

```text
client/
  manifest.ts                 模块路由与导航配置
  src/pages/                  页面：Papers、Favorites、Import、Run、Settings、Review、Detail
  src/components/             可复用 UI 组件
  src/utils/                  前端 API 包装与数据辅助

server/
  forge.ts                    模块 forge 启动入口
  index.ts                    服务端路由注册
  schema.ts                   PocketBase collections 定义
  routes/                     API 路由
  utils/
    constants.ts              模块常量与默认值
    records.ts                输入归一化与映射
    papers.ts                 论文响应整形
    pipeline.ts               fetch / abstract / recommend / enhance 编排
    scheduler.ts              模块内调度器

locales/
  en.json
  zh-CN.json
  ms.json
```

## 数据模型

模块使用分层模型：

- 共享论文主表
  - `ldq_paperlib_papers`
- 用户 overlay
  - `ldq_paperlib_user_states`
- 收藏相关
  - `ldq_paperlib_folders`
  - `ldq_paperlib_favorites`
- 配置与运行记录
  - `ldq_paperlib_fetch_settings`
  - `ldq_paperlib_user_settings`
  - `ldq_paperlib_runs`
- 导入与缓存
  - `ldq_paperlib_import_batches`
  - `ldq_paperlib_zotero_cache`
  - `ldq_paperlib_embed_cache`

### 当前工作流状态模型

模块现在使用四层状态：

- 调度配置状态
  - `fetch_enabled`、`abstract_enabled`、`recommend_enabled`、`enhance_enabled`
  - `fetch_time`、`abstract_time`、`recommend_time`、`enhance_time`
  - 调度去重 key：
    - `last_fetch_schedule_key`
    - `last_abstract_schedule_key`
    - `last_recommend_schedule_key`
    - `last_enhance_schedule_key`
- 论文内容可处理状态
  - `papers.abstract_status`
  - 取值：
    - `ready`
    - `missing`
    - `error`
- 用户阶段状态
  - `recommend_status`、`enhance_status`
  - 取值：
    - `idle`
    - `completed`
    - `failed`
  - 配套字段：
    - `recommend_input_hash`、`enhance_input_hash`
    - `recommend_last_run_id`、`enhance_last_run_id`
    - `recommend_last_reason`、`enhance_last_reason`
- 运行历史状态
  - `ldq_paperlib_runs`
  - 保存每次运行的统计、时间、错误和 skip 分类
  - 不再作为 scheduler 去重的主依据

## 流水线行为

### Fetch

- 从共享 `fetch settings` 读取 RSS source map
- 抓取当天 RSS 内容
- 解析为论文记录
- 在写入前先去重
- 已存在论文直接跳过，不覆盖
- 写入 `papers.abstract_status`
  - 有有效摘要：`ready`
  - 无摘要：`missing`
  - 提取逻辑明确失败：`error`
- 某个 feed 失败会记入 failed feed，但不会中断整轮

### Abstract

- 作为独立阶段运行
- 只处理 `abstract_status = missing` 的论文
- 当前 provider 顺序：
  - `Nature API`
  - `OpenAlex`
  - `Tavily`
- 使用批处理和请求超时控制
- 更新：
  - `papers.abstract`
  - `papers.abstract_status`
- 本轮 skip / failed 原因只记入 `runs.details`

### Recommend

- 使用当前用户的 Zotero 配置
- 在 PocketBase 中维护 Zotero 缓存
- 为论文计算与 Zotero collection 的相关性
- 把结果写入 `ldq_paperlib_user_states`
- 允许论文在没有现成 `user_state` 的情况下直接进入推荐
- 只处理 `abstract_status = ready` 的论文
- 使用 `recommend_input_hash` 跳过已完成且输入未变化的论文

### Enhance

- 只处理高于阈值的论文
- 调用配置好的 chat model
- 只写三类结果：
  - `tldr`
  - `translated_title`
  - `translated_abstract`
- 前置条件：
  - `abstract_status = ready`
  - 已有 recommend 结果
  - `score_max` 过阈值
- 使用 `enhance_input_hash` 跳过已完成且输入未变化的论文

## 调度规则

调度器运行在模块服务端内部，不依赖宿主框架额外任务系统。

当前协调规则：

- 新的 `fetch` 会把旧的 running `fetch` 标成 `failed`
- 新的 `abstract` 会把旧的 running `abstract` 标成 `failed`
- 如果 `fetch` 正在跑，`abstract` 会等待
- 新的 `recommend` 会把旧的 running `recommend` 标成 `failed`
- 如果 `abstract` 正在跑，`recommend` 会等待
- 新的 `enhance` 会把旧的 running `enhance` 标成 `failed`
- 如果 `recommend` 正在跑，`enhance` 会等待
- 过期 running job 会被自动回收
- scheduler 去重基于配置表中的 schedule key，而不是 `runs`

## 导入行为

导入页支持：

- `.json`
- `.jsonl`
- 文件上传
- 直接粘贴原始 JSON / JSONL

导入直接写数据库，不再依赖 JSONL 中间流水线。

导入也可以写入用户 overlay：

- 导入的 score / collections 会标记：
  - `recommend_status = completed`
- 导入的 TL;DR / translations 会标记：
  - `enhance_status = completed`
- 导入结果会明确标记：
  - `recommend_last_reason = imported`
  - `enhance_last_reason = imported`
- 重复论文现在会直接 `skip`，不覆盖已有论文

长文本处理：

- 文本字段必要时会截断到 `6000` 字符
- 截断只记 warning，不会让整条记录失败

## 开发方式

在 LifeForge 工作区中：

```bash
cd apps/longdongqiang--paper-library
bun install
```

常用命令：

```bash
bun run types
bun run build:client
bun run build:server
```

典型的 Docker 集成流程：

```bash
bun forge db push longdongqiang--paper-library
docker compose restart server
```

如果前端 bundle 改了，还需要重建 Docker 产物：

```bash
cd apps/longdongqiang--paper-library/client
DOCKER_BUILD=true bun run vite build
```

## Git 使用

这个模块刻意使用独立 Git 仓库管理。

典型流程：

```bash
cd apps/longdongqiang--paper-library
git status
git add .
git commit -m "..."
git push
```

## 已知限制

- 共享 fetch settings 目前还没有在代码层做强管理员限制
- `recommend` 目前仍会重复计算 candidate paper embeddings，只有 Zotero 侧 embeddings 做了缓存
- `enhance` 结果仍然依赖模型输出稳定性
- `Run` 页展示的是主统计和 skip 分类，底层状态信息仍比当前 UI 更细
- 模块默认按单实例 LifeForge server 运行
- 某些上游服务仍可能出现限流或不稳定：
  - `Nature API`
  - `Tavily`
  - 某些 RSS 源

## 仓库

GitHub：

- `git@github.com:Longdongqiang928/Lifeforge-Paper-Library.git`
