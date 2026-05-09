# 旧canonical到新canonical映射表

## 文档定位

- **用途**：为用户画像回填、运营导入审核、历史规则对账提供“旧写法 → 新短 canonical”映射依据。
- **口径说明**：历史旧 canonical 快照未单独归档，本表以**当前 seed 中已下沉为 alias 的旧长 canonical / 高频旧写法**作为正式映射依据。
- **全量 alias 归属**：见 `docs/alias归属说明表.md`。


## JOB_TITLE

| 旧 canonical / 旧写法 | 新 canonical | 匹配方式 | 说明 |
| --- | --- | --- | --- |
| 软件开发 | 开发 | contains | 历史长写法回收为通用开发主词。 |
| 软件开发工程师 | 开发 | contains | 长 canonical 下沉为 alias。 |
| 开发工程师 | 开发 | contains | 保留通用开发召回。 |
| 研发工程师 | 研发 | contains | 研发与开发明确分开。 |
| 研究开发 | 研发 | contains | 研发类旧长词统一收口。 |
| 后端开发工程师 | 后端 | contains | 后端方向独立。 |
| Java后端开发 | 后端 | contains | Java 后端细写法下沉为 alias。 |
| 前端开发工程师 | 前端 | contains | 前端方向独立。 |
| 移动端开发 | 客户端 | contains | 移动端并入客户端。 |
| 算法工程师 | 算法 | contains | 算法岗位统一收口。 |
| 数据开发 | 大数据 | contains | 数据工程类统一到大数据。 |
| AI工程师 | 人工智能 | contains | AI 专项统一到人工智能。 |
| 信息安全 | 安全 | contains | 安全类统一收口。 |
| 测试开发 | 测试 | contains | 测开统一进入测试 canonical。 |
| DevOps | 运维 | exact | 英文缩写按 exact 归一。 |
| 嵌入式开发 | 硬件 | contains | 嵌入式相关统一并入硬件。 |
| 产品经理 | 产品 | contains | 旧细分产品主词下沉为 alias。 |
| 运营管理 | 运营 | contains | 旧长 canonical 改为 alias。 |
| 数据分析师 | 数据分析 | contains | 分析类独立，不并入大数据。 |
| UI设计师 | UI | contains | UI 专项保留独立主词。 |
| 人力资源 | 人力 | contains | HR 类统一收口。 |
| 行政 | 人事 / 行政 | exact | 高歧义短词仅归一，不放开裸词扩召回。 |
| 财务管理 | 财务 | contains | 财务岗位类旧写法统一收口。 |
| 市场营销 | 营销 | contains | 营销与市场分开治理。 |
| 机械工程师 | 工程师 | contains | 制造工程类统一收口。 |
| 管理培训生 | 管培生 | contains | 校招专项岗位统一收口。 |
| 运营培训生 | 培训生 | contains | 培训体系单独收口。 |
| 暑期实习生 | 实习生 | contains | 实习类统一收口。 |
| 信息技术岗 | IT技术 | contains | 企业 IT 支持类统一收口。 |
| 储备干部 | 其他职位 | contains | 暂无法可靠归类时进入 fallback。 |

## MAJOR

| 旧 canonical / 旧写法 | 新 canonical | 匹配方式 | 说明 |
| --- | --- | --- | --- |
| 计算机科学与技术 | 计算机 | contains | 细分全称下沉为 alias。 |
| 软件工程 | 计算机 | contains | 软件工程收口到计算机大类。 |
| 数据科学与大数据技术 | 计算机 | contains | 数据技术类收口到计算机大类。 |
| 网络工程 | 计算机 | contains | 网络工程统一到计算机大类。 |
| 智能科学与技术 | 人工智能 | contains | AI 专项单独收口。 |
| 电子信息工程 | 电子信息 | contains | 工程全称下沉为 alias。 |
| 通信工程 | 通信 | contains | 通信工程统一收口。 |
| 电气工程及其自动化 | 电气 | contains | 典型长全称下沉为 alias。 |
| 机械设计制造及其自动化 | 机械 | contains | 机械细分长全称统一收口。 |
| 材料科学与工程 | 材料化工 | contains | 材料/化工合并为大类 canonical。 |
| 化学工程与工艺 | 材料化工 | contains | 化工类统一收口。 |
| 土木工程 | 土木建筑 | contains | 土木与建筑统一为大类。 |
| 建筑学 | 土木建筑 | contains | 建筑类统一收口。 |
| 统计学 | 数学统计 | contains | 数学与统计统一为大类。 |
| 临床医学 | 医学 | contains | 医学相关统一收口。 |
| 护理 | 医学 | exact | 高频短词可直接归一。 |
| 财务管理 | 财务 | contains | 财会专业统一收口。 |
| 会计学 | 财务 | contains | 财会全称下沉为 alias。 |
| 金融学 | 金融 | contains | 金融类统一收口。 |
| 工商管理 | 经管 | contains | 经管相关统一收口。 |
| 市场营销专业 | 市场营销 | contains | 营销专业独立保留。 |
| 人力资源管理 | 人力资源 | contains | 人资专业独立保留。 |
| 法学专业 | 法学 | contains | 法学统一收口。 |
| 新闻学 | 新闻传播 | contains | 传播相关统一收口。 |
| 英语 | 语言 | contains | 语言类统一收口。 |
| 教育学 | 教育 | contains | 教育类统一收口。 |
| 供应链管理 | 物流供应链 | contains | 物流与供应链并为单一大类。 |
