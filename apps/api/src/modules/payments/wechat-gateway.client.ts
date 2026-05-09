import { Injectable, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { env } from '../../config/env';

export type WechatPayScene = 'jsapi' | 'h5' | 'native';

export interface WechatGatewayPrepayPayload {
  scene: WechatPayScene;
  description: string;
  outTradeNo: string;
  notifyUrl: string;
  total: number;
  currency?: string;
  attach?: string;
  openid?: string;
  payerClientIp?: string;
  timeExpire?: string;
  h5RedirectUrl?: string;
  h5Type?: string;
  h5AppName?: string;
  h5AppUrl?: string;
}

export interface WechatGatewayPrepayResponse {
  scene: WechatPayScene;
  prepayId?: string | null;
  codeUrl?: string | null;
  h5Url?: string | null;
  jsapiParams?: {
    appId: string;
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: 'RSA';
    paySign: string;
    prepayId: string;
  } | null;
  raw?: Record<string, unknown> | null;
}

export interface WechatGatewayOrderQueryResponse {
  tradeState?: string | null;
  tradeStateDesc?: string | null;
  transactionId?: string | null;
  outTradeNo?: string | null;
  payerOpenId?: string | null;
  successTime?: string | null;
  amountTotal?: number | null;
  raw?: Record<string, unknown> | null;
}

export interface WechatGatewayRefundResponse {
  refundId?: string | null;
  outRefundNo?: string | null;
  status?: string | null;
  raw?: Record<string, unknown> | null;
}

export interface WechatGatewayRefundQueryResponse {
  refundId?: string | null;
  outRefundNo?: string | null;
  outTradeNo?: string | null;
  transactionId?: string | null;
  status?: string | null;
  successTime?: string | null;
  raw?: Record<string, unknown> | null;
}

export interface WechatGatewayOauthResponse {
  openid: string;
  unionid?: string | null;
  scope?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  raw?: Record<string, unknown> | null;
}

export interface WechatGatewayNotifyParseResponse {
  eventType?: string | null;
  transaction: {
    tradeState?: string | null;
    transactionId?: string | null;
    outTradeNo?: string | null;
    payerOpenId?: string | null;
    successTime?: string | null;
    amountTotal?: number | null;
    raw?: Record<string, unknown> | null;
  };
}

export interface WechatGatewayRefundNotifyParseResponse {
  eventType?: string | null;
  refund: {
    status?: string | null;
    refundId?: string | null;
    outRefundNo?: string | null;
    outTradeNo?: string | null;
    transactionId?: string | null;
    successTime?: string | null;
    raw?: Record<string, unknown> | null;
  };
}

@Injectable()
export class WechatGatewayClient {
  private readonly baseUrl = env.wechatPayGatewayUrl.replace(/\/$/, '');

  async createPrepay(payload: WechatGatewayPrepayPayload) {
    return this.request<WechatGatewayPrepayResponse>('/v1/wechat/prepay', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async queryOrder(payload: { scene: WechatPayScene; outTradeNo: string }) {
    return this.request<WechatGatewayOrderQueryResponse>('/v1/wechat/orders/query', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async closeOrder(payload: { scene: WechatPayScene; outTradeNo: string }) {
    return this.request<{ closed: true; raw?: Record<string, unknown> | null }>('/v1/wechat/orders/close', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async createRefund(payload: { outTradeNo: string; transactionId?: string | null; outRefundNo: string; reason?: string; total: number; refund: number; notifyUrl?: string }) {
    return this.request<WechatGatewayRefundResponse>('/v1/wechat/refunds', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async queryRefund(payload: { outRefundNo: string; outTradeNo?: string }) {
    return this.request<WechatGatewayRefundQueryResponse>('/v1/wechat/refunds/query', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async exchangeOauthCode(payload: { code: string }) {
    return this.request<WechatGatewayOauthResponse>('/v1/wechat/oauth/exchange', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async parsePaymentNotify(payload: { headers: Record<string, string>; body: string }) {
    return this.request<WechatGatewayNotifyParseResponse>('/v1/wechat/notify/parse', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async parseRefundNotify(payload: { headers: Record<string, string>; body: string }) {
    return this.request<WechatGatewayRefundNotifyParseResponse>('/v1/wechat/refunds/notify/parse', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    if (!this.baseUrl) {
      throw new ServiceUnavailableException('未配置微信支付 Go 网关地址');
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
      });
    } catch (error) {
      throw new ServiceUnavailableException(error instanceof Error ? error.message : '微信支付 Go 网关暂时不可用');
    }

    const text = await response.text();
    const payload = this.parseJson(text);
    if (!response.ok) {
      const message = typeof payload?.message === 'string' && payload.message.trim()
        ? payload.message.trim()
        : text || `微信支付网关请求失败（${response.status}）`;
      throw new InternalServerErrorException(message);
    }

    return (payload?.data ?? payload) as T;
  }

  private parseJson(text: string) {
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text) as { message?: string; data?: unknown } | Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
