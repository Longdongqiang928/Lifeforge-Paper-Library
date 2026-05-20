# Paper Library 前端设计规范

本文档总结 Paper Library 模块在近期前端重构中的设计约定，用于后续新增页面、维护布局和调整交互时保持一致。目标是让模块视觉上融入 LifeForge 主系统，同时保留 Paper Library 面向文献工作流的高信息密度和专业感。

## 设计目标

Paper Library 的前端应遵循以下原则：

- 与 LifeForge 主系统保持一致，优先使用 `lifeforge-ui` 提供的组件、颜色变量、滚动容器、表单输入、弹窗和状态组件。
- 页面布局突出核心任务，不堆叠大段说明文字，说明性文本只在必要位置作为辅助信息出现。
- 高信息密度但不拥挤，卡片、筛选器、表格和操作按钮之间必须保留稳定间距。
- 同类页面使用相同交互模型，例如 Papers、Favorites、Review 都采用双栏独立滚动结构。
- 功能入口清晰，非主线页面不放入侧边栏子模块，而是通过页面顶部按钮进入。

## 颜色与主题

所有颜色必须优先使用 LifeForge 主题变量，不硬编码独立主题色。

推荐使用：

- `bg-bg-50`、`bg-bg-100`、`bg-bg-900`
- `bg-component-bg`、`bg-component-bg-lighter`
- `text-bg`、`text-bg-400`、`text-bg-500`
- `border-bg-500/10`、`border-bg-500/20`
- `bg-custom-500`、`text-custom-500`、`border-custom-500/20`

避免使用：

- 与主系统无关的自定义色板作为主要 UI 颜色。
- 固定紫色、蓝色或其他默认 AI 风格配色。
- 在普通按钮、分数、选中态上绕过 `custom` 主题色。

允许在状态语义中使用固定色：

- 成功：emerald
- 警告 / running：amber 或 blue
- 失败：red
- 来源标识可以使用小面积 accent strip，但不能主导页面色彩。

## 页面结构

### 主页面入口

侧边栏中只保留 Paper Library 的主入口，点击后进入 Papers 页面。Import、Review、Settings、Run 等页面不作为侧边栏子项展示，应通过页面内部按钮进入。

Papers 页面右上角固定保留主要功能入口：

- Review
- Import
- Settings

按钮应一行排列，使用 `Button` 组件，图标清晰，文本简短。

### 双栏页面

Papers、Favorites、Review 使用双栏布局：

- 左栏是筛选器、文件夹、来源或分类导航。
- 右栏是内容列表、搜索区、卡片列表或详情入口。
- 左右栏之间必须有明确间隔，避免贴边或视觉重叠。
- 左栏和右栏应独立滚动，参考 Todo List 模块使用 LifeForge 自定义 `Scrollbar` 的方式。

推荐结构：

```tsx
<div className="flex size-full min-h-0 flex-1" style={{ gap: '2rem' }}>
  <PaperSplitSidebar>
    {/* filter/sidebar content */}
  </PaperSplitSidebar>

  <div className="relative z-10 flex h-full min-w-0 flex-1 flex-col">
    {/* sticky/search/header card */}
    <div className="mt-8 flex min-h-0 flex-1 flex-col">
      <Scrollbar>{/* card list */}</Scrollbar>
    </div>
  </div>
</div>
```

### 单栏页面

Import 和 Settings 以单栏纵向堆叠为主。

Import 页面：

- 上方使用左右并排的两个 Card：`Choose File` 与 `Paste Text`。
- 下方单独 Card 展示 Recent imports。
- 小屏幕允许横向滚动或降级堆叠，但桌面端必须保持左右操作区清晰。

Settings 页面：

- 顶部设置分类采用三等分 tab 容器。
- 选中 tab 使用 `bg-custom-500/15 text-custom-500` 等主系统主题色高亮。
- 当前 tab 内容显示在同一个主 Card 内。
- Recent executions 使用下方单独 Card，不与设置表单混在一起。

## 滚动规范

滚动统一使用 LifeForge 的 `Scrollbar`，不要再为 Paper Library 自定义一套滚动组件。

要求：

- 页面内部可滚动区域必须有 `min-h-0`，否则 flex 子元素可能撑破容器。
- 卡片列表外层使用 `Scrollbar`，不要在同一区域重复嵌套多个互相竞争的滚动容器。
- 左栏、右栏分别独立滚动。
- 鼠标停留在卡片、表单、按钮区域时，滚轮仍应能驱动所在滚动容器。

LifeForge 本体的 `Scrollbar` 已做滚轮捕获兜底：优先原生滚动，如果目标区域没有实际滚动，再把滚动量交给最近可滚动父容器。因此模块内不要再做额外 wheel 透传 hack，除非明确发现新场景。

## 表单规范

所有普通文本输入、日期输入、长文本输入应使用 `lifeforge-ui`：

- `TextInput`
- `TextAreaInput`
- `DateInput`
- `Switch`
- `ListboxInput`，如果后续需要下拉选择

不要为表单输入使用 `variant="plain"`，除非该输入嵌在极特殊的紧凑控件内并经过确认。默认表单样式应保留 LifeForge 的边框、label、icon 和焦点态。

推荐写法：

```tsx
<TextInput
  icon="tabler:key"
  label="AI API key"
  placeholder="Already configured"
  value={value}
  onChange={setValue}
/>

<DateInput
  icon="tabler:calendar-event"
  label="Range start"
  value={date}
  onChange={setDate}
/>

<TextAreaInput
  className="min-h-36"
  icon="tabler:rss"
  label="RSS sources"
  value={rssSources}
  onChange={setRssSources}
/>
```

表单布局规则：

- 成对配置使用 `grid gap-4 lg:grid-cols-2`。
- 四阶段 schedule 时间块在桌面端保持一行四列，使用横向 grid。
- 密钥类配置如果迁移到 LifeForge API Key Vault，原位置只显示状态提示，不再展示输入框。
- 密钥状态 Card 应显示 key id，例如 `springer-nature`、`tavily`，并提供跳转 `/api-keys` 的按钮。

## 日期筛选规范

Papers 和 Review 的日期筛选保留两种表达：

- 月份日历选择区域，用于快速点击日期范围。
- `DateInput` 起止日期输入，用于精确查看和手动调整。

日期组件要求：

- 默认选择当天，除非用户明确清空筛选。
- 避免出现 `NaN`，所有日期进入 UI 前必须用 `dayjs(...).isValid()` 防护。
- 起止日期使用 `YYYY-MM-DD` 作为前端状态字符串。
- 传给服务端时按业务需要转成 `startOf('day')` / `endOf('day')`。

## 卡片规范

论文卡片应突出以下信息层级：

1. 来源 / 期刊 / 状态标签
2. 标题和翻译标题
3. 作者和日期元数据
4. 分数或推荐状态
5. TL;DR 或摘要预览
6. collection / keyword 标签

Papers 页面卡片桌面端建议一行两列。三列会导致论文标题、标签和摘要过度压缩。

卡片点击行为：

- 点击论文卡片打开详情弹窗，而不是跳转到独立详情页。
- 弹窗打开后背景模糊化。
- 详情弹窗应使用 LifeForge 统一弹窗风格，不要自定义一套看起来相似但行为不一致的 Modal。
- 弹窗内支持左右切换，上下滚动浏览内容。

## 按钮与入口

按钮统一使用 `Button` 组件。

常见模式：

- 返回：`variant="secondary"` + `tabler:arrow-left`
- 保存：`tabler:device-floppy`
- 运行：`tabler:player-play`
- 刷新：`tabler:refresh`
- 导入：`tabler:file-import`
- 设置：`tabler:settings`

页面级入口应放在 `ModuleHeader` 的 action area 或页面顶部主要操作区。不要把低频页面塞进左侧系统侧边栏。

## 状态展示

状态信息使用 `TagChip` 或小型状态 badge。

推荐语义：

- `Configured` / `Missing`：API Key Vault 状态。
- `Running` / `Completed` / `Failed`：pipeline run 状态。
- `Skip: No state / no abstract`、`Skip: Below threshold`、`Skip: Already enhanced / unchanged`：运行统计中的原因分类。

状态展示要避免模糊旧语义：

- Import 遇到重复论文是 skipped，不再使用 updated 文案。
- 运行记录中 recommend 和 enhance 的 skip 分类分开展示，避免共用一个变量造成误解。

## Import 页面规范

Import 页面保留两种导入方式：

- 文件导入：JSON / JSONL 文件。
- 文本导入：粘贴 JSON / JSONL 内容。

布局要求：

- `Choose File` 与 `Paste Text` 在桌面端左右并排。
- 文件选择原生 input 可以隐藏，但外层必须是 LifeForge 风格的 Card/drop zone。
- Recent imports 单独放在下方 Card。
- 统计文案使用 Inserted / Skipped / Failed，不再出现 Updated 旧语义。

重复论文处理：

- 发现重复论文时跳过导入，不覆盖已有记录。
- UI 统计应把重复论文计入 skipped。

## Review 页面规范

Review 页面用于人工检查摘要抽取质量。

要求：

- 左栏提供日期和来源筛选。
- 右栏展示论文列表。
- 每个论文卡片直接展示可编辑 `TextAreaInput`，不要再使用外部摘要预览 + 折叠编辑区域。
- 摘要输入时自动移除换行符。
- URL 点击在新标签页打开。
- 提供清空摘要按钮。

## Settings 页面规范

Settings 页面合并原 Run 页面能力，分为三个 tab：

- Select stages and launch
- Shared configurations
- Personal configurations

Select stages and launch：

- 阶段选择和日期范围应在同一操作区域内。
- 四个 schedule 时间块桌面端一行展示。
- Save schedules 放在 Active runs 区域旁边，不放在日期选择旁边。

Shared configurations：

- 放 RSS sources、fetch/abstract 相关共享配置。
- `springer-nature`、`tavily` 只显示 API Key Vault 状态，不在这里输入密钥。

Personal configurations：

- 放 Zotero、AI base URL、模型、输出语言、推荐/增强阈值等用户相关配置。
- 目前 Zotero API key 和 AI API key 仍保留在模块个人配置中；如果后续迁移到 vault，需要重新评估用户隔离问题。

## API Key 状态规范

全局 API Key Vault 用于服务级密钥，不用于普通 URL 或模型名。

当前 Paper Library 使用的全局 key：

- `springer-nature`：Springer Nature metadata API key。
- `tavily`：Tavily API key。

页面内只显示状态，不显示密钥输入框。状态判断必须基于服务端能否成功读取并解密 key，而不是仅判断记录是否存在。

不建议放入 API Key Vault：

- AI base URL
- Chat model
- Embedding model
- RSS sources
- Zotero user ID

## 文案规范

文案要短，避免大段说明。

推荐：

- `All Papers`
- `Date Filter`
- `Recent imports`
- `Recent executions`
- `Manage API keys`
- `Configured`
- `Missing`

避免：

- 长段解释性副标题。
- 模糊语义，例如把 skip 显示成 update。
- 自动生成感很强的泛泛描述。

## 实现检查清单

新增或修改页面时至少检查：

- 是否使用 LifeForge 主题变量。
- 是否使用 `lifeforge-ui` 表单组件。
- 是否避免了表单输入 `variant="plain"`。
- 双栏页面左右是否独立滚动。
- 鼠标在卡片内部滚轮是否能滚动列表。
- 桌面端卡片是否过密。
- 顶部操作按钮是否位置一致。
- 状态标签是否语义清楚。
- Docker 环境是否构建了 `dist-docker`。

常用验证命令：

```bash
bun run types
bun run build:server
DOCKER_BUILD=true bun run build:client
docker compose restart server
```

注意：Paper Library Docker 前端使用 `client/dist-docker`，不是普通 `client/dist`。如果修改了 LifeForge 本体 `lifeforge-ui`，还需要重建主 `lifeforge-client` 镜像。
