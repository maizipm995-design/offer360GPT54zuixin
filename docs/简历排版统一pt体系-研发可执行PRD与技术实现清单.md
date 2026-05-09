# 简历排版统一 pt 体系研发可执行 PRD + 技术实现清单

## 1. 文档目的

本文用于统一简历优化页面的垂直排版规则，建立一套贴合 Word 原生排版逻辑的 `pt` 基准体系，并为后续研发改造、后台配置、前台调节、数据迁移、测试验收提供可直接执行的实现依据。

本文重点解决以下问题：

- 全站简历垂直间距统一采用 `pt` 作为唯一基础计量单位
- 后台维护模板基础 `pt` 值，前台仅提供全局缩放参数
- 严格区分：
  - `bodyTextLineHeightPt`：正文文本标准行高
  - `listItemGapPt`：不同列表条目之间的间距
- 移除当前通过 `lineHeight` 派生多种间距的隐式规则
- 保证不同模板、不同模块、不同内容类型在垂直排版上使用同一套计算口径

---

## 2. 业务背景与问题定义

### 2.1 业务前提

我方简历排版逻辑整体借鉴 Word 文档原生排版规则。

因此，所有垂直排版相关的：

- 行高
- 列表条目间距
- 标题与分割线间距
- 分割线与首条内容间距
- 条目头部与正文间距
- 段落间距
- 页面上下内边距
- 头部上下内边距

都必须遵循同一套基础计量体系。

### 2.2 当前实现的主要问题

当前简历页面中，多个垂直间距并不是独立配置，而是由 `lineHeight` 派生而来：

- `lineGap = 0.4 * lineHeight`
- `itemGap = 0.2 * lineHeight`
- `sectionGap = 0.2 * lineHeight`
- `pagePadding = 2.5 * lineHeight`
- `headerPadding = 2.0 * lineHeight`

当前相关实现位于：

- [resume-document.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/components/resume/resume-document.tsx)
- [resume-types.ts](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/components/resume/resume-types.ts)
- [resume-editor-page-client.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/components/resume/resume-editor-page-client.tsx)

该实现存在以下问题：

1. 不同元素使用不同倍率规则，不符合统一 `pt` 基准
2. 多处间距无法独立配置，只能一起联动变化
3. “正文行高”和“列表条目间距”没有严格拆分
4. 配置层存在 `sectionSpacing`、`itemSpacing`，但渲染层未独立读取
5. 前台调节的是 `lineHeight`，不是单纯的全局缩放系数

---

## 3. 产品目标

### 3.1 总体目标

建立统一的简历垂直排版参数体系，满足以下要求：

- 全链路统一使用 `pt` 作为基础单位
- 后台可按模板配置基础排版参数
- 前台用户仅可通过一个参数整体调节疏密
- 所有垂直间距与正文行高保持同比例缩放
- 模板排版结构比例固定，用户只能整体放大或缩小

### 3.2 核心目标

将当前“基于 `lineHeight` 派生多种间距”的逻辑，改造成：

```text
最终实际间距/行高 pt = 后台基础 pt 值 × 前台全局缩放系数
```

并明确拆分：

- `bodyTextLineHeightPt`
  - 表示正文文本的标准行高
- `listItemGapPt`
  - 表示不同列表条目之间的间距

两者完全分开，不混淆。

---

## 4. 统一排版规范

### 4.1 统一单位规范

全站简历所有垂直类排版参数，统一使用 `pt` 作为唯一基础计量单位。

适用范围包括但不限于：

- 文本标准行高
- 模块标题与分割线间距
- 分割线与首条内容间距
- 条目头部与正文间距
- 列表条目之间间距
- 段落之间间距
- 页面上下内边距
- 头部上下内边距

### 4.2 统一计算公式

所有垂直参数统一采用如下公式：

```text
最终值 = 后台基础 pt 值 × spacingScale
```

其中：

- 后台基础 pt 值：由管理员按模板预设
- `spacingScale`：由前台用户输入，表示整体疏密缩放系数

### 4.3 禁止事项

禁止出现以下情况：

- 标题用一套倍率、正文用另一套倍率
- 某些间距用 `lineHeight * 0.2`，某些再用写死 `px`
- 正文行高和列表项间距复用同一个配置项
- 前台允许逐项修改细分间距
- 模板基础比例被用户改乱

---

## 5. 参数定义

### 5.1 核心参数总表

| 参数名 | 含义 | 单位 | 默认值建议 | 是否参与全局缩放 |
| --- | --- | --- | --- | --- |
| `sectionTitleToDividerPt` | 模块标题与下方分割线间距 | pt | 3 | 是 |
| `dividerToEntryHeaderPt` | 分割线与下方公司/学校/起止信息间距 | pt | 3 | 是 |
| `entryHeaderToBodyPt` | 条目头部信息区与正文描述间距 | pt | 3 | 是 |
| `listItemGapPt` | 不同列表条目之间的间距 | pt | 2 | 是 |
| `bodyTextLineHeightPt` | 正文文本标准行高 | pt | 模板定义 | 是 |
| `paragraphGapPt` | 段落与段落之间间距 | pt | 2 | 是 |
| `sectionCardGapPt` | 模块标题块与模块正文之间间距 | pt | 3 | 是 |
| `pagePaddingTopPt` | 页面上内边距 | pt | 模板定义 | 是 |
| `pagePaddingBottomPt` | 页面下内边距 | pt | 模板定义 | 是 |
| `headerPaddingTopPt` | 头部上内边距 | pt | 模板定义 | 是 |
| `headerPaddingBottomPt` | 头部下内边距 | pt | 模板定义 | 是 |
| `spacingScale` | 前台全局疏密缩放系数 | 无单位 | 1 | - |

### 5.2 关键区分要求

#### `bodyTextLineHeightPt`

定义：

- 表示正文文本的标准行高
- 只影响单个文本块内部，多行自动换行时每一行的行盒高度

不应影响：

- 不同列表项之间的间距
- 模块之间的间距
- 标题和分割线之间的距离

#### `listItemGapPt`

定义：

- 表示不同列表条目之间的垂直间距
- 只影响 `li` 与 `li` 之间的距离

不应影响：

- 单个 `li` 内部多行文字的换行行高
- 正文标准行高

### 5.3 关于 `bodyTextLineHeightPt` 默认值说明

用户需求中提到“单条内容自动换行后，内部多行文字的行间距默认 2pt”，从实际排版角度看，这不适合作为最终 `line-height` 直接使用。

建议产品与设计统一以下口径：

- 若该字段指“正文标准行高”，则应直接配置一个真实可用的 `bodyTextLineHeightPt`
- 不建议将 `2pt` 直接作为正文标准行高
- 建议按模板定义真实正文行高，例如与字号匹配的标准 `pt` 值

本 PRD 不强行写死 `bodyTextLineHeightPt` 默认值，统一定义为“模板定义”。

---

## 6. 前后台职责划分

### 6.1 后台职责

后台负责：

- 为每套模板维护一套基础 `pt` 参数
- 锁定模板内部各垂直点位比例关系
- 提供可视化配置页面供管理员维护
- 保存模板默认 `spacingScaleDefault`
- 为新简历、新模板、模板切换提供基础值来源

### 6.2 前台职责

前台负责：

- 读取后台下发的基础 `pt` 参数
- 展示一个用户可调的 `spacingScale`
- 使用统一公式实时计算渲染值
- 保证用户调整后仅整体疏密变化，不破坏模板比例

### 6.3 用户权限边界

用户前台只能调整：

- `spacingScale`

用户前台不能调整：

- 任意单个基础间距 `pt`
- 标题和正文分别不同倍率
- 列表项间距和正文行高分开手调

---

## 7. 前台交互 PRD

### 7.1 交互目标

前台仅保留一个全局疏密参数，替代当前“全局垂直间距 / lineHeight”逻辑。

### 7.2 交互形式

建议保留当前顶部工具栏入口，但文案改为：

- `整体疏密`
- 或 `全局间距系数`

### 7.3 参数规则

- 字段名：`spacingScale`
- 默认值：`1`
- 建议范围：`0.8 - 1.2`
- 建议步进：`0.05`

### 7.4 用户调节效果

当用户调整 `spacingScale` 后：

- 正文行高同比例变化
- 列表条目间距同比例变化
- 模块标题与分割线间距同比例变化
- 分割线与首条内容间距同比例变化
- 条目头部与正文间距同比例变化
- 页面上下 padding、头部上下 padding 同比例变化

但模板内部相对比例结构不变。

---

## 8. 后台配置 PRD

### 8.1 页面目标

新增“简历模板排版基础参数配置”页面，支持管理员针对每套模板维护基础 `pt` 值。

### 8.2 页面字段分组建议

#### A. 模块标题区域

- `sectionTitleToDividerPt`
- `dividerToEntryHeaderPt`

#### B. 条目正文区域

- `entryHeaderToBodyPt`
- `listItemGapPt`
- `bodyTextLineHeightPt`
- `paragraphGapPt`

#### C. 模块结构区域

- `sectionCardGapPt`

#### D. 页面容器区域

- `pagePaddingTopPt`
- `pagePaddingBottomPt`
- `headerPaddingTopPt`
- `headerPaddingBottomPt`

#### E. 默认缩放

- `spacingScaleDefault`

### 8.3 页面能力要求

- 数值输入框统一显示单位 `pt`
- 支持模板维度保存
- 支持恢复默认
- 支持实时预览
- 支持复制模板参数
- 保存前进行参数校验

### 8.4 参数校验

通用要求：

- 所有间距类字段 `>= 0`
- 所有字段必须是数值

特别要求：

- `bodyTextLineHeightPt` 必须大于 0
- 建议 `bodyTextLineHeightPt >= fontSize`

---

## 9. 技术设计

### 9.1 数据结构设计

建议新增独立结构：

```ts
interface ResumeVerticalSpacingConfig {
  sectionTitleToDividerPt: number;
  dividerToEntryHeaderPt: number;
  entryHeaderToBodyPt: number;
  listItemGapPt: number;
  bodyTextLineHeightPt: number;
  paragraphGapPt: number;
  sectionCardGapPt: number;
  pagePaddingTopPt: number;
  pagePaddingBottomPt: number;
  headerPaddingTopPt: number;
  headerPaddingBottomPt: number;
}

interface ResumeStyleConfig {
  templateCode: ResumeTemplateCode;
  fontFamily: ResumeFontFamily;
  fontSize: number;
  pageMargin: number;
  themeColor: string;
  headerVariant: ResumeHeaderVariant;
  basicInfoVariant: ResumeBasicInfoVariant;
  sectionTitleVariant: ResumeSectionTitleVariant;
  skillVariant: ResumeSkillVariant;
  experienceHeaderVariant: ResumeExperienceHeaderVariant;
  paperBackgroundVariant: ResumePaperBackgroundVariant;
  paperBackgroundPosition: ResumeHeaderAlign;
  dateFormat: ResumeDateFormat;
  titleStyle: ResumeTitleStyle;
  titleSeparator: string;
  doubleLinePriority: ResumeDoubleLinePriority;
  headerAlign: ResumeHeaderAlign;
  spacingScale: number;
  verticalSpacing: ResumeVerticalSpacingConfig;
}
```

### 9.2 当前类型文件修改点

修改文件：

- [resume-types.ts](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/components/resume/resume-types.ts)

需要改动：

- `ResumeStyleConfig` 新增 `spacingScale`
- `ResumeStyleConfig` 新增 `verticalSpacing`
- `DEFAULT_RESUME_STYLE` 新增默认 `verticalSpacing`
- `normalizeResumeStyle()` 支持新字段归一化
- 旧字段 `lineHeight`、`sectionSpacing`、`itemSpacing` 标记为兼容字段，后续废弃

### 9.3 模板数据结构改造

修改文件：

- [resume-templates.ts](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/components/resume/resume-templates.ts)

改造要求：

- 每个模板新增一套 `verticalSpacing`
- 模板切换时加载模板默认 `verticalSpacing`
- 模板不再只依赖 `lineHeight`

---

## 10. 渲染层实现方案

### 10.1 核心改造原则

删除当前“由 `lineHeight` 派生多个间距”的主控模式，改为：

- 后台基础 `pt` 参数
- 前台 `spacingScale`
- 渲染时统一一次性计算最终值

### 10.2 新增计算函数

建议新增：

```ts
function buildVerticalSpacing(styleConfig: ResumeStyleConfig) {
  const scale = styleConfig.spacingScale ?? 1;
  const base = styleConfig.verticalSpacing;

  return {
    sectionTitleToDividerPt: base.sectionTitleToDividerPt * scale,
    dividerToEntryHeaderPt: base.dividerToEntryHeaderPt * scale,
    entryHeaderToBodyPt: base.entryHeaderToBodyPt * scale,
    listItemGapPt: base.listItemGapPt * scale,
    bodyTextLineHeightPt: base.bodyTextLineHeightPt * scale,
    paragraphGapPt: base.paragraphGapPt * scale,
    sectionCardGapPt: base.sectionCardGapPt * scale,
    pagePaddingTopPt: base.pagePaddingTopPt * scale,
    pagePaddingBottomPt: base.pagePaddingBottomPt * scale,
    headerPaddingTopPt: base.headerPaddingTopPt * scale,
    headerPaddingBottomPt: base.headerPaddingBottomPt * scale,
  };
}
```

### 10.3 CSS 变量注入建议

在简历文档根节点统一下发：

```ts
'--resume-section-title-divider-gap': `${spacing.sectionTitleToDividerPt}pt`,
'--resume-divider-entry-gap': `${spacing.dividerToEntryHeaderPt}pt`,
'--resume-entry-body-gap': `${spacing.entryHeaderToBodyPt}pt`,
'--resume-list-item-gap': `${spacing.listItemGapPt}pt`,
'--resume-body-line-height': `${spacing.bodyTextLineHeightPt}pt`,
'--resume-paragraph-gap': `${spacing.paragraphGapPt}pt`,
'--resume-section-card-gap': `${spacing.sectionCardGapPt}pt`,
'--resume-page-padding-top': `${spacing.pagePaddingTopPt}pt`,
'--resume-page-padding-bottom': `${spacing.pagePaddingBottomPt}pt`,
'--resume-header-padding-top': `${spacing.headerPaddingTopPt}pt`,
'--resume-header-padding-bottom': `${spacing.headerPaddingBottomPt}pt`,
```

### 10.4 当前文件改造点

修改文件：

- [resume-document.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/components/resume/resume-document.tsx)

关键要求：

- 弱化或移除 `buildSpacingScale(lineHeight)`
- 不再用 `lineHeight * 0.2 / 0.4 / 2.0 / 2.5`
- 页面 padding、头部 padding、模块间距、正文行高都改为读取独立变量

---

## 11. 组件级改造清单

### 11.1 `SectionTitle`

当前问题：

- `classic` 样式中，标题与蓝色分割线之间使用 `var(--resume-line-gap)`

改造目标：

- 改为 `var(--resume-section-title-divider-gap)`

涉及位置：

- [resume-document.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/components/resume/resume-document.tsx)

### 11.2 `SectionCard`

当前问题：

- 标题块与模块正文之间使用 `var(--resume-item-gap)`

改造目标：

- 改为 `var(--resume-divider-entry-gap)` 或 `var(--resume-section-card-gap)`

### 11.3 `renderExperienceItem` / `renderProjectItem` / `renderCampusRoleItem`

当前问题：

- 条目头部与正文描述之间使用 `var(--resume-item-gap)`

改造目标：

- 改为 `var(--resume-entry-body-gap)`

### 11.4 `renderRichTextBlock`

当前问题：

- 正文行高由 `typography.bodyLineHeightPt` 控制
- 列表项间距使用 `var(--resume-line-gap)`
- 段间距也混在 `var(--resume-line-gap)` 中

改造目标：

- `line-height` 改为 `var(--resume-body-line-height)`
- `li + li` 改为 `var(--resume-list-item-gap)`
- `block + block` 改为 `var(--resume-paragraph-gap)`

### 11.5 `ResumeFlow`

当前问题：

- 页面上下内边距使用 `getPagePaddingPt(lineHeight)` 派生

改造目标：

- 页面上下内边距读取：
  - `--resume-page-padding-top`
  - `--resume-page-padding-bottom`

### 11.6 `ResumeHeader`

当前问题：

- 头部上下内边距使用 `getHeaderPaddingPt(lineHeight)` 派生

改造目标：

- 改为读取：
  - `--resume-header-padding-top`
  - `--resume-header-padding-bottom`

---

## 12. 编辑器改造方案

### 12.1 目标

前台编辑器取消将 `lineHeight` 作为“全局垂直间距”主控参数，改为使用 `spacingScale`。

### 12.2 修改文件

- [resume-editor-page-client.tsx](file:///Users/maizim/Documents/2605GPT54offer360/apps/web/components/resume/resume-editor-page-client.tsx)

### 12.3 改造点

- 将当前“全局垂直间距”选择器改成“整体疏密 / 全局间距系数”
- 读写字段从 `styleConfig.lineHeight` 改为 `styleConfig.spacingScale`
- 前台不再允许用户直接配置单项 `pt`

### 12.4 智能一页逻辑改造

当前逻辑：

- 优先缩 `lineHeight`
- 再缩 `fontSize`
- 再缩 `pageMargin`

改造后建议：

1. 优先缩 `spacingScale`
2. 再缩 `fontSize`
3. 再缩 `pageMargin`

原因：

- `spacingScale` 才符合新的统一规则
- 不应在智能一页里直接改后台基础 `pt` 参数

---

## 13. 后台管理实现清单

### 13.1 新增能力

- 模板基础排版参数管理页
- 模板级基础 `pt` 参数编辑
- 实时预览
- 保存和发布
- 恢复默认
- 模板复制

### 13.2 后端能力

需要支持：

- 模板基础排版参数结构存储
- 简历草稿样式结构兼容新字段
- 查询、更新、模板下发

建议新增存储字段：

- `verticalSpacingJson`
- 或在 `styleJson` 中纳入 `verticalSpacing`

---

## 14. 数据迁移方案

### 14.1 迁移目标

兼容已有简历草稿，确保老数据在新系统上线后仍可正常渲染。

### 14.2 兼容规则

若旧数据仅存在：

- `lineHeight`
- `sectionSpacing`
- `itemSpacing`

则迁移时生成一套默认 `verticalSpacing`。

### 14.3 建议迁移映射

```text
sectionTitleToDividerPt = 3
dividerToEntryHeaderPt = 3
entryHeaderToBodyPt = 3
listItemGapPt = 2
paragraphGapPt = 2
sectionCardGapPt = 3
pagePaddingTopPt = 模板默认值
pagePaddingBottomPt = 模板默认值
headerPaddingTopPt = 模板默认值
headerPaddingBottomPt = 模板默认值
bodyTextLineHeightPt = 旧 lineHeight 或模板默认值
spacingScale = 1
```

### 14.4 废弃策略

以下字段先保留兼容 1 个版本：

- `lineHeight`
- `sectionSpacing`
- `itemSpacing`

后续版本再正式移除。

---

## 15. 验收标准

### 15.1 功能验收

- 用户前台只能看到一个全局疏密调节参数
- 所有垂直参数均按 `basePt × spacingScale` 计算
- `bodyTextLineHeightPt` 与 `listItemGapPt` 可分别独立生效
- 模板切换后，可正确加载模板基础 `pt` 参数
- 老草稿可兼容渲染

### 15.2 视觉验收

- `spacingScale` 调整后，整体疏密同比变化
- 不同位置比例关系不变
- 不出现某些位置缩放、某些位置不缩放的情况
- 正文多行换行行高与列表项间距视觉上清晰区分

### 15.3 打印验收

- 编辑器预览与打印页排版一致
- 同一份草稿在预览和导出 PDF 中的分页表现一致

### 15.4 技术验收

- 代码中不再新增新的 `lineHeight * 系数` 类型垂直派生规则
- 所有新垂直参数统一从 `verticalSpacing + spacingScale` 计算

---

## 16. 测试清单

### 16.1 单元测试

- `normalizeResumeStyle()` 对新旧字段兼容正确
- `buildVerticalSpacing()` 计算结果正确
- `spacingScale` 不同取值下输出正确

### 16.2 组件测试

- 模块标题到分割线间距生效正确
- 分割线到首条内容间距生效正确
- 条目头部到正文间距生效正确
- 列表项间距生效正确
- 正文多行行高生效正确

### 16.3 集成测试

- 编辑器切换模板后样式正确
- 调整全局疏密后预览实时更新
- 智能一页逻辑基于 `spacingScale` 工作

### 16.4 回归测试

- 教育经历
- 工作经历
- 项目经历
- 技能列表
- 个人总结
- 打印页 / PDF 导出

---

## 17. 研发实施顺序

### 第一阶段：类型与默认值改造

- 修改 `ResumeStyleConfig`
- 新增 `ResumeVerticalSpacingConfig`
- 修改默认样式
- 实现 `normalizeResumeStyle()` 兼容逻辑

### 第二阶段：渲染层接入

- 实现 `buildVerticalSpacing()`
- 注入 CSS 变量
- 替换关键间距点位

### 第三阶段：编辑器改造

- 将前台 `lineHeight` 入口改为 `spacingScale`
- 更新文案与交互逻辑
- 改造智能一页压缩策略

### 第四阶段：模板与后台配置

- 模板默认参数接入
- 后台模板配置页开发
- 接口存储与读取打通

### 第五阶段：迁移与测试

- 老数据兼容迁移
- 单测、组件测试、回归测试
- 打印与导出校验

---

## 18. 研发任务拆解清单

### 前端

- 扩展简历样式类型
- 实现 `verticalSpacing` 与 `spacingScale`
- 改造 `ResumeDocument`
- 改造 `renderRichTextBlock`
- 改造编辑器工具栏
- 改造智能一页
- 模板预设接入新字段

### 后端

- 支持新样式字段存储
- 提供后台模板配置接口
- 提供模板参数读取能力
- 兼容老数据

### 后台管理

- 新增模板排版基础参数配置页
- 支持数值录入、校验、预览、恢复默认

### 测试

- 编写兼容测试
- 编写关键点位样式测试
- 验证打印与 PDF 一致性

---

## 19. 风险与注意事项

### 19.1 风险点

- `bodyTextLineHeightPt` 若默认值定义不合理，会直接影响整体分页
- 老数据迁移若映射过粗，可能导致历史简历视觉变化
- 智能一页逻辑若继续直接修改基础参数，会破坏新规则

### 19.2 注意事项

- 正文行高和列表项间距必须在样式层严格分开
- 不允许为了省事继续复用同一个 CSS 变量
- 打印页和预览页必须复用同一套变量与计算逻辑

---

## 20. 最终结论

本方案的核心是：

1. 统一以 `pt` 为唯一垂直排版基础单位
2. 后台定义模板基础 `pt` 参数
3. 前台只开放一个 `spacingScale`
4. 所有垂直参数统一采用 `basePt × spacingScale`
5. 严格拆分：
   - `bodyTextLineHeightPt`
   - `listItemGapPt`
6. 移除当前基于 `lineHeight` 的隐式派生模式

该方案可确保：

- 规则统一
- 结构稳定
- 模板可控
- 用户调节简单
- 排版逻辑更贴合 Word

后续开发、设计、测试、后台配置均应以本文为统一执行标准。
