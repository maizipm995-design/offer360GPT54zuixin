## 微信支付 Cloudflare 临时域名本地联调说明

本文用于在 **本地开发环境** 下，通过 **Cloudflare Tunnel 临时 HTTPS 域名** 跑通 `Offer360` 的微信支付全链路，包括：

- 下单
- 唤起支付（`JSAPI / H5 / Native`）
- 微信支付异步回调
- 订单状态同步
- 退款异步回调（如需验证后台退款链路）

### 推荐的域名拆分方式

本项目现已适配 **前端公开域名** 与 **后端微信回调域名** 分离配置，推荐按下面方式使用两个 Tunnel：

- **前端 Tunnel**：映射到 `Next.js`，仅负责
  - 用户访问前端页面
  - 微信 `OAuth` 回跳
  - H5 支付完成后的浏览器返回页
- **后端 Tunnel**：映射到 `NestJS`，仅负责
  - 微信支付异步通知
  - 微信退款异步通知

推荐原因：

- 微信异步通知直接进 `NestJS`，链路更短，排查更清晰
- 前端只负责页面与回跳，不再承担微信签名报文中转
- 后续正式上线时，只需要把这两个公开域名替换成正式域名即可

### 代码现状与当前口径

本轮已完成以下适配：

- `WEB_APP_BASE_URL`：前端公开访问域名
  - 用于生成微信 `OAuth` 回调地址
  - 用于生成 H5 支付返回页地址
- `WECHAT_PAY_NOTIFY_URL`：微信支付异步通知地址
  - 建议直接配置为后端 Tunnel 的 `/api/payments/wechat/notify`
- `WECHAT_PAY_REFUND_NOTIFY_URL`：微信退款异步通知地址
  - 建议直接配置为后端 Tunnel 的 `/api/payments/wechat/refund/notify`
- 若未显式配置上述两个通知地址，后端仍会回退到旧逻辑：
  - `WEB_APP_BASE_URL + /api/proxy/payments/...`
  - 但 **双 Tunnel 本地联调不建议再走这个回退路径**

### 一、先确认你的本地端口

你可以按自己的启动方式选择端口：

- **纯本地源码直跑**
  - `Next.js`: `3000`
  - `NestJS`: `4000`
- **当前仓库推荐的隔离开发栈**
  - `Next.js`: `13000`
  - `NestJS`: `14000`

下面示例同时给出两种写法，请按你实际端口替换。

### 二、启动 Cloudflare Tunnel

当前系统是 `macOS + zsh`，推荐直接使用：

```bash
brew install cloudflared
```

#### 方案 A：你本地直跑 `Next 3000 / Nest 4000`

前端 Tunnel：

```bash
cloudflared tunnel --url http://localhost:3000
```

后端 Tunnel：

```bash
cloudflared tunnel --url http://localhost:4000
```

#### 方案 B：你使用本仓库隔离开发端口 `Next 13000 / Nest 14000`

前端 Tunnel：

```bash
cloudflared tunnel --url http://localhost:13000
```

后端 Tunnel：

```bash
cloudflared tunnel --url http://localhost:14000
```

启动后你会拿到两个临时 HTTPS 域名，例如：

- 前端：`https://offer360-web.trycloudflare.com`
- 后端：`https://offer360-api.trycloudflare.com`

### 三、填写环境变量

### 1）推荐值映射

假设：

- 前端 Tunnel：`https://offer360-web.trycloudflare.com`
- 后端 Tunnel：`https://offer360-api.trycloudflare.com`

则建议这样配置：

```env
WEB_APP_BASE_URL=https://offer360-web.trycloudflare.com
WECHAT_PAY_NOTIFY_URL=https://offer360-api.trycloudflare.com/api/payments/wechat/notify
WECHAT_PAY_REFUND_NOTIFY_URL=https://offer360-api.trycloudflare.com/api/payments/wechat/refund/notify
WECHAT_PAY_CALLBACK_BASE_URL=https://offer360-web.trycloudflare.com
```

### 2）纯本地源码直跑时的建议补充

如果你本地是 `web:3000`、`api:4000`：

```env
CORS_ORIGIN=http://localhost:3000,https://offer360-web.trycloudflare.com
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
INTERNAL_API_BASE_URL=http://localhost:4000/api
WEB_APP_BASE_URL=https://offer360-web.trycloudflare.com
WECHAT_PAY_NOTIFY_URL=https://offer360-api.trycloudflare.com/api/payments/wechat/notify
WECHAT_PAY_REFUND_NOTIFY_URL=https://offer360-api.trycloudflare.com/api/payments/wechat/refund/notify
WECHAT_PAY_CALLBACK_BASE_URL=https://offer360-web.trycloudflare.com
```

### 3）本仓库隔离开发栈时的建议补充

如果你本地是 `web:13000`、`api:14000`：

```env
CORS_ORIGIN=http://localhost:13000,https://offer360-web.trycloudflare.com
NEXT_PUBLIC_API_BASE_URL=http://localhost:14000/api
INTERNAL_API_BASE_URL=http://localhost:14000/api
WEB_APP_BASE_URL=https://offer360-web.trycloudflare.com
WECHAT_PAY_NOTIFY_URL=https://offer360-api.trycloudflare.com/api/payments/wechat/notify
WECHAT_PAY_REFUND_NOTIFY_URL=https://offer360-api.trycloudflare.com/api/payments/wechat/refund/notify
WECHAT_PAY_CALLBACK_BASE_URL=https://offer360-web.trycloudflare.com
```

### 4）如果你现在直接复用已备案正式域名 `offer360.cn`

则可以按下面这组最小配置先联调：

```env
CORS_ORIGIN=http://localhost:13000,https://offer360.cn
NEXT_PUBLIC_API_BASE_URL=https://offer360.cn/api
INTERNAL_API_BASE_URL=http://localhost:14000/api
WEB_APP_BASE_URL=https://offer360.cn
WECHAT_PAY_NOTIFY_URL=https://offer360.cn/api/proxy/payments/wechat/notify
WECHAT_PAY_REFUND_NOTIFY_URL=https://offer360.cn/api/proxy/payments/wechat/refund/notify
WECHAT_PAY_CALLBACK_BASE_URL=https://offer360.cn
```

同时还需要保证下面这些真实配置已填写：

```env
WECHAT_PAY_APP_ID=
WECHAT_PAY_APP_SECRET=
WECHAT_PAY_MCH_ID=
WECHAT_PAY_MCH_CERT_SERIAL_NO=
WECHAT_PAY_PUBLIC_KEY_ID=
WECHAT_PAY_API_V3_KEY=
WECHAT_PAY_PRIVATE_KEY_PATH=.config/certs/apiclient_key.pem
WECHAT_PAY_MCH_CERT_PATH=.config/certs/apiclient_cert.pem
WECHAT_PAY_PUBLIC_KEY_PATH=.config/certs/wechat_pay_public_key.pem
```

### 四、启动项目

#### 纯本地源码直跑

```bash
npm run dev:api
npm run dev:web
```

#### 或使用仓库隔离开发栈

```bash
bash scripts/dev-up.sh
```

### 五、完整联调链路是怎么走的

### 1）下单

前端调用：

- `POST /payments/orders`

后端创建本地订单，状态初始为 `unpaid`。

### 2）唤起支付

前端收银台调用：

- `POST /payments/orders/:orderNo/prepare`

后端会根据访问环境自动选择：

- 微信内：`JSAPI`
- 手机外部浏览器：`H5`
- 电脑端：`Native`

其中：

- `OAuth` 回调地址来自 `WEB_APP_BASE_URL`
- H5 支付返回地址来自 `WEB_APP_BASE_URL`
- 微信异步通知地址来自 `WECHAT_PAY_NOTIFY_URL`

### 3）微信支付异步回调

微信服务端回调：

```text
POST https://<api-tunnel>/api/payments/wechat/notify
```

NestJS 收到原始报文后，会调用 Go 网关解析验签并更新订单状态。

### 4）订单状态同步

前端收银台与订单页会继续轮询：

- `GET /payments/orders/:orderNo`

后端会：

- 优先读取本地订单状态
- 必要时主动查单同步微信状态
- 将已支付订单更新为 `paid`
- 将关闭订单更新为 `closed`
- 将退款处理中订单继续同步为 `refund_pending / refunded`

### 5）退款异步回调（如需）

微信退款异步回调：

```text
POST https://<api-tunnel>/api/payments/wechat/refund/notify
```

后台退款后，订单会经历：

- `paid -> refund_pending -> refunded`

如果异步通知延迟，也可以在后台订单页手动点击“同步微信状态”补偿对账。

### 六、建议的实际验证顺序

### 1）先验证基础网络

先分别打开：

- 前端 Tunnel 首页
- 后端 Tunnel 的 Swagger：`https://<api-tunnel>/api/docs`

确认两个 Tunnel 都能访问。

### 2）再验证下单

在前端 Tunnel 域名里登录，创建订单并进入 `/checkout`。

### 3）再验证支付场景

- **JSAPI**：必须在微信内打开前端 Tunnel 域名
- **H5**：手机浏览器打开前端 Tunnel 域名
- **Native**：电脑端打开前端 Tunnel 域名，扫码支付

### 4）再观察异步回调是否命中

关注：

- `NestJS` 日志
- `wechat-pay-gateway` 日志
- 订单 `payStatus` 是否从 `unpaid` 变成 `paid`

### 5）最后验证退款与补偿

后台发起退款后，检查：

- 是否收到 `/api/payments/wechat/refund/notify`
- 订单是否进入 `refund_pending`
- 若微信最终成功，是否变成 `refunded`
- 若未自动落账，后台“同步微信状态”是否能补偿成功

### 七、推荐的本地检查清单

每次 Tunnel 域名变化后，请至少同步以下四项：

- `WEB_APP_BASE_URL`
- `WECHAT_PAY_NOTIFY_URL`
- `WECHAT_PAY_REFUND_NOTIFY_URL`
- `WECHAT_PAY_CALLBACK_BASE_URL`

若你是容器方式启动，还需要：

- 重启 `api`
- 重启 `web`
- 如使用真实微信支付，也建议重建 `wechat-pay-gateway`

### 八、你现在可以直接这样理解这套配置

- **用户页面在哪个 HTTPS 域名访问** → 填 `WEB_APP_BASE_URL`
- **微信服务器该把支付结果打回哪里** → 填 `WECHAT_PAY_NOTIFY_URL`
- **微信服务器该把退款结果打回哪里** → 填 `WECHAT_PAY_REFUND_NOTIFY_URL`
- **后续正式上线** → 直接把上述临时 Tunnel 域名替换成正式域名即可

### 九、注意事项

- Cloudflare `trycloudflare.com` 临时域名每次重启可能变化，所以每次都要同步更新环境变量
- 若微信公众平台 / 商户平台对网页授权域名、支付授权目录、H5 域名有额外校验，仍需以微信侧规则为准
- 从 **代码与系统链路** 看，本项目现在已经支持“前端域名负责回跳、后端域名负责异步通知”的本地联调模式
