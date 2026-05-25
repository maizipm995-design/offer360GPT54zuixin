## offer360 全栈项目

基于你提供的两份文档，从零搭建的 **offer360 校招信息聚合与求职服务平台**，采用：

- **前端**：`Next.js 14` + `Tailwind CSS v3` + `Zustand`
- **后端**：`NestJS` + `Prisma`
- **存储/中间件**：`MySQL 8` + `Redis` + `Elasticsearch`
- **部署**：`Docker Compose` 负责本地与基础环境启动，生产发布配置集中在 `deploy/prod`

### 已完成模块
- **名企校招**：统计卡片、组合筛选、推荐标签、会员横幅、列表/卡片视图、无限加载、投递、求职进度、内推查看
- **个人中心**：个人信息、求职意向、邀请统计、订单列表、手机号/密码修改
- **求职服务**：服务列表、详情页、下单、订单联动、分销提成入账
- **数据层**：Prisma 模型、标准 SQL、种子数据、Swagger 接口文档
- **部署层**：`docker-compose.yml`、`scripts/deploy.sh`、环境变量模板

### 目录结构
- `apps/web`：Next.js 前端
- `apps/api`：NestJS 后端
- `packages/shared`：共享常量
- `infra/sql/schema.sql`：标准建表 SQL
- `docs/api-contract.md`：前后端对接规范
- `scripts/deploy.sh`：一键部署脚本

### 部署边界说明
- 根目录 `docker-compose.yml`：本地基础启动、功能验证、快速演示
- 根目录 `docker-compose.dev.yml`：隔离开发环境、联调环境
- `deploy/prod`：生产发布专用配置，后续 CI/CD、回滚、数据库迁移都会收敛到这里
- 自动化部署手册：`docs/自动化标准部署手册.md`
- 数据库迁移规范：`docs/数据库迁移与回滚规范.md`
- 生产参数与 CI Secrets 清单：`docs/生产环境参数与CI-Secrets清单.md`

### 隔离开发环境（推荐）
为避免与本机其他项目冲突，新增了一套**独立开发栈**：

- **命名前缀**：`gpt54-o360-dev`
- **容器/网络/卷命名规则**：统一自动带该前缀，与现有 `offer360-*` 环境彻底区分
- **独立端口**：`13000(web)`、`14000(api)`、`13306(mysql)`、`16379(redis)`、`19200(elasticsearch)`

启动：
```bash
bash scripts/dev-up.sh
```

停止：
```bash
bash scripts/dev-down.sh
```

如需自定义端口或栈名前缀，请修改根目录 `.env`。

### 本地源码开发
```bash
npm install
npm run db:generate
# 先确保根目录 .env 对应的 MySQL 已启动，再执行
npm run db:seed
npm run dev:api
npm run dev:web
```

### 微信支付 Cloudflare Tunnel 本地联调
若你当前没有正式备案域名，但需要先用临时 HTTPS 外网域名跑通微信支付下单、唤起支付、异步回调与订单状态同步，请直接参考：

- `docs/微信支付-Cloudflare临时域名本地联调.md`

当前项目已支持将：

- `WEB_APP_BASE_URL` 用作前端公开访问 / OAuth / H5 回跳域名
- `WECHAT_PAY_NOTIFY_URL` 用作微信支付异步通知地址
- `WECHAT_PAY_REFUND_NOTIFY_URL` 用作微信退款异步通知地址

推荐使用 **前端一个 Tunnel + 后端一个 Tunnel** 的双域名方式本地联调，后续上线时再替换为正式域名。

### API 宿主机直跑模式（推荐用于快速联调）
当 `docker compose up -d --build api` 卡住，或只想让 `api` 吃到最新源码而继续复用 Docker 里的 MySQL / Redis / Elasticsearch 时，可改用：

```bash
npm run dev:api:host
```

该模式会：
- 自动确保 `mysql` / `redis` / `elasticsearch` 容器仍在运行
- 自动停止占用 `14000` 的旧 Docker `api` 容器
- 在宿主机以最新源码启动 Nest API，并默认复用 macOS 本机 `Google Chrome` 作为 Puppeteer 浏览器

停止宿主机 API：

```bash
npm run dev:api:host:stop
```

### Docker 开发环境代码刷新
当前 `docker-compose.dev.yml` 里的 `api` / `web` 使用镜像构建，不挂源码卷；因此改完这两个服务的代码后，如果继续访问旧容器，可能会出现“代码已改但新路由 / 新页面还没生效”的假象。

这时直接执行：

```bash
npm run dev:apps:rebuild
```

该命令会只重建并重启 `api` / `web` 两个容器，保留 MySQL / Redis / Elasticsearch 现状，适合日常功能联调和验收前刷新最新代码。

### 云服务器手动部署（当前基础方式）
```bash
cp .env.example .env
bash scripts/deploy.sh
```

隔离开发环境启动后访问：
- **Web**：`http://localhost:13000`
- **API**：`http://localhost:14000/api`
- **Swagger**：`http://localhost:14000/api/docs`

### 演示账号
- **手机号**：`18888888888`
- **密码**：`Offer360@123`

### 项目记录机制
- **项目现状总文档**：`docs/项目当前进度及架构记录表.md`
- **项目迭代总台账**：`docs/项目迭代总台账.md`
- **命令专项记录目录**：`docs/command-logs/`
- **命令留痕入口**：
```bash
npm run record:cmd -- --category 开发 --title "后台模块联调" --summary "执行后台模块联调命令并沉淀记录" --append-ledger -- npm run build:web
```
- **说明**：当前工作区未接入 Git 仓库，命令留痕脚本会通过“文件系统快照前后对比”自动识别新增、修改、删除文件并生成专项记录文档。

### 说明
- 招聘与服务页面采用 SSR 首屏数据加载。
- 个人中心使用真实后端接口，资料与意向修改均为自动保存。
- 邀请模块已接入邀请关系、钱包、提成流水、奖励里程碑展示。
- 当前实现已预置演示数据，便于团队直接联调和继续扩展。
