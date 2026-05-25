# AI简历优化接口对接实施设计

## 1. 文档目标

这份文档不再讨论“要不要做、为什么做”，只回答一件事：

> 基于当前 offer360 代码结构，如何把火山引擎 Ark 的简历优化能力落成可开发、可联调、可灰度上线的第一版实现。

本实施设计直接展开 5 部分：

1. Prisma 表结构
2. Nest DTO 与接口契约
3. `volcengine-ark` provider 封装
4. 后台 `ai-model-configs` 页面字段
5. “单条经历智能优化” MVP 的前后端改造清单

---

## 2. 实施边界

第一版只做最短闭环，不扩散需求：

- 只接入一个供应商：`volcengine-ark`
- 只接入一个模型：`doubao-seed-2-0-lite-260428`
- 只走文本输入，不做图片/OCR
- 只做同步调用，不做异步任务队列
- 只做“单条经历智能优化” MVP
- 只做服务端代理调用，不允许前端直连模型

### 第一版允许优化的字段

- `education[].description`
- `internships[].description`
- `projects[].description`
- `campusRoles[].description`

### 第一版明确不做

- 全局一键优化
- `skills` / `awards` / `languages` / `selfEvaluation` 的 AI 优化
- 优化前后 diff 可视化
- AI 优化撤销
- 多模型切换
- 配额与会员限制的强约束拦截

原因很直接：

- 单条经历优化最容易验证“回填精度”
- 只改 `description` 风险最低
- 当前前端已经有单条经历卡片编辑结构，最容易嵌入按钮

---

## 3. Prisma 表结构

当前项目 Prisma 风格以 `String/Int/Json/DateTime` 为主，状态值主要用字符串，而不是 Prisma enum。第一版建议保持一致，不引入 enum，避免偏离现有风格。

## 3.1 新增表一：`AiModelConfig`

### 用途

后台维护 Ark 模型配置，包括：

- Base URL
- API Key
- 模型名称
- 提示词模板
- 启停状态

### 建议 Prisma 模型

```prisma
model AiModelConfig {
  id                    String   @id @default(uuid()) @db.Char(36)
  code                  String   @unique(map: "uk_ai_model_config_code") @db.VarChar(50)
  provider              String   @db.VarChar(30)
  configName            String   @map("config_name") @db.VarChar(80)
  baseUrl               String   @map("base_url") @db.VarChar(255)
  apiKeyEncrypted       String   @map("api_key_encrypted") @db.Text
  apiKeyMask            String?  @map("api_key_mask") @db.VarChar(80)
  modelName             String   @map("model_name") @db.VarChar(100)
  endpointType          String   @default("responses") @map("endpoint_type") @db.VarChar(30)
  timeoutMs             Int      @default(15000) @map("timeout_ms")
  maxOutputTokens       Int?     @map("max_output_tokens")
  temperature           Decimal? @db.Decimal(4, 2)
  topP                  Decimal? @map("top_p") @db.Decimal(4, 2)
  systemPrompt          String?  @map("system_prompt") @db.LongText
  globalPromptTemplate  String?  @map("global_prompt_template") @db.LongText
  entryPromptTemplate   String?  @map("entry_prompt_template") @db.LongText
  enabled               Boolean  @default(true)
  isDefault             Boolean  @default(false) @map("is_default")
  remark                String?  @db.VarChar(255)
  createdAt             DateTime @default(now()) @map("created_at") @db.DateTime(0)
  updatedAt             DateTime @updatedAt @map("updated_at") @db.DateTime(0)

  @@index([provider, enabled], map: "idx_ai_model_configs_provider_enabled")
  @@index([isDefault], map: "idx_ai_model_configs_is_default")
  @@map("ai_model_configs")
}
```

### 字段说明

| 字段 | 说明 |
|---|---|
| `code` | 固定配置编码，例如 `resume_optimizer_default` |
| `provider` | 第一版固定 `volcengine-ark` |
| `configName` | 后台显示名称 |
| `baseUrl` | `https://ark.cn-beijing.volces.com/api/v3` |
| `apiKeyEncrypted` | 加密后的 API Key |
| `apiKeyMask` | 用于后台展示掩码 |
| `modelName` | `doubao-seed-2-0-lite-260428` |
| `endpointType` | 第一版固定 `responses` |
| `entryPromptTemplate` | MVP 局部优化 prompt 模板 |
| `enabled` | 启停开关 |
| `isDefault` | 默认配置标记 |

### 设计决策

- 不把 API Key 放环境变量，是因为你已经明确要后台配置
- 仍然建议增加一个环境变量做“加密密钥”，只用于加解密数据库里的 API Key

## 3.2 新增表二：`ResumeAiOptimizationLog`

### 用途

记录每次 AI 优化调用，第一版主要解决：

- 调用审计
- 错误排查
- 成本统计
- 后续配额扩展

### 建议 Prisma 模型

```prisma
model ResumeAiOptimizationLog {
  id                String   @id @default(uuid()) @db.Char(36)
  userId            String   @map("user_id") @db.Char(36)
  resumeId          String   @map("resume_id") @db.Char(36)
  provider          String   @db.VarChar(30)
  modelName         String   @map("model_name") @db.VarChar(100)
  optimizeType      String   @map("optimize_type") @db.VarChar(20)
  sectionId         String   @map("section_id") @db.VarChar(50)
  entryId           String   @map("entry_id") @db.VarChar(50)
  status            String   @default("processing") @db.VarChar(20)
  requestPayload    Json?    @map("request_payload")
  responsePayload   Json?    @map("response_payload")
  beforeContent     Json?    @map("before_content")
  afterContent      Json?    @map("after_content")
  responseText      String?  @map("response_text") @db.LongText
  errorCode         String?  @map("error_code") @db.VarChar(50)
  errorMessage      String?  @map("error_message") @db.VarChar(255)
  inputTokens       Int?     @map("input_tokens")
  outputTokens      Int?     @map("output_tokens")
  latencyMs         Int?     @map("latency_ms")
  createdAt         DateTime @default(now()) @map("created_at") @db.DateTime(0)
  updatedAt         DateTime @updatedAt @map("updated_at") @db.DateTime(0)
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  resumeDraft       ResumeDraft @relation(fields: [resumeId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt], map: "idx_resume_ai_logs_user_created")
  @@index([resumeId, createdAt], map: "idx_resume_ai_logs_resume_created")
  @@index([status, createdAt], map: "idx_resume_ai_logs_status_created")
  @@index([sectionId, entryId], map: "idx_resume_ai_logs_section_entry")
  @@map("resume_ai_optimization_logs")
}
```

### 为什么第一版就要落日志表

因为只要进入“自动回填”，任何一次失败都必须能回答：

1. 当时发给模型的是什么
2. 模型返回了什么
3. 回填前后发生了什么变化
4. 失败是鉴权、超时、格式错误，还是字段校验失败

没有日志表，问题无法定位。

## 3.3 对现有表的关联影响

需要在现有模型上增加反向关联：

### `ResumeDraft`

```prisma
aiOptimizationLogs ResumeAiOptimizationLog[]
```

### `User`

```prisma
resumeAiOptimizationLogs ResumeAiOptimizationLog[]
```

## 3.4 建议新增环境变量

虽然模型 Key 不放环境变量，但“数据库密钥加解密密钥”仍建议用环境变量：

在 `apps/api/src/config/env.ts` 增加：

```ts
aiConfigSecret: process.env.AI_CONFIG_SECRET ?? '',
```

### 用途

- 加密 `AiModelConfig.apiKeyEncrypted`
- 解密模型调用时的真实 Key

---

## 4. Nest DTO 与接口契约

第一版只设计 **MVP 必需接口**。

## 4.1 用户端接口

### 1. 单条经历智能优化

`POST /me/resume-drafts/:id/ai-optimize-entry`

### 接口目的

只优化某个经历条目的 `description` 字段。

### 支持的 `sectionId`

- `education`
- `internships`
- `projects`
- `campusRoles`

### 请求 DTO

建议新增：

`apps/api/src/modules/resume-ai/dto/optimize-resume-entry.dto.ts`

```ts
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class OptimizeResumeEntryDto {
  @IsString()
  @IsIn(['education', 'internships', 'projects', 'campusRoles'])
  sectionId!: 'education' | 'internships' | 'projects' | 'campusRoles';

  @IsString()
  @MaxLength(50)
  entryId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTarget?: string;
}
```

### 请求示例

```json
{
  "sectionId": "projects",
  "entryId": "project-1",
  "tone": "professional",
  "jobTarget": "前端开发"
}
```

### 返回结构

第一版建议直接返回“更新后的整份草稿”，因为前端已经有现成的 `applyDraftToEditor()` 链路。

```ts
export interface ResumeAiOptimizeEntryResponse {
  logId: string;
  optimizeType: 'entry';
  sectionId: 'education' | 'internships' | 'projects' | 'campusRoles';
  entryId: string;
  updatedFieldKeys: string[];
  updatedDraft: ResumeDraftRecord;
}
```

### 返回示例

```json
{
  "logId": "9e1d2f74-1d67-4bc5-a9a2-4f1c8d0d21ef",
  "optimizeType": "entry",
  "sectionId": "projects",
  "entryId": "project-1",
  "updatedFieldKeys": ["description"],
  "updatedDraft": {
    "id": "resume-1",
    "title": "我的简历",
    "templateCode": "style-a",
    "status": "draft",
    "contentJson": {},
    "styleJson": {},
    "layoutJson": {},
    "lastValidatedAt": null,
    "createdAt": "2026-05-13T10:00:00.000Z",
    "updatedAt": "2026-05-13T10:10:00.000Z"
  }
}
```

## 4.2 后台接口

第一版后台至少需要 5 个接口。

### 1. 获取 AI 模型配置列表

`GET /admin/ai-model-configs`

### 2. 新建 AI 模型配置

`POST /admin/ai-model-configs`

### 3. 更新 AI 模型配置

`PATCH /admin/ai-model-configs/:id`

### 4. 启停 AI 模型配置

`PATCH /admin/ai-model-configs/:id/status`

### 5. 测试 AI 模型连接

`POST /admin/ai-model-configs/:id/test`

### 6. 查询 AI 优化日志

`GET /admin/resume-ai-logs`

## 4.3 后台配置 DTO

建议新增：

`apps/api/src/modules/admin/dto/upsert-ai-model-config.dto.ts`

```ts
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertAiModelConfigDto {
  @IsString()
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsIn(['volcengine-ark'])
  provider!: 'volcengine-ark';

  @IsString()
  @MaxLength(80)
  configName!: string;

  @IsString()
  @MaxLength(255)
  baseUrl!: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsString()
  @MaxLength(100)
  modelName!: string;

  @IsString()
  @IsIn(['responses'])
  endpointType!: 'responses';

  @IsInt()
  @Min(3000)
  @Max(60000)
  timeoutMs!: number;

  @IsOptional()
  @IsInt()
  @Min(128)
  @Max(8192)
  maxOutputTokens?: number;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  globalPromptTemplate?: string;

  @IsOptional()
  @IsString()
  entryPromptTemplate?: string;

  @IsBoolean()
  enabled!: boolean;

  @IsBoolean()
  isDefault!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
```

## 4.4 后台测试连接 DTO

建议新增：

`apps/api/src/modules/admin/dto/test-ai-model-config.dto.ts`

```ts
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TestAiModelConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  prompt?: string;
}
```

默认测试文案建议：

`请返回 {"success":true,"message":"ok"}`

## 4.5 后台接口返回类型建议

前端 `apps/web/types/index.ts` 建议新增：

```ts
export interface AdminAiModelConfigItem {
  id: string;
  code: string;
  provider: 'volcengine-ark';
  configName: string;
  baseUrl: string;
  apiKeyMask?: string | null;
  modelName: string;
  endpointType: 'responses';
  timeoutMs: number;
  maxOutputTokens?: number | null;
  systemPrompt?: string | null;
  globalPromptTemplate?: string | null;
  entryPromptTemplate?: string | null;
  enabled: boolean;
  isDefault: boolean;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminResumeAiLogItem {
  id: string;
  userId: string;
  resumeId: string;
  provider: string;
  modelName: string;
  optimizeType: string;
  sectionId: string;
  entryId: string;
  status: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  latencyMs?: number | null;
  createdAt: string;
  updatedAt: string;
}
```

## 4.6 权限设计

当前后台权限命名在 `admin-permissions.ts` 中使用 `admin:*` 风格。建议新增：

```ts
{ key: 'admin:ai:manage', name: '管理 AI 模型配置与简历优化日志', group: 'service' }
```

### 为什么不复用 `admin:service:manage`

短期能复用，但长期会混乱，因为：

- AI 模型配置不是服务商品
- AI 日志也不是订单

第一版就拆干净更好。

---

## 5. `volcengine-ark` provider 封装

这一部分是整个后端最核心的技术实现。

## 5.1 文件建议

新增：

- `apps/api/src/modules/resume-ai/providers/volcengine-ark.provider.ts`
- `apps/api/src/modules/resume-ai/resume-ai.module.ts`
- `apps/api/src/modules/resume-ai/resume-ai.service.ts`
- `apps/api/src/modules/resume-ai/resume-ai.controller.ts`
- `apps/api/src/modules/resume-ai/resume-ai.mapper.ts`
- `apps/api/src/modules/resume-ai/resume-ai.prompt.ts`

后台扩展：

- `apps/api/src/modules/admin/admin.controller.ts`
- `apps/api/src/modules/admin/admin.service.ts`

## 5.2 Provider 职责

`VolcengineArkProvider` 只负责四件事：

1. 接收配置
2. 发起 Ark 请求
3. 解析 Ark 响应
4. 归一化输出

它**不负责**：

- 读取简历草稿
- 构造业务 prompt
- 决定回填哪个字段
- 直接写数据库

这些职责必须留在 `ResumeAiService`。

## 5.3 统一输入输出接口

建议先定义 provider 抽象：

```ts
export interface AiProviderRequest {
  systemPrompt: string;
  userPayloadText: string;
  modelName: string;
  timeoutMs: number;
  maxOutputTokens?: number;
}

export interface AiProviderResult {
  rawText: string;
  rawResponse: unknown;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}
```

## 5.4 Ark Provider 示例实现

```ts
import OpenAI from 'openai';

export class VolcengineArkProvider {
  async generateJson(request: AiProviderRequest, apiKey: string, baseUrl: string): Promise<AiProviderResult> {
    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });

    const response = await client.responses.create({
      model: request.modelName,
      max_output_tokens: request.maxOutputTokens,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: request.systemPrompt,
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: request.userPayloadText,
            },
          ],
        },
      ],
    });

    const rawText = this.extractText(response);
    return {
      rawText,
      rawResponse: response,
      usage: {
        inputTokens: Number((response as any)?.usage?.input_tokens ?? 0),
        outputTokens: Number((response as any)?.usage?.output_tokens ?? 0),
      },
    };
  }

  private extractText(response: unknown): string {
    const candidate = response as any;
    if (typeof candidate?.output_text === 'string' && candidate.output_text.trim()) {
      return candidate.output_text.trim();
    }

    const output = Array.isArray(candidate?.output) ? candidate.output : [];
    for (const item of output) {
      const content = Array.isArray(item?.content) ? item.content : [];
      for (const block of content) {
        if (typeof block?.text === 'string' && block.text.trim()) {
          return block.text.trim();
        }
      }
    }

    throw new Error('Ark 响应中未解析到文本内容');
  }
}
```

### 为什么要单独写 `extractText`

因为 OpenAI 兼容协议在不同 SDK 版本下，文本字段可能不完全一致。第一版把“文本提取”单独封装，后面升级 SDK 时不至于影响业务层。

## 5.5 密钥加解密建议

新增一个简单服务：

`apps/api/src/modules/resume-ai/ai-config-crypto.service.ts`

职责：

- `encryptApiKey()`
- `decryptApiKey()`
- `maskApiKey()`

### 推荐行为

- 保存配置时：`apiKey -> encrypted + mask`
- 查询配置时：只返回 `mask`
- 真正调用模型时：`decryptApiKey(encrypted)`

## 5.6 `ResumeAiService` 的真实职责

### 输入

- 当前用户 `userId`
- 当前草稿 `resumeId`
- `sectionId`
- `entryId`

### 流程

1. 校验草稿归属
2. 读取默认启用的 `AiModelConfig`
3. 校验目标条目存在
4. 提取当前 entry 的原始内容
5. 生成 prompt
6. 先写一条 `processing` 日志
7. 调用 Ark Provider
8. 解析 AI 返回 JSON
9. 校验字段范围只能改 `description`
10. 回填到 `contentJson`
11. 更新 `ResumeDraft`
12. 更新日志为 `success`
13. 返回 `updatedDraft`

### 出错时

1. 不写坏 `ResumeDraft`
2. 日志标记为 `failed`
3. 错误归一化后抛给前端

## 5.7 Prompt Builder 设计

建议新增：

`resume-ai.prompt.ts`

只提供一个第一版方法：

```ts
buildEntryOptimizePrompt(params: {
  sectionId: string;
  entryLabel: string;
  title: string;
  roleName?: string;
  description: string;
  jobTarget?: string;
  tone?: string;
}): { systemPrompt: string; userPayloadText: string }
```

### 第一版 prompt 原则

- 禁止编造
- 禁止修改标题、公司、项目名、时间
- 只能返回 JSON
- 只能返回 `description`
- 富文本只允许 `p/ul/ol/li/strong/br`

## 5.8 Mapper 设计

建议新增：

`resume-ai.mapper.ts`

职责：

- 从 `contentJson` 里定位 entry
- 把 entry 转成 AI 输入结构
- 把 AI 结果映射回 entry

### 关键约束

第一版只允许回填：

```ts
entry.description = parsed.updatedFields.description;
```

其它任何字段直接忽略。

---

## 6. 后台 `ai-model-configs` 页面字段

## 6.1 页面路径

建议新增：

`apps/web/app/admin/ai-model-configs/page.tsx`

## 6.2 页面目标

支持后台完成以下动作：

1. 新建 Ark 配置
2. 编辑 Ark 配置
3. 设置默认配置
4. 启停配置
5. 测试连接

## 6.3 页面字段清单

### 基础信息区

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| 配置编码 `code` | Input | 是 | 如 `resume_optimizer_default` |
| 配置名称 `configName` | Input | 是 | 后台展示名称 |
| 供应商 `provider` | Select | 是 | 第一版固定 `volcengine-ark` |
| Base URL `baseUrl` | Input | 是 | 默认填 `https://ark.cn-beijing.volces.com/api/v3` |
| Endpoint Type `endpointType` | Select | 是 | 第一版固定 `responses` |
| 模型名 `modelName` | Input | 是 | 默认填 `doubao-seed-2-0-lite-260428` |

### 鉴权与调用参数区

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| API Key | Password | 新建必填 | 编辑时可留空表示不改 |
| 超时 `timeoutMs` | Number | 是 | 默认 15000 |
| 最大输出 Token `maxOutputTokens` | Number | 否 | 可留空 |
| 启用 `enabled` | Switch | 是 | 控制前台是否可用 |
| 默认配置 `isDefault` | Switch | 是 | 同时只能有一个默认配置 |

### Prompt 配置区

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| 系统提示词 `systemPrompt` | Textarea | 否 | 建议给默认值 |
| 全局优化模板 `globalPromptTemplate` | Textarea | 否 | 第一版先存，不启用 |
| 条目优化模板 `entryPromptTemplate` | Textarea | 否 | MVP 真实使用 |
| 备注 `remark` | Textarea | 否 | 说明用途 |

## 6.4 页面返回与保存规则

### 查询列表

- API Key 不回明文
- 返回 `apiKeyMask`

### 编辑保存

- 如果用户没改 API Key，则前端不传 `apiKey`
- 如果传了新 `apiKey`，后端覆盖旧值并重算 `apiKeyMask`

## 6.5 页面交互建议

### 列表页展示字段

- 配置名称
- provider
- modelName
- baseUrl
- apiKeyMask
- 是否启用
- 是否默认
- 更新时间

### 操作按钮

- 编辑
- 设为默认
- 启用 / 停用
- 测试连接

## 6.6 测试连接行为

点击“测试连接”后：

1. 前端请求 `POST /admin/ai-model-configs/:id/test`
2. 后端使用当前配置发一个最小 prompt
3. 只验证两件事：
4. 是否连通
5. 是否能返回可解析文本

### 返回示例

```json
{
  "success": true,
  "modelName": "doubao-seed-2-0-lite-260428",
  "latencyMs": 1280,
  "previewText": "{\"success\":true,\"message\":\"ok\"}"
}
```

---

## 7. “单条经历智能优化” MVP 前后端改造清单

这一部分是实际开发执行顺序。

## 7.1 后端改造清单

### A. Prisma

1. 在 `schema.prisma` 新增 `AiModelConfig`
2. 在 `schema.prisma` 新增 `ResumeAiOptimizationLog`
3. 给 `User` 增加反向关联
4. 给 `ResumeDraft` 增加反向关联
5. 生成 migration

### B. 配置

1. 在 `env.ts` 增加 `aiConfigSecret`

### C. 模块

1. 新增 `resume-ai.module.ts`
2. 新增 `resume-ai.controller.ts`
3. 新增 `resume-ai.service.ts`
4. 新增 `resume-ai.mapper.ts`
5. 新增 `resume-ai.prompt.ts`
6. 新增 `providers/volcengine-ark.provider.ts`
7. 新增 `ai-config-crypto.service.ts`

### D. Admin

1. 在 `admin-permissions.ts` 增加 `admin:ai:manage`
2. 在 `admin.controller.ts` 增加 AI 配置与日志接口
3. 在 `admin.service.ts` 增加：
4. `getAiModelConfigs()`
5. `createAiModelConfig()`
6. `updateAiModelConfig()`
7. `updateAiModelConfigStatus()`
8. `testAiModelConfig()`
9. `getResumeAiLogs()`

### E. 用户接口

在 `resume-ai.controller.ts` 新增：

- `POST /me/resume-drafts/:id/ai-optimize-entry`

## 7.2 前端改造清单

### A. 类型

在 `apps/web/types/index.ts` 新增：

- `AdminAiModelConfigItem`
- `AdminResumeAiLogItem`

在 `apps/web/components/resume/resume-types.ts` 或相关类型文件新增：

- `ResumeAiOptimizeEntryResponse`

### B. 后台页面

新增：

- `apps/web/app/admin/ai-model-configs/page.tsx`

第一版页面能力：

1. 配置列表
2. 新建弹窗/表单
3. 编辑弹窗/表单
4. 启停
5. 设默认
6. 测试连接

### C. 简历编辑页

文件：

- `apps/web/components/resume/resume-editor-page-client.tsx`

改造点：

1. 增加状态：
   - `optimizingEntryKey`
2. 在 `ExperienceEditorSection` 的卡片标题操作区新增 `AI优化` 按钮
3. 点击后先执行现有 `persistCurrentDraft({ silent: true })`
4. 再调用：
   - `POST /me/resume-drafts/:id/ai-optimize-entry`
5. 成功后直接复用：
   - `applyDraftToEditor(updatedDraft)`
6. 失败后 toast，不改当前内容

### D. MVP 按钮落点

第一版只在以下卡片中出现：

- 工作经历
- 项目经历
- 教育经历
- 校内职务

不在这些位置出现：

- 技能
- 荣誉奖项
- 语言能力
- 个人总结

## 7.3 前端请求示意

```ts
const response = await clientFetch<ResumeAiOptimizeEntryResponse>(
  `/me/resume-drafts/${draftId}/ai-optimize-entry`,
  {
    method: 'POST',
    body: JSON.stringify({
      sectionId: 'projects',
      entryId: item.id,
      tone: 'professional',
      jobTarget: content.personal.expectedRole || '',
    }),
  },
  token,
);

applyDraftToEditor(response.updatedDraft);
```

## 7.4 用户体验文案建议

### 成功

- `该段经历已完成智能优化`

### 失败

- `AI 优化失败，请稍后重试`
- `当前内容过短，暂不建议优化`
- `AI 返回结果异常，本次未改动原内容`

### 进行中

- 按钮文案：`优化中...`

## 7.5 服务端校验清单

MVP 上线前，后端必须有这些硬校验：

1. 草稿属于当前用户
2. 目标 `sectionId` 在白名单内
3. 目标 `entryId` 存在
4. `description` 非空且长度达标
5. 存在默认启用的 `AiModelConfig`
6. Ark 返回文本可解析为 JSON
7. 解析结果只包含 `description`
8. 结果不是空字符串
9. HTML 标签在白名单范围内

## 7.6 上线顺序建议

### 第一步

- 后台模型配置页
- Ark Provider
- 测试连接接口

### 第二步

- 单条项目经历优化

### 第三步

- 扩展到工作经历 / 教育经历 / 校内职务

### 第四步

- 后台日志页

### 为什么先做“项目经历”

因为当前项目经历文本通常最标准，最容易判断优化结果是否合格，适合作为第一批灰度入口。

---

## 8. 推荐目录结构

建议新增后的 API 目录大致如下：

```text
apps/api/src/modules/resume-ai/
  dto/
    optimize-resume-entry.dto.ts
  providers/
    volcengine-ark.provider.ts
  ai-config-crypto.service.ts
  resume-ai.controller.ts
  resume-ai.mapper.ts
  resume-ai.module.ts
  resume-ai.prompt.ts
  resume-ai.service.ts
```

前端目录：

```text
apps/web/app/admin/ai-model-configs/page.tsx
```

---

## 9. 第一版验收标准

满足以下 8 条即可视为 MVP 完成：

1. 后台可录入并保存 Ark 配置
2. API Key 数据库存储为加密值
3. 后台可测试模型连接
4. 用户可在单条项目经历点击 `AI优化`
5. 请求会先保存当前草稿
6. AI 返回结果只覆盖当前条目的 `description`
7. 失败时原内容不变
8. 后台能查到本次优化日志

---

## 10. 下一步执行建议

如果按最短路径继续推进，开发顺序建议是：

1. 先建 Prisma 表和 migration
2. 再做后台 `ai-model-configs`
3. 再封装 `volcengine-ark.provider.ts`
4. 再接 `POST /me/resume-drafts/:id/ai-optimize-entry`
5. 最后在前端卡片上挂 `AI优化` 按钮

这条路径最短、最稳，也最符合当前项目现有结构。
