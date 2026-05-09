# GitHub Webhook 自动部署与数据库增量规范

## 1. 目标
- 本地只执行 `git push`，服务器自动拉取、构建、发布。
- 部署前自动备份生产库，发布时仅执行增量结构迁移。
- 严格隔离本地开发库与线上生产库，禁止本地库覆盖线上数据。

## 2. 配置文件约定
- 统一配置源：项目根目录 `.env`。
- 模板文件：`.env.example`（只保留占位符）。
- 严禁提交：`.env`、证书私钥、数据库备份文件。

## 3. GitHub 仓库净化流程（本地）
```bash
cd /Users/maizim/Documents/2605GPT54offer360
git checkout --orphan clean-main
git add .
git commit -m "chore: clean initial import"
git branch -M main
git push -u -f origin main
```

## 4. 服务器从零重建（会清空旧 Docker）
```bash
cd /opt/offer360
cp .env.example .env
# 填写 .env 真实生产参数

RESET_CONFIRM=YES ENV_FILE=/opt/offer360/.env \
  bash deploy/prod/scripts/server-reset-rebuild.sh
```

## 5. 启用 Webhook 自动部署
### 5.1 安装监听服务
```bash
cd /opt/offer360
echo 'WEBHOOK_SECRET=请替换成你的随机长字符串' >> .env
echo 'TARGET_BRANCH=main' >> .env
echo 'GITHUB_REPO_SLUG=maizipm995-design/offer360GPT54zuixin' >> .env
echo 'GITHUB_USERNAME=你的 GitHub 用户名' >> .env
echo 'GITHUB_TOKEN=你的 GitHub Personal Access Token' >> .env
ENV_FILE=/opt/offer360/.env bash deploy/prod/scripts/install-webhook-service.sh
```

- 私有仓库必须配置 `GITHUB_USERNAME` 与 `GITHUB_TOKEN`，否则服务器无法自动 `git fetch` 或下载源码包。
- `TARGET_BRANCH` 必须与 GitHub Webhook 监听分支保持一致，当前默认是 `main`。

### 5.2 GitHub 仓库设置 Webhook
- Payload URL：`https://<你的服务器域名>/webhook/github`
- Content type：`application/json`
- Secret：与 `WEBHOOK_SECRET` 完全一致
- Event：选择 `Just the push event`
- 不要继续使用 `http://<服务器IP>/webhook/github`，在全站 HTTPS 场景下应统一改为域名 HTTPS 地址。

### 5.4 端口与反向代理规范（服务器统一约定）
- 宿主机仅 `nginx` 可占用 `80/443`。
- 所有业务服务（含 Docker 映射端口）禁止占用宿主机 `80/443`，统一使用自定义端口（如 `18080/3000/8080/9000`）。
- `nginx` 负责按域名转发到各业务端口，并统一维护 SSL 证书。
- 所有 `80` 的 HTTP 请求统一 `301` 跳转至 `443` HTTPS。
- 仓库内的生产网关会把 `https://<域名>/webhook/github` 继续转发到宿主机 `WEBHOOK_PORT`，因此宿主机防火墙需要允许本机到该端口的访问。
- 若服务器环境无法稳定直连 `github.com`，`webhook-deploy.sh` 会自动回退为从 `codeload.github.com` 下载目标分支源码包后再构建发布。
- 若仓库是私有仓库，`webhook-deploy.sh` 会优先使用 `GITHUB_TOKEN` 通过 GitHub API 下载源码包。

### 5.3 验证
- 本地推送一次：
```bash
git push origin main
```
- 服务器查看状态：
```bash
systemctl status offer360-webhook --no-pager
journalctl -u offer360-webhook -n 100 --no-pager
tail -n 100 /opt/offer360/deploy/prod/runtime/logs/webhook-deploy.log
docker compose --env-file /opt/offer360/.env -f /opt/offer360/deploy/prod/docker-compose.prod.yml ps
```

## 6. 发布链路（自动执行）
- `webhook-deploy.sh`：
  - 拉取 `main` 最新代码
  - 使用部署锁避免多个 `push` 并发发布
  - 构建 `api/web/wechat-pay-gateway` 镜像
  - 调用 `deploy-release.sh`
- `deploy-release.sh`：
  - 启动基础依赖容器
  - 调用 `backup-db.sh` 备份生产库
  - 执行 `migrator`（`prisma migrate deploy`，仅执行未执行迁移）
  - 蓝绿切换并健康检查

## 7. 数据库增量与防覆盖规则
- 结构变更只通过 Prisma migration（目录：`apps/api/prisma/migrations/*/migration.sql`）。
- 生产发布只运行 `prisma migrate deploy`，不会回放 seed，不会覆盖业务数据。
- 禁止在生产使用 `prisma db push`、禁止从本地导入整库覆盖线上。
- 生产备份目录：`deploy/prod/runtime/db-backups/`，每次部署自动新增一份 `*.sql.gz`。

## 8. 回滚与应急
### 8.1 应用回滚（不改数据）
```bash
ENV_FILE=/opt/offer360/.env ROLLBACK_SLOT=blue \
  bash deploy/prod/scripts/rollback-release.sh
```

### 8.2 数据库回滚（手动）
```bash
gunzip -c deploy/prod/runtime/db-backups/<备份文件>.sql.gz | \
docker compose --env-file /opt/offer360/.env -f deploy/prod/docker-compose.prod.yml \
  exec -T mysql sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"'
```

## 9. 日常操作最小清单
- 开发：改代码 + 生成迁移脚本 + 提交。
- 发布：`git push origin main`。
- 观察：`docker compose ... ps` + `systemctl status offer360-webhook`。
