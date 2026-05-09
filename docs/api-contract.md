## 前后端对接规范

### 基础约定
- **API 前缀**：`/api`
- **接口风格**：RESTful
- **统一响应**：

```json
{
  "success": true,
  "message": "ok",
  "data": {}
}
```

### 认证说明
- **C 端用户接口**：`Authorization: Bearer <user_token>`
- **后台管理接口**：`Authorization: Bearer <admin_token>`
- **公开接口**：邀请落地页、会员权益内容等无需登录

### 通用分页约定
大部分列表接口均支持：
- `page`
- `limit`

统一返回：
- `list`
- `pagination.page`
- `pagination.limit`
- `pagination.total`
- `pagination.hasMore`

---

## C 端用户接口

### 认证
| 方法 | 路径 | 说明 | 关键参数 |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | 手机号密码登录 | `phone`、`password` |
| `POST` | `/auth/register` | 注册并自动登录，支持邀请码绑定 | `phone`、`password`、`inviteCode?`、`name?` |
| `GET` | `/auth/me` | 获取当前登录用户 | Header：用户 Token |

### 招聘首页
| 方法 | 路径 | 说明 | 关键参数 |
| --- | --- | --- | --- |
| `GET` | `/dashboard/job-stats` | 首页顶部统计卡片 | 无 |
| `GET` | `/jobs/filters` | 岗位筛选项 | 无 |
| `GET` | `/jobs` | 岗位列表、筛选、推荐、分页 | `companyName`、`positionName`、`major`、`workLocation`、`degree`、`enterpriseNature`、`jobType`、`updatedWithinDays`、`progressStatus`、`tab=all\|recommended`、`page`、`limit`、`userId?` |
| `GET` | `/jobs/:id` | 岗位详情 | 路径参数 `id` |
| `POST` | `/jobs/:id/deliver` | 立即投递 / 复制邮箱 | 路径参数 `id` |
| `PUT` | `/jobs/:id/progress` | 更新求职进度 | 路径参数 `id`，Body：`progressStatus` |
| `GET` | `/jobs/:id/referral` | 获取内推信息（会员） | 路径参数 `id` |

### 个人中心
| 方法 | 路径 | 说明 | 关键参数 |
| --- | --- | --- | --- |
| `GET` | `/me/overview` | 个人中心聚合信息 | 无 |
| `PUT` | `/me/profile` | 更新个人资料 | `name`、`graduationYear`、`degree`、`schoolName`、`major` |
| `GET` | `/me/preferences` | 获取求职意向 | 无 |
| `PUT` | `/me/preferences` | 更新求职意向 | `intentionCity[]`、`intentionJob[]`、`intentionCompany[]` |
| `PUT` | `/me/phone` | 修改手机号 | `phone` |
| `PUT` | `/me/password` | 修改密码 | `oldPassword`、`newPassword` |
| `GET` | `/me/invitations` | 获取邀请码、邀请统计、邀请记录、中转链接 | 无 |
| `GET` | `/me/orders` | 获取当前用户订单列表 | `page`、`limit` |
| `GET` | `/me/membership` | 获取当前会员状态 | 无 |
| `POST` | `/me/membership/open` | 开通会员 | `days?` |
| `POST` | `/me/membership/redeem` | 使用兑换码兑换会员 | `code` |

### 求职服务
| 方法 | 路径 | 说明 | 关键参数 |
| --- | --- | --- | --- |
| `GET` | `/service-products` | 服务列表 | 无 |
| `GET` | `/service-products/:id` | 服务详情 | 路径参数 `id` |
| `POST` | `/service-products/:id/orders` | 创建服务订单 | 路径参数 `id` |

### 公开页面接口
| 方法 | 路径 | 说明 | 关键参数 |
| --- | --- | --- | --- |
| `GET` | `/invite-links/:randomKey` | 邀请落地页数据，并记录访问轨迹 | 路径参数 `randomKey` |
| `GET` | `/membership-page/benefits` | 会员权益富文本页面内容 | 无 |

---

## 后台认证与权限接口

### 后台登录态
| 方法 | 路径 | 说明 | 关键参数 |
| --- | --- | --- | --- |
| `POST` | `/admin/auth/login` | 后台账号密码登录 | `username`、`password` |
| `GET` | `/admin/auth/me` | 获取当前后台管理员信息、角色与权限 | Header：后台 Token |
| `GET` | `/admin/permission-catalog` | 获取后台权限目录 | 无 |

### 权限说明
后台接口按权限点控制，常见权限包括：
- `dashboard:view`
- `admin:admin-user:manage`
- `admin:role:manage`
- `admin:operation-log:view`
- `admin:user:manage`
- `admin:job:manage`
- `admin:membership:manage`
- `admin:service:manage`
- `admin:commission:manage`
- `admin:redeem:manage`

---

## 后台业务管理接口

### 工作台与招聘公告
| 方法 | 路径 | 说明 | 关键参数 |
| --- | --- | --- | --- |
| `GET` | `/admin/overview` | 后台工作台聚合概览 | 无 |
| `GET` | `/admin/jobs` | 招聘公告列表 | `keyword`、`enterpriseNature`、`jobType`、`page`、`limit` |
| `POST` | `/admin/jobs` | 新建招聘公告 | `companyName`、`positionNames`、`workLocation` 必填；支持 `positionCategory`、`degreeRequirement`、`enterpriseNature`、`jobType`、`majorRequirement`、`deadlineAt`、`announcementUrl`、`recruitmentLink`、`recruitmentType`、`referralCode`、`status`、`sourceChannel`、`remark` |
| `PATCH` | `/admin/jobs/:id` | 更新招聘公告 | 同创建字段 |
| `DELETE` | `/admin/jobs/:id` | 删除招聘公告 | 路径参数 `id` |

### 用户与会员管理
| 方法 | 路径 | 说明 | 关键参数 |
| --- | --- | --- | --- |
| `GET` | `/admin/users` | C 端用户列表 | `keyword`、`status`、`membershipStatus`、`page`、`limit` |
| `POST` | `/admin/users` | 创建用户 | `phone`、`password` 必填；支持 `name`、`graduationYear`、`degree`、`schoolName`、`major`、`parentUid`、`parentInviteCode`、`status`、`sourceType`、`intentionCity`、`intentionJob`、`intentionCompany` |
| `PATCH` | `/admin/users/:id` | 更新用户资料、意向、状态 | 同上 |
| `DELETE` | `/admin/users/:id` | 删除用户 | 路径参数 `id` |
| `PATCH` | `/admin/users/:id/status` | 冻结 / 恢复用户 | `status`、`reason?` |
| `PATCH` | `/admin/users/:id/reset-password` | 重置用户密码 | `password` |
| `GET` | `/admin/memberships` | 会员记录列表 | `keyword`、`status`、`page`、`limit` |
| `POST` | `/admin/memberships` | 手工开通 / 续期会员 | `userId?`、`phone?`、`days` |
| `PATCH` | `/admin/memberships/:id` | 更新会员有效期 | `days?`、`startAt?`、`endAt?`、`remainingDays?` |
| `DELETE` | `/admin/memberships/:id` | 删除会员记录 | 路径参数 `id` |
| `GET` | `/admin/membership-contents` | 会员权益富文本内容列表 | `keyword`、`status`、`page`、`limit` |
| `POST` | `/admin/membership-contents` | 新建会员权益内容 | `slug`、`title`、`htmlContent`、`status?` |
| `PATCH` | `/admin/membership-contents/:id` | 更新会员权益内容 | `title?`、`htmlContent?`、`status?` |
| `DELETE` | `/admin/membership-contents/:id` | 删除会员权益内容 | 路径参数 `id` |

### 服务、订单与分销
| 方法 | 路径 | 说明 | 关键参数 |
| --- | --- | --- | --- |
| `GET` | `/admin/service-products` | 服务商品列表 | `keyword`、`status`、`page`、`limit` |
| `POST` | `/admin/service-products` | 新建服务商品 | `name`、`description`、`price`、`originalPrice`、`score`、`isHot`、`status` |
| `PATCH` | `/admin/service-products/:id` | 更新服务商品 | 同创建字段 |
| `DELETE` | `/admin/service-products/:id` | 删除服务商品 | 路径参数 `id` |
| `GET` | `/admin/orders` | 服务订单列表 | `keyword`、`payStatus`、`page`、`limit` |
| `PATCH` | `/admin/orders/:id/status` | 修改订单状态 / 退款登记 / 分销扣回 | `payStatus`、`refundReason?`、`remark?` |
| `GET` | `/admin/commission-logs` | 分销佣金流水 | `keyword`、`logType`、`page`、`limit` |
| `GET` | `/admin/commission-config` | 获取分销配置 | 无 |
| `PATCH` | `/admin/commission-config/:id` | 更新分销比例 | `oneLevelRate` |

订单列表返回建议前端重点使用字段：
- `id`
- `orderNo`
- `amount`
- `payStatus`
- `payTime`
- `refundReason`
- `refundAt`
- `remark`
- `createdAt`
- `updatedAt`
- `user.id`
- `user.phone`
- `user.myInviteCode`
- `product.id`
- `product.name`

---

## 后台治理接口

### 后台管理员与角色管理
| 方法 | 路径 | 说明 | 关键参数 |
| --- | --- | --- | --- |
| `GET` | `/admin/admin-users` | 后台账号列表 | `keyword`、`status`、`page`、`limit` |
| `POST` | `/admin/admin-users` | 新建后台账号并绑定角色 | `username`、`password` 必填；支持 `realName`、`phone`、`email`、`status`、`remark`、`roleIds[]` |
| `PATCH` | `/admin/admin-users/:id` | 更新后台账号 | 支持 `password?`、`realName?`、`phone?`、`email?`、`status?`、`remark?`、`roleIds[]?` |
| `DELETE` | `/admin/admin-users/:id` | 删除后台账号 | 路径参数 `id` |
| `GET` | `/admin/admin-roles` | 后台角色列表 | `keyword`、`status`、`page`、`limit` |
| `POST` | `/admin/admin-roles` | 新建角色并配置权限 | `code`、`name`、`description?`、`status?`、`permissionKeys[]` |
| `PATCH` | `/admin/admin-roles/:id` | 更新角色与权限 | 同上 |
| `DELETE` | `/admin/admin-roles/:id` | 删除角色 | 路径参数 `id` |

后台账号返回建议前端重点使用字段：
- `id`
- `username`
- `realName`
- `phone`
- `email`
- `status`
- `remark`
- `lastLoginAt`
- `isSuperAdmin`
- `roleIds[]`
- `roles[]`
- `permissions[]`

角色返回建议前端重点使用字段：
- `id`
- `code`
- `name`
- `description`
- `status`
- `userCount`
- `permissionKeys[]`
- `permissions[]`

### 后台操作日志
| 方法 | 路径 | 说明 | 关键参数 |
| --- | --- | --- | --- |
| `GET` | `/admin/operation-logs` | 查询后台操作日志 | `keyword`、`module`、`action`、`page`、`limit` |

说明：
- 后台写操作会通过拦截器自动记录日志。
- 默认记录模块、动作、目标类型、目标 ID、请求方法、请求路径、请求参数摘要、响应摘要、IP、UA。
- 敏感字段会脱敏，例如：`password`、`token`、`authorization`、`cookie`、`csvText`。

---

## 后台批量导入导出接口

### 招聘公告导入导出
| 方法 | 路径 | 说明 | 关键参数 |
| --- | --- | --- | --- |
| `GET` | `/admin/jobs/template` | 下载招聘公告 CSV 模板 | 无 |
| `GET` | `/admin/jobs/export` | 导出当前筛选结果 | 复用 `/admin/jobs` 查询参数 |
| `POST` | `/admin/jobs/import` | 批量导入招聘公告 | `csvText` |

### 用户导入导出
| 方法 | 路径 | 说明 | 关键参数 |
| --- | --- | --- | --- |
| `GET` | `/admin/users/template` | 下载用户 CSV 模板 | 无 |
| `GET` | `/admin/users/export` | 导出当前筛选结果 | 复用 `/admin/users` 查询参数 |
| `POST` | `/admin/users/import` | 批量导入用户 | `csvText` |

批量导入统一返回：
- `total`
- `success`
- `failed`
- `errors[]`（仅返回前 20 条，字段：`row`、`message`）

---

## 后台兑换码接口

| 方法 | 路径 | 说明 | 关键参数 |
| --- | --- | --- | --- |
| `GET` | `/admin/redeem-batches` | 兑换码批次列表 | `keyword`、`status`、`page`、`limit` |
| `POST` | `/admin/redeem-batches` | 创建兑换码批次 | `cardType`、`grantDays`、`quantity`、`validFrom?`、`validUntil?`、`remark?` |
| `PATCH` | `/admin/redeem-batches/:id` | 更新兑换码批次 | `status?`、`validFrom?`、`validUntil?`、`remark?` |
| `GET` | `/admin/redeem-codes` | 兑换码明细列表 | `keyword`、`status`、`batchId`、`page`、`limit` |
| `PATCH` | `/admin/redeem-codes/:id` | 作废 / 调整兑换码 | `status`、`invalidReason?` |

兑换码相关返回建议前端重点使用字段：
- **批次**：`id`、`batchNo`、`cardType`、`grantDays`、`quantity`、`usedCount`、`unusedCount`、`status`、`validFrom`、`validUntil`、`remark`
- **兑换码**：`id`、`code`、`batchId`、`batchNo`、`cardType`、`grantDays`、`status`、`validUntil`、`usedByUserId`、`usedByUserPhone`、`usedAt`、`invalidatedAt`、`invalidReason`

---

## 页面联动说明
- **`/jobs`**：SSR 首屏请求 `job-stats`、`jobs/filters`、`jobs`
- **`/services`**：SSR 首屏请求 `service-products`
- **`/personal-center`**：登录后客户端并发请求 `overview`、`invitations`、`orders`
- **`/membership`**：公开页请求 `membership-page/benefits`
- **`/invite/[randomKey]`**：SSR 请求 `invite-links/:randomKey`
- **后台订单页**：列表调用 `/admin/orders`，详情操作调用 `/admin/orders/:id/status`
- **后台治理页**：账号、角色、日志页面分别对应 `/admin/admin-users`、`/admin/admin-roles`、`/admin/operation-logs`

## Swagger
- 本地开发访问：`http://localhost:4000/api/docs`
