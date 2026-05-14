# Paper Library 维护指南

本文档面向后续维护 `apps/longdongqiang--paper-library` 模组的人，重点记录当前真实架构、部署流程、常见故障、排查路径，以及前面多轮 debug 中已经确认过的高频问题与修复经验。

它不是功能说明书。  
如果你想先了解模块功能、页面结构和对外能力，先看：

- [README.md](./README.md)
- [README.zh-CN.md](./README.zh-CN.md)

## 1. 当前模块的真实结构

当前 `paper-library` 是一个：

- 独立 Git 仓库
- 运行在 LifeForge 宿主中的自定义模块
- 前端通过 module federation 挂载
- 后端路由与调度器运行在 `lifeforge-server` 容器内
- 数据落在 PocketBase

模块路径：

```text
apps/longdongqiang--paper-library
```

关键目录：

```text
client/    前端页面、组件、manifest、类型与 API 包装
server/    schema、routes、pipeline、scheduler
locales/   模块自己的多语言文案
README*    功能说明
CLAUDE.md  模块内开发约束
```

## 2. 当前工作流

当前已经稳定成四阶段：

1. `fetch`
2. `abstract`
3. `recommend`
4. `enhance`

### 2.1 fetch

职责：

- 读取共享 `fetch settings`
- 按 source 抓 RSS
- 解析新论文
- 去重
- 只插入新论文，不覆盖已有论文
- 给论文打 `abstract_status`

当前规则：

- 已存在论文：跳过
- 本轮重复论文：跳过
- 不在 `fetch` 阶段做推荐或增强

### 2.2 abstract

职责：

- 只处理 `abstract_status = missing` 的论文
- 独立于 `fetch`

当前 provider 链路：

1. `Nature API`
2. `OpenAlex`
3. `Tavily`

当前特点：

- 批处理
- 有超时
- 有重试
- 某个 provider 失败不会中断整个阶段

### 2.3 recommend

职责：

- 用当前用户的 Zotero 语料做相关性排序
- 写入 `user overlay`

当前前置条件：

- `papers.abstract_status = ready`

当前特点：

- 没有 `user_state` 也允许进入推荐
- 推荐结果写入时自动创建 overlay
- 使用 `recommend_input_hash` 跳过未变化内容

### 2.4 enhance

职责：

- 对高相关论文生成：
  - `tldr`
  - `translated_title`
  - `translated_abstract`

前置条件：

- `papers.abstract_status = ready`
- 已有 recommend 结果
- `score_max >= enhance_threshold`

当前特点：

- 使用 `enhance_input_hash` 跳过未变化内容
- 已完成且输入未变时不会重复调用模型

## 3. 当前状态模型

### 3.1 调度层

配置来源：

- `ldq_paperlib_fetch_settings`
- `ldq_paperlib_user_settings`

共享调度 key：

- `last_fetch_schedule_key`
- `last_abstract_schedule_key`

用户调度 key：

- `last_recommend_schedule_key`
- `last_enhance_schedule_key`

这些 key 才是 scheduler 去重依据。  
不要再把 `runs` 当成调度是否执行过的唯一判断。

### 3.2 论文层

摘要资格字段：

- `papers.abstract_status`

当前只允许三种语义：

- `ready`
- `missing`
- `error`

后续阶段应只认这个 gate，不要再次自行发明一套“读 abstract 是否为空”的分支逻辑。

### 3.3 用户 overlay 层

当前长期阶段状态：

- `recommend_status`
- `enhance_status`

长期状态语义只保留：

- `idle`
- `completed`
- `failed`

不要再把 `skipped` 当长期状态写回去。  
跳过原因只应进入本次 `run.details`。

配套字段：

- `recommend_input_hash`
- `enhance_input_hash`
- `recommend_last_run_id`
- `enhance_last_run_id`
- `recommend_last_reason`
- `enhance_last_reason`

### 3.4 运行历史层

表：

- `ldq_paperlib_runs`

职责：

- 保存每次执行历史
- 保存本次统计
- 保存本次 skip 分类与错误摘要

不负责：

- 长期调度去重
- 作为长期阶段状态来源

## 4. 数据表分工

### 4.1 业务主表

- `ldq_paperlib_papers`
- `ldq_paperlib_user_states`

### 4.2 收藏相关

- `ldq_paperlib_folders`
- `ldq_paperlib_favorites`

### 4.3 配置相关

- `ldq_paperlib_fetch_settings`
- `ldq_paperlib_user_settings`

### 4.4 运行与缓存

- `ldq_paperlib_runs`
- `ldq_paperlib_import_batches`
- `ldq_paperlib_zotero_cache`
- `ldq_paperlib_embed_cache`

## 5. 后续开发时必须记住的部署规则

这是前面排障里最重要的一条。

### 5.1 前端改动

如果你改的是：

- `client/src/**`
- `client/manifest.ts`
- `locales/**`

至少需要：

```bash
cd apps/longdongqiang--paper-library
bun run build:client
cd client
DOCKER_BUILD=true bun run vite build
cd ../../..
docker compose restart server
```

原因：

- 模块前端资产要重新生成 `dist` / `dist-docker`
- `lifeforge-server` 需要重新提供新的 module 静态资源

### 5.2 后端改动

如果你改的是：

- `server/utils/pipeline.ts`
- `server/utils/scheduler.ts`
- `server/routes/**`
- `server/schema.ts`
- `server/utils/constants.ts`

至少需要：

```bash
cd apps/longdongqiang--paper-library
bun run build:server
docker compose restart server
```

如果改了 schema，再额外执行：

```bash
bun forge db push longdongqiang--paper-library
```

### 5.3 为什么一定要重启 server

这是最常见的误区。

`paper-library` 的 scheduler 和所有服务端流程都在 `lifeforge-server` 的长生命周期进程内运行。  
只改源码、不重启容器时，前端可能已经更新，但：

- scheduler 还是旧逻辑
- pipeline 还是旧逻辑
- 已缓存的 PocketBase 连接也是旧状态

前面真实出现过的问题：

- scheduler 继续跑旧 bundle
- 已修复的 `fetch_settings create` bug 仍在每分钟报错
- 过期的管理员连接一直不刷新

所以：

**只要改了服务端逻辑，就必须重启 `lifeforge-server`。**

## 6. 当前最重要的真实排障结论

### 6.1 scheduler 不触发的经典原因：过期的管理员 PB 连接

真实发生过的问题：

- scheduler 使用缓存的 superuser PocketBase 客户端
- 认证过期后，读 `ldq_paperlib_fetch_settings` 会退化成未认证效果
- 查询结果为空
- 于是误以为不存在 `global fetch settings`
- 每分钟都去 create
- 然后报：

```text
ClientResponseError 400: Failed to create record.
url: http://db:8090/api/collections/ldq_paperlib_fetch_settings/records
```

现已修复：

- `getSchedulerPocketBase()` 会在 `authStore` 失效时自动重连

如果以后又看到同类问题，优先检查：

1. `lifeforge-server` 是否重启过
2. 当前 scheduler bundle 是否包含修复
3. `fetch_settings` 的 key 是否停在昨天

### 6.2 scheduler 误以为没有 fetch settings

真实发生过的问题：

- `getOrCreateFetchSettingsRecord()` 曾经用：
  - `getFirstListItem(...).catch(() => null)`
- 某些查询失败会被误吞成“查不到”
- 然后错误走到 create 分支

现已修复：

- 改成 `getFullList(filter: config_key = "global")`
- 明确只在真的空列表时 create
- create 失败后回查一次，防止竞态

### 6.3 abstract 独立阶段后，旧 user_settings 兼容问题

真实发生过的问题：

- `abstract` 从用户配置迁到共享 `fetch settings` 后
- 旧 `user_settings` 里仍有残留 `abstract_*` 字段脏值
- scheduler 更新 `last_recommend_schedule_key` 时被旧字段校验拦住

现已做过兼容层处理。  
如果以后再调整阶段归属，记得同时处理：

- schema
- 旧记录默认值
- update 时的兼容字段

### 6.4 abstract / fetch / recommend / enhance 处于 running 不收尾

真实发生过的问题：

- 运行过程中重启 `server`
- 当前 `run` 会遗留成 `running`
- 后续阶段可能被锁住

现已修复：

- 启动时会回收 orphan `running` run
- 超时运行会按 stale run 回收

如果页面里又看到 오래的 `running`：

1. 先查容器是否刚重启
2. 再查 run 的 `created/updated`
3. 如果明显已死，确认 orphan reconcile 是否运行

### 6.5 locale warning

真实发生过的问题：

- `ModuleHeader` 会按全局 namespace 猜测文案 key
- `ModalHeader` / `Button` 的裸字符串会被当作 i18n key
- 导致日志刷一堆：
  - `Missing locale apps.runPage:*`
  - `Missing locale common.buttons:*`

当前处理方式：

- 模块内使用显式页头组件
- modal 标题改成非字符串 key 形式
- 按钮文本包成普通 node，而不是让 shared Button 自己猜 key

如果未来又看到类似 warning：

先排查：

1. 是否又用了 shared `ModuleHeader`
2. 是否把 `title="Some string"` 直接传给 shared `ModalHeader`
3. 是否又出现了裸字符串按钮文案

## 7. 各阶段的常见问题与处理

### 7.1 fetch

#### 问题：旧论文被覆盖

当前设计已经改成：

- 已存在论文直接跳过
- 不在 `fetch` 阶段覆盖更新

如果以后有人把逻辑改回了 upsert，需要特别警惕：

- 空摘要覆盖已有摘要
- `abstract_status` 回退
- `fetched_at` 被污染

#### 问题：同一轮里重复论文浪费摘要提取成本

当前应保持：

- 先去重
- 再进入后续处理

不要回退到：

- 先提摘要
- 后判重

### 7.2 abstract

#### 问题：Nature API 频繁失败

真实现象：

- `429 Too Many Requests`
- `401 Unauthorized`

优先排查：

1. `Nature API Key` 是否有效
2. 是否已超官方限额
3. 当前 source 是否应该走 Nature

当前抽摘要顺序是：

- `Nature API`
- `OpenAlex`
- `Tavily`

不要再让非 `nature` 源错误走 Nature API 全量链路。

#### 问题：Tavily 长时间卡住

真实现象：

- `Empty Tavily response`
- `Request timed out after 30000ms`
- 整轮 `abstract` 看起来像卡住

当前应对方式：

- 批处理
- 重试
- 超时
- 单 provider 失败不阻断整轮

如果未来又慢：

1. 查 Tavily batch 大小
2. 查超时设置
3. 查是否需要减少 lookback 范围

### 7.3 recommend

#### 问题：没有 `user_state` 时全被跳过

这个问题前面已经改过。  
当前逻辑应保持：

- 没有 `user_state` 也允许推荐
- 推荐结果写回时自动创建 overlay

#### 问题：embedding 超时

真实现象：

- `/embeddings` 30s 超时
- 大模型网关收到请求但客户端拿不到完整响应

当前修复思路是：

- embeddings 分批
- 更长超时
- 单独重试

如果以后又超时：

1. 先看网关是否真返回了完整 HTTP 响应
2. 再看批量大小
3. 再看 timeout 是否足够

### 7.4 enhance

#### 问题：连续跑两次仍然重复处理

真实根因：

- 命中 unchanged 分支时把 `enhance_status` 改成了 `skipped`
- 下一次判断 `status === completed` 不成立
- 所以又重新跑

当前正确逻辑应保持：

- unchanged 时保留 `status = completed`
- 只在 run details 里记 skip 原因

## 8. 导入与 fetch 的差异

### 8.1 import

当前导入逻辑：

- 重复论文直接跳过
- 不覆盖已有论文
- `inserted / skipped / failed` 才是主要统计

推荐 / 增强类导入结果：

- 会明确标记 `imported`

### 8.2 fetch

当前 fetch 逻辑也应保持：

- 只抓新论文
- 已存在论文跳过

不要让 `import` 和 `fetch` 在重复论文策略上再次分叉。

## 9. 收藏夹相关维护要点

真实修过的问题：

- 新建空文件夹后页面“像是没反应”

根因：

- 前端把空文件夹过滤掉了

当前应保持：

- 空文件夹也显示
- 默认文件夹不可删
- 删除普通文件夹时把论文迁回 `Default`

如果以后收藏夹操作出问题，先查：

1. 文件夹是否被 UI 过滤掉
2. 默认文件夹是否存在
3. 删除逻辑是否正确迁移 favorites

## 10. 业务数据清理规则

前面多次用过的“只保留配置，清空业务表”原则：

保留：

- `ldq_paperlib_fetch_settings`
- `ldq_paperlib_user_settings`

清空：

- `ldq_paperlib_papers`
- `ldq_paperlib_user_states`
- `ldq_paperlib_folders`
- `ldq_paperlib_favorites`
- `ldq_paperlib_runs`
- `ldq_paperlib_import_batches`
- `ldq_paperlib_zotero_cache`
- `ldq_paperlib_embed_cache`

注意：

- 如果调度开关还是开的，清完后到时间会自动重新写入业务数据
- 如果想“清空后静置”，先关调度开关

## 11. 日志排查顺序

以后再排障，建议按这个顺序看。

### 11.1 先看 scheduler 是否在正常 tick

```bash
docker compose logs server --since 10m | tail -200
```

关注：

- `scheduler tick at ...`
- 是否出现：
  - `Failed to create record`
  - `Marked failed after server restart interrupted the run`

### 11.2 再查 schedule key 是否更新

看：

- `last_fetch_schedule_key`
- `last_abstract_schedule_key`
- `last_recommend_schedule_key`
- `last_enhance_schedule_key`

如果今天已到时间但 key 还停在昨天，说明阶段根本没被记账。

### 11.3 再看 runs

重点看最近几条：

- `stage`
- `triggered_by`
- `status`
- `error_summary`

不要只看前端页面，要直接查表。

### 11.4 最后看 provider 层日志

例如：

- Nature
- OpenAlex
- Tavily
- embedding gateway
- chat model gateway

## 12. 推荐的日常维护流程

### 修改代码后

1. 改前端：
   - `bun run build:client`
   - `DOCKER_BUILD=true bun run vite build`
2. 改后端：
   - `bun run build:server`
3. 改 schema：
   - `bun forge db push longdongqiang--paper-library`
4. 最后：
   - `docker compose restart server`

### 上线后确认

1. 看 `docker compose logs server --since 3m`
2. 确认：
   - 没有新的 `scheduler tick failed`
   - 没有重复 `fetch_settings create`
3. 打开页面验证：
   - `Papers`
   - `Run`
   - `Settings`

## 13. 如果未来还要继续重构，优先级建议

优先保持这几个方向不被破坏：

1. `abstract` 必须保持独立阶段
2. scheduler 必须使用有效的管理员连接
3. 调度 key 必须是唯一去重依据
4. `recommend/enhance` 的 unchanged 跳过不能再污染长期状态
5. `fetch/import` 对重复论文都应该保持跳过，不覆盖

不建议轻易回退的设计：

- 把 `abstract` 再塞回 `fetch`
- 用 `runs` 重新承担调度去重
- 用 `skipped` 作为长期 overlay 状态
- 重新让 `fetch` 覆盖已有论文

## 14. 维护结论

这套模块现在能稳定运行的关键，不在于某一条 API，而在于：

- 阶段边界清楚
- 状态模型清楚
- scheduler 和运行历史分层
- 服务端修改后始终重启容器
- 把所有“只在运行时成立的状态”留在 `runs.details`

后续维护时，只要始终守住这几个边界，大多数问题都不会再退回到早期那种“同一个 bug 重复出现”的状态。
