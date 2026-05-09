# Offer360 腾讯云 + 宝塔 + Docker 一键部署手册

## 1. 适用范围

本文档用于 `Offer360` 项目在腾讯云单机服务器上的生产部署，目标是：

- 使用 Docker 方式打包和运行整站服务
- 使用 Nginx 统一对外暴露 `80/443`
- 保留宝塔面板，便于后续运维和监控
- 形成可复用的一键部署流程

当前服务器信息：

- 云厂商：腾讯云 CVM
- 公网 IP：`175.24.133.232`
- SSH 用户：`ubuntu`
- 实际系统：`Ubuntu 24.04.4 LTS`
- 域名目标：`www.offer360.cn`

## 2. 当前现状

当前已完成：

- Docker 安装完成
- Docker Compose 安装完成
- 宝塔面板安装完成
- 宝塔端口已可访问

当前仍需注意：

- `www.offer360.cn` 和 `offer360.cn` 当前解析到 `124.237.177.228`
- 还没有解析到本次部署服务器 `175.24.133.232`
- 因此可以先完成服务器部署，但正式通过域名访问前，必须先完成 DNS 切换

## 3. 本次新增文件

本次为了避免影响你当前仓库里已有改动，只新增了独立的生产部署文件：

- `deploy/prod/docker-compose.prod.yml`
- `.env.example`
- `deploy/prod/nginx/offer360.conf`
- `scripts/deploy-prod-oneclick.sh`

## 4. 生产部署架构

本次部署采用如下结构：

- `mysql`：业务数据库
- `redis`：缓存
- `elasticsearch`：搜索
- `api`：NestJS 后端
- `web`：Next.js 前端
- `wechat-pay-gateway`：微信支付 Go 网关
- `nginx`：宿主机 Nginx，统一反代到 `web`

### 4.1 当前容器运行架构结论

当前系统不是“单个 Docker 容器运行所有服务”，而是“多容器独立部署架构”：

- 前端：`web` 独立容器
- 后端：`api` 独立容器
- 数据库：`mysql` 独立容器
- 缓存：`redis` 独立容器
- 搜索：`elasticsearch` 独立容器
- 支付网关：`wechat-pay-gateway` 独立容器
- 反向代理：宿主机 `nginx`

也就是说，当前采用的是分布式职责拆分方式，而不是单容器“大杂烩”部署。

外部访问路径：

- 浏览器访问 `http://www.offer360.cn` 或 `http://175.24.133.232`
- 宿主机 Nginx 转发到 `127.0.0.1:3000`
- `web` 再通过 `INTERNAL_API_BASE_URL=http://api:4000/api` 访问后端
- 浏览器侧 API 统一走 `/api/proxy/*`

## 5. 推荐目录结构

服务器建议使用以下目录：

```text
/srv/offer360/
  app/                      # 项目代码
  app/deploy/prod/          # 生产 compose / env / nginx 配置
```

## 6. 首次部署步骤

### 6.1 上传代码到服务器

推荐在本地项目根目录执行：

```bash
rsync -avz --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude ".next" \
  ./ ubuntu@175.24.133.232:/srv/offer360/app/
```

### 6.2 生成生产环境变量

登录服务器后执行：

```bash
cd /srv/offer360/app
cp .env.example .env
```

然后编辑：

```bash
vim .env
```

至少需要重点确认这些变量：

- `MYSQL_ROOT_PASSWORD`
- `JWT_SECRET`
- `AUTH_CODE_SECRET`
- `CORS_ORIGIN`
- `WEB_APP_BASE_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `OSS_*`
- `WECHAT_PAY_*`

说明：

- 如果微信支付证书和商户参数尚未配置，`wechat-pay-gateway` 仍可启动，但支付能力不可用
- 如果 OSS、短信等第三方参数未配置，对应功能将无法正常工作

### 6.3 启动生产容器

执行：

```bash
cd /srv/offer360/app
chmod +x scripts/deploy-prod-oneclick.sh
./scripts/deploy-prod-oneclick.sh
```

等价命令为：

```bash
docker compose \
  --env-file .env \
  -f deploy/prod/docker-compose.prod.yml \
  up -d --build --remove-orphans
```

### 6.4 查看容器状态

```bash
docker compose \
  --env-file .env \
  -f deploy/prod/docker-compose.prod.yml \
  ps
```

### 6.5 验证本机访问

```bash
curl http://127.0.0.1:3000
curl http://127.0.0.1:4000/api
curl http://127.0.0.1:4000/api/docs
curl http://127.0.0.1:15000/healthz
```

## 7. Nginx 反向代理配置

当前提供的配置文件：

- `deploy/prod/nginx/offer360.conf`

用途：

- 宿主机监听 `80`
- 统一反代到 `127.0.0.1:3000`
- 由 Next.js 统一承接页面和 `/api/proxy/*`

### 7.1 安装宿主机 Nginx

```bash
sudo apt-get update
sudo apt-get install -y nginx
```

### 7.2 安装站点配置

```bash
sudo cp deploy/prod/nginx/offer360.conf /etc/nginx/sites-available/offer360.conf
sudo ln -sf /etc/nginx/sites-available/offer360.conf /etc/nginx/sites-enabled/offer360.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

### 7.3 验证反向代理

```bash
curl -I http://127.0.0.1
curl -I http://175.24.133.232
```

## 8. 宝塔使用建议

本次服务器已经安装宝塔面板，建议用途如下：

- 查看服务器运行状态
- 管理防火墙、计划任务、文件
- 监控 Docker 运行情况

注意：

- 当前部署链路以 Docker + 宿主机 Nginx 为主
- 后续如果你想把站点纳入宝塔 Nginx 管理，可以在宝塔里安装 Nginx，再把当前反代配置迁入宝塔站点配置
- 在未完成迁移前，不建议同时让“宿主机 apt Nginx”和“宝塔 Nginx”都监听 `80/443`

## 9. 域名切换要求

要正式启用 `www.offer360.cn`，必须把 DNS 解析改到本机：

- `A 记录`：`www.offer360.cn -> 175.24.133.232`
- 如需裸域：`offer360.cn -> 175.24.133.232`

切换前：

- 只能通过服务器 IP 做预验证

切换后：

- 可通过 `http://www.offer360.cn` 访问
- 随后再申请 HTTPS 证书

## 10. HTTPS 上线建议

域名切换完成后，建议安装证书：

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d www.offer360.cn -d offer360.cn
```

证书配置完成后，需要同步确认以下变量：

- `WEB_APP_BASE_URL=https://www.offer360.cn`
- `NEXT_PUBLIC_API_BASE_URL=https://www.offer360.cn/api`
- `WECHAT_PAY_NOTIFY_URL=https://www.offer360.cn/api/proxy/payments/wechat/notify`
- `WECHAT_PAY_REFUND_NOTIFY_URL=https://www.offer360.cn/api/proxy/payments/wechat/refund/notify`
- `WECHAT_PAY_CALLBACK_BASE_URL=https://www.offer360.cn`

## 11. 后续一键部署流程

以后每次发版，建议使用下面的固定流程。

### 11.0 代码升级时需要重新打包的内容

后续版本迭代时，不是只打包前端页面文件，而是要重新打包所有与运行直接相关的代码和部署文件：

- `apps/web`：前端页面、组件、样式、管理后台页面
- `apps/api`：后端接口、权限、支付、管理后台逻辑、Prisma Schema
- `apps/wechat-pay-gateway`：微信支付 Go 网关
- `packages/shared`：前后端共用包
- `deploy/prod`：生产 Docker Compose、Nginx 配置、生产 Dockerfile、环境模板
- `scripts/deploy-prod-oneclick.sh`：一键部署脚本

如果本次迭代涉及以下内容，也必须同步：

- 数据库结构变更：`apps/api/prisma/schema.prisma`
- 初始化脚本/种子数据：`apps/api/prisma/seed.ts`
- 证书或第三方配置：`.config/certs`、`.env`

### 11.1 本地同步代码

```bash
rsync -avz --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude ".next" \
  ./ ubuntu@175.24.133.232:/srv/offer360/app/
```

### 11.2 服务器一键部署

```bash
ssh ubuntu@175.24.133.232
cd /srv/offer360/app
./scripts/deploy-prod-oneclick.sh
```

### 11.2.1 如果本次升级涉及数据库结构

在服务器执行：

```bash
cd /srv/offer360/app
docker compose \
  --env-file .env \
  -f deploy/prod/docker-compose.prod.yml \
  exec -T api sh -lc 'npx prisma db push --accept-data-loss --schema prisma/schema.prisma'
```

说明：

- 如果只是加字段、加表，通常执行 `db push` 即可
- 如果是正式生产历史数据环境，执行前必须先备份数据库
- 如果需要迁移的是业务数据，不是结构变更，则还要执行种子脚本或导入备份

### 11.2.2 如果本次升级涉及初始化数据或管理员初始化逻辑

按需执行：

```bash
cd /srv/offer360/app
docker compose \
  --env-file .env \
  -f deploy/prod/docker-compose.prod.yml \
  exec -T api sh -lc 'npm run prisma:seed'
```

### 11.3 发布后检查

```bash
docker compose \
  --env-file .env \
  -f deploy/prod/docker-compose.prod.yml \
  ps

docker compose \
  --env-file .env \
  -f deploy/prod/docker-compose.prod.yml \
  logs api --tail=100

docker compose \
  --env-file .env \
  -f deploy/prod/docker-compose.prod.yml \
  logs web --tail=100
```

## 12. 故障排查

### 12.1 域名打不开

优先检查：

- DNS 是否已解析到 `175.24.133.232`
- 腾讯云安全组是否放行 `80/443`
- 服务器 `ufw` 是否放行 `80/443`
- Nginx 是否启动成功

### 12.2 页面能打开但接口报错

优先检查：

- `web` 容器是否正常
- `api` 容器是否正常
- `INTERNAL_API_BASE_URL` 是否仍为 `http://api:4000/api`
- `DATABASE_URL` 是否正确

### 12.3 支付异常

优先检查：

- `WECHAT_PAY_*` 是否完整
- `.config/certs/` 证书文件是否上传到服务器
- 回调地址是否已经使用正式 HTTPS 域名

## 13. 最终建议

推荐按以下顺序完成正式上线：

1. 先把代码部署到服务器并确保 IP 可访问
2. 再切换 `www.offer360.cn` DNS 到 `175.24.133.232`
3. 再申请 HTTPS 证书
4. 最后验证登录、支付、上传、搜索、后台等完整链路
