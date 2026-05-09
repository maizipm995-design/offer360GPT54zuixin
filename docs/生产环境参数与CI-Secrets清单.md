# Offer360 生产环境参数与 CI Secrets 清单

## 目标
- 让 `.env` 只承载服务器运行时所需的真实生产参数
- 让 CI 平台只保存最小必要的登录与部署凭据
- 避免 `.env`、截图、聊天记录、日志中继续散落真实生产值

## 存放原则
- `.env`
  - 只允许放本地开发或联调用占位值、测试值
  - 禁止放真实生产短信、OSS、微信支付密钥
- `.env`
  - 放服务器运行时真正需要的生产参数
  - 该文件只存在于服务器，不提交仓库
- CI Secrets
  - 只放 CI 登录镜像仓库和登录服务器所需凭据
  - 不重复保存可以放在服务器 `.env` 中的业务配置

## 一、`.env` 安全使用说明
### 1. 生成方式
在服务器上进入 `deploy/prod` 目录后执行：

```bash
cp .env.example .env
```

### 2. 填写原则
- 所有 `CHANGE_ME_*` 必须替换为真实生产值
- 所有 `YOUR_*` 必须替换为真实生产值
- 不要把 `.env` 回传到本地开发目录
- 不要把 `.env` 上传到仓库
- 不要把 `.env` 内容贴到工单、IM、截图里

### 3. 建议由服务器保存的字段
- 镜像仓库运行参数：
  - `IMAGE_REGISTRY`
  - `IMAGE_NAMESPACE`
- 对外访问与域名：
  - `SERVER_NAME`
  - `WEB_APP_BASE_URL`
  - `NEXT_PUBLIC_API_BASE_URL`
  - `NEXT_SERVER_ACTIONS_ALLOWED_ORIGINS`
  - `CORS_ORIGIN`
- 数据库与中间件：
  - `MYSQL_DATABASE`
  - `MYSQL_ROOT_PASSWORD`
  - `ES_JAVA_OPTS`
- 应用安全参数：
  - `JWT_SECRET`
  - `AUTH_CODE_SECRET`
- 短信、OSS、微信支付全部业务密钥
- 微信支付证书目录：
  - `WECHAT_PAY_CERTS_HOST_PATH`

### 4. 不建议放到 CI Secrets 的业务参数
以下内容更适合只保存在服务器 `.env`：
- `MYSQL_ROOT_PASSWORD`
- `JWT_SECRET`
- `AUTH_CODE_SECRET`
- `ALIYUN_SMS_*`
- `OSS_*`
- `WECHAT_PAY_*`

原因：
- 这些值只给生产容器运行时使用
- CI 不需要读取业务密钥明文也能完成部署
- 统一放服务器更利于权限收口

## 二、CI Secrets 清单
当前流水线文件为：
- [deploy.yml](file:///Users/maizim/Documents/2605GPT54offer360/.github/workflows/deploy.yml)

### 必填 Secrets
- `OCI_REGISTRY`
  - 用途：登录 OCI 镜像仓库
  - 示例：`registry.cn-hangzhou.aliyuncs.com`
- `OCI_NAMESPACE`
  - 用途：镜像命名空间
  - 示例：`your-namespace`
- `OCI_USERNAME`
  - 用途：镜像仓库账号
- `OCI_PASSWORD`
  - 用途：镜像仓库密码或 AccessToken
- `DEPLOY_HOST`
  - 用途：部署服务器地址
- `DEPLOY_PORT`
  - 用途：部署服务器 SSH 端口
- `DEPLOY_USER`
  - 用途：部署服务器 SSH 用户
- `DEPLOY_SSH_KEY`
  - 用途：CI 登录服务器的私钥
- `DEPLOY_ROOT`
  - 用途：服务器部署目录
  - 推荐值：`/opt/offer360/deploy/prod`

### 可选补充
- 如果你后续要把生产业务参数也改成 CI 下发，再额外增加对应 Secrets
- 但当前推荐方案是不这么做，而是让服务器本地 `.env` 承载业务参数

## 三、当前文件与参数归属建议
### 本地开发文件
- `.env`
  - 现在已经清理掉真实生产密钥
  - 若要本地联调，请改填测试值或临时值

### 模板文件
- `.env.example`
- `.env.example`
- `.env.example`
  - 这些文件只保留字段结构与占位符

### 服务器文件
- `.env`
  - 存放真实生产值

### CI 平台
- 仅保存：
  - 镜像仓库登录信息
  - 服务器 SSH 登录信息
  - 部署根目录

## 四、建议立刻执行的安全动作
- 轮换已经暴露过的生产级密钥：
  - 阿里云 `AK/SK`
  - OSS 相关访问密钥与 STS 角色策略
  - 微信 `AppSecret`
  - 微信支付 `API V3 Key`
  - 微信支付商户公钥/证书相关标识
  - 短信服务相关密钥
- 重新生成后：
  - 只写入服务器 `.env`
  - CI 中只更新最小必要的登录 Secrets
  - 本地 `.env` 继续保持占位或测试值

## 五、推荐交接口径
- 开发同学只维护 `.env.example`
- 运维同学只维护服务器 `.env`
- 仓库管理员只维护 CI Secrets
- 任何真实生产密钥都不再进入 Git 工作区长期保存
