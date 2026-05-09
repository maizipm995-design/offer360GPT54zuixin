## 微信支付 Go 网关

该目录用于承接 `Offer360` 的微信支付官方 V3 Go SDK 网关层，负责：

- 统一初始化 `wechatpay-go`
- 提供 `JSAPI / H5 / Native` 三种支付场景的预下单接口
- 提供查单、关单、退款、退款查单接口
- 提供公众号 OAuth `code -> openid` 交换能力
- 提供微信支付成功回调、退款回调的验签与解密入口

### 当前约束

- Go 网关代码当前只保留 **微信支付 V3 正式生产接口** 实现，不再维护沙箱或本地 Mock 分支。
- 网关支持 `JSAPI / H5 / Native` 预下单、查单、关单、退款、退款查单，以及支付 / 退款回调解析。
- 商户号、公众号 `AppID`、`APIv3 Key`、微信支付公钥 `Key ID` 与证书文件路径等真实配置需由业务环境注入；网关启动时会直接从商户证书文件中提取序列号，校验证书/私钥配对关系，并使用微信支付公钥模式完成响应与回调验签。
- 本地联调时，推荐直接使用已备案正式域名 `offer360.cn` 作为 `WEB_APP_BASE_URL`，并把 `WECHAT_PAY_NOTIFY_URL / WECHAT_PAY_REFUND_NOTIFY_URL` 指向 `offer360.cn` 下可稳定到达后端的 HTTPS 回调地址。

### 主要环境变量

- `WECHAT_PAY_GATEWAY_PORT`
- `WECHAT_PAY_MCH_ID`
- `WECHAT_PAY_APP_ID`
- `WECHAT_PAY_APP_SECRET`
- `WECHAT_PAY_MCH_CERT_SERIAL_NO`（用于启动时与证书文件做一致性校验）
- `WECHAT_PAY_PUBLIC_KEY_ID`
- `WECHAT_PAY_API_V3_KEY`
- `WECHAT_PAY_PRIVATE_KEY_PATH`
- `WECHAT_PAY_MCH_CERT_PATH`
- `WECHAT_PAY_PUBLIC_KEY_PATH`

### 对外 HTTP 接口

- `POST /v1/wechat/prepay`
- `POST /v1/wechat/orders/query`
- `POST /v1/wechat/orders/close`
- `POST /v1/wechat/refunds`
- `POST /v1/wechat/refunds/query`
- `POST /v1/wechat/oauth/exchange`
- `POST /v1/wechat/notify/parse`
- `POST /v1/wechat/refunds/notify/parse`
- `GET /healthz`
