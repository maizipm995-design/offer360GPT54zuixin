# 阿里云 OSS 对接规划方案

## 1. 目标

- 全站文件存储统一收口到阿里云 OSS。
- 废弃原有“双 Bucket / 公私分桶”方案，改为“单 Bucket + 私有读写 + 桶内目录分类”。
- 所有文件访问统一走后端签名 URL，不再依赖任何公开读 URL。
- 对接优先使用阿里云官方原生 SDK；当前项目继续沿用 `NestJS API + Next.js Web`，不新增 Go 上传网关。

## 2. 架构结论

### 2.1 最终架构

- 只使用 **1 个 OSS Bucket**
- Bucket 权限统一设置为 **私有读写**
- 所有文件通过 **桶内目录** 做业务分类
- 浏览器上传采用 **前端直传 OSS + 后端签发 STS 临时凭证**
- 前端展示图片、下载简历、访问运营图片时，统一由后端生成 **短时效签名 URL**

### 2.2 为什么不再使用双 Bucket

- 当前业务里真正需要的是“按业务分类管理对象”，而不是“按 Bucket 粗粒度拆分”
- 双 Bucket 会带来更多环境变量、权限配置、运维排障和历史迁移成本
- 单桶私有化后，权限边界回到后端签名层，访问口径更统一
- 后续即使扩展到运营图片、配置图片、富文本图片，也仍然可以通过目录和签名方式控制

## 3. 文件资产盘点

### 3.1 需要纳入 OSS 的长期文件类型

1. 简历头像
   - 当前字段：`ResumeContent.personal.avatarUrl`
   - 当前入口：简历编辑器上传头像
   - 存储方式：保存 `objectKey`，展示时签名

2. 简历教育经历校徽
   - 当前字段：`ResumeEducationEntry.logoUrl`
   - 当前入口：简历编辑器上传校徽
   - 存储方式：保存 `objectKey`，展示时签名

3. 简历 PDF 导出文件
   - 当前入口：简历导出 PDF
   - 存储方式：服务端生成 PDF 后上传到 OSS，再返回临时签名下载链接

4. 服务商品订单服务弹窗配图
   - 当前字段：`ServiceProduct.orderServiceImageUrl`
   - 当前入口：后台服务商品管理页
   - 存储方式：保存 `objectKey`，展示时签名

5. 服务商品详情富文本内嵌图片
   - 当前字段：`ServiceProduct.detailHtml`
   - 当前入口：后台服务商品管理页 HTML 富文本
   - 存储方式：HTML 内保存对象访问标识，渲染前或接口返回前转成签名 URL

6. 会员权益富文本内嵌图片
   - 当前字段：`MembershipRichTextContent.htmlContent`
   - 当前入口：后台会员权益内容页
   - 存储方式：同上

7. 我的求职之路富文本内嵌图片
   - 当前字段：`MembershipRichTextContent.htmlContent`
   - 当前入口：后台“我的求职之路”内容页
   - 存储方式：同上

8. 网站运营配置类图片或文件
   - 例如：站点配置图、默认展示素材、活动配置素材
   - 存储方式：保存 `objectKey`，访问时签名

### 3.2 当前不纳入本轮改造的临时文件

- Excel / CSV 导入文件
- 导出后立即返回且不需要长期留存的临时文本文件
- 微信支付二维码、H5 支付链接等第三方运行时 URL

这些对象不属于当前 OSS 单桶私有化改造重点，本轮不主动扩展。

## 4. 技术选型

### 4.1 运行环境

- 服务端：`NestJS 10`
- 前端：`Next.js 14`
- 存储 SDK：阿里云官方 `ali-oss`
- STS SDK：阿里云官方 `@alicloud/sts20150401`

### 4.2 上传方案

- 推荐：`前端直传 OSS + API 签发 STS`
- 不采用：`浏览器上传到 API，再由 API 转传 OSS`

原因：

- 减少 API 带宽和内存占用
- 上传体验更稳定
- 更容易按场景约束目录、大小、MIME、业务 ID

### 4.3 读取方案

- 所有读取统一由后端通过 `ali-oss` 生成签名 URL
- 数据库存储 **对象 Key / 内部标识**，不长期存储签名 URL
- 签名 URL 仅作为运行时返回字段使用，到期自动失效

## 5. 存储目录规划

## 5.1 目录规则

统一规则：

`一级业务目录/二级场景目录/业务ID/年份/月/文件名`

文件名建议：

`{actorType}-{actorId}-{uuid}.{ext}`

### 5.2 目录清单

- `avatars/`
  - 用户头像

- `school-logos/`
  - 简历教育经历校徽

- `resumes/exports/`
  - 导出的 PDF 简历

- `service-products/order-images/`
  - 服务商品订单服务弹窗配图

- `service-products/detail-images/`
  - 服务商品详情富文本图片

- `site-content/membership/`
  - 会员权益富文本图片

- `site-content/career-journey/`
  - 我的求职之路富文本图片

- `site-config/`
  - 网站运营配置类文件

### 5.3 对象 Key 示例

- `avatars/{resumeId}/{yyyy}/{mm}/user-{userId}-{uuid}.jpg`
- `school-logos/{resumeId}/{yyyy}/{mm}/user-{userId}-{uuid}.png`
- `resumes/exports/{resumeId}/{yyyy}/{mm}/user-{userId}-{uuid}.pdf`
- `service-products/order-images/{productId}/{yyyy}/{mm}/admin-{adminId}-{uuid}.webp`
- `site-content/membership/{slug}/{yyyy}/{mm}/admin-{adminId}-{uuid}.jpg`

## 6. 数据存储口径

### 6.1 数据库 / JSON 中保存什么

- 统一保存 `objectKey`
- 不保存公开 URL
- 不长期保存签名 URL
- 历史兼容期内，如字段里已有 `http(s)` 或 `data:` 值，读取时兼容展示，但新上传统一改为 `objectKey`

### 6.2 接口返回什么

- 上传接口返回：
  - `bucket`
  - `endpoint`
  - `objectKey`
  - STS 临时凭证
  - 可选的短时预览签名 URL

- 读取接口返回：
  - 原始业务数据
  - 运行时签名后的图片预览 URL

- 下载接口返回：
  - OSS 中导出文件的签名下载 URL
  - 文件名、MIME、过期时间

## 7. 安全约束

### 7.1 凭证安全

- 长期 `AccessKeyId / AccessKeySecret` 仅存放服务端环境变量
- 前端只获取 STS 临时凭证
- STS 权限仅允许上传到指定 Bucket 的指定对象 Key

### 7.2 文件白名单

- 图片场景仅允许：
  - `image/jpeg`
  - `image/png`
  - `image/webp`

- PDF 导出仅允许服务端写入：
  - `application/pdf`

### 7.3 文件大小

- 简历头像：2MB
- 简历校徽：2MB
- 运营图片 / 富文本图片：5MB

### 7.4 访问控制

- 所有图片展示都使用签名 URL
- 所有简历 PDF 下载都使用签名 URL
- 不允许前端拼接固定 OSS 地址直接访问
- 不允许客户端自定义上传目录

## 8. 本轮改造范围

### 8.1 文档与基础设施

- 将旧的双 Bucket 文档收敛为单桶私有方案
- 收敛环境变量，只保留单桶私有架构需要的参数
- 重构 `storage` 模块，移除 `public/private bucket` 逻辑

### 8.2 简历业务链路

- 头像上传改为：申请上传会话 -> 直传 OSS -> 保存 `objectKey`
- 校徽上传改为：申请上传会话 -> 直传 OSS -> 保存 `objectKey`
- 简历详情、打印页读取时返回签名头像与签名校徽
- PDF 导出改为：服务端生成 -> 上传 OSS -> 返回签名下载链接

### 8.3 当前不在本轮直接落地的页面

- 后台富文本图片实际上传接线
- 运营配置文件上传接线
- 历史 `data:` / 第三方 URL 数据迁移脚本

这些仍遵循本方案，但本轮只改到当前已接入的 OSS 代码和简历主链路。

## 9. 环境变量方案

本次改造后，`.env` 只保留单桶私有架构所需参数：

- `OSS_REGION`
  - 示例：`oss-cn-hangzhou`
  - 用途：OSS 区域

- `OSS_ENDPOINT`
  - 示例：`https://oss-cn-hangzhou.aliyuncs.com`
  - 用途：可选，自定义 OSS 访问端点；为空时按区域自动推导

- `OSS_BUCKET`
  - 示例：`offer360-assets`
  - 用途：唯一使用的私有 Bucket 名称

- `OSS_ACCESS_KEY_ID`
  - 用途：服务端主账号或 RAM 用户访问 Key

- `OSS_ACCESS_KEY_SECRET`
  - 用途：服务端主账号或 RAM 用户访问 Secret

- `OSS_STS_ROLE_ARN`
  - 用途：前端直传时用于签发 STS 的角色 ARN

- `OSS_STS_ENDPOINT`
  - 示例：`sts.aliyuncs.com`
  - 用途：STS 服务地址

- `OSS_UPLOAD_EXPIRE_SECONDS`
  - 示例：`900`
  - 用途：上传凭证有效期

- `OSS_SIGN_EXPIRE_SECONDS`
  - 示例：`1800`
  - 用途：图片访问 / 文件下载签名链接有效期

## 10. 实施结果要求

- 代码中不再出现公开 Bucket / 私有 Bucket 双分支逻辑
- 代码中不再依赖公开 URL / CDN URL 字段
- 简历头像、校徽、PDF 下载全部走 OSS 单桶私有链路
- 后端统一负责签名 URL 生成
- 前端统一消费签名 URL 展示与下载

## 11. 最终结论

- `Offer360` 的 OSS 最终方案定为：`单 Bucket + 私有读写 + 分目录存储 + 后端签名访问`
- 当前主链路继续采用：`NestJS + Next.js + 阿里云官方 SDK`
- 本轮先完成文档收口、存储基础层重构、简历上传展示下载打通
- 后续后台富文本与运营配置上传，继续复用本方案扩展即可
