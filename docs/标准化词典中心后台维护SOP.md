# 标准化词典中心后台维护SOP

## 文档定位

- **适用页面**：`/admin/normalization-dictionary`
- **适用接口**：
  - `GET /admin/normalization-summary`
  - `GET /admin/normalization-terms`
  - `POST /admin/normalization-terms`
  - `PATCH /admin/normalization-terms/:id`
  - `GET /admin/normalization-terms/:id/aliases`
  - `POST /admin/normalization-terms/:id/aliases`
  - `PATCH /admin/normalization-aliases/:id`
  - `GET /admin/location-hierarchies`
  - `POST /admin/location-hierarchies`
  - `GET /admin/normalization/template`
  - `GET /admin/normalization/export`
  - `POST /admin/normalization/import`
- **权限要求**：`admin:job:manage`
- **当前重点治理域**：`JOB_TITLE`、`MAJOR`

## 一、核心治理原则

### 1. canonical 只能保留短词 / 大类词

- `JOB_TITLE`：以 `开发 / 研发 / 后端 / 前端 / 产品 / 运营 / 财务` 这类平台稳定主词为准
- `MAJOR`：以 `计算机 / 财务 / 机械 / 电子信息 / 法学` 这类大类专业词为准
- **禁止**把 `产品经理 / 软件开发工程师 / 计算机科学与技术 / 财务管理` 这类长全称重新建成主词

### 2. 长词、旧写法优先挂 alias

- 旧 canonical、岗位细写法、专业全称，默认都应作为 alias 挂到已有 canonical 下
- 只有在**确实无法被现有 canonical 准确承接**时，才允许新增 canonical

### 3. `exact` 与 `contains` 的使用规则

| 场景 | 规则 |
| --- | --- |
| 高歧义短词 | 用 `exact`，只做归一，不放开搜索/推荐扩召回 |
| 稳定长词 / 全称 | 用 `contains`，允许进入搜索与推荐文本召回 |
| 不确定是否歧义 | 先用 `exact`，验收稳定后再考虑调成 `contains` |

### 4. 当前已明确的强约束

- `开发` 与 `研发` **必须保持独立**
- `产品` 与 `运营` **必须保持独立**
- `数据分析` **只承接分析 / BI / 报表类岗位**，不能并入 `大数据`
- `工程师` 只承接**制造 / 电气 / 机械 / 通用工程**类岗位，不承接软件研发
- `IT技术` 只承接**企业 IT 支持 / 内部系统 / 信息技术岗**，不并入 `研发`
- `其他职位` 仅作为 **fallback canonical**，新增或命中后应做人工复核

## 二、日常维护标准流程

### 步骤 1：先判断是“新增 alias”还是“新增 canonical”

优先顺序：

1. 先查 `docs/JOB_TITLE canonical 定稿表.md` / `docs/MAJOR canonical 定稿表.md`
2. 若已有可承接 canonical，**只新增 alias**
3. 若现有 canonical 都无法准确承接，再提交新增 canonical 评审

### 步骤 2：维护前先导出

- 在后台词典中心点击 **导出全量词典**
- 保存导出文件，作为本次变更前快照
- 大批量导入前，必须保留导出快照，便于回滚

### 步骤 3：单条维护优先走页面 CRUD

适用场景：

- 新增 1~5 条 canonical 或 alias
- 修改单条 alias 的 `matchMode`
- 修正省市父子关系

操作建议：

- 新增主词后，再进入同一弹窗维护 alias
- 编辑 alias 时先看 `aliasNormalized` 预览，确认去空格、去标点后的唯一性
- 高歧义 alias 默认先 `exact`

### 步骤 4：批量维护走导入模板

适用场景：

- 一次性新增大量 alias
- 批量调整排序、状态、source
- 需要运营侧多人协作审稿

强制要求：

- 只能使用系统下载的 Excel 模板
- 必须保留三张 Sheet：`terms / aliases / location_hierarchy`
- 导入前先自查列头、domain、canonicalName、matchMode 是否正确

## 三、什么情况下允许新增 canonical

仅当同时满足以下条件时才允许新增：

- 现有 canonical 无法准确承接该词
- 该词在多家企业、多条公告中长期稳定出现
- 该词不是单一公司内部命名、单一项目名或一次性活动名
- 新增后不会破坏现有短 canonical 体系

### 明确禁止新增为 canonical 的情况

- 岗位细长全称：如 `产品经理`、`软件开发工程师`
- 专业全称：如 `计算机科学与技术`、`机械设计制造及其自动化`
- 高歧义短词：如 `行政`、`金融`、`移动`
- 明显应归到现有大类的词：如 `市场营销专业`、`Java后端开发`

## 四、变更后必须完成的验收动作

### 1. 词典层验收

- 标准词、alias、matchMode、状态、排序是否与设计一致
- 是否误把长词建成了 canonical
- 是否出现同一 domain 下 alias 归属冲突

### 2. 功能层验收

至少抽样验证以下链路：

- 用户画像写库是否能归一到目标 canonical
- `/jobs` 普通搜索是否命中预期岗位
- `/jobs` 专属推荐是否理解为相同 canonical
- 后台导出、导入、再次导出是否前后一致

### 3. 缓存层注意事项

- 词典中心保存或导入后，当前实现会自动清空标准化缓存与推荐缓存
- 若在异常情况下发现前后台口径不一致，应优先确认 API 是否已刷新到最新词典数据

## 五、回滚与异常处理

### 1. 导入后发现大面积误归类

- 立即用导出快照对照错误行
- 优先把高风险 alias 改回 `exact` 或直接停用
- 必要时用变更前导出文件重新导入恢复

### 2. 页面保存成功但搜索 / 推荐结果异常

优先排查：

1. alias 是否错误使用了 `contains`
2. 是否误把高歧义短词开放到搜索召回
3. canonical 是否挂错 domain
4. 是否把应挂 alias 的值错误新建成 canonical

### 3. `其他职位` 命中增加

- 说明出现了更多暂时无法可靠归类的尾部岗位
- 需定期复盘这些词，判断是否应升级为已有 canonical 的 alias，或是否需要新增正式 canonical

## 六、配套文档索引

- `docs/JOB_TITLE canonical 定稿表.md`
- `docs/MAJOR canonical 定稿表.md`
- `docs/旧canonical到新canonical映射表.md`
- `docs/alias归属说明表.md`
- `docs/标准化词典中心导入导出与运营验收样例.md`
- `docs/词库标准化搜索推荐正式验收报告-20260429.md`

## 七、版本说明

- 2026-04-29：首次形成正式 SOP，补齐此前只有“样例文档”而缺少长期维护规范的问题
