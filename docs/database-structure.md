# Offer360 数据库结构文档 (Database Structure)

本文档由自动化脚本根据 `apps/api/prisma/schema.prisma` 实时同步生成，旨在为开发人员提供最新的表结构、字段定义及索引信息。

---

## 1. 核心求职业务模块

### 1.1 招聘公告表 (`job_announcements`)
- **Prisma Model**: `JobAnnouncement`
- **业务说明**: 存储全站发布的招聘岗位公告信息。

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | 唯一 ID | @id (PK) |
| companyFullName | `company_full_name` | VarChar(191) | 企业全称 | idx_jobs_company_full_name |
| enterpriseNature | `enterprise_nature` | VarChar(50) | 企业性质 | idx_jobs_nature |
| degreeRequirement | `degree_requirement` | VarChar(50) | 学历要求 | idx_jobs_degree |
| workLocation | `work_location` | LongText | 工作地点 | - |
| jobName | `job_name` | Text | 岗位名称 | - |
| jobCategory | `job_category` | Text | 岗位类别 | - |
| recruitmentType | `recruitment_type` | VarChar(50) | 招聘类型 | idx_jobs_recruitment_type |
| deadlineAt | `deadline_at` | Text | 截止日期 | - |
| announcementUrl | `announcement_url` | Text | 公告原文链接 | - |
| deliveryUrl | `delivery_url` | Text | 投递入口链接 | - |
| graduationSession | `graduation_session` | LongText | 面向届别 | - |
| referralCode | `referral_code` | Text | 内推码 | - |
| announcementTitle | `announcement_title` | VarChar(255) | 公告标题 | - |
| industry | `industry` | VarChar(100) | 行业领域 | - |
| entryDate | `entry_date` | Text | 录入日期 | - |
| accessClickCount | `access_click_count` | Int | 累计访问量 | idx_jobs_access_click_updated_at |
| deliveryMarkCount | `delivery_mark_count` | Int | 投递标记量 | idx_jobs_delivery_mark_updated_at |
| lastAccessAt | `last_access_at` | DateTime | 最后访问时间 | - |
| lastDeliveryMarkAt | `last_delivery_mark_at` | DateTime | 最后投递标记时间 | - |
| status | `status` | VarChar(20) | 发布状态 | idx_jobs_status_updated_at |
| createdAt | `created_at` | DateTime | 创建时间 | - |
| updatedAt | `updated_at` | DateTime | 更新时间 | idx_jobs_updated_at |

### 1.2 求职进度追踪表 (`user_job_tracking`)
- **Prisma Model**: `UserJobTracking`
- **业务说明**: 记录用户对特定岗位的关注及求职进展。

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | 记录 ID | @id (PK) |
| userId | `user_id` | Char(36) | 用户 ID | uniq_user_job_tracking (U) |
| jobId | `job_id` | Char(36) | 岗位 ID | uniq_user_job_tracking (U) |
| progressStatus | `progress_status` | VarChar(30) | 求职进度 | idx_tracking_progress |
| createdAt | `created_at` | DateTime | 标记时间 | - |
| updatedAt | `updated_at` | DateTime | 状态变更时间 | - |

---

## 2. 用户中心模块

### 2.1 用户基础账号表 (`users`)
- **Prisma Model**: `User`
- **业务说明**: 存储用户的登录凭证、状态及分销邀请关系。

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | 用户唯一 ID | @id (PK) |
| phone | `phone` | VarChar(20) | 手机号 | @unique |
| passwordHash | `password_hash` | Text | 密码 Hash | - |
| myInviteCode | `my_invite_code` | VarChar(32) | 个人邀请码 | @unique |
| parentUid | `parent_uid` | Char(36) | 邀请人 ID | idx_users_parent_uid |
| status | `status` | VarChar(20) | 账号状态 | idx_users_status |
| sourceType | `source_type` | VarChar(50) | 注册来源 | idx_users_source_type |
| wechatOpenId | `wechat_open_id` | VarChar(64) | 微信 OpenID | @unique |
| resumePdfExportCount | `resume_pdf_export_count` | Int | 简历导出次数 | - |
| createdAt | `created_at` | DateTime | 注册时间 | - |
| lastLoginAt | `last_login_at` | DateTime | 最后登录时间 | - |

### 2.2 用户资料详情表 (`user_profiles`)
- **Prisma Model**: `UserProfile`
- **业务说明**: 存储用户的详细个人资料。

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | 资料 ID | @id (PK) |
| userId | `user_id` | Char(36) | 用户 ID | @unique |
| name | `name` | VarChar(100) | 真实姓名 | - |
| graduationYear | `graduation_year` | Int | 毕业年份 | - |
| degree | `degree` | VarChar(20) | 最高学历 | - |
| schoolName | `school_name` | VarChar(120) | 学校名称 | - |
| major | `major` | VarChar(120) | 所学专业 | - |
| updatedAt | `updated_at` | DateTime | 更新时间 | - |

### 2.3 手机验证码表 (`phone_verification_codes`)
- **Prisma Model**: `PhoneVerificationCode`
- **业务说明**: 存储登录、注册、找回密码等流程的短信验证码。

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | 记录 ID | @id (PK) |
| phone | `phone` | VarChar(20) | 手机号 | uniq_phone_verification_phone_business (U) |
| business | `business` | VarChar(30) | 业务类型 | uniq_phone_verification_phone_business (U), idx_phone_verification_business_expires |
| codeHash | `code_hash` | VarChar(128) | 验证码 Hash | - |
| expiresAt | `expires_at` | DateTime | 过期时间 | idx_phone_verification_business_expires |
| lastSentAt | `last_sent_at` | DateTime | 最后发送时间 | - |
| verifiedAt | `verified_at` | DateTime | 校验时间 | - |
| sendCount | `send_count` | Int | 发送次数 | - |
| createdAt | `created_at` | DateTime | 创建时间 | - |
| updatedAt | `updated_at` | DateTime | 更新时间 | - |

### 2.4 简历草稿表 (`resume_drafts`)
- **Prisma Model**: `ResumeDraft`
- **业务说明**: 存储用户的简历草稿数据。

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | 草稿 ID | @id (PK) |
| userId | `user_id` | Char(36) | 用户 ID | idx_resume_drafts_user_updated_at |
| title | `title` | VarChar(120) | 简历标题 | - |
| templateCode | `template_code` | VarChar(40) | 模板编码 | - |
| status | `status` | VarChar(20) | 状态 | idx_resume_drafts_status |
| contentJson | `content_json` | Json | 简历内容 | - |
| styleJson | `style_json` | Json | 样式配置 | - |
| layoutJson | `layout_json` | Json | 布局配置 | - |
| lastValidatedAt | `last_validated_at` | DateTime | 最后校验时间 | - |
| createdAt | `created_at` | DateTime | 创建时间 | - |
| updatedAt | `updated_at` | DateTime | 更新时间 | idx_resume_drafts_user_updated_at |

### 2.5 用户求职偏好标签表 (`user_job_preference_tags`)
- **Prisma Model**: `UserJobPreferenceTag`
- **业务说明**: 存储用户的求职偏好（城市、岗位、公司等）。

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | BigInt | ID | @id (PK, AI) |
| userId | `user_id` | Char(36) | 用户 ID | @unique |
| intentionCity | `intention_city` | Json | 意向城市 | - |
| intentionJob | `intention_job` | Json | 意向岗位 | - |
| intentionCompany | `intention_company` | Json | 意向公司 | - |
| createTime | `create_time` | DateTime | 创建时间 | - |
| updateTime | `update_time` | DateTime | 更新时间 | - |

---

## 3. 会员与支付模块

### 3.1 会员身份表 (`user_memberships`)
- **Prisma Model**: `UserMembership`
- **业务说明**: 记录用户的会员身份及有效期。

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | 记录 ID | @id (PK) |
| userId | `user_id` | Char(36) | 用户 ID | @unique |
| memberLevel | `member_level` | VarChar(30) | 会员等级 | idx_user_memberships_member_level |
| startAt | `start_at` | DateTime | 生效时间 | - |
| endAt | `end_at` | DateTime | 到期时间 | - |
| remainingDays | `remaining_days` | Int | 剩余天数 | - |
| sourceType | `source_type` | VarChar(30) | 来源类型 | idx_user_memberships_source_type |
| sourceRemark | `source_remark` | VarChar(255) | 来源备注 | - |
| openedByAdminId | `opened_by_admin_id` | Char(36) | 管理员 ID | idx_user_memberships_opened_by_admin |
| createdAt | `created_at` | DateTime | 创建时间 | - |
| updatedAt | `updated_at` | DateTime | 更新时间 | - |

### 3.2 会员权益富文本表 (`membership_rich_text_contents`)
- **Prisma Model**: `MembershipRichTextContent`
- **业务说明**: 存储会员权益介绍等富文本内容。

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | ID | @id (PK) |
| slug | `slug` | VarChar(100) | 标识符 | @unique, idx_membership_content_slug_status |
| title | `title` | VarChar(120) | 标题 | - |
| htmlContent | `html_content` | LongText | HTML 内容 | - |
| status | `status` | VarChar(20) | 状态 | idx_membership_content_slug_status |
| version | `version` | Int | 版本号 | - |
| publishedAt | `published_at` | DateTime | 发布时间 | - |
| publishedByAdminId | `published_by_admin_id` | Char(36) | 发布管理员 | idx_membership_content_published_by_admin |
| createdAt | `created_at` | DateTime | 创建时间 | - |
| updatedAt | `updated_at` | DateTime | 更新时间 | - |

### 3.3 服务产品表 (`service_products`)
- **Prisma Model**: `ServiceProduct`
- **业务说明**: 存储可购买的服务项或会员卡。

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | 产品 ID | @id (PK) |
| name | `name` | VarChar(120) | 产品名称 | - |
| description | `description` | Text | 描述 | - |
| price | `price` | Decimal | 售价 | - |
| originalPrice | `original_price` | Decimal | 原价 | - |
| score | `score` | Decimal | 评分 | - |
| salesCount | `sales_count` | Int | 销量 | idx_service_products_type_status_hot |
| isHot | `is_hot` | Boolean | 是否热门 | idx_service_products_type_status_hot |
| status | `status` | Boolean | 上架状态 | idx_service_products_type_status_hot |
| productType | `product_type` | VarChar(20) | 产品类型 | idx_service_products_type_status_hot, idx_service_products_type_member_level |
| memberLevel | `member_level` | VarChar(30) | 会员等级 | idx_service_products_type_member_level |
| grantDays | `grant_days` | Int | 赠送天数 | - |
| detailHtml | `detail_html` | LongText | 详情 HTML | - |
| orderServiceText | `order_service_text` | Text | 订单服务说明文案 | - |
| orderServiceImageUrl | `order_service_image_url` | Text | 订单服务说明图片 | - |
| createdAt | `created_at` | DateTime | 创建时间 | - |
| updatedAt | `updated_at` | DateTime | 更新时间 | - |

### 3.4 服务订单表 (`service_orders`)
- **Prisma Model**: `ServiceOrder`
- **业务说明**: 存储交易订单明细。

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | 订单 ID | @id (PK) |
| orderNo | `order_no` | VarChar(40) | 订单号 | @unique |
| userId | `user_id` | Char(36) | 用户 ID | idx_orders_user_created |
| productId | `product_id` | Char(36) | 产品 ID | - |
| orderType | `order_type` | VarChar(20) | 订单类型 | idx_orders_type_status_created |
| title | `title` | VarChar(120) | 标题 | - |
| amount | `amount` | Decimal | 金额 | - |
| memberLevel | `member_level` | VarChar(30) | 会员等级 | - |
| grantDays | `grant_days` | Int | 赠送天数 | - |
| payStatus | `pay_status` | VarChar(20) | 支付状态 | idx_orders_pay_status_created, idx_orders_type_status_created, idx_orders_expire_status |
| payChannel | `pay_channel` | VarChar(30) | 支付渠道 | - |
| payScene | `pay_scene` | VarChar(20) | 支付场景 | - |
| wechatOpenId | `wechat_open_id` | VarChar(64) | 微信 OpenID | - |
| wechatPrepayId | `wechat_prepay_id` | VarChar(100) | 微信预支付 ID | - |
| wechatCodeUrl | `wechat_code_url` | Text | 微信支付二维码 URL | - |
| wechatH5Url | `wechat_h5_url` | Text | 微信 H5 支付 URL | - |
| wechatTransactionId | `wechat_transaction_id` | VarChar(64) | 微信流水号 | idx_orders_wechat_transaction |
| callbackPayload | `callback_payload` | Json | 回调原始数据 | - |
| payTime | `pay_time` | DateTime | 支付时间 | - |
| expireAt | `expire_at` | DateTime | 过期时间 | idx_orders_expire_status |
| closedAt | `closed_at` | DateTime | 关闭时间 | - |
| refundReason | `refund_reason` | VarChar(255) | 退款原因 | - |
| refundAt | `refund_at` | DateTime | 退款时间 | - |
| remark | `remark` | Text | 备注 | - |
| createdAt | `created_at` | DateTime | 创建时间 | idx_orders_user_created, idx_orders_pay_status_created, idx_orders_type_status_created |
| updatedAt | `updated_at` | DateTime | 更新时间 | - |

---

## 4. 兑换码与分销模块

### 4.1 兑换码批次表 (`membership_redeem_code_batches`)
- **Prisma Model**: `MembershipRedeemCodeBatch`

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | 批次 ID | @id (PK) |
| batchNo | `batch_no` | VarChar(32) | 批次号 | @unique |
| memberLevel | `member_level` | VarChar(30) | 等级 | idx_redeem_batches_member_level |
| cardType | `card_type` | VarChar(20) | 卡类型 | - |
| grantDays | `grant_days` | Int | 授权天数 | - |
| quantity | `quantity` | Int | 数量 | - |
| usedCount | `used_count` | Int | 已用数量 | - |
| status | `status` | VarChar(20) | 状态 | idx_redeem_batches_status_valid_until |
| validFrom | `valid_from` | DateTime | 有效期起 | - |
| validUntil | `valid_until` | DateTime | 有效期止 | idx_redeem_batches_status_valid_until |
| remark | `remark` | VarChar(255) | 备注 | - |
| createdByAdminId | `created_by_admin_id` | Char(36) | 管理员 ID | idx_redeem_batches_created_by_admin |
| createdAt | `created_at` | DateTime | 创建时间 | - |
| updatedAt | `updated_at` | DateTime | 更新时间 | - |

### 4.2 兑换码明细表 (`membership_redeem_codes`)
- **Prisma Model**: `MembershipRedeemCode`

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | 码 ID | @id (PK) |
| code | `code` | VarChar(64) | 码内容 | @unique |
| batchId | `batch_id` | Char(36) | 批次 ID | idx_redeem_codes_batch_status |
| status | `status` | VarChar(20) | 状态 | idx_redeem_codes_batch_status |
| validUntil | `valid_until` | DateTime | 有效期至 | - |
| usedByUserId | `used_by_user_id` | Char(36) | 兑换用户 | idx_redeem_codes_used_by_user |
| usedAt | `used_at` | DateTime | 兑换时间 | - |
| invalidatedByAdminId | `invalidated_by_admin_id` | Char(36) | 作废管理员 | idx_redeem_codes_invalidated_by_admin |
| invalidatedAt | `invalidated_at` | DateTime | 作废时间 | - |
| invalidReason | `invalid_reason` | VarChar(255) | 作废原因 | - |
| createdAt | `created_at` | DateTime | 创建时间 | - |
| updatedAt | `updated_at` | DateTime | 更新时间 | - |

### 4.3 兑换码使用日志表 (`membership_redeem_use_logs`)
- **Prisma Model**: `MembershipRedeemUseLog`

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | BigInt | ID | @id (PK, AI) |
| batchId | `batch_id` | Char(36) | 批次 ID | idx_redeem_use_logs_batch_used_at |
| codeId | `code_id` | Char(36) | 码 ID | - |
| userId | `user_id` | Char(36) | 用户 ID | idx_redeem_use_logs_user_used_at |
| membershipId | `membership_id` | Char(36) | 会员记录 ID | idx_redeem_use_logs_membership_id |
| grantDays | `grant_days` | Int | 授权天数 | - |
| usedAt | `used_at` | DateTime | 使用时间 | idx_redeem_use_logs_user_used_at, idx_redeem_use_logs_batch_used_at |
| remark | `remark` | VarChar(255) | 备注 | - |

### 4.4 邀请链接与访问追踪
#### 邀请重定向链接表 (`inv_redirect_link`)
- **Prisma Model**: `InvRedirectLink`

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Int | ID | @id (PK, AI) |
| randomKey | `random_key` | VarChar(64) | 随机 Key | @unique |
| inviterUid | `inviter_uid` | Char(36) | 邀请人 ID | - |
| expireAt | `expire_at` | DateTime | 过期时间 | - |
| createAt | `create_at` | DateTime | 创建时间 | - |

#### 访客追踪表 (`inv_visitor_trace`)
- **Prisma Model**: `InvVisitorTrace`

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Int | ID | @id (PK, AI) |
| traceSn | `trace_sn` | VarChar(64) | 追踪流水号 | @unique |
| inviterUid | `inviter_uid` | Char(36) | 邀请人 ID | - |
| ip | `ip` | VarChar(45) | IP 地址 | - |
| userAgent | `user_agent` | Text | UA 信息 | - |
| clickAt | `click_at` | DateTime | 点击时间 | - |
| expireAt | `expire_at` | DateTime | 过期时间 | - |

### 4.5 财务与佣金
#### 用户钱包表 (`user_wallet`)
- **Prisma Model**: `UserWallet`

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Int | ID | @id (PK, AI) |
| userId | `user_id` | Char(36) | 用户 ID | @unique |
| availableBalance | `available_balance` | Decimal | 可用余额 | - |
| frozenBalance | `frozen_balance` | Decimal | 冻结余额 | - |
| totalEarn | `total_earn` | Decimal | 累计收益 | - |
| updateAt | `update_at` | DateTime | 更新时间 | - |

#### 佣金流水表 (`commission_log`)
- **Prisma Model**: `CommissionLog`

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Int | 流水 ID | @id (PK, AI) |
| orderId | `order_id` | Char(36) | 订单 ID | - |
| inviterUid | `inviter_uid` | Char(36) | 邀请人 ID | - |
| consumeUid | `consume_uid` | Char(36) | 消费者 ID | - |
| commissionRate | `commission_rate` | Int | 佣金比例 | - |
| commissionMoney | `commission_money` | Decimal | 佣金金额 | - |
| originalConsumeMoney | `original_consume_money` | Decimal | 原始消费金额 | - |
| logType | `log_type` | Int | 日志类型 | - |
| createAt | `create_at` | DateTime | 产生时间 | - |

#### 佣金配置表 (`commission_config`)
- **Prisma Model**: `CommissionConfig`

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Int | ID | @id (PK, AI) |
| oneLevelRate | `one_level_rate` | Int | 一级返佣比例 | - |
| updateAt | `update_at` | DateTime | 更新时间 | - |

---

## 5. 后台管理模块

### 5.1 管理员表 (`admin_users`)
- **Prisma Model**: `AdminUser`

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | ID | @id (PK) |
| username | `username` | VarChar(50) | 用户名 | @unique |
| passwordHash | `password_hash` | Text | 密码 Hash | - |
| realName | `real_name` | VarChar(50) | 真实姓名 | - |
| phone | `phone` | VarChar(20) | 手机号 | @unique |
| email | `email` | VarChar(100) | 邮箱 | @unique |
| status | `status` | VarChar(20) | 状态 | idx_admin_users_status |
| remark | `remark` | Text | 备注 | - |
| lastLoginAt | `last_login_at` | DateTime | 最后登录时间 | - |
| createdAt | `created_at` | DateTime | 创建时间 | - |
| updatedAt | `updated_at` | DateTime | 更新时间 | - |

### 5.2 后台角色与权限
#### 角色表 (`admin_roles`)
- **Prisma Model**: `AdminRole`

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | ID | @id (PK) |
| code | `code` | VarChar(50) | 角色编码 | @unique |
| name | `name` | VarChar(50) | 角色名称 | @unique |
| description | `description` | VarChar(255) | 描述 | - |
| status | `status` | VarChar(20) | 状态 | idx_admin_roles_status |
| createdAt | `created_at` | DateTime | 创建时间 | - |
| updatedAt | `updated_at` | DateTime | 更新时间 | - |

#### 用户角色关联表 (`admin_user_roles`)
- **Prisma Model**: `AdminUserRole`

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | ID | @id (PK) |
| adminUserId | `admin_user_id` | Char(36) | 管理员 ID | uniq_admin_user_role (U) |
| roleId | `role_id` | Char(36) | 角色 ID | uniq_admin_user_role (U), idx_admin_user_roles_role_id |
| createdAt | `created_at` | DateTime | 创建时间 | - |

#### 角色权限表 (`admin_role_permissions`)
- **Prisma Model**: `AdminRolePermission`

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | ID | @id (PK) |
| roleId | `role_id` | Char(36) | 角色 ID | uniq_admin_role_permission (U) |
| permissionKey | `permission_key` | VarChar(120) | 权限 Key | uniq_admin_role_permission (U) |
| permissionName | `permission_name` | VarChar(120) | 权限名称 | - |
| permissionGroup | `permission_group` | VarChar(50) | 权限分组 | idx_admin_role_permission_group |
| permissionType | `permission_type` | VarChar(20) | 权限类型 | - |
| createdAt | `created_at` | DateTime | 创建时间 | - |
| updatedAt | `updated_at` | DateTime | 更新时间 | - |

### 5.3 操作审计日志表 (`admin_operation_logs`)
- **Prisma Model**: `AdminOperationLog`

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | BigInt | 日志 ID | @id (PK, AI) |
| adminUserId | `admin_user_id` | Char(36) | 操作人 | idx_admin_operation_user_created |
| module | `module` | VarChar(50) | 模块 | idx_admin_operation_module_created |
| action | `action` | VarChar(50) | 动作 | - |
| targetType | `target_type` | VarChar(50) | 目标类型 | - |
| targetId | `target_id` | VarChar(64) | 目标 ID | - |
| requestMethod | `request_method` | VarChar(10) | 请求方法 | - |
| requestPath | `request_path` | VarChar(191) | 请求路径 | - |
| requestPayload | `request_payload` | Json | 请求报文 | - |
| responseSummary | `response_summary` | VarChar(255) | 响应摘要 | - |
| ip | `ip` | VarChar(45) | IP 地址 | - |
| userAgent | `user_agent` | Text | UA 信息 | - |
| createdAt | `created_at` | DateTime | 发生时间 | idx_admin_operation_module_created, idx_admin_operation_user_created |

---

## 6. 归一化与基础支撑

### 6.1 归一化术语与别名
#### 归一化术语表 (`normalization_terms`)
- **Prisma Model**: `NormalizationTerm`

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | 术语 ID | @id (PK) |
| domain | `domain` | VarChar(30) | 领域 | uniq_normalization_terms_domain_name (U), idx_normalization_terms_domain_status, idx_normalization_terms_domain_sort, idx_normalization_terms_domain_code |
| canonicalName | `canonical_name` | VarChar(120) | 标准名 | uniq_normalization_terms_domain_name (U) |
| canonicalCode | `canonical_code` | VarChar(80) | 标准编码 | idx_normalization_terms_domain_code |
| level | `level` | VarChar(20) | 等级 | - |
| status | `status` | VarChar(20) | 状态 | idx_normalization_terms_domain_status |
| sortOrder | `sort_order` | Int | 排序 | idx_normalization_terms_domain_sort |
| metadata | `metadata` | Json | 元数据 | - |
| createdAt | `created_at` | DateTime | 创建时间 | - |
| updatedAt | `updated_at` | DateTime | 更新时间 | - |

#### 归一化别名表 (`normalization_aliases`)
- **Prisma Model**: `NormalizationAlias`

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | ID | @id (PK) |
| termId | `term_id` | Char(36) | 术语 ID | uniq_normalization_alias_term_lookup (U), idx_normalization_alias_term_status |
| aliasName | `alias_name` | VarChar(120) | 别名 | - |
| aliasNormalized | `alias_normalized` | VarChar(120) | 归一化别名 | uniq_normalization_alias_term_lookup (U), idx_normalization_alias_lookup_status |
| matchMode | `match_mode` | VarChar(20) | 匹配模式 | - |
| status | `status` | VarChar(20) | 状态 | idx_normalization_alias_lookup_status, idx_normalization_alias_term_status |
| source | `source` | VarChar(30) | 来源 | - |
| sortOrder | `sort_order` | Int | 排序 | - |
| createdAt | `created_at` | DateTime | 创建时间 | - |
| updatedAt | `updated_at` | DateTime | 更新时间 | - |

### 6.2 行政区划层级表 (`location_hierarchies`)
- **Prisma Model**: `LocationHierarchy`

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | ID | @id (PK) |
| provinceTermId | `province_term_id` | Char(36) | 省份术语 ID | uniq_location_hierarchy_province_city (U), idx_location_hierarchy_province_status |
| cityTermId | `city_term_id` | Char(36) | 城市术语 ID | @unique, uniq_location_hierarchy_province_city (U), idx_location_hierarchy_city_status |
| status | `status` | VarChar(20) | 状态 | idx_location_hierarchy_province_status, idx_location_hierarchy_city_status |
| createdAt | `created_at` | DateTime | 创建时间 | - |
| updatedAt | `updated_at` | DateTime | 更新时间 | - |

### 6.3 邀请绑定日志表 (`inv_bind_log`)
- **Prisma Model**: `InvBindLog`

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Int | ID | @id (PK, AI) |
| inviterUid | `inviter_uid` | Char(36) | 邀请人 ID | - |
| newUserUid | `new_user_uid` | Char(36) | 新用户 ID | - |
| bindTime | `bind_time` | DateTime | 绑定时间 | - |

### 6.4 岗位推荐算法配置表 (`jobs_recommendation_config`)
- **Prisma Model**: `JobsRecommendationConfig`

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Int | ID | @id (PK, AI) |
| companyWeight | `company_weight` | Int | 公司权重 | - |
| jobWeight | `job_weight` | Int | 岗位权重 | - |
| cityExactWeight | `city_exact_weight` | Int | 城市精确匹配权重 | - |
| cityParentWeight | `city_parent_weight` | Int | 城市父级匹配权重 | - |
| degreeWeight | `degree_weight` | Int | 学历权重 | - |
| majorWeight | `major_weight` | Int | 专业权重 | - |
| fresh3DaysWeight | `fresh_3_days_weight` | Int | 3天内上新权重 | - |
| fresh7DaysWeight | `fresh_7_days_weight` | Int | 7天内上新权重 | - |
| stateOwnedFallbackWeight | `state_owned_fallback_weight` | Int | 国企保底权重 | - |
| deliveredPenalty | `delivered_penalty` | Int | 已投递惩罚分 | - |
| heatMax | `heat_max` | Int | 热度上限分 | - |
| hotAccessThreshold | `hot_access_threshold` | Int | 热门访问阈值 | - |
| hotDeliveryThreshold | `hot_delivery_threshold` | Int | 热门投递阈值 | - |
| updatedAt | `updated_at` | DateTime | 更新时间 | - |

### 6.5 前台角色与权限
#### 角色表 (`member_roles`)
- **Prisma Model**: `MemberRole`

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | ID | @id (PK) |
| code | `code` | VarChar(50) | 角色编码 | @unique |
| name | `name` | VarChar(50) | 角色名称 | @unique |
| description | `description` | VarChar(255) | 描述 | - |
| status | `status` | VarChar(20) | 状态 | idx_member_roles_status |
| isSystem | `is_system` | Boolean | 是否系统预设 | - |
| sortOrder | `sort_order` | Int | 排序 | idx_member_roles_sort_order |
| createdAt | `created_at` | DateTime | 创建时间 | - |
| updatedAt | `updated_at` | DateTime | 更新时间 | - |

#### 角色权限表 (`member_role_permissions`)
- **Prisma Model**: `MemberRolePermission`

| 字段原名 | 物理列名 | 类型 | 描述 | 约束/索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | `id` | Char(36) | ID | @id (PK) |
| roleId | `role_id` | Char(36) | 角色 ID | uniq_member_role_permission (U) |
| permissionKey | `permission_key` | VarChar(120) | 权限 Key | uniq_member_role_permission (U) |
| permissionName | `permission_name` | VarChar(120) | 权限名称 | - |
| permissionGroup | `permission_group` | VarChar(50) | 权限分组 | idx_member_role_permission_group |
| permissionType | `permission_type` | VarChar(20) | 权限类型 | - |
| createdAt | `created_at` | DateTime | 创建时间 | - |
| updatedAt | `updated_at` | DateTime | 更新时间 | - |

---

*文档同步时间：2026-05-05 12:45*
*数据源：apps/api/prisma/schema.prisma*
