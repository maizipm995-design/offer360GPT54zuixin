# offer360项目全量记忆文件清单
> 版本：v1.0 | 更新时间：2026-04-25

---

## 一、说明
本次排查未发现系统默认自动生成的原生项目记忆文件（无`.codebuddy`目录及相关自动生成记忆文件），所有记忆相关文件均为**用户主动要求创建**或**项目原生需求/架构/记录文档**。

---

## 二、分类清单
### 第一类：用户主动要求创建的项目记忆文件
> 存储位置：CodeBuddy全局脑目录（跨会话记忆存储区）

| 文件名称 | 完整存储路径 | 所在目录 | 文件用途/属性说明 |
|----------|--------------|----------|------------------|
| 方案C确认与数据库调整授权说明.md | `/Users/maizim/Library/Application Support/CodeBuddy/User/globalStorage/tencent-cloud.coding-copilot/brain/a0a993baf9734ad08f34f2867a527a87/方案C确认与数据库调整授权说明.md` | CodeBuddy脑目录 | 方案C正式确认函，包含数据库调整授权口径，可直接用于项目群确认 |
| 后台管理页面整体方案.md | `/Users/maizim/Library/Application Support/CodeBuddy/User/globalStorage/tencent-cloud.coding-copilot/brain/a0a993baf9734ad08f34f2867a527a87/后台管理页面整体方案.md` | CodeBuddy脑目录 | 后台管理系统完整落地方案，包含三个迭代阶段、数据库改造范围、功能清单 |
| offer360项目开发记忆档案.md | `/Users/maizim/Library/Application Support/CodeBuddy/User/globalStorage/tencent-cloud.coding-copilot/brain/a0a993baf9734ad08f34f2867a527a87/offer360项目开发记忆档案.md` | CodeBuddy脑目录 | 项目唯一官方交接文档，包含17轮开发历程、技术栈、功能清单、开发进度、代码规范、约束，可直接用于跨AI工具交接 |
| offer360项目全量记忆文件清单.md | `/Users/maizim/Library/Application Support/CodeBuddy/User/globalStorage/tencent-cloud.coding-copilot/brain/a0a993baf9734ad08f34f2867a527a87/offer360项目全量记忆文件清单.md` | CodeBuddy脑目录 | 本清单文件，记录项目所有记忆相关文件索引 |

---

### 第二类：项目原生/自带的记忆相关文件
> 存储位置：项目本地工作区目录

| 文件名称 | 完整存储路径 | 所在目录 | 文件用途/属性说明 |
|----------|--------------|----------|------------------|
| README.md | `/Users/maizim/Documents/2605GPT54offer360/README.md` | 项目根目录 | 项目通用说明文档，包含项目介绍、技术栈、部署说明 |
| offer360核心模块产品需求文档.md | `/Users/maizim/Documents/2605GPT54offer360/offer360核心模块产品需求文档.md` | 项目根目录 | 产品需求原始文档，包含所有功能模块需求描述、交互说明 |
| offer360核心数据表设计文档.md | `/Users/maizim/Documents/2605GPT54offer360/offer360核心数据表设计文档.md` | 项目根目录 | 数据库设计原始文档，包含所有表结构、字段说明、关系设计 |
| api-contract.md | `/Users/maizim/Documents/2605GPT54offer360/docs/api-contract.md` | 项目docs目录 | API接口契约文档，包含所有接口路径、参数、返回值说明 |
| 项目优化历程记录.md | `/Users/maizim/Documents/2605GPT54offer360/docs/项目优化历程记录.md` | 项目docs目录 | 项目历次优化记录，包含性能优化、BUG修复、技术调整历史 |
| 项目当前进度及架构记录表.md | `/Users/maizim/Documents/2605GPT54offer360/docs/项目当前进度及架构记录表.md` | 项目docs目录 | 当前项目进度记录、整体架构说明、模块划分描述 |
| 项目迭代总台账.md | `/Users/maizim/Documents/2605GPT54offer360/docs/项目迭代总台账.md` | 项目docs目录 | 版本迭代总台账，包含各版本迭代内容、上线时间、责任人 |
| 20260425-091604-前端构建校验.md | `/Users/maizim/Documents/2605GPT54offer360/docs/command-logs/20260425-091604-前端构建校验.md` | 项目docs/command-logs目录 | 前端构建校验日志记录，包含构建过程、结果、问题处理 |

---

## 三、使用说明
1.  **跨AI工具交接**：优先使用`offer360项目开发记忆档案.md`作为唯一权威依据，可快速让新AI理解项目全貌
2.  **需求/设计溯源**：参考`offer360核心模块产品需求文档.md`、`offer360核心数据表设计文档.md`、`后台管理页面整体方案.md`获取原始设计依据
3.  **问题排查**：参考`项目优化历程记录.md`、`command-logs`目录下的日志文件排查历史问题和处理方案
4.  **接口开发**：参考`api-contract.md`获取接口规范
