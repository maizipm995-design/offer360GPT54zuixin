package main

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/wechatpay-apiv3/wechatpay-go/core"
	paynotify "github.com/wechatpay-apiv3/wechatpay-go/core/notify"
	"github.com/wechatpay-apiv3/wechatpay-go/core/option"
	"github.com/wechatpay-apiv3/wechatpay-go/core/auth/verifiers"
	paymentsv3 "github.com/wechatpay-apiv3/wechatpay-go/services/payments"
	payh5 "github.com/wechatpay-apiv3/wechatpay-go/services/payments/h5"
	payjsapi "github.com/wechatpay-apiv3/wechatpay-go/services/payments/jsapi"
	paynative "github.com/wechatpay-apiv3/wechatpay-go/services/payments/native"
	refunddomestic "github.com/wechatpay-apiv3/wechatpay-go/services/refunddomestic"
	"github.com/wechatpay-apiv3/wechatpay-go/utils"
)

type config struct {
	Port                 string
	MchID                string
	AppID                string
	AppSecret            string
	MchCertSerialNo      string
	PublicKeyID          string
	MchCertPath          string
	PublicKeyPath        string
	APIv3Key             string
	PrivateKeyPath       string
	NotifyURL            string
	RefundNotifyURL      string
	CallbackBaseURL      string
}

type gateway struct {
	cfg            config
	initErr        error
	client         *core.Client
	notifyHandler  *paynotify.Handler
	jsapiService   payjsapi.JsapiApiService
	h5Service      payh5.H5ApiService
	nativeService  paynative.NativeApiService
	refundService  refunddomestic.RefundsApiService
}

type envelope struct {
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

type prepayRequest struct {
	Scene          string `json:"scene"`
	Description    string `json:"description"`
	OutTradeNo     string `json:"outTradeNo"`
	NotifyURL      string `json:"notifyUrl"`
	Total          int64  `json:"total"`
	Currency       string `json:"currency"`
	Attach         string `json:"attach"`
	Openid         string `json:"openid"`
	PayerClientIP  string `json:"payerClientIp"`
	TimeExpire     string `json:"timeExpire"`
	H5RedirectURL  string `json:"h5RedirectUrl"`
	H5Type         string `json:"h5Type"`
	H5AppName      string `json:"h5AppName"`
	H5AppURL       string `json:"h5AppUrl"`
}

type queryOrderRequest struct {
	Scene         string `json:"scene"`
	OutTradeNo    string `json:"outTradeNo"`
	TransactionID string `json:"transactionId"`
}

type closeOrderRequest struct {
	Scene      string `json:"scene"`
	OutTradeNo string `json:"outTradeNo"`
}

type refundRequest struct {
	OutTradeNo    string `json:"outTradeNo"`
	TransactionID string `json:"transactionId"`
	OutRefundNo   string `json:"outRefundNo"`
	Reason        string `json:"reason"`
	Total         int64  `json:"total"`
	Refund        int64  `json:"refund"`
	Currency      string `json:"currency"`
	NotifyURL     string `json:"notifyUrl"`
}

type queryRefundRequest struct {
	OutRefundNo string `json:"outRefundNo"`
	OutTradeNo  string `json:"outTradeNo"`
}

type oauthExchangeRequest struct {
	Code string `json:"code"`
}

type parseNotifyRequest struct {
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

type oauthExchangeResponse struct {
	Openid       string                 `json:"openid"`
	Unionid      string                 `json:"unionid,omitempty"`
	Scope        string                 `json:"scope,omitempty"`
	AccessToken  string                 `json:"accessToken,omitempty"`
	RefreshToken string                 `json:"refreshToken,omitempty"`
	Raw          map[string]interface{} `json:"raw,omitempty"`
}

type transactionDTO struct {
	TradeState    string                 `json:"tradeState,omitempty"`
	TradeStateDesc string                `json:"tradeStateDesc,omitempty"`
	TransactionID string                 `json:"transactionId,omitempty"`
	OutTradeNo    string                 `json:"outTradeNo,omitempty"`
	PayerOpenID   string                 `json:"payerOpenId,omitempty"`
	SuccessTime   string                 `json:"successTime,omitempty"`
	AmountTotal   int64                  `json:"amountTotal,omitempty"`
	Raw           map[string]interface{} `json:"raw,omitempty"`
}

type refundDTO struct {
	RefundID      string                 `json:"refundId,omitempty"`
	OutRefundNo   string                 `json:"outRefundNo,omitempty"`
	OutTradeNo    string                 `json:"outTradeNo,omitempty"`
	TransactionID string                 `json:"transactionId,omitempty"`
	Status        string                 `json:"status,omitempty"`
	SuccessTime   string                 `json:"successTime,omitempty"`
	Raw           map[string]interface{} `json:"raw,omitempty"`
}

func main() {
	cfg := loadConfig()
	gw := newGateway(cfg)
	if gw.initErr != nil {
		log.Printf("[wechat-pay-gateway] SDK 初始化未完成：%v", gw.initErr)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", gw.handleHealth)
	mux.HandleFunc("/v1/wechat/prepay", gw.handlePrepay)
	mux.HandleFunc("/v1/wechat/orders/query", gw.handleQueryOrder)
	mux.HandleFunc("/v1/wechat/orders/close", gw.handleCloseOrder)
	mux.HandleFunc("/v1/wechat/refunds", gw.handleRefund)
	mux.HandleFunc("/v1/wechat/refunds/query", gw.handleQueryRefund)
	mux.HandleFunc("/v1/wechat/oauth/exchange", gw.handleOauthExchange)
	mux.HandleFunc("/v1/wechat/notify/parse", gw.handleParseNotify)
	mux.HandleFunc("/v1/wechat/refunds/notify/parse", gw.handleParseRefundNotify)

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           withCORS(withLogging(mux)),
		ReadHeaderTimeout: 10 * time.Second,
	}

	log.Printf("[wechat-pay-gateway] listening on :%s", cfg.Port)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("listen failed: %v", err)
	}
}

func loadConfig() config {
	return config{
		Port:            getEnv("WECHAT_PAY_GATEWAY_PORT", "8080"),
		MchID:           strings.TrimSpace(os.Getenv("WECHAT_PAY_MCH_ID")),
		AppID:           strings.TrimSpace(os.Getenv("WECHAT_PAY_APP_ID")),
		AppSecret:       strings.TrimSpace(os.Getenv("WECHAT_PAY_APP_SECRET")),
		MchCertSerialNo: strings.TrimSpace(os.Getenv("WECHAT_PAY_MCH_CERT_SERIAL_NO")),
		PublicKeyID:     strings.TrimSpace(os.Getenv("WECHAT_PAY_PUBLIC_KEY_ID")),
		MchCertPath:     strings.TrimSpace(os.Getenv("WECHAT_PAY_MCH_CERT_PATH")),
		PublicKeyPath:   strings.TrimSpace(os.Getenv("WECHAT_PAY_PUBLIC_KEY_PATH")),
		APIv3Key:        strings.TrimSpace(os.Getenv("WECHAT_PAY_API_V3_KEY")),
		PrivateKeyPath:  strings.TrimSpace(os.Getenv("WECHAT_PAY_PRIVATE_KEY_PATH")),
		NotifyURL:       strings.TrimSpace(os.Getenv("WECHAT_PAY_NOTIFY_URL")),
		RefundNotifyURL: strings.TrimSpace(os.Getenv("WECHAT_PAY_REFUND_NOTIFY_URL")),
		CallbackBaseURL: strings.TrimSpace(os.Getenv("WECHAT_PAY_CALLBACK_BASE_URL")),
	}
}

func newGateway(cfg config) *gateway {
	gw := &gateway{cfg: cfg}
	if err := validatePaymentConfig(cfg); err != nil {
		gw.initErr = err
		return gw
	}

	privateKey, err := loadMerchantPrivateKey(cfg)
	if err != nil {
		gw.initErr = err
		return gw
	}
	wechatPayPublicKey, err := loadWechatPayPublicKey(cfg)
	if err != nil {
		gw.initErr = err
		return gw
	}
	merchantCertificate, merchantCertSerialNo, err := loadMerchantCertificate(cfg)
	if err != nil {
		gw.initErr = err
		return gw
	}
	if err := validateMerchantCertificate(cfg, merchantCertificate, privateKey, merchantCertSerialNo); err != nil {
		gw.initErr = err
		return gw
	}
	gw.cfg.MchCertSerialNo = merchantCertSerialNo

	ctx := context.Background()
	client, err := core.NewClient(ctx,
		option.WithWechatPayPublicKeyAuthCipher(
			cfg.MchID,
			merchantCertSerialNo,
			privateKey,
			cfg.PublicKeyID,
			wechatPayPublicKey,
		),
	)
	if err != nil {
		gw.initErr = fmt.Errorf("初始化微信支付客户端失败：%w", err)
		return gw
	}

	gw.client = client
	gw.notifyHandler = paynotify.NewNotifyHandler(cfg.APIv3Key, verifiers.NewSHA256WithRSAPubkeyVerifier(cfg.PublicKeyID, *wechatPayPublicKey))
	gw.jsapiService = payjsapi.JsapiApiService{Client: client}
	gw.h5Service = payh5.H5ApiService{Client: client}
	gw.nativeService = paynative.NativeApiService{Client: client}
	gw.refundService = refunddomestic.RefundsApiService{Client: client}
	return gw
}

func validatePaymentConfig(cfg config) error {
	missing := make([]string, 0)
	if cfg.MchID == "" {
		missing = append(missing, "WECHAT_PAY_MCH_ID")
	}
	if cfg.AppID == "" {
		missing = append(missing, "WECHAT_PAY_APP_ID")
	}
	if cfg.PublicKeyID == "" {
		missing = append(missing, "WECHAT_PAY_PUBLIC_KEY_ID")
	}
	if cfg.APIv3Key == "" {
		missing = append(missing, "WECHAT_PAY_API_V3_KEY")
	}
	if cfg.PrivateKeyPath == "" {
		missing = append(missing, "WECHAT_PAY_PRIVATE_KEY_PATH")
	}
	if cfg.MchCertPath == "" {
		missing = append(missing, "WECHAT_PAY_MCH_CERT_PATH")
	}
	if cfg.PublicKeyPath == "" {
		missing = append(missing, "WECHAT_PAY_PUBLIC_KEY_PATH")
	}
	if len(missing) > 0 {
		return fmt.Errorf("缺少支付配置：%s", strings.Join(missing, ", "))
	}
	return nil
}

func loadMerchantPrivateKey(cfg config) (*rsa.PrivateKey, error) {
	privateKey, err := utils.LoadPrivateKeyWithPath(cfg.PrivateKeyPath)
	if err != nil {
		return nil, fmt.Errorf("读取商户私钥失败：%w", err)
	}
	return privateKey, nil
}

func loadWechatPayPublicKey(cfg config) (*rsa.PublicKey, error) {
	publicKey, err := utils.LoadPublicKeyWithPath(cfg.PublicKeyPath)
	if err != nil {
		return nil, fmt.Errorf("读取微信支付公钥失败：%w", err)
	}
	return publicKey, nil
}

func loadMerchantCertificate(cfg config) (*x509.Certificate, string, error) {
	content, err := os.ReadFile(cfg.MchCertPath)
	if err != nil {
		return nil, "", fmt.Errorf("读取商户证书失败：%w", err)
	}

	rest := content
	for len(rest) > 0 {
		var block *pem.Block
		block, rest = pem.Decode(rest)
		if block == nil {
			break
		}
		if block.Type != "CERTIFICATE" {
			continue
		}
		certificate, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			return nil, "", fmt.Errorf("解析商户证书失败：%w", err)
		}
		return certificate, strings.ToUpper(certificate.SerialNumber.Text(16)), nil
	}

	return nil, "", errors.New("商户证书文件中未找到 CERTIFICATE")
}

func validateMerchantCertificate(cfg config, certificate *x509.Certificate, privateKey *rsa.PrivateKey, serial string) error {
	if certificate == nil {
		return errors.New("商户证书不能为空")
	}
	if serial == "" {
		return errors.New("无法从商户证书提取序列号")
	}
	if cfg.MchCertSerialNo != "" && !strings.EqualFold(strings.TrimSpace(cfg.MchCertSerialNo), serial) {
		return fmt.Errorf("商户证书序列号与环境变量不一致：env=%s cert=%s", strings.TrimSpace(cfg.MchCertSerialNo), serial)
	}
	if commonName := strings.TrimSpace(certificate.Subject.CommonName); commonName != "" && commonName != cfg.MchID {
		return fmt.Errorf("商户证书 CN 与商户号不一致：cn=%s mchId=%s", commonName, cfg.MchID)
	}

	certificatePublicKey, ok := certificate.PublicKey.(*rsa.PublicKey)
	if !ok {
		return errors.New("商户证书公钥不是 RSA 类型")
	}
	if certificatePublicKey.N.Cmp(privateKey.PublicKey.N) != 0 || certificatePublicKey.E != privateKey.PublicKey.E {
		return errors.New("商户证书与商户私钥不匹配")
	}
	return nil
}

func (g *gateway) handleHealth(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(writer, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	writeJSON(writer, http.StatusOK, map[string]interface{}{
		"ready": g.initErr == nil,
		"message": errorMessage(g.initErr),
	})
}

func (g *gateway) handlePrepay(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if err := g.requirePaymentReady(); err != nil {
		writeError(writer, http.StatusServiceUnavailable, err.Error())
		return
	}

	var payload prepayRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}
	if payload.OutTradeNo == "" || payload.Description == "" || payload.Total <= 0 {
		writeError(writer, http.StatusBadRequest, "缺少必要的预下单参数")
		return
	}
	if strings.TrimSpace(payload.NotifyURL) == "" {
		payload.NotifyURL = g.cfg.NotifyURL
	}
	if strings.TrimSpace(payload.NotifyURL) == "" {
		writeError(writer, http.StatusBadRequest, "缺少 notifyUrl")
		return
	}

	ctx := request.Context()
	scene := normalizeScene(payload.Scene)
	switch scene {
	case "jsapi":
		if strings.TrimSpace(payload.Openid) == "" {
			writeError(writer, http.StatusBadRequest, "JSAPI 支付缺少 openid")
			return
		}
		resp, _, err := g.jsapiService.PrepayWithRequestPayment(ctx, payjsapi.PrepayRequest{
			Appid:       core.String(g.cfg.AppID),
			Mchid:       core.String(g.cfg.MchID),
			Description: core.String(payload.Description),
			OutTradeNo:  core.String(payload.OutTradeNo),
			TimeExpire:  parseTimePtr(payload.TimeExpire),
			Attach:      stringPtr(payload.Attach),
			NotifyUrl:   core.String(payload.NotifyURL),
			Amount: &payjsapi.Amount{
				Total:    core.Int64(payload.Total),
				Currency: stringPtr(defaultCurrency(payload.Currency)),
			},
			Payer: &payjsapi.Payer{Openid: core.String(payload.Openid)},
		})
		if err != nil {
			writeError(writer, http.StatusBadGateway, fmt.Sprintf("JSAPI 预下单失败：%v", err))
			return
		}
		writeJSON(writer, http.StatusOK, map[string]interface{}{
			"scene": "jsapi",
			"prepayId": derefString(resp.PrepayId),
			"jsapiParams": map[string]string{
				"appId": derefString(resp.Appid),
				"timeStamp": derefString(resp.TimeStamp),
				"nonceStr": derefString(resp.NonceStr),
				"package": derefString(resp.Package),
				"signType": derefString(resp.SignType),
				"paySign": derefString(resp.PaySign),
				"prepayId": derefString(resp.PrepayId),
			},
			"raw": toMap(resp),
		})
	case "h5":
		resp, _, err := g.h5Service.Prepay(ctx, payh5.PrepayRequest{
			Appid:       core.String(g.cfg.AppID),
			Mchid:       core.String(g.cfg.MchID),
			Description: core.String(payload.Description),
			OutTradeNo:  core.String(payload.OutTradeNo),
			TimeExpire:  parseTimePtr(payload.TimeExpire),
			Attach:      stringPtr(payload.Attach),
			NotifyUrl:   core.String(payload.NotifyURL),
			Amount: &payh5.Amount{
				Total:    core.Int64(payload.Total),
				Currency: stringPtr(defaultCurrency(payload.Currency)),
			},
			SceneInfo: &payh5.SceneInfo{
				PayerClientIp: core.String(defaultClientIP(payload.PayerClientIP)),
				H5Info: &payh5.H5Info{
					Type:    core.String(defaultH5Type(payload.H5Type)),
					AppName: stringPtr(payload.H5AppName),
					AppUrl:  stringPtr(payload.H5AppURL),
				},
			},
		})
		if err != nil {
			writeError(writer, http.StatusBadGateway, fmt.Sprintf("H5 预下单失败：%v", err))
			return
		}
		h5URL := appendRedirectURL(derefString(resp.H5Url), payload.H5RedirectURL)
		writeJSON(writer, http.StatusOK, map[string]interface{}{
			"scene": "h5",
			"h5Url": h5URL,
			"raw": toMap(resp),
		})
	case "native":
		resp, _, err := g.nativeService.Prepay(ctx, paynative.PrepayRequest{
			Appid:       core.String(g.cfg.AppID),
			Mchid:       core.String(g.cfg.MchID),
			Description: core.String(payload.Description),
			OutTradeNo:  core.String(payload.OutTradeNo),
			TimeExpire:  parseTimePtr(payload.TimeExpire),
			Attach:      stringPtr(payload.Attach),
			NotifyUrl:   core.String(payload.NotifyURL),
			Amount: &paynative.Amount{
				Total:    core.Int64(payload.Total),
				Currency: stringPtr(defaultCurrency(payload.Currency)),
			},
			SceneInfo: &paynative.SceneInfo{
				PayerClientIp: stringPtr(defaultClientIP(payload.PayerClientIP)),
			},
		})
		if err != nil {
			writeError(writer, http.StatusBadGateway, fmt.Sprintf("Native 预下单失败：%v", err))
			return
		}
		writeJSON(writer, http.StatusOK, map[string]interface{}{
			"scene": "native",
			"codeUrl": derefString(resp.CodeUrl),
			"raw": toMap(resp),
		})
	default:
		writeError(writer, http.StatusBadRequest, "不支持的支付场景")
	}
}

func (g *gateway) handleQueryOrder(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if err := g.requirePaymentReady(); err != nil {
		writeError(writer, http.StatusServiceUnavailable, err.Error())
		return
	}

	var payload queryOrderRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(payload.OutTradeNo) == "" && strings.TrimSpace(payload.TransactionID) == "" {
		writeError(writer, http.StatusBadRequest, "缺少订单查询参数")
		return
	}

	ctx := request.Context()
	scene := normalizeScene(payload.Scene)
	var (
		resp *paymentsv3.Transaction
		err  error
	)
	switch scene {
	case "jsapi":
		if strings.TrimSpace(payload.TransactionID) != "" {
			resp, _, err = g.jsapiService.QueryOrderById(ctx, payjsapi.QueryOrderByIdRequest{
				TransactionId: core.String(payload.TransactionID),
				Mchid:         core.String(g.cfg.MchID),
			})
		} else {
			resp, _, err = g.jsapiService.QueryOrderByOutTradeNo(ctx, payjsapi.QueryOrderByOutTradeNoRequest{
				OutTradeNo: core.String(payload.OutTradeNo),
				Mchid:      core.String(g.cfg.MchID),
			})
		}
	case "h5":
		if strings.TrimSpace(payload.TransactionID) != "" {
			resp, _, err = g.h5Service.QueryOrderById(ctx, payh5.QueryOrderByIdRequest{
				TransactionId: core.String(payload.TransactionID),
				Mchid:         core.String(g.cfg.MchID),
			})
		} else {
			resp, _, err = g.h5Service.QueryOrderByOutTradeNo(ctx, payh5.QueryOrderByOutTradeNoRequest{
				OutTradeNo: core.String(payload.OutTradeNo),
				Mchid:      core.String(g.cfg.MchID),
			})
		}
	case "native":
		if strings.TrimSpace(payload.TransactionID) != "" {
			resp, _, err = g.nativeService.QueryOrderById(ctx, paynative.QueryOrderByIdRequest{
				TransactionId: core.String(payload.TransactionID),
				Mchid:         core.String(g.cfg.MchID),
			})
		} else {
			resp, _, err = g.nativeService.QueryOrderByOutTradeNo(ctx, paynative.QueryOrderByOutTradeNoRequest{
				OutTradeNo: core.String(payload.OutTradeNo),
				Mchid:      core.String(g.cfg.MchID),
			})
		}
	default:
		writeError(writer, http.StatusBadRequest, "不支持的支付场景")
		return
	}
	if err != nil {
		writeError(writer, http.StatusBadGateway, fmt.Sprintf("查询订单失败：%v", err))
		return
	}
	writeJSON(writer, http.StatusOK, buildTransactionDTO(resp))
}

func (g *gateway) handleCloseOrder(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if err := g.requirePaymentReady(); err != nil {
		writeError(writer, http.StatusServiceUnavailable, err.Error())
		return
	}

	var payload closeOrderRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(payload.OutTradeNo) == "" {
		writeError(writer, http.StatusBadRequest, "缺少 outTradeNo")
		return
	}

	ctx := request.Context()
	scene := normalizeScene(payload.Scene)
	var err error
	switch scene {
	case "jsapi":
		_, err = g.jsapiService.CloseOrder(ctx, payjsapi.CloseOrderRequest{
			OutTradeNo: core.String(payload.OutTradeNo),
			Mchid:      core.String(g.cfg.MchID),
		})
	case "h5":
		_, err = g.h5Service.CloseOrder(ctx, payh5.CloseOrderRequest{
			OutTradeNo: core.String(payload.OutTradeNo),
			Mchid:      core.String(g.cfg.MchID),
		})
	case "native":
		_, err = g.nativeService.CloseOrder(ctx, paynative.CloseOrderRequest{
			OutTradeNo: core.String(payload.OutTradeNo),
			Mchid:      core.String(g.cfg.MchID),
		})
	default:
		writeError(writer, http.StatusBadRequest, "不支持的支付场景")
		return
	}
	if err != nil {
		writeError(writer, http.StatusBadGateway, fmt.Sprintf("关闭订单失败：%v", err))
		return
	}
	writeJSON(writer, http.StatusOK, map[string]bool{"closed": true})
}

func (g *gateway) handleRefund(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if err := g.requirePaymentReady(); err != nil {
		writeError(writer, http.StatusServiceUnavailable, err.Error())
		return
	}

	var payload refundRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(payload.OutRefundNo) == "" || payload.Total <= 0 || payload.Refund <= 0 {
		writeError(writer, http.StatusBadRequest, "缺少必要的退款参数")
		return
	}
	if strings.TrimSpace(payload.OutTradeNo) == "" && strings.TrimSpace(payload.TransactionID) == "" {
		writeError(writer, http.StatusBadRequest, "缺少原支付订单号或微信交易号")
		return
	}
	if strings.TrimSpace(payload.NotifyURL) == "" {
		payload.NotifyURL = g.cfg.RefundNotifyURL
	}

	resp, _, err := g.refundService.Create(request.Context(), refunddomestic.CreateRequest{
		TransactionId: stringPtr(payload.TransactionID),
		OutTradeNo:    stringPtr(payload.OutTradeNo),
		OutRefundNo:   core.String(payload.OutRefundNo),
		Reason:        stringPtr(payload.Reason),
		NotifyUrl:     stringPtr(payload.NotifyURL),
		Amount: &refunddomestic.AmountReq{
			Refund:   core.Int64(payload.Refund),
			Total:    core.Int64(payload.Total),
			Currency: stringPtr(defaultCurrency(payload.Currency)),
		},
	})
	if err != nil {
		writeError(writer, http.StatusBadGateway, fmt.Sprintf("退款请求失败：%v", err))
		return
	}

	writeJSON(writer, http.StatusOK, buildRefundDTO(toMap(resp)))
}

func (g *gateway) handleQueryRefund(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if err := g.requirePaymentReady(); err != nil {
		writeError(writer, http.StatusServiceUnavailable, err.Error())
		return
	}

	var payload queryRefundRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(payload.OutRefundNo) == "" {
		writeError(writer, http.StatusBadRequest, "缺少 outRefundNo")
		return
	}

	resp, _, err := g.refundService.QueryByOutRefundNo(request.Context(), refunddomestic.QueryByOutRefundNoRequest{
		OutRefundNo: core.String(strings.TrimSpace(payload.OutRefundNo)),
	})
	if err != nil {
		writeError(writer, http.StatusBadGateway, fmt.Sprintf("查询退款失败：%v", err))
		return
	}

	writeJSON(writer, http.StatusOK, buildRefundDTO(toMap(resp)))
}

func (g *gateway) handleOauthExchange(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if g.cfg.AppID == "" || g.cfg.AppSecret == "" {
		writeError(writer, http.StatusServiceUnavailable, "未配置公众号 AppID / AppSecret")
		return
	}

	var payload oauthExchangeRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(payload.Code) == "" {
		writeError(writer, http.StatusBadRequest, "缺少微信授权 code")
		return
	}

	endpoint := fmt.Sprintf(
		"https://api.weixin.qq.com/sns/oauth2/access_token?appid=%s&secret=%s&code=%s&grant_type=authorization_code",
		url.QueryEscape(g.cfg.AppID),
		url.QueryEscape(g.cfg.AppSecret),
		url.QueryEscape(strings.TrimSpace(payload.Code)),
	)

	response, err := http.Get(endpoint)
	if err != nil {
		writeError(writer, http.StatusBadGateway, fmt.Sprintf("微信 OAuth 请求失败：%v", err))
		return
	}
	defer response.Body.Close()

	var raw map[string]interface{}
	if err := json.NewDecoder(response.Body).Decode(&raw); err != nil {
		writeError(writer, http.StatusBadGateway, fmt.Sprintf("解析微信 OAuth 响应失败：%v", err))
		return
	}
	if errCode, ok := raw["errcode"]; ok {
		writeError(writer, http.StatusBadGateway, fmt.Sprintf("微信 OAuth 返回错误：%v %v", errCode, raw["errmsg"]))
		return
	}

	result := oauthExchangeResponse{
		Openid:       asString(raw["openid"]),
		Unionid:      asString(raw["unionid"]),
		Scope:        asString(raw["scope"]),
		AccessToken:  asString(raw["access_token"]),
		RefreshToken: asString(raw["refresh_token"]),
		Raw:          raw,
	}
	if result.Openid == "" {
		writeError(writer, http.StatusBadGateway, "微信 OAuth 未返回 openid")
		return
	}
	writeJSON(writer, http.StatusOK, result)
}

func (g *gateway) handleParseNotify(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if err := g.requirePaymentReady(); err != nil {
		writeError(writer, http.StatusServiceUnavailable, err.Error())
		return
	}

	var payload parseNotifyRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(payload.Body) == "" {
		writeError(writer, http.StatusBadRequest, "缺少微信回调原始报文")
		return
	}

	rawRequest, err := http.NewRequestWithContext(request.Context(), http.MethodPost, "https://offer360.local/wechat/notify", strings.NewReader(payload.Body))
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}
	for key, value := range payload.Headers {
		rawRequest.Header.Set(key, value)
	}

	transaction := new(paymentsv3.Transaction)
	if _, err := g.notifyHandler.ParseNotifyRequest(request.Context(), rawRequest, transaction); err != nil {
		writeError(writer, http.StatusBadGateway, fmt.Sprintf("解析微信支付回调失败：%v", err))
		return
	}

	var notifyEnvelope map[string]interface{}
	_ = json.Unmarshal([]byte(payload.Body), &notifyEnvelope)
	writeJSON(writer, http.StatusOK, map[string]interface{}{
		"eventType": asString(notifyEnvelope["event_type"]),
		"transaction": buildTransactionDTO(transaction),
	})
}

func (g *gateway) handleParseRefundNotify(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if err := g.requirePaymentReady(); err != nil {
		writeError(writer, http.StatusServiceUnavailable, err.Error())
		return
	}

	var payload parseNotifyRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(payload.Body) == "" {
		writeError(writer, http.StatusBadRequest, "缺少微信退款回调原始报文")
		return
	}

	rawRequest, err := http.NewRequestWithContext(request.Context(), http.MethodPost, "https://offer360.local/wechat/refund/notify", strings.NewReader(payload.Body))
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err.Error())
		return
	}
	for key, value := range payload.Headers {
		rawRequest.Header.Set(key, value)
	}

	refund := new(refunddomestic.Refund)
	if _, err := g.notifyHandler.ParseNotifyRequest(request.Context(), rawRequest, refund); err != nil {
		writeError(writer, http.StatusBadGateway, fmt.Sprintf("解析微信退款回调失败：%v", err))
		return
	}

	var notifyEnvelope map[string]interface{}
	_ = json.Unmarshal([]byte(payload.Body), &notifyEnvelope)
	writeJSON(writer, http.StatusOK, map[string]interface{}{
		"eventType": asString(notifyEnvelope["event_type"]),
		"refund": buildRefundDTO(toMap(refund)),
	})
}

func (g *gateway) requirePaymentReady() error {
	if g.initErr != nil {
		return g.initErr
	}
	return nil
}

func buildTransactionDTO(transaction *paymentsv3.Transaction) transactionDTO {
	if transaction == nil {
		return transactionDTO{}
	}
	var amountTotal int64
	if transaction.Amount != nil && transaction.Amount.Total != nil {
		amountTotal = *transaction.Amount.Total
	}
	payerOpenID := ""
	if transaction.Payer != nil {
		payerOpenID = derefString(transaction.Payer.Openid)
	}
	return transactionDTO{
		TradeState:     derefString(transaction.TradeState),
		TradeStateDesc: derefString(transaction.TradeStateDesc),
		TransactionID:  derefString(transaction.TransactionId),
		OutTradeNo:     derefString(transaction.OutTradeNo),
		PayerOpenID:    payerOpenID,
		SuccessTime:    derefString(transaction.SuccessTime),
		AmountTotal:    amountTotal,
		Raw:            toMap(transaction),
	}
}

func buildRefundDTO(raw map[string]interface{}) refundDTO {
	return refundDTO{
		RefundID:      readStringFromMap(raw, "refund_id", "refundId"),
		OutRefundNo:   readStringFromMap(raw, "out_refund_no", "outRefundNo"),
		OutTradeNo:    readStringFromMap(raw, "out_trade_no", "outTradeNo"),
		TransactionID: readStringFromMap(raw, "transaction_id", "transactionId"),
		Status:        readStringFromMap(raw, "status"),
		SuccessTime:   readStringFromMap(raw, "success_time", "successTime"),
		Raw:           raw,
	}
}

func decodeJSON(request *http.Request, target interface{}) error {
	defer request.Body.Close()
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return fmt.Errorf("请求体解析失败：%w", err)
	}
	return nil
}

func writeJSON(writer http.ResponseWriter, status int, data interface{}) {
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(envelope{Message: "ok", Data: data})
}

func writeError(writer http.ResponseWriter, status int, message string) {
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(envelope{Message: message})
}

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		start := time.Now()
		next.ServeHTTP(writer, request)
		log.Printf("%s %s %s", request.Method, request.URL.Path, time.Since(start))
	})
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Access-Control-Allow-Origin", "*")
		writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if request.Method == http.MethodOptions {
			writer.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(writer, request)
	})
}

func normalizeScene(scene string) string {
	switch strings.ToLower(strings.TrimSpace(scene)) {
	case "jsapi", "h5", "native":
		return strings.ToLower(strings.TrimSpace(scene))
	default:
		return strings.ToLower(strings.TrimSpace(scene))
	}
}

func defaultCurrency(currency string) string {
	if strings.TrimSpace(currency) == "" {
		return "CNY"
	}
	return strings.TrimSpace(strings.ToUpper(currency))
}

func defaultClientIP(ip string) string {
	if strings.TrimSpace(ip) == "" {
		return "127.0.0.1"
	}
	return strings.TrimSpace(ip)
}

func defaultH5Type(value string) string {
	if strings.TrimSpace(value) == "" {
		return "Wap"
	}
	return strings.TrimSpace(value)
}

func parseTimePtr(value string) *time.Time {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339, trimmed)
	if err != nil {
		return nil
	}
	return &parsed
}

func appendRedirectURL(h5URL, redirectURL string) string {
	if strings.TrimSpace(h5URL) == "" || strings.TrimSpace(redirectURL) == "" {
		return h5URL
	}
	parsed, err := url.Parse(h5URL)
	if err != nil {
		return h5URL
	}
	query := parsed.Query()
	query.Set("redirect_url", redirectURL)
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

func stringPtr(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func toMap(value interface{}) map[string]interface{} {
	if value == nil {
		return nil
	}
	bytes, err := json.Marshal(value)
	if err != nil {
		return nil
	}
	var result map[string]interface{}
	if err := json.Unmarshal(bytes, &result); err != nil {
		return nil
	}
	return result
}

func asString(value interface{}) string {
	if value == nil {
		return ""
	}
	if text, ok := value.(string); ok {
		return strings.TrimSpace(text)
	}
	return strings.TrimSpace(fmt.Sprint(value))
}

func readStringFromMap(source map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if value, ok := source[key]; ok {
			if text := asString(value); text != "" {
				return text
			}
		}
	}
	return ""
}

func errorMessage(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func getEnv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}
