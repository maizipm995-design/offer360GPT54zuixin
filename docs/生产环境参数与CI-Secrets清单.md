# Offer360 生产环境参数清单

## 归属原则
- 当前部署方案为本地离线镜像包上传，不再依赖 GitHub Actions、私有镜像仓库或镜像仓库登录凭据。
- 服务器 `.env` 只保存：
  - 容器运行时业务参数
  - 数据库密码
  - OSS / 短信 / 微信支付密钥
  - 域名配置
- HTTPS 证书单独保存在宿主机 `/etc/nginx/ssl/www.offer360.cn`
- 微信支付证书单独保存在宿主机 `/opt/offer360/certs`

## 服务器 `.env` 必填
### 基础运行
- `MYSQL_DATABASE`
- `MYSQL_ROOT_PASSWORD`
- `JWT_SECRET`
- `AUTH_CODE_SECRET`
- `WEB_APP_BASE_URL`
- `CORS_ORIGIN`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_SERVER_ACTIONS_ALLOWED_ORIGINS`

### 微信支付
- `WECHAT_PAY_APP_ID`
- `WECHAT_PAY_APP_SECRET`
- `WECHAT_PAY_NOTIFY_URL`
- `WECHAT_PAY_REFUND_NOTIFY_URL`
- `WECHAT_PAY_CALLBACK_BASE_URL`
- `WECHAT_PAY_MCH_ID`
- `WECHAT_PAY_MCH_CERT_SERIAL_NO`
- `WECHAT_PAY_PUBLIC_KEY_ID`
- `WECHAT_PAY_API_V3_KEY`

### 阿里云短信
- `ALIYUN_SMS_ACCESS_KEY_ID`
- `ALIYUN_SMS_ACCESS_KEY_SECRET`
- `ALIYUN_SMS_SIGN_NAME`
- `ALIYUN_SMS_TEMPLATE_CODE`

### 阿里云 OSS
- `OSS_REGION`
- `OSS_ENDPOINT`
- `OSS_BUCKET`
- `OSS_ACCESS_KEY_ID`
- `OSS_ACCESS_KEY_SECRET`
- `OSS_STS_ROLE_ARN`

## 服务器 `.env` 可保留默认值
- `API_PORT=4000`
- `AUTH_CODE_TTL_MINUTES=5`
- `AUTH_CODE_LENGTH=6`
- `ALIYUN_SMS_ENDPOINT=dysmsapi.aliyuncs.com`
- `ALIYUN_SMS_TEMPLATE_PARAM_NAME=code`
- `OSS_STS_ENDPOINT=sts.aliyuncs.com`
- `OSS_UPLOAD_EXPIRE_SECONDS=900`
- `OSS_SIGN_EXPIRE_SECONDS=1800`
- `WECHAT_PAY_ORDER_EXPIRE_MINUTES=15`
- `WEB_PORT_HOST=3000`
- `API_PORT_HOST=4000`

## 不再需要的 CI/仓库参数
- `OCI_REGISTRY`
- `OCI_NAMESPACE`
- `OCI_USERNAME`
- `OCI_PASSWORD`
- `DEPLOY_ROOT`
- `SERVER_HOST`
- `SERVER_PORT`
- `SSH_USER`
- `SSH_PASS`

## 证书目录要求
### 宿主机 Nginx 证书
- 目录：`/etc/nginx/ssl/www.offer360.cn`
- 文件：
  - `fullchain.pem`
  - `privkey.pem`

### 微信支付证书
- 目录：`/opt/offer360/certs`
- 文件名按微信支付证书实际文件放置

## `.env` 使用方式
- 如果服务器缺少 `/opt/offer360/.env`，先把仓库中的 `.env.example` 复制过去：

```bash
cp /opt/offer360/.env.example /opt/offer360/.env
```

- 所有 `CHANGE_ME_*` 都必须替换成真实值。
- 不要把服务器 `.env` 提交 Git。
- 不要把服务器 `.env` 下载回本地仓库。
- 不要把服务器 `.env` 内容发到聊天、截图或工单。

## 安全提醒
- 生产密钥、数据库密码、证书文件都只应存放在服务器本机。
- 离线镜像包传输建议走 `scp` 或 `rsync over ssh`。
- 如果服务器登录密码或第三方密钥曾在聊天中明文出现，应立即轮换。
