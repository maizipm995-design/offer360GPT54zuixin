# Offer360 数据库业务手册 (技术+业务对照版)

本手册由自动化任务实时同步，监控 `apps/api/prisma/schema.prisma` 变更并解析。涵盖全站 30+ 物理表及其字段的技术实现与业务释义对照。

## 1. 核心求职业务

### 1.1 招聘公告表 (`job_announcements`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 岗位唯一编号 | PRIMARY KEY |
| companyFullName | company_full_name | VarChar(191) | 企业全称 | idx_jobs_company_full_name |
| enterpriseNature | enterprise_nature | VarChar(50) | 企业性质 | idx_jobs_nature |
| degreeRequirement | degree_requirement | VarChar(50) | 学历要求 | idx_jobs_degree |
| workLocation | work_location | LongText | 工作地点 | - |
| jobName | job_name | Text | 岗位名称 | - |
| jobCategory | job_category | Text | 岗位类别 | - |
| recruitmentType | recruitment_type | VarChar(50) | 招聘类型 | idx_jobs_recruitment_type |
| deadlineAt | deadline_at | Text | 截止日期 | - |
| announcementUrl | announcement_url | Text | 公告原文链接 | - |
| deliveryUrl | delivery_url | Text | 投递入口链接 | - |
| graduationSession | graduation_session | LongText | 面向届别 | - |
| referralCode | referral_code | Text | 内推码 | - |
| announcementTitle | announcement_title | VarChar(255) | 公告标题 | - |
| industry | industry | VarChar(100) | 行业领域 | - |
| entryDate | entry_date | Text | 录入日期 | - |
| accessClickCount | access_click_count | Int | 累计访问量 | idx_jobs_access_click_updated_at |
| deliveryMarkCount | delivery_mark_count | Int | 投递标记量 | idx_jobs_delivery_mark_updated_at |
| lastAccessAt | last_access_at | DateTime(0) | 最后访问时间 | - |
| lastDeliveryMarkAt | last_delivery_mark_at | DateTime(0) | 最后投递标记时间 | - |
| status | status | VarChar(20) | 发布状态 | idx_jobs_status_updated_at |
| createdAt | created_at | DateTime(0) | 创建时间 | - |
| updatedAt | updated_at | DateTime(0) | 更新时间 | idx_jobs_updated_at |

### 1.2 用户主表 (`users`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 用户唯一编号 | PRIMARY KEY |
| phone | phone | VarChar(20) | 手机号 | UNIQUE |
| passwordHash | password_hash | Text | 密码哈希 | - |
| myInviteCode | my_invite_code | VarChar(32) | 个人邀请码 | UNIQUE |
| parentUid | parent_uid | Char(36) | 邀请人 ID | idx_users_parent_uid |
| status | status | VarChar(20) | 账号状态 | idx_users_status |
| sourceType | source_type | VarChar(50) | 来源类型 | idx_users_source_type |
| wechatOpenId | wechat_open_id | VarChar(64) | 微信 OpenID | UNIQUE |
| createdAt | created_at | DateTime(0) | 注册时间 | - |
| lastLoginAt | last_login_at | DateTime(0) | 最后登录时间 | - |
| resumePdfExportCount | resume_pdf_export_count | Int | 简历 PDF 导出次数 | - |

### 1.3 用户资料详情表 (`user_profiles`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 资料唯一编号 | PRIMARY KEY |
| userId | user_id | Char(36) | 所属用户 ID | UNIQUE |
| name | name | VarChar(100) | 真实姓名 | - |
| graduationYear | graduation_year | Int | 毕业年份 | - |
| degree | degree | VarChar(20) | 最高学历 | - |
| schoolName | school_name | VarChar(120) | 学校名称 | - |
| major | major | VarChar(120) | 所学专业 | - |
| updatedAt | updated_at | DateTime(0) | 最后更新时间 | - |

### 1.4 用户求职意向表 (`user_job_preference_tags`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | BigInt | 意向记录 ID | PRIMARY KEY |
| userId | user_id | Char(36) | 所属用户 ID | UNIQUE |
| intentionCity | intention_city | Json | 意向城市 | - |
| intentionJob | intention_job | Json | 意向岗位 | - |
| intentionCompany | intention_company | Json | 意向公司 | - |
| createTime | create_time | DateTime(0) | 创建时间 | - |
| updateTime | update_time | DateTime(0) | 更新时间 | - |

### 1.5 求职进度追踪表 (`user_job_tracking`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 追踪记录 ID | PRIMARY KEY |
| userId | user_id | Char(36) | 操作用户 ID | uniq_user_job_tracking |
| jobId | job_id | Char(36) | 对应岗位 ID | uniq_user_job_tracking |
| progressStatus | progress_status | VarChar(30) | 求职进度状态 | idx_tracking_progress |
| createdAt | created_at | DateTime(0) | 创建时间 | - |
| updatedAt | updated_at | DateTime(0) | 更新时间 | - |

## 2. 会员权益体系

### 2.1 用户会员身份表 (`user_memberships`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 记录编号 | PRIMARY KEY |
| userId | user_id | Char(36) | 用户 ID | UNIQUE |
| memberLevel | member_level | VarChar(30) | 会员等级 | idx_user_memberships_member_level |
| startAt | start_at | DateTime(0) | 生效时间 | - |
| endAt | end_at | DateTime(0) | 到期时间 | - |
| remainingDays | remaining_days | Int | 剩余天数 | - |
| sourceType | source_type | VarChar(30) | 来源方式 | idx_user_memberships_source_type |
| sourceRemark | source_remark | VarChar(255) | 来源备注 | - |
| openedByAdminId | opened_by_admin_id | Char(36) | 操作管理员 | idx_user_memberships_opened_by_admin |
| createdAt | created_at | DateTime(0) | 创建时间 | - |
| updatedAt | updated_at | DateTime(0) | 更新时间 | - |

### 2.2 会员权益富文本内容表 (`membership_rich_text_contents`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 内容 ID | PRIMARY KEY |
| slug | slug | VarChar(100) | 标识别名 | UNIQUE, idx_membership_content_slug_status |
| title | title | VarChar(120) | 页面标题 | - |
| htmlContent | html_content | LongText | HTML 源码 | - |
| status | status | VarChar(20) | 发布状态 | idx_membership_content_slug_status |
| version | version | Int | 版本号 | - |
| publishedAt | published_at | DateTime(0) | 发布时间 | - |
| publishedByAdminId | published_by_admin_id | Char(36) | 发布管理员 | idx_membership_content_published_by_admin |
| createdAt | created_at | DateTime(0) | 创建时间 | - |
| updatedAt | updated_at | DateTime(0) | 更新时间 | - |

### 2.3 会员角色表 (`member_roles`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 角色编号 | PRIMARY KEY |
| code | code | VarChar(50) | 角色代码 | UNIQUE |
| name | name | VarChar(50) | 角色名称 | UNIQUE |
| description | description | VarChar(255) | 描述 | - |
| status | status | VarChar(20) | 状态 | idx_member_roles_status |
| isSystem | is_system | Boolean | 系统预置 | - |
| sortOrder | sort_order | Int | 排序权重 | idx_member_roles_sort_order |
| createdAt | created_at | DateTime(0) | 创建时间 | - |
| updatedAt | updated_at | DateTime(0) | 更新时间 | - |

### 2.4 会员权限配置表 (`member_role_permissions`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 权限配置 ID | PRIMARY KEY |
| roleId | role_id | Char(36) | 关联角色 ID | uniq_member_role_permission |
| permissionKey | permission_key | VarChar(120) | 权限唯一码 | uniq_member_role_permission |
| permissionName | permission_name | VarChar(120) | 权限名称 | - |
| permissionGroup | permission_group | VarChar(50) | 权限分组 | idx_member_role_permission_group |
| permissionType | permission_type | VarChar(20) | 权限类型 | - |
| createdAt | created_at | DateTime(0) | 创建时间 | - |
| updatedAt | updated_at | DateTime(0) | 更新时间 | - |

### 2.5 兑换码批次表 (`membership_redeem_code_batches`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 批次 ID | PRIMARY KEY |
| batchNo | batch_no | VarChar(32) | 批次号 | UNIQUE |
| memberLevel | member_level | VarChar(30) | 赋予等级 | idx_redeem_batches_member_level |
| cardType | card_type | VarChar(20) | 卡片类型 | - |
| grantDays | grant_days | Int | 赠送天数 | - |
| quantity | quantity | Int | 生成数量 | - |
| usedCount | used_count | Int | 已使用数 | - |
| status | status | VarChar(20) | 批次状态 | idx_redeem_batches_status_valid_until |
| validFrom | valid_from | DateTime(0) | 开始有效期 | - |
| validUntil | valid_until | DateTime(0) | 结束有效期 | idx_redeem_batches_status_valid_until |
| remark | remark | VarChar(255) | 备注说明 | - |
| createdByAdminId | created_by_admin_id | Char(36) | 创建人 ID | idx_redeem_batches_created_by_admin |
| createdAt | created_at | DateTime(0) | 创建时间 | - |
| updatedAt | updated_at | DateTime(0) | 更新时间 | - |

### 2.6 会员兑换码表 (`membership_redeem_codes`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 码记录 ID | PRIMARY KEY |
| code | code | VarChar(64) | 兑换码内容 | UNIQUE |
| batchId | batch_id | Char(36) | 所属批次 ID | idx_redeem_codes_batch_status |
| status | status | VarChar(20) | 码状态 | idx_redeem_codes_batch_status |
| validUntil | valid_until | DateTime(0) | 最终有效期 | - |
| usedByUserId | used_by_user_id | Char(36) | 兑换用户 ID | idx_redeem_codes_used_by_user |
| usedAt | used_at | DateTime(0) | 兑换时间 | - |
| invalidatedByAdminId | invalidated_by_admin_id | Char(36) | 作废管理员 ID | idx_redeem_codes_invalidated_by_admin |
| invalidatedAt | invalidated_at | DateTime(0) | 作废时间 | - |
| invalidReason | invalid_reason | VarChar(255) | 作废原因 | - |
| createdAt | created_at | DateTime(0) | 创建时间 | - |
| updatedAt | updated_at | DateTime(0) | 更新时间 | - |

### 2.7 兑换码使用日志表 (`membership_redeem_use_logs`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | BigInt | 日志 ID | PRIMARY KEY |
| batchId | batch_id | Char(36) | 关联批次 | idx_redeem_use_logs_batch_used_at |
| codeId | code_id | Char(36) | 关联具体码 | - |
| userId | user_id | Char(36) | 操作用户 | idx_redeem_use_logs_user_used_at |
| membershipId | membership_id | Char(36) | 关联会员记录 ID | idx_redeem_use_logs_membership_id |
| grantDays | grant_days | Int | 实际赠送天数 | - |
| usedAt | used_at | DateTime(0) | 操作时间 | idx_redeem_use_logs_user_used_at, idx_redeem_use_logs_batch_used_at |
| remark | remark | VarChar(255) | 备注说明 | - |

## 3. 付费服务与订单

### 3.1 服务产品表 (`service_products`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 产品唯一编号 | PRIMARY KEY |
| name | name | VarChar(120) | 产品名称 | - |
| description | description | Text | 产品描述 | - |
| price | price | Decimal(10, 2) | 当前售价 | - |
| originalPrice | original_price | Decimal(10, 2) | 原始价格 | - |
| score | score | Decimal(3, 1) | 评分 | - |
| salesCount | sales_count | Int | 销量 | idx_service_products_type_status_hot |
| isHot | is_hot | Boolean | 是否热门 | idx_service_products_type_status_hot |
| status | status | Boolean | 上架状态 | idx_service_products_type_status_hot |
| productType | product_type | VarChar(20) | 产品类型 | idx_service_products_type_status_hot, idx_service_products_type_member_level |
| memberLevel | member_level | VarChar(30) | 会员等级 | idx_service_products_type_member_level |
| grantDays | grant_days | Int | 赠送天数 | - |
| detailHtml | detail_html | LongText | 详情 HTML | - |
| orderServiceText | order_service_text | Text | 订单服务说明文本 | - |
| orderServiceImageUrl | order_service_image_url | Text | 订单服务说明图片 | - |
| createdAt | created_at | DateTime(0) | 创建时间 | - |
| updatedAt | updated_at | DateTime(0) | 更新时间 | - |

### 3.2 服务订单表 (`service_orders`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 订单内码 | PRIMARY KEY |
| orderNo | order_no | VarChar(40) | 业务订单号 | UNIQUE |
| userId | user_id | Char(36) | 下单用户 ID | idx_orders_user_created |
| productId | product_id | Char(36) | 购买产品 ID | - |
| orderType | order_type | VarChar(20) | 订单类型 | idx_orders_type_status_created |
| title | title | VarChar(120) | 订单标题 | - |
| amount | amount | Decimal(10, 2) | 订单金额 | - |
| memberLevel | member_level | VarChar(30) | 会员等级 | - |
| grantDays | grant_days | Int | 赠送天数 | - |
| payStatus | pay_status | VarChar(20) | 支付状态 | idx_orders_pay_status_created, idx_orders_type_status_created, idx_orders_expire_status |
| payChannel | pay_channel | VarChar(30) | 支付渠道 | - |
| payScene | pay_scene | VarChar(20) | 支付场景 | - |
| wechatOpenId | wechat_open_id | VarChar(64) | 微信 OpenID | - |
| wechatPrepayId | wechat_prepay_id | VarChar(100) | 微信预支付 ID | - |
| wechatCodeUrl | wechat_code_url | Text | 微信支付二维码链接 | - |
| wechatH5Url | wechat_h5_url | Text | 微信 H5 支付链接 | - |
| wechatTransactionId | wechat_transaction_id | VarChar(64) | 微信交易号 | idx_orders_wechat_transaction |
| callbackPayload | callback_payload | Json | 回调原始报文 | - |
| payTime | pay_time | DateTime(0) | 支付时间 | - |
| expireAt | expire_at | DateTime(0) | 订单有效期 | idx_orders_expire_status |
| closedAt | closed_at | DateTime(0) | 关闭时间 | - |
| refundReason | refund_reason | VarChar(255) | 退款原因 | - |
| refundAt | refund_at | DateTime(0) | 退款时间 | - |
| remark | remark | Text | 订单备注 | - |
| createdAt | created_at | DateTime(0) | 创建时间 | idx_orders_user_created, idx_orders_pay_status_created, idx_orders_type_status_created |
| updatedAt | updated_at | DateTime(0) | 更新时间 | - |

## 4. 分销推荐与营销

### 4.1 邀请短链重定向表 (`inv_redirect_link`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Int | 记录 ID | PRIMARY KEY |
| randomKey | random_key | VarChar(64) | 链接随机码 | UNIQUE |
| inviterUid | inviter_uid | Char(36) | 邀请人 ID | - |
| expireAt | expire_at | DateTime(0) | 失效时间 | - |
| createAt | create_at | DateTime(0) | 生成时间 | - |

### 4.2 邀请访客追踪表 (`inv_visitor_trace`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Int | 追踪记录 ID | PRIMARY KEY |
| traceSn | trace_sn | VarChar(64) | 追踪唯一流水号 | UNIQUE |
| inviterUid | inviter_uid | Char(36) | 归属邀请人 | - |
| ip | ip | VarChar(45) | 访客 IP | - |
| userAgent | user_agent | Text | 浏览器指纹 | - |
| clickAt | click_at | DateTime(0) | 点击时间 | - |
| expireAt | expire_at | DateTime(0) | 缓存失效时间 | - |

### 4.3 用户钱包表 (`user_wallet`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Int | 钱包编号 | PRIMARY KEY |
| userId | user_id | Char(36) | 所属用户 ID | UNIQUE |
| availableBalance | available_balance | Decimal(10, 2) | 可用余额 | - |
| frozenBalance | frozen_balance | Decimal(10, 2) | 冻结金额 | - |
| totalEarn | total_earn | Decimal(10, 2) | 累计总收益 | - |
| updateAt | update_at | DateTime(0) | 最近更新时间 | - |

### 4.4 佣金流水日志表 (`commission_log`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Int | 流水 ID | PRIMARY KEY |
| orderId | order_id | Char(36) | 触发订单 ID | - |
| inviterUid | inviter_uid | Char(36) | 获利者 ID | - |
| consumeUid | consume_uid | Char(36) | 消费者 ID | - |
| commissionRate | commission_rate | Int | 返佣比例 | - |
| commissionMoney | commission_money | Decimal(10, 2) | 佣金金额 | - |
| originalConsumeMoney | original_consume_money | Decimal(10, 2) | 订单原价 | - |
| logType | log_type | Int | 日志类型 | - |
| createAt | create_at | DateTime(0) | 产生时间 | - |

### 4.5 佣金全局配置表 (`commission_config`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Int | 配置 ID | PRIMARY KEY |
| oneLevelRate | one_level_rate | Int | 一级返佣比例 | - |
| updateAt | update_at | DateTime(0) | 更新时间 | - |

### 4.6 邀请绑定记录表 (`inv_bind_log`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Int | 绑定 ID | PRIMARY KEY |
| inviterUid | inviter_uid | Char(36) | 邀请人 ID | - |
| newUserUid | new_user_uid | Char(36) | 被邀请人 ID | - |
| bindTime | bind_time | DateTime(0) | 绑定时间 | - |

## 5. 系统管理与治理

### 5.1 后台管理员表 (`admin_users`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 管理员唯一编号 | PRIMARY KEY |
| username | username | VarChar(50) | 登录账号 | UNIQUE |
| passwordHash | password_hash | Text | 密码哈希 | - |
| realName | real_name | VarChar(50) | 真实姓名 | - |
| phone | phone | VarChar(20) | 手机号 | UNIQUE |
| email | email | VarChar(100) | 邮箱 | UNIQUE |
| status | status | VarChar(20) | 账号状态 | idx_admin_users_status |
| remark | remark | Text | 备注说明 | - |
| lastLoginAt | last_login_at | DateTime(0) | 最后登录时间 | - |
| createdAt | created_at | DateTime(0) | 创建时间 | - |
| updatedAt | updated_at | DateTime(0) | 更新时间 | - |

### 5.2 后台角色表 (`admin_roles`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 角色唯一编号 | PRIMARY KEY |
| code | code | VarChar(50) | 角色代码 | UNIQUE |
| name | name | VarChar(50) | 角色名称 | UNIQUE |
| description | description | VarChar(255) | 角色描述 | - |
| status | status | VarChar(20) | 状态 | idx_admin_roles_status |
| createdAt | created_at | DateTime(0) | 创建时间 | - |
| updatedAt | updated_at | DateTime(0) | 更新时间 | - |

### 5.3 管理员-角色中间表 (`admin_user_roles`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 绑定 ID | PRIMARY KEY |
| adminUserId | admin_user_id | Char(36) | 管理员 ID | uniq_admin_user_role |
| roleId | role_id | Char(36) | 角色 ID | uniq_admin_user_role, idx_admin_user_roles_role_id |
| createdAt | created_at | DateTime(0) | 绑定时间 | - |

### 5.4 后台权限权限表 (`admin_role_permissions`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 权限配置 ID | PRIMARY KEY |
| roleId | role_id | Char(36) | 所属角色 | uniq_admin_role_permission |
| permissionKey | permission_key | VarChar(120) | 权限唯一码 | uniq_admin_role_permission |
| permissionName | permission_name | VarChar(120) | 权限名称 | - |
| permissionGroup | permission_group | VarChar(50) | 权限分组 | idx_admin_role_permission_group |
| permissionType | permission_type | VarChar(20) | 权限类型 | - |
| createdAt | created_at | DateTime(0) | 创建时间 | - |
| updatedAt | updated_at | DateTime(0) | 更新时间 | - |

### 5.5 管理员操作审计日志表 (`admin_operation_logs`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | BigInt | 日志 ID | PRIMARY KEY |
| adminUserId | admin_user_id | Char(36) | 操作人 ID | idx_admin_operation_user_created |
| module | module | VarChar(50) | 模块名称 | idx_admin_operation_module_created |
| action | action | VarChar(50) | 动作类型 | - |
| targetType | target_type | VarChar(50) | 目标类型 | - |
| targetId | target_id | VarChar(64) | 目标 ID | - |
| requestMethod | request_method | VarChar(10) | 请求方式 | - |
| requestPath | request_path | VarChar(191) | 请求路径 | - |
| requestPayload | request_payload | Json | 请求参数 | - |
| responseSummary | response_summary | VarChar(255) | 响应摘要 | - |
| ip | ip | VarChar(45) | 操作 IP | - |
| userAgent | user_agent | Text | 浏览器指纹 | - |
| createdAt | created_at | DateTime(0) | 操作时间 | idx_admin_operation_module_created, idx_admin_operation_user_created |

## 6. 基础支撑与算法

### 6.1 数据归一化术语表 (`normalization_terms`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 术语内码 | PRIMARY KEY |
| domain | domain | VarChar(30) | 所属领域 | uniq_normalization_terms_domain_name, idx_normalization_terms_domain_status, idx_normalization_terms_domain_sort, idx_normalization_terms_domain_code |
| canonicalName | canonical_name | VarChar(120) | 标准名称 | uniq_normalization_terms_domain_name |
| canonicalCode | canonical_code | VarChar(80) | 标准编码 | idx_normalization_terms_domain_code |
| level | level | VarChar(20) | 层级标识 | - |
| status | status | VarChar(20) | 启用状态 | idx_normalization_terms_domain_status |
| sortOrder | sort_order | Int | 排序序号 | idx_normalization_terms_domain_sort |
| metadata | metadata | Json | 额外元数据 | - |
| createdAt | created_at | DateTime(0) | 创建时间 | - |
| updatedAt | updated_at | DateTime(0) | 更新时间 | - |

### 6.2 数据归一化别名表 (`normalization_aliases`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 别名编号 | PRIMARY KEY |
| termId | term_id | Char(36) | 关联标准术语 | uniq_normalization_alias_term_lookup, idx_normalization_alias_term_status |
| aliasName | alias_name | VarChar(120) | 原始别名 | - |
| aliasNormalized | alias_normalized | VarChar(120) | 归一化别名 | uniq_normalization_alias_term_lookup, idx_normalization_alias_lookup_status |
| matchMode | match_mode | VarChar(20) | 匹配模式 | - |
| status | status | VarChar(20) | 启用状态 | idx_normalization_alias_lookup_status, idx_normalization_alias_term_status |
| source | source | VarChar(30) | 来源标记 | - |
| sortOrder | sort_order | Int | 排序权重 | - |
| createdAt | created_at | DateTime(0) | 创建时间 | - |
| updatedAt | updated_at | DateTime(0) | 更新时间 | - |

### 6.3 行政区域层级表 (`location_hierarchies`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 层级 ID | PRIMARY KEY |
| provinceTermId | province_term_id | Char(36) | 所属省份术语 | uniq_location_hierarchy_province_city, idx_location_hierarchy_province_status |
| cityTermId | city_term_id | Char(36) | 对应城市术语 | UNIQUE, uniq_location_hierarchy_province_city, idx_location_hierarchy_city_status |
| status | status | VarChar(20) | 状态 | idx_location_hierarchy_province_status, idx_location_hierarchy_city_status |
| createdAt | created_at | DateTime(0) | 创建时间 | - |
| updatedAt | updated_at | DateTime(0) | 更新时间 | - |

### 6.4 专属推荐算法配置表 (`jobs_recommendation_config`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Int | 配置 ID | PRIMARY KEY |
| companyWeight | company_weight | Int | 公司匹配权重 | - |
| jobWeight | job_weight | Int | 岗位匹配权重 | - |
| cityExactWeight | city_exact_weight | Int | 城市精确权重 | - |
| cityParentWeight | city_parent_weight | Int | 城市上级权重 | - |
| degreeWeight | degree_weight | Int | 学历权重 | - |
| majorWeight | major_weight | Int | 专业权重 | - |
| fresh3DaysWeight | fresh_3_days_weight | Int | 3天内上新加分 | - |
| fresh7DaysWeight | fresh_7_days_weight | Int | 7天内上新加分 | - |
| stateOwnedFallbackWeight | state_owned_fallback_weight | Int | 央国企兜底分 | - |
| deliveredPenalty | delivered_penalty | Int | 已投递惩罚分 | - |
| heatMax | heat_max | Int | 热度上限 | - |
| hotAccessThreshold | hot_access_threshold | Int | 热门访问阈值 | - |
| hotDeliveryThreshold | hot_delivery_threshold | Int | 热门投递阈值 | - |
| updatedAt | updated_at | DateTime(0) | 最近修改时间 | - |

## 7. 其他支撑表

### 7.1 手机验证码表 (`phone_verification_codes`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 记录 ID | PRIMARY KEY |
| phone | phone | VarChar(20) | 手机号 | uniq_phone_verification_phone_business |
| business | business | VarChar(30) | 业务类型 | uniq_phone_verification_phone_business, idx_phone_verification_business_expires |
| codeHash | code_hash | VarChar(128) | 验证码哈希 | - |
| expiresAt | expires_at | DateTime(0) | 过期时间 | idx_phone_verification_business_expires |
| lastSentAt | last_sent_at | DateTime(0) | 最后发送时间 | - |
| verifiedAt | verified_at | DateTime(0) | 验证时间 | - |
| sendCount | send_count | Int | 发送次数 | - |
| createdAt | created_at | DateTime(0) | 创建时间 | - |
| updatedAt | updated_at | DateTime(0) | 更新时间 | - |

### 7.2 简历草稿表 (`resume_drafts`)
| 原名 | 物理列名 | 类型 | 业务释义 | 索引 |
| :--- | :--- | :--- | :--- | :--- |
| id | id | Char(36) | 简历 ID | PRIMARY KEY |
| userId | user_id | Char(36) | 所属用户 ID | idx_resume_drafts_user_updated_at |
| title | title | VarChar(120) | 简历标题 | - |
| templateCode | template_code | VarChar(40) | 模板代码 | - |
| status | status | VarChar(20) | 简历状态 | idx_resume_drafts_status |
| contentJson | content_json | Json | 简历内容 | - |
| styleJson | style_json | Json | 样式配置 | - |
| layoutJson | layout_json | Json | 布局配置 | - |
| lastValidatedAt | last_validated_at | DateTime(0) | 最后校验时间 | - |
| createdAt | created_at | DateTime(0) | 创建时间 | - |
| updatedAt | updated_at | DateTime(0) | 更新时间 | idx_resume_drafts_user_updated_at |

---
**最后更新时间：2026-05-05 12:45**
