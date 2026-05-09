# offer360全站项目架构全景地图+开发定位手册
> 版本：v1.0 | 更新时间：2026-04-25 | 状态：开发中 | 永久架构手册

---

## 一、项目目录结构全景树
```
offer360/
├── apps/
│   ├── api/                          # NestJS后端服务
│   │   ├── src/
│   │   │   ├── common/               # 公共工具层
│   │   │   │   ├── decorators/       # 自定义装饰器
│   │   │   │   ├── guards/           # 守卫
│   │   │   │   ├── interceptors/     # 拦截器
│   │   │   │   └── types/            # 公共类型
│   │   │   ├── config/               # 配置文件
│   │   │   ├── modules/              # 业务模块
│   │   │   │   ├── admin/            # 后台管理模块
│   │   │   │   ├── auth/             # 用户认证模块
│   │   │   │   ├── dashboard/        # 数据总览模块
│   │   │   │   ├── invitations/      # 邀请分销模块
│   │   │   │   ├── jobs/             # 招聘公告模块
│   │   │   │   ├── memberships/      # 会员模块
│   │   │   │   ├── orders/           # 订单模块
│   │   │   │   ├── services/         # 服务商品模块
│   │   │   │   └── users/            # 用户模块
│   │   │   ├── app.module.ts         # 根模块
│   │   │   ├── main.ts               # 应用入口
│   │   │   └── prisma.service.ts     # Prisma服务
│   │   ├── prisma/                   # 数据库相关
│   │   │   ├── schema.prisma         # 数据库模型
│   │   │   └── seed.ts               # 初始化脚本
│   │   ├── package.json              # 后端依赖
│   │   └── tsconfig.json             # 后端TS配置
│   └── web/                          # Next.js前端应用
│       ├── app/                      # 页面路由
│       │   ├── admin/                # 后台页面
│       │   ├── api/proxy/[...path]/  # 代理路由
│       │   ├── invite/               # 邀请页
│       │   ├── jobs/                 # 招聘页
│       │   ├── login/                # 登录页
│       │   ├── membership/           # 会员页
│       │   ├── personal-center/      # 个人中心
│       │   ├── register/             # 注册页
│       │   ├── services/             # 服务页
│       │   ├── layout.tsx            # 全局布局
│       │   └── page.tsx              # 首页
│       ├── components/               # 组件库
│       │   ├── admin/                # 后台组件
│       │   ├── jobs/                 # 招聘组件
│       │   ├── layout/               # 布局组件
│       │   ├── membership/           # 会员组件
│       │   ├── personal/             # 个人中心组件
│       │   ├── services/             # 服务组件
│       │   └── ui/                   # shadcn/ui组件
│       ├── lib/                      # 工具库
│       │   ├── admin-auth.ts         # 后台认证工具
│       │   ├── admin.ts              # 后台工具
│       │   ├── api.ts                # 接口请求工具
│       │   └── utils.ts              # 通用工具
│       ├── store/                    # 状态管理
│       │   └── auth-store.ts         # 用户认证状态
│       ├── types/                    # 前端类型
│       └── package.json              # 前端依赖
├── docs/                            # 项目文档
├── packages/shared/                  # 前后端共享包
├── offer360核心模块产品需求文档.md
├── offer360核心数据表设计文档.md
└── package.json                      # 根Monorepo配置
```

---

## 二、前端模块清单
### 1. 页面路由
| 页面路径 | 文件路径 | 负责功能 |
|----------|----------|----------|
| 首页 | `/apps/web/app/page.tsx` | 重定向到/jobs |
| 前台登录 | `/apps/web/app/login/page.tsx` | 用户登录 |
| 前台注册 | `/apps/web/app/register/page.tsx` | 用户注册 |
| 招聘列表 | `/apps/web/app/jobs/page.tsx` | 前台岗位展示 |
| 服务商品 | `/apps/web/app/services/page.tsx` | 服务商品列表 |
| 服务详情 | `/apps/web/app/services/[id]/page.tsx` | 服务商品详情 |
| 会员开通 | `/apps/web/app/membership/page.tsx` | 会员开通与兑换 |
| 个人中心 | `/apps/web/app/personal-center/page.tsx` | 用户个人中心 |
| 邀请落地 | `/apps/web/app/invite/[randomKey]/page.tsx` | 邀请链接落地 |
| 后台登录 | `/apps/web/app/admin/login/page.tsx` | 管理员登录 |
| 后台总览 | `/apps/web/app/admin/overview/page.tsx` | 后台数据总览 |
| 招聘管理 | `/apps/web/app/admin/jobs/page.tsx` | 后台招聘CRUD/导入导出 |
| 用户管理 | `/apps/web/app/admin/users/page.tsx` | 后台用户CRUD/导入导出 |
| 会员管理 | `/apps/web/app/admin/memberships/page.tsx` | 后台会员管理 |
| 会员内容 | `/apps/web/app/admin/membership-content/page.tsx` | 后台会员内容管理 |
| 兑换码批次 | `/apps/web/app/admin/redeem-batches/page.tsx` | 后台兑换码批次管理 |
| 兑换码明细 | `/apps/web/app/admin/redeem-codes/page.tsx` | 后台兑换码明细管理 |
| 服务商品管理 | `/apps/web/app/admin/service-products/page.tsx` | 后台服务商品管理 |
| 订单管理 | `/apps/web/app/admin/orders/page.tsx` | 后台订单管理 |
| 分销流水 | `/apps/web/app/admin/commission-logs/page.tsx` | 后台分销流水 |
| 分销配置 | `/apps/web/app/admin/commission-config/page.tsx` | 后台分销配置 |
| 管理员管理 | `/apps/web/app/admin/admin-users/page.tsx` | 后台管理员管理 |
| 角色管理 | `/apps/web/app/admin/admin-roles/page.tsx` | 后台角色权限管理 |
| 操作日志 | `/apps/web/app/admin/operation-logs/page.tsx` | 后台操作日志 |

### 2. 组件与工具
| 组件/工具名 | 文件路径 | 功能说明 |
|------------|----------|----------|
| AdminShell | `/apps/web/components/admin/admin-shell.tsx` | 后台壳组件，权限控制与侧边栏 |
| JobsPageClient | `/apps/web/components/jobs/jobs-page-client.tsx` | 招聘页客户端交互逻辑 |
| MembershipOpenPageClient | `/apps/web/components/membership/membership-open-page-client.tsx` | 会员页交互逻辑（兑换码） |
| api.ts | `/apps/web/lib/api.ts` | 前后端接口统一请求封装 |
| admin-auth.ts | `/apps/web/lib/admin-auth.ts` | 后台管理员Token cookie管理 |
| admin.ts | `/apps/web/lib/admin.ts` | 后台工具（CSV下载等） |
| auth-store.ts | `/apps/web/store/auth-store.ts` | 用户认证状态持久化管理 |

---

## 三、后端接口清单
### 1. 用户认证
| 接口路径 | 方法 | 作用 | 所在文件 |
|----------|------|------|----------|
| `/api/auth/login` | POST | 用户登录 | `/apps/api/src/modules/auth/auth.controller.ts` |
| `/api/auth/me` | GET | 获取当前用户 | `/apps/api/src/modules/auth/auth.controller.ts` |

### 2. 招聘公告
| 接口路径 | 方法 | 作用 | 所在文件 |
|----------|------|------|----------|
| `/api/jobs/filters` | GET | 获取筛选项 | `/apps/api/src/modules/jobs/jobs.controller.ts` |
| `/api/jobs` | GET | 获取岗位列表 | `/apps/api/src/modules/jobs/jobs.controller.ts` |
| `/api/jobs/:id` | GET | 获取岗位详情 | `/apps/api/src/modules/jobs/jobs.controller.ts` |
| `/api/jobs/:id/deliver` | POST | 投递岗位 | `/apps/api/src/modules/jobs/jobs.controller.ts` |
| `/api/jobs/:id/progress` | PUT | 更新投递进度 | `/apps/api/src/modules/jobs/jobs.controller.ts` |
| `/api/jobs/:id/referral` | GET | 获取内推码 | `/apps/api/src/modules/jobs/jobs.controller.ts` |

### 3. 会员
| 接口路径 | 方法 | 作用 | 所在文件 |
|----------|------|------|----------|
| `/api/memberships/public/benefits` | GET | 获取会员权益内容 | `/apps/api/src/modules/memberships/memberships-public.controller.ts` |
| `/api/me/membership` | GET | 获取当前用户会员信息 | `/apps/api/src/modules/memberships/memberships.controller.ts` |
| `/api/me/membership/redeem` | POST | 兑换会员兑换码 | `/apps/api/src/modules/memberships/memberships.controller.ts` |

### 4. 后台管理
| 接口路径 | 方法 | 作用 | 所在文件 |
|----------|------|------|----------|
| `/api/admin/auth/login` | POST | 管理员登录 | `/apps/api/src/modules/admin/admin-auth.controller.ts` |
| `/api/admin/auth/me` | GET | 获取当前管理员 | `/apps/api/src/modules/admin/admin-auth.controller.ts` |
| `/api/admin/overview` | GET | 后台数据总览 | `/apps/api/src/modules/admin/admin.controller.ts` |
| `/api/admin/jobs` | GET/POST | 后台招聘公告列表/新增 | `/apps/api/src/modules/admin/admin.controller.ts` |
| `/api/admin/jobs/:id` | PATCH/DELETE | 后台招聘公告更新/删除 | `/apps/api/src/modules/admin/admin.controller.ts` |
| `/api/admin/users` | GET/POST | 后台用户列表/新增 | `/apps/api/src/modules/admin/admin.controller.ts` |
| `/api/admin/users/:id` | PATCH/DELETE | 后台用户更新/删除 | `/apps/api/src/modules/admin/admin.controller.ts` |
| `/api/admin/jobs/template` | GET | 下载招聘导入模板 | `/apps/api/src/modules/admin/admin-bulk.controller.ts` |
| `/api/admin/jobs/export` | GET | 导出招聘公告 | `/apps/api/src/modules/admin/admin-bulk.controller.ts` |
| `/api/admin/jobs/import` | POST | 批量导入招聘公告 | `/apps/api/src/modules/admin/admin-bulk.controller.ts` |
| `/api/admin/users/template` | GET | 下载用户导入模板 | `/apps/api/src/modules/admin/admin-bulk.controller.ts` |
| `/api/admin/users/export` | GET | 导出用户 | `/apps/api/src/modules/admin/admin-bulk.controller.ts` |
| `/api/admin/users/import` | POST | 批量导入用户 | `/apps/api/src/modules/admin/admin-bulk.controller.ts` |
| `/api/admin/redeem-batches` | GET/POST | 兑换码批次列表/新建 | `/apps/api/src/modules/admin/admin-redeem.controller.ts` |
| `/api/admin/redeem-batches/:id` | PATCH | 更新兑换码批次 | `/apps/api/src/modules/admin/admin-redeem.controller.ts` |
| `/api/admin/redeem-codes` | GET | 兑换码明细列表 | `/apps/api/src/modules/admin/admin-redeem.controller.ts` |
| `/api/admin/redeem-codes/:id` | PATCH | 作废/恢复兑换码 | `/apps/api/src/modules/admin/admin-redeem.controller.ts` |

---

## 四、数据库设计清单
### 1. 核心业务表
| 表名 | 用途 | 核心字段 |
|------|------|----------|
| `job_announcements` | 招聘公告存储 | id, companyName, positionNames, workLocation, status, sourceChannel |
| `users` | 前台用户存储 | id, phone, passwordHash, myInviteCode, status, sourceType |
| `user_memberships` | 用户会员有效期 | id, userId, startAt, endAt, remainingDays, sourceType |
| `service_products` | 服务商品存储 | id, name, price, originalPrice, status, isHot |
| `service_orders` | 服务订单存储 | id, orderNo, userId, productId, amount, payStatus |

### 2. 后台管理表
| 表名 | 用途 | 核心字段 |
|------|------|----------|
| `admin_users` | 管理员账号 | id, username, passwordHash, realName, status |
| `admin_roles` | 后台角色 | id, code, name, status |
| `admin_role_permissions` | 角色权限关联 | id, roleId, permissionKey |
| `admin_user_roles` | 用户角色关联 | id, adminUserId, roleId |
| `admin_operation_logs` | 管理员操作日志 | id, adminUserId, module, action, requestPath |

### 3. 兑换码体系表
| 表名 | 用途 | 核心字段 |
|------|------|----------|
| `membership_redeem_code_batches` | 兑换码批次 | id, batchNo, cardType, grantDays, quantity, usedCount, status |
| `membership_redeem_codes` | 单个兑换码 | id, code, batchId, status, validUntil, usedByUserId |
| `membership_redeem_use_logs` | 兑换码使用记录 | id, batchId, codeId, userId, grantDays, usedAt |

---

## 五、功能-文件快速映射表
> ✅ 已完成 | ⚠️ 后端完成前端待完善 | ❌ 未开发

| 功能点 | 前端文件 | 后端文件 | 数据库表 | 状态 |
|--------|----------|----------|----------|------|
| 前台岗位列表/详情/投递 | `/apps/web/app/jobs/page.tsx` + `jobs-page-client.tsx` | `/apps/api/src/modules/jobs/` | `job_announcements` / `user_job_tracking` | ✅ |
| 会员开通/兑换码兑换 | `/apps/web/app/membership/page.tsx` + `membership-open-page-client.tsx` | `/apps/api/src/modules/memberships/` | `user_memberships` / `membership_redeem_codes` | ✅ |
| 后台管理员登录/权限控制 | `/apps/web/app/admin/login/page.tsx` + `admin-shell.tsx` | `/apps/api/src/modules/admin/admin-auth.service.ts` + 守卫/装饰器 | `admin_users` / `admin_roles` | ✅ |
| 后台招聘公告CRUD | `/apps/web/app/admin/jobs/page.tsx` | `/apps/api/src/modules/admin/admin.service.ts` | `job_announcements` | ✅ |
| 后台用户CRUD | `/apps/web/app/admin/users/page.tsx` | `/apps/api/src/modules/admin/admin.service.ts` | `users` | ✅ |
| 批量导入导出后端接口 | - | `/apps/api/src/modules/admin/admin-bulk.service.ts` | `job_announcements` / `users` | ✅ |
| 兑换码批次管理后端接口 | - | `/apps/api/src/modules/admin/admin-redeem.service.ts` | `membership_redeem_code_batches` | ✅ |
| 兑换码明细管理后端接口 | - | `/apps/api/src/modules/admin/admin-redeem.service.ts` | `membership_redeem_codes` | ✅ |
| 招聘公告/用户批量导入前端上传 | `/apps/web/app/admin/jobs/page.tsx` / `/apps/web/app/admin/users/page.tsx` | - | - | ⚠️ |
| 兑换码批次管理前端 | `/apps/web/app/admin/redeem-batches/page.tsx` | - | - | ⚠️ |
| 兑换码明细管理前端 | `/apps/web/app/admin/redeem-codes/page.tsx` | - | - | ⚠️ |
| 管理员/角色管理前后端 | `/apps/web/app/admin/admin-users/page.tsx` / `/apps/web/app/admin/admin-roles/page.tsx` | - | `admin_users` / `admin_roles` / `admin_user_roles` / `admin_role_permissions` | ❌ |
| 操作日志前后端 | `/apps/web/app/admin/operation-logs/page.tsx` | - | `admin_operation_logs` | ❌ |
| 服务商品订单支付 | - | - | `service_orders` | ❌ |
| 站内搜索/Elasticsearch接入 | - | - | - | ❌ |
| 消息推送/通知 | - | - | - | ❌ |

---

## 六、项目开发进度与现状
### 已完成功能模块
1. ✅ 完整Monorepo目录结构与构建配置
2. ✅ 数据库模型设计与初始化脚本（包含管理员/角色/权限/兑换码体系）
3. ✅ 前台用户注册/登录/个人中心/会员开通/岗位展示/投递/进度更新/内推
4. ✅ 前台会员兑换码实际兑换逻辑
5. ✅ 后台管理员登录/权限控制/会话隔离
6. ✅ 后台招聘公告/用户/会员/服务商品/订单/分销流水/分销配置CRUD
7. ✅ 批量导入导出后端接口（招聘公告/用户模板下载/导出/导入）
8. ✅ 兑换码管理后端接口（批次管理/明细查询/作废恢复）
9. ✅ 后台权限守卫与装饰器
10. ✅ 前台代理自动注入后台管理员Token

### 未开发待完善模块
1. ⚠️ 批量导入导出前端上传入口
2. ⚠️ 兑换码管理前端页面完善
3. ❌ 管理员账号/角色权限配置前后端
4. ❌ 操作日志记录与查询前后端
5. ❌ 服务订单支付链路接入
6. ❌ 站内搜索与Elasticsearch接入
7. ❌ 消息推送/站内通知/短信/邮件
8. ❌ 分销佣金提现功能
9. ❌ 移动端H5适配优化
10. ❌ SEO优化与服务端渲染（SSR）
11. ❌ 多环境配置（测试/预发/生产）
12. ❌ 监控与告警接入

---

## 七、现有技术规范
### 1. 目录与命名规范
- 目录：Monorepo结构，`apps/`前后端分离，`packages/shared`前后端共享
- 命名：接口路径小写连字符，数据库表名蛇形复数，类型/类大驼峰，变量/函数小驼峰，常量全大写下划线
- 权限命名：模块:操作:范围，例如`admin:job:manage`

### 2. 接口规范
- 统一返回格式：`{ code: 0, data: T, message?: string }`
- 分页接口返回：`{ list: T[], pagination: { page: number, limit: number, total: number, hasMore: boolean } }`
- 错误码：401未登录/403无权限/404不存在/400参数错误/500服务错误

### 3. 数据库规范
- 所有表必须包含`id`、`createdAt`、`updatedAt`字段
- 禁止修改已有字段类型或名称，扩展只能新增字段
- 查询优先走索引，禁止全表扫描
- 新增修改必须走Prisma Client，禁止直接操作数据库

### 4. 代码提交规范（待正式制定）
- 提交信息格式：`feat: 功能描述` / `fix: 修复描述` / `docs: 文档更新` / `refactor: 重构描述`

---

## 八、已知问题与限制
1. **数据库兼容性**：新表与旧表间暂时没有强外键约束，只保留ID字段与索引，业务层需自行保证数据一致性
2. **导入导出限制**：单次导入导出最大限制5000条，当前导出接口仅支持导出当前页/第一页，全量导出需分页处理
3. **操作日志未落地**：管理员操作日志表结构已完成，但未接入操作记录逻辑
4. **后台权限未完全细化**：当前权限守卫已接入，但后台角色权限配置页面与接口未开发
5. **支付未接入**：服务订单模块结构已完成，但未接入任何支付渠道（微信/支付宝）
6. **后台导入上传未实现**：批量导入接口已开发，但前端上传入口与交互逻辑未完善
7. **接口频率限制**：当前无频率限制，后续需接入限流

---

## 九、后续开发约束与注意事项
1. **权限规则必须遵守**：新增后台接口必须加上`@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)`与`@RequireAdminPermissions`装饰器，禁止裸奔接口
2. **前台数据安全必须保证**：前台接口永远不返回草稿/下线状态的招聘公告，敏感字段（如密码hash）永远不返回
3. **数据库变更必须走Prisma Migrate**：禁止直接修改数据库结构，必须通过修改`schema.prisma`后执行`prisma migrate`
4. **接口变更必须向前兼容**：修改已有接口返回结构时，必须兼容旧版本，禁止直接删除已有字段
5. **兑换码规则必须遵守**：已使用的兑换码禁止再次使用/作废/修改，作废的兑换码可恢复为未使用，但需检查有效期
6. **交接必须以本手册为唯一权威**：后续更换AI或开发人员时，必须先完全阅读本手册，了解项目全貌后再开发
7. **开发前必须先查映射表**：修改功能/修复bug时，优先参考本手册的「功能-文件快速映射表」，快速定位文件位置
