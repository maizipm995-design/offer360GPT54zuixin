# AI简历优化大模型对接落地方案

## 1. 方案目标

基于当前项目已存在的简历编辑、数据库存储、自动排版、PDF 导出能力，在**不推翻现有简历数据结构**的前提下，引入 AI 大模型接口，完成两类能力：

1. 全局一键智能优化
2. 单模块 / 单条经历局部智能优化

核心原则只有三条：

1. **不改变现有简历编辑主链路**
2. **AI 只优化内容，不改排版结构**
3. **优化结果自动回填到原字段，用户不需要复制粘贴**

---

## 2. 先看当前系统真实基础

结合现有代码，当前简历能力的真实落点已经非常适合接 AI：

### 2.1 后端现状

- 简历草稿主表是 `ResumeDraft`
- 简历正文统一存储在 `ResumeDraft.contentJson`
- 模板样式在 `styleJson`
- 模块展示顺序/显隐在 `layoutJson`
- 用户编辑保存走 `PATCH /me/resume-drafts/:id`

也就是说，**AI 需要处理的不是整站复杂散表，而是一个结构化 JSON 文档**。这是本次方案必须利用的最短路径。

### 2.2 前端现状

简历编辑页已经完成：

- 草稿初始化与详情加载
- 1 秒自动保存
- 工作经历、项目经历、教育经历、技能、个人总结等模块化编辑
- 富文本输入
- 预览排版
- PDF 导出

这说明本次 AI 对接不需要重做编辑器，只需要：

1. 增加 AI 按钮
2. 增加 AI 调用状态
3. 在成功后把返回结果写回当前 `content` 状态
4. 复用现有自动保存或直接走现有草稿更新接口落库

### 2.3 后台现状

后台已经有成熟的统一管理模式：

- `AdminController` / `AdminService`
- 独立后台页面
- 已有配置型能力，例如简历模板排版配置

因此，大模型的 `URL / API Key / Model / Prompt 模板 / 开关` 完全应该走后台统一配置，不应写死在环境变量里。

---

## 3. 本次方案的本质决策

### 3.1 不建议的做法

不建议：

1. 让前端直接调大模型接口
2. 把整份简历原样拼接成一大段纯文本后让 AI 自由发挥
3. 让 AI 直接返回整份 HTML
4. 让用户手动复制 AI 结果再贴回编辑器

原因很简单：

- 前端直连会暴露密钥
- 非结构化 prompt 会导致回填困难
- 返回 HTML 会破坏当前字段结构
- 手动复制粘贴违背本次需求

### 3.2 建议的核心方案

统一采用：

1. **后端代理调用大模型**
2. **前后端都围绕 `contentJson` 的结构化字段做优化**
3. **AI 返回严格 JSON 结果**
4. **后端完成字段级校验与回填映射**
5. **前端拿到更新后的标准草稿结构，直接覆盖当前编辑态**

一句话概括：

> 当前系统已经有“结构化简历 JSON + 自动保存”的底座，本次只需要把 AI 变成一个“结构化内容加工器”。

---

## 4. 推荐整体架构

## 4.1 模块划分

建议在 `apps/api/src/modules` 下新增一个独立 AI 模块，例如：

`resume-ai`

职责拆分如下：

### A. `ResumeAiController`

负责对外接口：

- 全局优化
- 局部优化
- 查询任务状态（如果后续做异步）
- 预览差异

### B. `ResumeAiService`

负责业务编排：

- 读取简历草稿
- 提取可优化字段
- 生成 prompt
- 调用模型客户端
- 解析响应
- 校验结构
- 写回 `ResumeDraft.contentJson`
- 记录日志

### C. `AiProviderService`

负责模型调用适配：

- 读取后台配置
- 组装 HTTP 请求
- 超时控制
- 重试
- 错误归一化

后续如果你除了字节模型还要接阿里 / OpenAI / DeepSeek，这层可以直接复用。

### D. `ResumeAiPromptBuilder`

负责 prompt 模板拼装：

- 全局优化 prompt
- 局部优化 prompt
- 不同模块的字段说明
- JSON Schema/输出格式约束

### E. `ResumeAiMapper`

负责结构化映射：

- `contentJson -> AI 输入 payload`
- `AI 输出 payload -> contentJson 局部更新`

这个层很关键，它决定“精准回填”是否稳定。

---

## 5. 数据库设计

本次建议新增 **2 张主表 + 1 张可选快照表**。

## 5.1 AI 模型配置表

用途：后台管理页面配置模型参数。

建议新增表：

`ai_model_configs`

建议字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | int / uuid | 主键 |
| code | varchar(50) | 配置编码，例如 `resume_optimizer_default` |
| provider | varchar(30) | 供应商，例如 `doubao` |
| baseUrl | varchar(500) | 接口地址 |
| apiPath | varchar(255) | 可选，接口路径 |
| apiKeyEncrypted | text | 加密后的密钥 |
| modelName | varchar(100) | 模型名 |
| temperature | decimal(4,2) | 温度 |
| topP | decimal(4,2) | 可选 |
| maxTokens | int | 最大输出 token |
| timeoutMs | int | 超时 |
| enabled | boolean | 是否启用 |
| isDefault | boolean | 是否默认配置 |
| systemPrompt | longtext | 全局系统提示词模板 |
| globalPromptTemplate | longtext | 全局优化提示词模板 |
| modulePromptTemplate | longtext | 局部优化提示词模板 |
| remark | varchar(255) | 备注 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

### 为什么必须单独建表

因为这不是普通页面文案配置，而是：

- 包含密钥
- 包含模型参数
- 会有启停
- 未来可能多模型切换

用现有富文本内容表或杂项配置表硬塞，后续一定失控。

## 5.2 AI 优化日志表

用途：审计、排障、统计、限流、计费。

建议新增表：

`resume_ai_optimization_logs`

建议字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| userId | char(36) | 用户 ID |
| resumeId | char(36) | 简历草稿 ID |
| optimizeType | varchar(20) | `global` / `section` / `entry` |
| sectionId | varchar(50) | 模块 ID，如 `internships` |
| entryId | varchar(50) | 条目 ID，如某条项目经历 ID |
| requestPayload | json | 发给模型的结构化内容快照 |
| responsePayload | json | 模型原始结构化返回 |
| beforeContent | json | 优化前片段 |
| afterContent | json | 优化后片段 |
| status | varchar(20) | `processing` / `success` / `failed` |
| errorCode | varchar(50) | 错误码 |
| errorMessage | varchar(255) | 错误信息 |
| tokenUsageInput | int | 输入 tokens |
| tokenUsageOutput | int | 输出 tokens |
| latencyMs | int | 调用耗时 |
| provider | varchar(30) | 供应商 |
| modelName | varchar(100) | 实际使用模型 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

### 为什么必须留日志

因为上线后最难排查的是：

1. 用户说“优化后内容错了”
2. 用户说“点了没反应”
3. 用户说“为什么其它模块被改了”
4. 模型返回了脏格式 JSON

没有日志，这类问题无法定位。

## 5.3 可选：简历 AI 回滚快照表

如果你希望“自动回填后还能一键撤销”，建议新增：

`resume_ai_snapshots`

字段可以很简单：

- id
- resumeId
- logId
- snapshotType：`before_optimize`
- contentJson
- createdAt

### 建议

这个表不是必须第一期就上，但如果你预期用户会频繁尝试 AI 优化，我建议第一期就做。因为“自动回填”本质上是覆盖式写入，没有快照就很难做高质量撤销。

---

## 6. 后台管理页面方案

## 6.1 页面目标

新增后台页面：

`/admin/ai-model-configs`

建议权限：

- 最好新增 `admin:ai:manage`

如果你想第一期少改权限体系，也可以临时复用 `admin:service:manage`，但从长期看不够清晰。

## 6.2 页面内容

后台页面至少包含以下区域：

### A. 基础连接配置

- 供应商
- Base URL
- API Path
- API Key
- 模型名称
- 启用状态
- 默认配置开关

### B. 调用参数配置

- temperature
- topP
- maxTokens
- timeoutMs
- 重试次数

### C. Prompt 模板配置

- 系统提示词
- 全局优化提示词模板
- 单模块优化提示词模板

### D. 测试连接区

新增“测试模型连接”按钮：

- 输入一段测试文本
- 后台调用一次模型
- 返回结构化测试结果

这样可以先验证 URL/密钥/模型名是否可用，再开放给用户端。

### E. 日志查看区

至少支持：

- 按用户
- 按简历
- 按优化类型
- 按成功/失败
- 按时间范围

查询最近 AI 调用记录。

---

## 7. 与现有简历数据结构的映射规则

当前 `contentJson` 的核心结构已经清晰：

```json
{
  "personal": {
    "name": "",
    "phone": "",
    "email": "",
    "expectedRole": "",
    "expectedCity": "",
    "availability": "",
    "website": "",
    "avatarUrl": "",
    "summary": ""
  },
  "education": [],
  "internships": [],
  "projects": [],
  "skills": [],
  "awards": [],
  "languages": [],
  "campusRoles": [],
  "selfEvaluation": "",
  "links": []
}
```

这里最重要的决策是：

## 7.1 只让 AI 改“文本字段”

允许 AI 优化的字段：

- `personal.summary`
- `education[].description`
- `internships[].description`
- `projects[].description`
- `skills[].content`
- `awards[].description`
- `languages[].description`
- `campusRoles[].description`
- `selfEvaluation`

谨慎处理的字段：

- `roleName`
- `projectName`
- `companyName`
- `organization`
- `title`

默认不建议 AI 改的字段：

- `name`
- `phone`
- `email`
- `website`
- `avatarUrl`
- `logoUrl`
- `startDate`
- `endDate`
- `city`

### 原因

本次需求的本质是“润色优化”，不是“事实改写”。

日期、公司名、项目名、城市、链接这类字段一旦被模型误改，损失远大于收益。

## 7.2 推荐的字段策略

### 安全策略 A：只改描述正文

第一期建议只优化描述型字段，风险最低。

### 安全策略 B：标题类字段只在用户显式允许时才改

例如后续加一个开关：

- 是否允许 AI 优化标题表达

默认关闭。

---

## 8. 两类优化场景的业务方案

## 8.1 场景一：全局一键智能优化

### 用户目标

用户希望一次性把整份简历的表达质量提升，但不想自己逐段复制。

### 推荐交互

页面新增主按钮：

`一键全局优化`

点击后流程：

1. 前端先触发一次保存，确保当前编辑内容已落库
2. 后端读取最新 `ResumeDraft.contentJson`
3. 后端提取可优化字段，组装结构化 AI 请求
4. 大模型返回结构化优化结果
5. 后端按字段映射回原简历 JSON
6. 更新 `ResumeDraft.contentJson`
7. 前端拿到新草稿，直接替换本地状态
8. 页面保留原排版模板与布局，不改 `styleJson`、不改 `layoutJson`

### 全局优化接口建议

`POST /me/resume-drafts/:id/ai-optimize`

请求体建议：

```json
{
  "mode": "global",
  "jobTarget": {
    "role": "产品经理",
    "industry": "互联网",
    "keywords": ["用户增长", "数据分析", "项目推进"]
  },
  "options": {
    "tone": "professional",
    "keepFacts": true,
    "keepRichText": true
  }
}
```

返回建议：

```json
{
  "resumeId": "xxx",
  "mode": "global",
  "updatedDraft": {
    "id": "xxx",
    "title": "我的简历",
    "contentJson": {},
    "styleJson": {},
    "layoutJson": {},
    "updatedAt": "2026-05-13T00:00:00.000Z"
  },
  "summary": {
    "updatedFieldCount": 8,
    "updatedSections": ["internships", "projects", "selfEvaluation"]
  },
  "logId": "xxx"
}
```

## 8.2 场景二：局部单模块精准优化

### 用户目标

用户只想优化某一段，不想动其他内容。

### 推荐交互

在以下位置新增按钮：

1. 模块级按钮：如“工作经历模块智能优化”
2. 条目级按钮：如“这段项目经历智能优化”
3. 单字段级按钮：如“个人总结智能优化”

### 交互优先级建议

第一期建议先做两层：

1. 条目级
2. 单字段级

模块级虽然也能做，但实际很容易引发“模块里多条经历一起被 AI 改了，我看不清差异”的问题。最稳妥的是先把粒度做到“单条经历 / 单段总结”。

### 局部优化接口建议

#### A. 单条经历优化

`POST /me/resume-drafts/:id/ai-optimize-entry`

请求体：

```json
{
  "mode": "entry",
  "sectionId": "projects",
  "entryId": "project-abc123",
  "options": {
    "tone": "professional",
    "keepFacts": true,
    "keepRichText": true
  }
}
```

#### B. 单字段模块优化

`POST /me/resume-drafts/:id/ai-optimize-section`

请求体：

```json
{
  "mode": "section",
  "sectionId": "selfEvaluation",
  "options": {
    "tone": "professional",
    "keepFacts": true,
    "keepRichText": true
  }
}
```

### 局部回填原则

必须满足：

1. 只更新命中的 `sectionId`
2. 如果是条目级，再只更新命中的 `entryId`
3. 其它模块、其它条目完全不动
4. 后端写入前后都要做字段范围校验

这部分不能只靠 prompt 保证，必须靠后端映射层硬限制。

---

## 9. AI 请求数据结构设计

这是整套方案稳定性的关键。

## 9.1 全局优化请求 payload

建议后端发给模型的内容不要直接是整份 `contentJson`，而是转成一个**更明确、更可控**的结构：

```json
{
  "task": "resume_global_optimize",
  "language": "zh-CN",
  "rules": {
    "keepFacts": true,
    "doNotModifyFields": [
      "name",
      "phone",
      "email",
      "website",
      "avatarUrl",
      "logoUrl",
      "startDate",
      "endDate",
      "city"
    ],
    "outputFormat": "json"
  },
  "jobTarget": {
    "role": "产品经理",
    "industry": "互联网",
    "keywords": ["用户增长", "数据分析", "跨团队协作"]
  },
  "resume": {
    "personalSummary": "<p>...</p>",
    "education": [
      {
        "entryId": "edu-1",
        "schoolName": "xx大学",
        "degree": "本科",
        "major": "计算机",
        "description": "<ul><li>...</li></ul>"
      }
    ],
    "internships": [
      {
        "entryId": "exp-1",
        "companyName": "xx公司",
        "roleName": "产品实习生",
        "description": "<ul><li>...</li></ul>"
      }
    ],
    "projects": [],
    "skills": [],
    "selfEvaluation": "<p>...</p>"
  }
}
```

## 9.2 局部优化请求 payload

例如单条项目经历：

```json
{
  "task": "resume_entry_optimize",
  "sectionId": "projects",
  "entryId": "project-1",
  "rules": {
    "keepFacts": true,
    "onlyOptimizeCurrentEntry": true,
    "outputFormat": "json"
  },
  "jobTarget": {
    "role": "前端开发"
  },
  "entry": {
    "projectName": "offer360 后台系统",
    "roleName": "前端负责人",
    "description": "<ul><li>...</li></ul>"
  }
}
```

---

## 10. AI 响应格式设计

## 10.1 绝对不要接受自由文本响应

必须要求模型返回严格 JSON。

### 全局优化返回建议

```json
{
  "success": true,
  "updates": {
    "personal.summary": "<p>...</p>",
    "education": [
      { "entryId": "edu-1", "description": "<ul><li>...</li></ul>" }
    ],
    "internships": [
      { "entryId": "exp-1", "description": "<ul><li>...</li></ul>" }
    ],
    "projects": [
      { "entryId": "project-1", "description": "<ul><li>...</li></ul>" }
    ],
    "skills": [
      { "entryId": "skill-1", "content": "<ul><li>...</li></ul>" }
    ],
    "selfEvaluation": "<p>...</p>"
  }
}
```

### 局部优化返回建议

```json
{
  "success": true,
  "sectionId": "projects",
  "entryId": "project-1",
  "updatedFields": {
    "description": "<ul><li>...</li></ul>"
  }
}
```

## 10.2 后端必须二次校验

后端收到模型结果后，不可直接落库，必须校验：

1. JSON 是否可解析
2. `sectionId` 是否合法
3. `entryId` 是否真实存在于当前草稿
4. 返回字段是否在允许修改白名单内
5. 富文本是否为字符串
6. 返回空值是否允许覆盖

校验失败时：

- 不更新草稿
- 记录失败日志
- 给前端返回明确错误提示

---

## 11. 富文本与回填机制

当前简历编辑器已经在多个模块使用富文本，因此 AI 方案不能只输出纯文本。

## 11.1 推荐输出格式

第一期推荐：

- 仍以 HTML 字符串作为富文本承载格式

因为当前编辑器保存的就是富文本字符串，直接兼容现有 `description` / `selfEvaluation` / `content` 字段。

## 11.2 输出约束

要求模型只使用有限标签：

- `p`
- `ul`
- `ol`
- `li`
- `strong`
- `br`

不允许：

- `script`
- `style`
- `img`
- `table`
- 任意事件属性

## 11.3 服务端清洗

模型返回后，后端需要做一次 HTML 清洗，至少移除：

- `script`
- `style`
- `iframe`
- `onClick` 等事件属性

如果你后续要更稳，建议接一个标准 HTML sanitize 库。

---

## 12. 回填策略设计

## 12.1 全局回填

后端流程：

1. 读取当前 `contentJson`
2. 深拷贝出 `nextContentJson`
3. 遍历 AI 返回的 `updates`
4. 按字段映射更新 `nextContentJson`
5. 保留未命中的原字段
6. 更新 `ResumeDraft.contentJson`

### 示例

如果 AI 只返回：

- `internships[exp-1].description`
- `projects[project-2].description`
- `selfEvaluation`

则只更新这 3 个位置，其它内容原样保留。

## 12.2 局部回填

例如用户点击某条项目经历的智能优化按钮：

1. 前端传 `sectionId=projects` + `entryId=xxx`
2. 后端只读取该条数据生成 prompt
3. AI 只返回该条数据的允许字段
4. 后端只写回该条数据

### 硬约束

局部优化时，即使模型误返回其它模块字段，也直接丢弃。

这是“局部精准优化”的根本保障。

---

## 13. 前端页面改造方案

## 13.1 按钮落点

基于当前简历编辑页结构，建议新增：

### A. 顶部全局按钮

位置：编辑页顶部操作区

按钮：

- `一键全局优化`

### B. 单条经历按钮

放在当前每个 `DrawerCard` 标题区域右侧，和现有“展开/删除”并列。

适用模块：

- `education`
- `internships`
- `projects`
- `skills`
- `awards`
- `languages`
- `campusRoles`

### C. 单字段按钮

适用：

- `selfEvaluation`
- `personal.summary`

## 13.2 前端状态设计

建议新增状态：

- `optimizingGlobal`
- `optimizingSectionKey`
- `optimizingEntryKey`
- `aiDiffPreview`（可选）
- `lastAiOptimizeLogId`

## 13.3 前端调用流程

### 全局优化

1. 调用现有 `persistCurrentDraft({ silent: true })`
2. 成功后请求 AI 接口
3. 按钮 loading
4. 返回 `updatedDraft`
5. 复用现有 `applyDraftToEditor(updatedDraft)`
6. toast 提示“AI 优化完成”

### 局部优化

1. 调用现有静默保存
2. 发起局部 AI 请求
3. 当前卡片按钮 loading
4. 返回 `updatedDraft`
5. 仍然直接 `applyDraftToEditor(updatedDraft)`

### 为什么局部优化也返回整份草稿

因为前端当前已经有成熟的“加载详情 -> 应用到编辑器”的能力。复用整份草稿返回最简单，状态同步成本最低。

---

## 14. 是否同步执行还是异步任务

## 14.1 第一阶段建议：同步接口

如果单次优化耗时可控制在 5~15 秒内，建议第一阶段直接同步返回。

优点：

- 实现最快
- 前端简单
- 不需要任务轮询

## 14.2 第二阶段再升级异步任务

如果后续你发现：

- 模型响应慢
- 全局优化经常超时
- 需要支持排队与重试

再升级为：

1. 提交任务接口
2. 查询任务状态接口
3. 完成后自动刷新草稿

### 结论

第一期先同步，是当前系统最短落地路径。

---

## 15. Prompt 设计原则

## 15.1 系统提示词原则

系统提示词只做四件事：

1. 明确角色是“专业中文简历优化顾问”
2. 明确不能编造事实
3. 明确只输出 JSON
4. 明确保留原字段结构与 ID

示意：

```text
你是资深中文简历优化顾问。你的任务是对用户简历内容进行专业润色。
禁止编造未提供的事实、业绩、数据、奖项、技能、公司、学校、时间。
除允许优化的字段外，禁止修改任何其他字段。
输出必须是合法 JSON，不要输出 Markdown，不要输出解释文字。
```

## 15.2 局部 prompt 原则

局部 prompt 必须反复强调：

- 只优化当前模块
- 只优化当前 entryId
- 不得输出其他字段

---

## 16. 错误处理与兜底

## 16.1 常见错误类型

需要统一处理：

1. 后台未配置模型
2. 配置已禁用
3. API Key 无效
4. 模型超时
5. 模型返回非 JSON
6. JSON 结构不合法
7. 局部优化目标不存在
8. 草稿不存在或无权限

## 16.2 前端提示文案建议

- `AI 优化服务暂未配置，请联系管理员`
- `AI 优化超时，请稍后重试`
- `AI 返回结果异常，本次未改动原简历内容`
- `当前内容过短，暂不建议优化`

## 16.3 关键兜底原则

只要 AI 响应校验没通过：

- 不落库
- 不覆盖前端当前内容
- 只提示失败

不能出现“返回异常但部分内容已写坏”。

---

## 17. 限流、费用与会员策略

这部分虽然不是接口接通本身，但如果不提前设计，上线后很快失控。

## 17.1 建议的第一期策略

按用户维度做简单限制：

- 全局优化：每天 3 次
- 局部优化：每天 20 次

计数可以先直接基于 `resume_ai_optimization_logs` 聚合统计。

## 17.2 会员策略建议

可作为后续商业化入口：

- 免费用户：仅支持局部优化，且次数有限
- 标准会员：支持全局优化，中等次数
- 超级会员：更高次数 / 优先队列 / 更强模型

这一层可以直接复用当前项目已有会员体系。

---

## 18. 安全与合规

## 18.1 API Key 存储

`apiKey` 不能明文存数据库。

建议：

- 后端入库前加密
- 读取时解密
- 后台页面展示时只回显掩码，例如 `sk-****abcd`

## 18.2 用户数据最小发送原则

只把当前优化真正需要的字段发给模型。

例如单条项目经历优化时，不要把整份简历、手机号、邮箱都发出去。

## 18.3 审计原则

每一次 AI 调用都要记录：

- 谁触发
- 优化了哪份简历
- 哪个模块
- 模型返回什么
- 最终改了什么

---

## 19. 接口清单建议

## 19.1 用户端接口

### 1. 全局优化

`POST /me/resume-drafts/:id/ai-optimize`

### 2. 单模块优化

`POST /me/resume-drafts/:id/ai-optimize-section`

### 3. 单条经历优化

`POST /me/resume-drafts/:id/ai-optimize-entry`

### 4. 查询 AI 使用额度（建议）

`GET /me/resume-drafts/ai-usage`

返回：

- 今日全局已用次数
- 今日局部已用次数
- 剩余次数

## 19.2 后台接口

### 1. 获取模型配置列表

`GET /admin/ai-model-configs`

### 2. 新建模型配置

`POST /admin/ai-model-configs`

### 3. 更新模型配置

`PATCH /admin/ai-model-configs/:id`

### 4. 启停模型配置

`PATCH /admin/ai-model-configs/:id/status`

### 5. 测试模型连接

`POST /admin/ai-model-configs/:id/test`

### 6. 查询优化日志

`GET /admin/resume-ai-logs`

---

## 20. 已确认的火山引擎 Ark 对接参数

你已经提供了字节火山引擎平台的真实接入方式，本项目后续实现应按以下参数落地。

## 20.1 接口基础信息

- 供应商：`volcengine-ark`
- SDK 协议风格：`OpenAI compatible`
- Base URL：`https://ark.cn-beijing.volces.com/api/v3`
- 推荐模型：`doubao-seed-2-0-lite-260428`

### 关键结论

这意味着当前后端不用为“火山引擎专有协议”单独造复杂客户端，直接按 **OpenAI 兼容协议** 封装一个 Provider 即可。

## 20.2 鉴权方式

你提供的密钥是 Ark API Key，鉴权方式应设计为：

- 后台录入真实 API Key
- 数据库存储加密值
- 服务端调用时放到请求头
- 前端永远不接触真实密钥

推荐请求头：

```http
Authorization: Bearer <ARK_API_KEY>
Content-Type: application/json
```

### 安全要求

真实密钥不要写入代码仓库、不要写入种子数据、不要明文写进项目文档。

后台页面建议：

- 新增 `API Key` 输入框
- 编辑态仅允许覆盖，不回显明文
- 列表页只显示掩码值，例如 `ark-****-4c135`

## 20.3 后台配置字段如何落库

基于 Ark 的真实参数，后台配置表 `ai_model_configs` 建议这样映射：

| 后台字段 | 实际值/示例 | 说明 |
|---|---|---|
| provider | `volcengine-ark` | 固定供应商标识 |
| baseUrl | `https://ark.cn-beijing.volces.com/api/v3` | 基础地址 |
| apiKeyEncrypted | 后台录入后加密存储 | 不明文保存 |
| modelName | `doubao-seed-2-0-lite-260428` | 模型名 |
| endpointType | `responses` | 当前优先走 Responses API |
| timeoutMs | `15000` | 第一版建议 15 秒 |
| enabled | `true` | 是否启用 |
| systemPrompt | 后台可配 | 系统提示词 |
| globalPromptTemplate | 后台可配 | 全局优化 prompt |
| modulePromptTemplate | 后台可配 | 局部优化 prompt |

### 为什么推荐 `endpointType = responses`

因为你给的官方示例走的是：

`client.responses.create(...)`

所以第一版实现优先对齐官方路径，减少协议猜测和兼容成本。

## 20.4 官方示例对应到本项目的真实调用方式

你给的 Python 示例本质上是：

```python
client = OpenAI(
    base_url="https://ark.cn-beijing.volces.com/api/v3",
    api_key=api_key,
)

response = client.responses.create(
    model="doubao-seed-2-0-lite-260428",
    input=[...]
)
```

对当前 NestJS 项目，建议等价改写为服务端 `fetch` 或 OpenAI Node SDK 调用。

### 推荐的 TypeScript 服务端调用示例

```ts
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
  apiKey: decryptedApiKey,
});

const response = await client.responses.create({
  model: 'doubao-seed-2-0-lite-260428',
  input: [
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: '请按约定 JSON 格式优化这段简历内容',
        },
      ],
    },
  ],
});
```

### 本项目里的真实建议

简历优化不是图片理解场景，所以当前业务里不需要 `input_image`，只需要：

- `input_text`

这样可以让请求结构更简单、更稳定。

## 20.5 推荐的 Ark 请求体结构

本项目后端应把 prompt 和结构化简历内容拼成以下风格：

```json
{
  "model": "doubao-seed-2-0-lite-260428",
  "input": [
    {
      "role": "system",
      "content": [
        {
          "type": "input_text",
          "text": "你是资深中文简历优化顾问。禁止编造事实，必须返回合法 JSON。"
        }
      ]
    },
    {
      "role": "user",
      "content": [
        {
          "type": "input_text",
          "text": "{...这里放结构化简历优化任务 JSON...}"
        }
      ]
    }
  ]
}
```

### 关键实现点

不要把 prompt 拆成散乱字符串拼接后直接裸发给模型。应统一通过：

1. `systemPrompt`
2. `taskPayloadJson`

这两层构造请求，便于后台运营修改 prompt，也便于日志排查。

## 20.6 Ark 响应解析建议

火山引擎 Ark 使用 OpenAI 兼容格式时，第一版不要依赖过深的 SDK 内部对象结构，建议在服务端统一做一层“文本提取器”：

### 目标

无论 SDK 最终返回的字段是：

- `output_text`
- `output[0].content[...]`
- 其他兼容结构

最终都归一成：

- `rawText`
- `rawResponse`
- `usage`

### 推荐归一化结构

```ts
type NormalizedAiResult = {
  rawText: string;
  rawResponse: unknown;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
};
```

## 20.7 面向本项目的响应样例

建议要求模型最终返回的是“JSON 字符串”，例如局部优化：

```json
{
  "success": true,
  "sectionId": "projects",
  "entryId": "project-1",
  "updatedFields": {
    "description": "<ul><li>负责后台系统重构，优化模块拆分与交付效率。</li><li>推动核心流程标准化，降低重复沟通成本。</li></ul>"
  }
}
```

全局优化：

```json
{
  "success": true,
  "updates": {
    "internships": [
      {
        "entryId": "exp-1",
        "description": "<ul><li>独立负责 xx 业务线需求推进，协调产品、研发与测试高效交付。</li></ul>"
      }
    ],
    "projects": [
      {
        "entryId": "project-1",
        "description": "<ul><li>主导 xx 项目落地，围绕用户体验和转化目标完成关键流程优化。</li></ul>"
      }
    ],
    "selfEvaluation": "<p>具备结构化分析、跨团队协同与复杂项目推进能力，能够快速理解业务并沉淀可复制方法。</p>"
  }
}
```

## 20.8 本项目不建议直接照搬图片示例的原因

你给的官方样例里包含：

- `input_image`
- “你看见了什么？”

那是多模态能力演示，不是本项目主链路。

当前简历优化页面的目标是：

- 对数据库中的结构化简历内容做文字优化

因此第一版请严格收敛在：

1. 文本输入
2. JSON 输出
3. 内容润色
4. 自动回填

不要第一版就扩散到：

- 图片识别简历
- 上传截图识别简历
- OCR 导入

这些是后续增量需求，不属于当前最短路径。

---

## 21. 建议的后端落地顺序

## 第一阶段：最小可用版本

目标：最快接通并能真实使用。

包含：

1. 新增 `ai_model_configs`
2. 新增 `resume_ai_optimization_logs`
3. 后台模型配置页
4. 后端模型调用服务
5. 单条经历优化
6. `selfEvaluation` 优化
7. 前端按钮与 loading

### 为什么先做局部

因为局部优化：

- prompt 最短
- 风险最小
- 回填最简单
- 最容易验证模型质量

## 第二阶段：全局优化

包含：

1. 全局优化接口
2. 多模块结构化返回
3. 全局回填
4. 差异摘要

## 第三阶段：增强体验

包含：

1. 优化前后 diff 对比
2. 撤销本次 AI 优化
3. 额度展示
4. 异步任务化
5. 多模型切换

---

## 22. 对当前代码的具体改造建议

以下不是泛泛而谈，而是贴现有结构的建议落点。

## 22.1 后端文件建议

新增：

- `apps/api/src/modules/resume-ai/resume-ai.module.ts`
- `apps/api/src/modules/resume-ai/resume-ai.controller.ts`
- `apps/api/src/modules/resume-ai/resume-ai.service.ts`
- `apps/api/src/modules/resume-ai/ai-provider.service.ts`
- `apps/api/src/modules/resume-ai/resume-ai.mapper.ts`
- `apps/api/src/modules/resume-ai/resume-ai.prompt.ts`
- `apps/api/src/modules/resume-ai/dto/*.dto.ts`

扩展：

- `apps/api/src/app.module.ts`
- `apps/api/src/modules/resume/resume.controller.ts`
- `apps/api/src/modules/admin/admin.controller.ts`
- `apps/api/src/modules/admin/admin.service.ts`
- `apps/api/prisma/schema.prisma`

## 22.2 前端文件建议

扩展：

- `apps/web/components/resume/resume-editor-page-client.tsx`
- `apps/web/components/resume/resume-types.ts`
- `apps/web/types/index.ts`

新增后台页：

- `apps/web/app/admin/ai-model-configs/page.tsx`

如果要做日志查询，再加：

- `apps/web/app/admin/resume-ai-logs/page.tsx`

---

## 23. 关键实现细节建议

## 23.1 幂等控制

同一份简历连续点击 AI 按钮时，建议前端先禁用按钮，后端也可以增加短时间重复提交保护。

## 23.2 并发控制

同一份草稿同时只允许一个 AI 优化任务进行中。

否则容易出现：

1. 全局优化还没结束
2. 用户又点了某条项目经历优化
3. 后写入覆盖先写入

## 23.3 空内容拦截

如果目标字段是空的，不要请求模型，直接返回：

- `当前内容为空，请先填写后再优化`

## 23.4 最短内容阈值

内容过短时不建议调用模型，例如少于 15 个有效字。

---

## 24. 推荐的最终产品行为

从用户体验看，我建议最终行为是：

### 全局优化

- 点击后出现全局 loading
- 显示“正在分析并优化整份简历内容”
- 成功后自动回填
- toast 提示“已完成 8 处内容优化”

### 局部优化

- 按钮变 loading
- 当前卡片显示“AI 优化中”
- 完成后只更新当前卡片内容
- 自动保存

### 失败时

- 明确提示失败原因
- 保证原内容不变

---

## 25. 最终结论

这次需求的最短落地路径，不是做一个“聊天式 AI 简历助手”，而是做一个：

> 基于现有 `ResumeDraft.contentJson` 的结构化 AI 优化引擎。

具体落地结论如下：

1. **后端代理调用大模型，前端绝不直连**
2. **后台新增独立 AI 模型配置页，配置 URL / API Key / 模型名 / Prompt**
3. **AI 输入输出都必须结构化 JSON，不能接受自由文本**
4. **第一期优先做局部优化，再扩展到全局优化**
5. **回填必须由后端做字段白名单映射，不能只靠 prompt 约束**
6. **优化日志必须落库，否则后续无法排障和计费**
7. **排版结构保持不变，只更新 `contentJson` 中允许优化的文本字段**

---

## 26. 下一步建议

字节平台的核心接入信息已经明确，下一步不再是补信息，而是直接进入实施设计：

1. 我先基于这份方案，补成**“数据库表设计 + 接口 DTO + API 契约 + 前后端改造清单”**
2. 然后再进入真实代码实现

拿到后我可以继续给你出下一版：

`AI简历优化接口对接实施设计.md`

如果继续推进实现，我下一步会直接输出：

1. Ark Provider 的后端接口封装设计
2. `ai_model_configs` 与 `resume_ai_optimization_logs` 的 Prisma 表结构
3. 用户端 AI 优化接口 DTO
4. 后台模型配置页字段定义
5. 局部优化 MVP 的前后端落地顺序
