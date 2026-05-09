import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import {
  getMemberLevelLabel,
  normalizeStoredMemberLevel,
  parseMemberLevelInput,
} from '../../common/utils/member-access';
import { PrismaService } from '../../prisma.service';
import { MembershipsService } from '../memberships/memberships.service';
import {
  WechatGatewayClient,
  type WechatGatewayOrderQueryResponse,
  type WechatGatewayPrepayPayload,
  type WechatGatewayPrepayResponse,
  type WechatGatewayRefundQueryResponse,
  type WechatGatewayRefundResponse,
  type WechatGatewayRefundNotifyParseResponse,
  type WechatPayScene,
} from './wechat-gateway.client';

const ORDER_EXPIRE_MINUTES_DEFAULT = 15;
const PAYMENT_STATUS_UNPAID = 'unpaid';
const PAYMENT_STATUS_PAID = 'paid';
const PAYMENT_STATUS_CLOSED = 'closed';
const PAYMENT_STATUS_REFUND_PENDING = 'refund_pending';
const PAYMENT_STATUS_REFUNDED = 'refunded';
const PAYMENT_CHANNEL_WECHAT = 'wechat_pay';
const SERVICE_PRODUCT_TYPE = 'service';
const MEMBERSHIP_PRODUCT_TYPE = 'membership';

const WECHAT_SUCCESS_STATES = new Set(['SUCCESS']);
const WECHAT_PENDING_STATES = new Set(['NOTPAY', 'USERPAYING']);
const WECHAT_CLOSED_STATES = new Set(['CLOSED', 'REVOKED', 'PAYERROR']);

const WECHAT_REFUND_SUCCESS_STATES = new Set(['SUCCESS']);
const WECHAT_REFUND_PENDING_STATES = new Set(['PROCESSING']);
const WECHAT_REFUND_FAILED_STATES = new Set(['ABNORMAL', 'CLOSED']);

const MOBILE_USER_AGENT_PATTERN = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;
const WECHAT_USER_AGENT_PATTERN = /MicroMessenger/i;

type OrderWithRelations = Prisma.ServiceOrderGetPayload<{
  include: {
    user: true;
    product: true;
    commissions: true;
  };
}>;

interface CreateCheckoutOrderInput {
  productId?: string;
  userAgent?: string;
}

interface PaymentRequestContext {
  scene?: WechatPayScene;
  userAgent?: string;
  clientIp?: string;
  forwardedFor?: string;
  requestIp?: string;
  returnPath?: string;
}

interface ReconcileRecentOrdersInput {
  limit?: number;
  lookbackHours?: number;
}

interface RefundTransitionOptions {
  source: string;
  reason?: string | null;
  remark?: string | null;
  status?: string | null;
  outRefundNo?: string | null;
  refundId?: string | null;
  transactionId?: string | null;
  successTime?: string | null;
  requestedAt?: string | null;
  requestPayload?: Record<string, unknown> | null;
  responsePayload?: Record<string, unknown> | null;
  notifyPayload?: Record<string, unknown> | null;
  queryPayload?: Record<string, unknown> | null;
  failureMessage?: string | null;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipsService: MembershipsService,
    private readonly wechatGatewayClient: WechatGatewayClient,
  ) {}

  async createCheckoutOrder(userId: string, body: CreateCheckoutOrderInput) {
    const productId = String(body.productId || '').trim();
    if (!productId) {
      throw new BadRequestException('商品 ID 不能为空');
    }

    const product = await this.prisma.serviceProduct.findUnique({ where: { id: productId } });
    if (!product || !product.status) {
      throw new NotFoundException('商品不存在或已下架');
    }

    const orderType = this.normalizeProductType(product.productType);
    if (orderType === MEMBERSHIP_PRODUCT_TYPE && (!product.memberLevel || !product.grantDays)) {
      throw new BadRequestException('会员商品缺少会员等级或时长配置');
    }

    const scene = this.detectPayScene(body.userAgent);
    const now = new Date();
    const expireAt = new Date(now.getTime() + this.getOrderExpireMinutes() * 60 * 1000);

    const existingOrder = await this.prisma.serviceOrder.findFirst({
      where: {
        userId,
        productId,
        payStatus: PAYMENT_STATUS_UNPAID,
        payChannel: PAYMENT_CHANNEL_WECHAT,
        expireAt: { gt: now },
      },
      include: {
        user: true,
        product: true,
        commissions: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingOrder) {
      return {
        order: this.toCheckoutOrder(existingOrder),
        detectedScene: this.detectPayScene(body.userAgent, existingOrder.payScene),
      };
    }

    const order = await this.prisma.serviceOrder.create({
      data: {
        orderNo: await this.generateOrderNo(),
        userId,
        productId,
        orderType,
        title: product.name,
        amount: product.price,
        memberLevel: orderType === MEMBERSHIP_PRODUCT_TYPE ? normalizeStoredMemberLevel(product.memberLevel) ?? 'standard' : null,
        grantDays: orderType === MEMBERSHIP_PRODUCT_TYPE ? product.grantDays : null,
        payStatus: PAYMENT_STATUS_UNPAID,
        payChannel: PAYMENT_CHANNEL_WECHAT,
        payScene: scene,
        expireAt,
        remark: orderType === MEMBERSHIP_PRODUCT_TYPE
          ? `${getMemberLevelLabel(product.memberLevel)} ${product.grantDays} 天待支付订单`
          : '微信支付待支付订单',
      },
      include: {
        user: true,
        product: true,
        commissions: true,
      },
    });

    return {
      order: this.toCheckoutOrder(order),
      detectedScene: scene,
    };
  }

  async getCheckoutOrder(userId: string, orderNo: string, context?: PaymentRequestContext) {
    const order = await this.getUserOrderOrThrow(userId, orderNo);
    const synced: OrderWithRelations = await this.syncOrderStateIfNeeded(order, context);
    return this.toCheckoutOrder(synced);
  }

  async prepareCheckoutPayment(userId: string, orderNo: string, context?: PaymentRequestContext) {
    let order: OrderWithRelations = await this.getUserOrderOrThrow(userId, orderNo);
    order = await this.syncOrderStateIfNeeded(order, context);

    if (order.payStatus === PAYMENT_STATUS_PAID) {
      return {
        order: this.toCheckoutOrder(order),
        scene: this.detectPayScene(context?.userAgent, order.payScene),
        action: 'already_paid' as const,
      };
    }

    if (order.payStatus === PAYMENT_STATUS_CLOSED || order.payStatus === PAYMENT_STATUS_REFUNDED || order.payStatus === PAYMENT_STATUS_REFUND_PENDING) {
      return {
        order: this.toCheckoutOrder(order),
        scene: this.detectPayScene(context?.userAgent, order.payScene),
        action: 'closed' as const,
      };
    }

    const scene = this.detectPayScene(context?.userAgent, context?.scene ?? order.payScene);
    if (order.expireAt && order.expireAt <= new Date()) {
      const closedOrder = await this.closeOrderRecord(order.id, '订单已超时关闭');
      return {
        order: this.toCheckoutOrder(closedOrder),
        scene,
        action: 'closed' as const,
      };
    }

    if (scene === 'jsapi') {
      const openId = order.wechatOpenId || order.user.wechatOpenId;
      if (!openId) {
        return {
          order: this.toCheckoutOrder(order),
          scene,
          action: 'oauth_redirect_required' as const,
          oauthUrl: (await this.buildWechatOauthUrl(userId, order.orderNo)).url,
        };
      }
    }

    const payload = this.buildWechatPrepayPayload(order, scene, context);
    const payment = await this.wechatGatewayClient.createPrepay(payload);

    order = await this.prisma.serviceOrder.update({
      where: { id: order.id },
      data: {
        payChannel: PAYMENT_CHANNEL_WECHAT,
        payScene: scene,
        wechatOpenId: scene === 'jsapi' ? order.wechatOpenId || order.user.wechatOpenId : order.wechatOpenId,
        wechatPrepayId: payment.prepayId ?? null,
        wechatCodeUrl: payment.codeUrl ?? null,
        wechatH5Url: payment.h5Url ?? null,
        expireAt: order.expireAt ?? new Date(Date.now() + this.getOrderExpireMinutes() * 60 * 1000),
      },
      include: {
        user: true,
        product: true,
        commissions: true,
      },
    });

    return {
      order: this.toCheckoutOrder(order),
      scene,
      action: this.toFrontendAction(scene, payment),
      codeUrl: payment.codeUrl ?? null,
      h5Url: payment.h5Url ?? null,
      jsapiParams: payment.jsapiParams ?? null,
    };
  }

  async closeCheckoutOrder(userId: string, orderNo: string) {
    const order = await this.getUserOrderOrThrow(userId, orderNo);
    if (order.payStatus !== PAYMENT_STATUS_UNPAID) {
      return this.toCheckoutOrder(order);
    }

    await this.tryCloseWechatOrder(order);
    const closedOrder = await this.closeOrderRecord(order.id, '用户主动关闭订单');
    return this.toCheckoutOrder(closedOrder);
  }

  async buildWechatOauthUrl(userId: string, orderNo: string, referer?: string) {
    const order = await this.getUserOrderOrThrow(userId, orderNo);
    const appId = env.wechatPayAppId.trim();
    if (!appId) {
      throw new BadRequestException('未配置微信公众号 AppID，无法发起 JSAPI 授权');
    }

    const callbackUrl = this.buildPublicUrl(`/payments/wechat/callback?orderNo=${encodeURIComponent(order.orderNo)}`);
    const state = encodeURIComponent(order.orderNo);
    const url = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=snsapi_base&state=${state}#wechat_redirect`;

    return {
      orderNo: order.orderNo,
      url,
      callbackUrl,
      referer: referer || null,
    };
  }

  async completeWechatOauth(userId: string, orderNo: string, code: string) {
    if (!orderNo.trim()) {
      throw new BadRequestException('订单号不能为空');
    }
    if (!code.trim()) {
      throw new BadRequestException('缺少微信授权 code');
    }

    const order = await this.getUserOrderOrThrow(userId, orderNo);
    const oauth = await this.wechatGatewayClient.exchangeOauthCode({ code: code.trim() });
    if (!oauth.openid) {
      throw new BadRequestException('微信授权未返回 openid');
    }

    const openid = oauth.openid.trim();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { wechatOpenId: openid },
      });
      await tx.serviceOrder.update({
        where: { id: order.id },
        data: { wechatOpenId: openid },
      });
    });

    return {
      orderNo: order.orderNo,
      openid,
      checkoutPath: this.buildCheckoutPath(order.orderNo),
    };
  }

  async handleWechatPaymentNotify(rawBody: string, headers: Record<string, string | string[] | undefined>) {
    if (!rawBody) {
      throw new BadRequestException('微信支付回调缺少原始报文');
    }

    const payload = await this.wechatGatewayClient.parsePaymentNotify({
      headers: this.normalizeNotifyHeaders(headers),
      body: rawBody,
    });

    const transaction = payload.transaction;
    const orderNo = transaction.outTradeNo?.trim();
    if (!orderNo) {
      throw new BadRequestException('微信支付回调未提供商户订单号');
    }

    const order = await this.prisma.serviceOrder.findUnique({
      where: { orderNo },
      include: {
        user: true,
        product: true,
        commissions: true,
      },
    });
    if (!order) {
      throw new NotFoundException('回调订单不存在');
    }

    const tradeState = this.normalizeTradeState(transaction.tradeState);
    if (WECHAT_SUCCESS_STATES.has(tradeState)) {
      await this.markOrderPaid(order.id, {
        transactionId: transaction.transactionId,
        successTime: transaction.successTime,
        payerOpenId: transaction.payerOpenId,
        callbackPayload: {
          source: 'wechat_notify',
          rawBody,
          parsed: payload,
          receivedAt: new Date().toISOString(),
        },
      });
      return { handled: true };
    }

    if (WECHAT_CLOSED_STATES.has(tradeState)) {
      await this.closeOrderRecord(order.id, `微信支付回调返回 ${tradeState}`);
      return { handled: true };
    }

    if (!WECHAT_PENDING_STATES.has(tradeState)) {
      throw new BadRequestException(`暂未支持的微信支付状态：${tradeState || 'UNKNOWN'}`);
    }

    return { handled: true };
  }

  async handleWechatRefundNotify(rawBody: string, headers: Record<string, string | string[] | undefined>) {
    if (!rawBody) {
      throw new BadRequestException('微信退款回调缺少原始报文');
    }

    const payload = await this.wechatGatewayClient.parseRefundNotify({
      headers: this.normalizeNotifyHeaders(headers),
      body: rawBody,
    });

    const refund = payload.refund;
    const orderNo = refund.outTradeNo?.trim();
    if (!orderNo) {
      throw new BadRequestException('微信退款回调未提供商户订单号');
    }

    const order = await this.prisma.serviceOrder.findUnique({
      where: { orderNo },
      include: {
        user: true,
        product: true,
        commissions: true,
      },
    });
    if (!order) {
      throw new NotFoundException('退款回调订单不存在');
    }

    const refundStatus = this.normalizeRefundStatus(refund.status);
    const notifyPayload = {
      source: 'wechat_refund_notify',
      rawBody,
      parsed: payload,
      receivedAt: new Date().toISOString(),
    };

    if (WECHAT_REFUND_SUCCESS_STATES.has(refundStatus)) {
      await this.markOrderRefunded(order.id, {
        source: 'wechat_refund_notify',
        reason: order.refundReason,
        remark: '微信退款回调确认成功',
        status: refundStatus,
        outRefundNo: refund.outRefundNo,
        refundId: refund.refundId,
        transactionId: refund.transactionId,
        successTime: refund.successTime,
        notifyPayload,
      });
      return { handled: true };
    }

    if (WECHAT_REFUND_PENDING_STATES.has(refundStatus)) {
      await this.markOrderRefundPending(order.id, {
        source: 'wechat_refund_notify',
        reason: order.refundReason,
        remark: '微信退款处理中，等待最终结果',
        status: refundStatus,
        outRefundNo: refund.outRefundNo,
        refundId: refund.refundId,
        transactionId: refund.transactionId,
        notifyPayload,
      });
      return { handled: true };
    }

    if (WECHAT_REFUND_FAILED_STATES.has(refundStatus)) {
      await this.markOrderRefundFailed(order.id, {
        source: 'wechat_refund_notify',
        reason: order.refundReason,
        remark: `微信退款回调返回 ${refundStatus}`,
        status: refundStatus,
        outRefundNo: refund.outRefundNo,
        refundId: refund.refundId,
        transactionId: refund.transactionId,
        notifyPayload,
        failureMessage: refund.status,
      });
      return { handled: true };
    }

    throw new BadRequestException(`暂未支持的微信退款状态：${refundStatus || 'UNKNOWN'}`);
  }

  async markOrderPaidFromAdmin(orderId: string, remark?: string | null) {
    const order = await this.getOrderByIdOrThrow(orderId);
    if (order.payStatus === PAYMENT_STATUS_REFUNDED) {
      throw new BadRequestException('已退款订单不支持改回已支付');
    }
    if (order.payStatus === PAYMENT_STATUS_REFUND_PENDING) {
      throw new BadRequestException('退款处理中订单不支持直接改回已支付');
    }
    return this.toCheckoutOrder(await this.markOrderPaid(order.id, {
      successTime: order.payTime?.toISOString(),
      remark: remark || '后台人工确认支付',
      callbackPayload: {
        source: 'admin_manual_paid',
        receivedAt: new Date().toISOString(),
      },
    }));
  }

  async closeOrderFromAdmin(orderId: string, remark?: string | null) {
    const order = await this.getOrderByIdOrThrow(orderId);
    if (order.payStatus === PAYMENT_STATUS_PAID) {
      throw new BadRequestException('已支付订单不能直接关闭，请使用退款流程');
    }
    if (order.payStatus === PAYMENT_STATUS_REFUNDED) {
      throw new BadRequestException('已退款订单不支持关闭');
    }
    if (order.payStatus === PAYMENT_STATUS_REFUND_PENDING) {
      throw new BadRequestException('退款处理中订单不能直接关闭，请先同步微信退款状态');
    }
    await this.tryCloseWechatOrder(order);
    return this.toCheckoutOrder(await this.closeOrderRecord(order.id, remark || '后台关闭订单'));
  }

  async refundOrderFromAdmin(orderId: string, refundReason?: string | null, remark?: string | null) {
    const order = await this.getOrderByIdOrThrow(orderId);
    if (order.payStatus !== PAYMENT_STATUS_PAID) {
      throw new BadRequestException('只有已支付订单才能退款');
    }
    if (order.orderType === MEMBERSHIP_PRODUCT_TYPE) {
      throw new BadRequestException('会员订单暂不支持自动退款，请先人工确认会员权益回收方案');
    }

    const reason = refundReason?.trim() || '后台发起退款';
    const outRefundNo = this.buildOutRefundNo(order);
    const requestPayload = {
      outTradeNo: order.orderNo,
      transactionId: order.wechatTransactionId,
      outRefundNo,
      reason,
      total: this.toFen(order.amount),
      refund: this.toFen(order.amount),
      notifyUrl: this.buildRefundNotifyUrl(),
    };

    if (order.payChannel !== PAYMENT_CHANNEL_WECHAT) {
      return this.toCheckoutOrder(await this.markOrderRefunded(order.id, {
        source: 'admin_manual_refund',
        reason,
        remark: remark || '后台手工退款成功',
        status: 'SUCCESS',
        outRefundNo,
        transactionId: order.wechatTransactionId,
        successTime: new Date().toISOString(),
        requestPayload,
      }));
    }

    const refund = await this.wechatGatewayClient.createRefund(requestPayload);
    const refundStatus = this.normalizeRefundStatus(refund.status);
    const responsePayload = this.extractRefundResponsePayload(refund, outRefundNo);

    if (WECHAT_REFUND_SUCCESS_STATES.has(refundStatus)) {
      return this.toCheckoutOrder(await this.markOrderRefunded(order.id, {
        source: 'admin_refund_response',
        reason,
        remark: remark || '微信退款已成功受理',
        status: refundStatus,
        outRefundNo,
        refundId: refund.refundId,
        transactionId: order.wechatTransactionId,
        successTime: new Date().toISOString(),
        requestPayload,
        responsePayload,
      }));
    }

    if (WECHAT_REFUND_FAILED_STATES.has(refundStatus)) {
      throw new BadRequestException(`微信退款未成功受理，当前状态：${refundStatus}`);
    }

    return this.toCheckoutOrder(await this.markOrderRefundPending(order.id, {
      source: 'admin_refund_request',
      reason,
      remark: remark || '后台已提交微信退款，等待异步确认',
      status: refundStatus || 'PROCESSING',
      outRefundNo,
      refundId: refund.refundId,
      transactionId: order.wechatTransactionId,
      requestedAt: new Date().toISOString(),
      requestPayload,
      responsePayload,
    }));
  }

  async reconcileOrderFromAdmin(orderId: string) {
    const order = await this.getOrderByIdOrThrow(orderId);
    return this.toCheckoutOrder(await this.reconcileWechatOrder(order));
  }

  async reconcileRecentOrdersFromAdmin(input: ReconcileRecentOrdersInput = {}) {
    const limit = Math.min(Math.max(Number(input.limit ?? 20) || 20, 1), 50);
    const lookbackHours = Math.min(Math.max(Number(input.lookbackHours ?? 48) || 48, 1), 24 * 30);
    const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

    const orders = await this.prisma.serviceOrder.findMany({
      where: {
        payChannel: PAYMENT_CHANNEL_WECHAT,
        payStatus: { in: [PAYMENT_STATUS_UNPAID, PAYMENT_STATUS_REFUND_PENDING] },
        createdAt: { gte: since },
      },
      include: {
        user: true,
        product: true,
        commissions: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    let changed = 0;
    const list = [] as Array<{
      id: string;
      orderNo: string;
      payStatus: string;
      refundReason: string | null;
      updatedAt: Date;
    }>;

    for (const order of orders) {
      const reconciled = await this.reconcileWechatOrder(order);
      if (reconciled.payStatus !== order.payStatus) {
        changed += 1;
      }
      list.push({
        id: reconciled.id,
        orderNo: reconciled.orderNo,
        payStatus: reconciled.payStatus,
        refundReason: reconciled.refundReason,
        updatedAt: reconciled.updatedAt,
      });
    }

    return {
      scanned: orders.length,
      changed,
      limit,
      lookbackHours,
      list,
    };
  }

  private async reconcileWechatOrder(order: OrderWithRelations) {
    if (order.payChannel !== PAYMENT_CHANNEL_WECHAT) {
      return order;
    }
    if (order.payStatus === PAYMENT_STATUS_REFUND_PENDING) {
      return this.syncRefundStateIfNeeded(order);
    }
    if (order.payStatus === PAYMENT_STATUS_UNPAID) {
      return this.syncOrderStateIfNeeded(order);
    }
    return order;
  }

  private async syncOrderStateIfNeeded(order: OrderWithRelations, context?: PaymentRequestContext) {
    if (order.payStatus === PAYMENT_STATUS_REFUND_PENDING) {
      return this.syncRefundStateIfNeeded(order);
    }
    if (
      order.payStatus !== PAYMENT_STATUS_UNPAID ||
      order.payChannel !== PAYMENT_CHANNEL_WECHAT ||
      !order.payScene ||
      (!order.wechatPrepayId && !order.wechatCodeUrl && !order.wechatH5Url)
    ) {
      return order;
    }

    const query = await this.safeQueryWechatOrder(order);
    if (query) {
      const tradeState = this.normalizeTradeState(query.tradeState);
      if (WECHAT_SUCCESS_STATES.has(tradeState)) {
        return this.markOrderPaid(order.id, {
          transactionId: query.transactionId,
          successTime: query.successTime,
          payerOpenId: query.payerOpenId,
          callbackPayload: {
            source: 'wechat_query',
            parsed: query,
            receivedAt: new Date().toISOString(),
          },
        });
      }
      if (WECHAT_CLOSED_STATES.has(tradeState)) {
        return this.closeOrderRecord(order.id, `微信支付状态同步为 ${tradeState}`);
      }
    }

    if (order.expireAt && order.expireAt <= new Date()) {
      await this.tryCloseWechatOrder(order);
      return this.closeOrderRecord(order.id, '订单超时自动关闭');
    }

    if (context?.scene && context.scene !== order.payScene) {
      return this.prisma.serviceOrder.update({
        where: { id: order.id },
        data: { payScene: context.scene },
        include: {
          user: true,
          product: true,
          commissions: true,
        },
      });
    }

    return order;
  }

  private async syncRefundStateIfNeeded(order: OrderWithRelations) {
    if (order.payStatus !== PAYMENT_STATUS_REFUND_PENDING || order.payChannel !== PAYMENT_CHANNEL_WECHAT) {
      return order;
    }

    const outRefundNo = this.readStoredOutRefundNo(order.callbackPayload);
    if (!outRefundNo) {
      return order;
    }

    const query = await this.safeQueryWechatRefund(order, outRefundNo);
    if (!query) {
      return order;
    }

    const refundStatus = this.normalizeRefundStatus(query.status);
    if (WECHAT_REFUND_SUCCESS_STATES.has(refundStatus)) {
      return this.markOrderRefunded(order.id, {
        source: 'wechat_refund_query',
        reason: order.refundReason,
        remark: '退款状态已通过微信查单同步为成功',
        status: refundStatus,
        outRefundNo: query.outRefundNo,
        refundId: query.refundId,
        transactionId: query.transactionId,
        successTime: query.successTime,
        queryPayload: {
          queriedAt: new Date().toISOString(),
          parsed: query,
        },
      });
    }

    if (WECHAT_REFUND_FAILED_STATES.has(refundStatus)) {
      return this.markOrderRefundFailed(order.id, {
        source: 'wechat_refund_query',
        reason: order.refundReason,
        remark: `微信退款状态同步为 ${refundStatus}`,
        status: refundStatus,
        outRefundNo: query.outRefundNo,
        refundId: query.refundId,
        transactionId: query.transactionId,
        queryPayload: {
          queriedAt: new Date().toISOString(),
          parsed: query,
        },
        failureMessage: query.status,
      });
    }

    return order;
  }

  private buildWechatPrepayPayload(order: OrderWithRelations, scene: WechatPayScene, context?: PaymentRequestContext): WechatGatewayPrepayPayload {
    const payload: WechatGatewayPrepayPayload = {
      scene,
      description: order.title,
      outTradeNo: order.orderNo,
      notifyUrl: this.buildPaymentNotifyUrl(),
      total: this.toFen(order.amount),
      currency: 'CNY',
      attach: order.orderType,
      timeExpire: (order.expireAt ?? new Date(Date.now() + this.getOrderExpireMinutes() * 60 * 1000)).toISOString(),
    };

    if (scene === 'jsapi') {
      payload.openid = order.wechatOpenId || order.user.wechatOpenId || undefined;
    }

    if (scene === 'h5') {
      payload.payerClientIp = context?.clientIp || this.extractClientIp(context) || '127.0.0.1';
      payload.h5Type = 'Wap';
      payload.h5AppName = 'Offer360';
      payload.h5AppUrl = this.getPublicBaseUrl();
      payload.h5RedirectUrl = this.buildPublicUrl(context?.returnPath || this.buildCheckoutPath(order.orderNo, { wxReturn: '1' }));
    }

    if (scene === 'native') {
      payload.payerClientIp = context?.clientIp || this.extractClientIp(context) || '127.0.0.1';
    }

    return payload;
  }

  private async safeQueryWechatOrder(order: OrderWithRelations) {
    try {
      return await this.wechatGatewayClient.queryOrder({
        scene: this.detectPayScene(undefined, order.payScene),
        outTradeNo: order.orderNo,
      });
    } catch {
      return null;
    }
  }

  private async safeQueryWechatRefund(order: OrderWithRelations, outRefundNo: string) {
    try {
      return await this.wechatGatewayClient.queryRefund({
        outRefundNo,
        outTradeNo: order.orderNo,
      });
    } catch {
      return null;
    }
  }

  private async tryCloseWechatOrder(order: OrderWithRelations) {
    if (order.payChannel !== PAYMENT_CHANNEL_WECHAT || !order.payScene) {
      return;
    }
    try {
      await this.wechatGatewayClient.closeOrder({
        scene: this.detectPayScene(undefined, order.payScene),
        outTradeNo: order.orderNo,
      });
    } catch {
      // 关单失败不阻塞本地订单状态回收，避免用户被卡死在超时订单上。
    }
  }

  private async markOrderPaid(
    orderId: string,
    options: {
      transactionId?: string | null;
      successTime?: string | null;
      payerOpenId?: string | null;
      callbackPayload?: Record<string, unknown>;
      remark?: string | null;
    },
  ): Promise<OrderWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const order: OrderWithRelations | null = await tx.serviceOrder.findUnique({
        where: { id: orderId },
        include: {
          user: true,
          product: true,
          commissions: true,
        },
      });
      if (!order) {
        throw new NotFoundException('订单不存在');
      }
      if (order.payStatus === PAYMENT_STATUS_PAID || order.payStatus === PAYMENT_STATUS_REFUNDED || order.payStatus === PAYMENT_STATUS_REFUND_PENDING) {
        return order;
      }

      const successTime = options.successTime ? new Date(options.successTime) : new Date();
      const updatedOrder: OrderWithRelations = await tx.serviceOrder.update({
        where: { id: orderId },
        data: {
          payStatus: PAYMENT_STATUS_PAID,
          payTime: Number.isNaN(successTime.getTime()) ? new Date() : successTime,
          closedAt: null,
          wechatTransactionId: options.transactionId || order.wechatTransactionId,
          wechatOpenId: options.payerOpenId || order.wechatOpenId || order.user.wechatOpenId,
          callbackPayload: this.buildCallbackPayloadSection(order.callbackPayload, 'payment', {
            status: 'SUCCESS',
            transactionId: options.transactionId || order.wechatTransactionId,
            payerOpenId: options.payerOpenId || order.wechatOpenId || order.user.wechatOpenId,
            successTime: Number.isNaN(successTime.getTime()) ? new Date().toISOString() : successTime.toISOString(),
            ...(options.callbackPayload ?? {}),
          }),
          remark: options.remark ? this.appendRemark(order.remark, options.remark) : order.remark,
        },
        include: {
          user: true,
          product: true,
          commissions: true,
        },
      });

      if (updatedOrder.orderType === MEMBERSHIP_PRODUCT_TYPE) {
        await this.membershipsService.grantMembershipFromOrder(tx, updatedOrder.userId, {
          memberLevel: parseMemberLevelInput(updatedOrder.memberLevel, 'standard'),
          grantDays: updatedOrder.grantDays ?? 0,
          orderNo: updatedOrder.orderNo,
        });
      }

      await tx.serviceProduct.update({
        where: { id: updatedOrder.productId },
        data: { salesCount: { increment: 1 } },
      }).catch(() => null);

      await this.ensureCommissionForPaidOrder(tx, updatedOrder);
      return updatedOrder;
    });
  }

  private async markOrderRefundPending(orderId: string, options: RefundTransitionOptions): Promise<OrderWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.serviceOrder.findUnique({
        where: { id: orderId },
        include: {
          user: true,
          product: true,
          commissions: true,
        },
      });
      if (!order) {
        throw new NotFoundException('订单不存在');
      }
      if (order.payStatus === PAYMENT_STATUS_REFUNDED) {
        return order;
      }

      return tx.serviceOrder.update({
        where: { id: orderId },
        data: {
          payStatus: PAYMENT_STATUS_REFUND_PENDING,
          refundReason: options.reason?.trim() || order.refundReason,
          refundAt: null,
          callbackPayload: this.buildCallbackPayloadSection(order.callbackPayload, 'refund', {
            status: options.status || 'PROCESSING',
            outRefundNo: options.outRefundNo || this.readStoredOutRefundNo(order.callbackPayload),
            refundId: options.refundId || null,
            transactionId: options.transactionId || order.wechatTransactionId || null,
            outTradeNo: order.orderNo,
            requestedAt: options.requestedAt || new Date().toISOString(),
            lastSource: options.source,
            request: options.requestPayload ?? undefined,
            response: options.responsePayload ?? undefined,
            notify: options.notifyPayload ?? undefined,
            query: options.queryPayload ?? undefined,
          }),
          remark: options.remark ? this.appendRemark(order.remark, options.remark) : order.remark,
        },
        include: {
          user: true,
          product: true,
          commissions: true,
        },
      });
    });
  }

  private async markOrderRefunded(orderId: string, options: RefundTransitionOptions): Promise<OrderWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.serviceOrder.findUnique({
        where: { id: orderId },
        include: {
          user: true,
          product: true,
          commissions: true,
        },
      });
      if (!order) {
        throw new NotFoundException('订单不存在');
      }
      if (order.payStatus === PAYMENT_STATUS_REFUNDED) {
        return order;
      }
      if (order.payStatus !== PAYMENT_STATUS_PAID && order.payStatus !== PAYMENT_STATUS_REFUND_PENDING) {
        throw new BadRequestException('只有已支付或退款处理中订单才能确认为已退款');
      }

      const successTime = options.successTime ? new Date(options.successTime) : new Date();
      const updated = await tx.serviceOrder.update({
        where: { id: order.id },
        data: {
          payStatus: PAYMENT_STATUS_REFUNDED,
          refundReason: options.reason?.trim() || order.refundReason,
          refundAt: Number.isNaN(successTime.getTime()) ? new Date() : successTime,
          callbackPayload: this.buildCallbackPayloadSection(order.callbackPayload, 'refund', {
            status: options.status || 'SUCCESS',
            outRefundNo: options.outRefundNo || this.readStoredOutRefundNo(order.callbackPayload),
            refundId: options.refundId || null,
            transactionId: options.transactionId || order.wechatTransactionId || null,
            outTradeNo: order.orderNo,
            successTime: Number.isNaN(successTime.getTime()) ? new Date().toISOString() : successTime.toISOString(),
            lastSource: options.source,
            request: options.requestPayload ?? undefined,
            response: options.responsePayload ?? undefined,
            notify: options.notifyPayload ?? undefined,
            query: options.queryPayload ?? undefined,
          }),
          remark: options.remark ? this.appendRemark(order.remark, options.remark) : order.remark,
        },
        include: {
          user: true,
          product: true,
          commissions: true,
        },
      });
      await this.rollbackCommissionForRefund(tx, order.id);
      return updated;
    });
  }

  private async markOrderRefundFailed(orderId: string, options: RefundTransitionOptions): Promise<OrderWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.serviceOrder.findUnique({
        where: { id: orderId },
        include: {
          user: true,
          product: true,
          commissions: true,
        },
      });
      if (!order) {
        throw new NotFoundException('订单不存在');
      }
      if (order.payStatus === PAYMENT_STATUS_REFUNDED) {
        return order;
      }

      return tx.serviceOrder.update({
        where: { id: orderId },
        data: {
          payStatus: order.payStatus === PAYMENT_STATUS_REFUND_PENDING ? PAYMENT_STATUS_PAID : order.payStatus,
          refundReason: options.reason?.trim() || order.refundReason,
          refundAt: null,
          callbackPayload: this.buildCallbackPayloadSection(order.callbackPayload, 'refund', {
            status: options.status || 'ABNORMAL',
            outRefundNo: options.outRefundNo || this.readStoredOutRefundNo(order.callbackPayload),
            refundId: options.refundId || null,
            transactionId: options.transactionId || order.wechatTransactionId || null,
            outTradeNo: order.orderNo,
            failedAt: new Date().toISOString(),
            failureMessage: options.failureMessage || null,
            lastSource: options.source,
            request: options.requestPayload ?? undefined,
            response: options.responsePayload ?? undefined,
            notify: options.notifyPayload ?? undefined,
            query: options.queryPayload ?? undefined,
          }),
          remark: options.remark ? this.appendRemark(order.remark, options.remark) : order.remark,
        },
        include: {
          user: true,
          product: true,
          commissions: true,
        },
      });
    });
  }

  private async closeOrderRecord(orderId: string, reason: string): Promise<OrderWithRelations> {
    const current = await this.prisma.serviceOrder.findUnique({ where: { id: orderId } });
    return this.prisma.serviceOrder.update({
      where: { id: orderId },
      data: {
        payStatus: PAYMENT_STATUS_CLOSED,
        closedAt: new Date(),
        remark: this.appendRemark(current?.remark, reason),
      },
      include: {
        user: true,
        product: true,
        commissions: true,
      },
    });
  }

  private async ensureCommissionForPaidOrder(tx: Prisma.TransactionClient, order: OrderWithRelations) {
    if (!order.user.parentUid) {
      return;
    }
    if (order.commissions.some((item) => item.logType === 1)) {
      return;
    }

    const config = await tx.commissionConfig.findFirst({ orderBy: { id: 'asc' } });
    const rate = config?.oneLevelRate ?? 15;
    const commissionMoney = (Number(order.amount) * rate) / 100;

    await tx.commissionLog.create({
      data: {
        orderId: order.id,
        inviterUid: order.user.parentUid,
        consumeUid: order.user.id,
        commissionRate: rate,
        commissionMoney,
        originalConsumeMoney: order.amount,
        logType: 1,
      },
    });

    await tx.userWallet.upsert({
      where: { userId: order.user.parentUid },
      update: {
        availableBalance: { increment: commissionMoney },
        totalEarn: { increment: commissionMoney },
      },
      create: {
        userId: order.user.parentUid,
        availableBalance: commissionMoney,
        frozenBalance: 0,
        totalEarn: commissionMoney,
      },
    });
  }

  private async rollbackCommissionForRefund(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.serviceOrder.findUnique({
      where: { id: orderId },
      include: { commissions: true },
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    const originalLog = order.commissions.find((item) => item.logType === 1);
    const refundLog = order.commissions.find((item) => item.logType === 2);
    if (!originalLog || refundLog) {
      return;
    }

    await tx.commissionLog.create({
      data: {
        orderId,
        inviterUid: originalLog.inviterUid,
        consumeUid: originalLog.consumeUid,
        commissionRate: originalLog.commissionRate,
        commissionMoney: originalLog.commissionMoney,
        originalConsumeMoney: originalLog.originalConsumeMoney,
        logType: 2,
      },
    });

    const wallet = await tx.userWallet.findUnique({ where: { userId: originalLog.inviterUid } });
    if (!wallet) {
      return;
    }

    const availableBalance = Math.max(Number(wallet.availableBalance) - Number(originalLog.commissionMoney), 0);
    const totalEarn = Math.max(Number(wallet.totalEarn) - Number(originalLog.commissionMoney), 0);

    await tx.userWallet.update({
      where: { userId: originalLog.inviterUid },
      data: {
        availableBalance,
        totalEarn,
      },
    });
  }

  private async getUserOrderOrThrow(userId: string, orderNo: string) {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { orderNo },
      include: {
        user: true,
        product: true,
        commissions: true,
      },
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('无权访问该订单');
    }
    return order;
  }

  private async getOrderByIdOrThrow(orderId: string) {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        product: true,
        commissions: true,
      },
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    return order;
  }

  private toCheckoutOrder(order: OrderWithRelations) {
    return {
      id: order.id,
      orderNo: order.orderNo,
      orderType: order.orderType,
      title: order.title,
      amount: Number(order.amount),
      payStatus: order.payStatus,
      payChannel: order.payChannel,
      payScene: order.payScene,
      memberLevel: normalizeStoredMemberLevel(order.memberLevel),
      memberLevelLabel: order.memberLevel ? getMemberLevelLabel(order.memberLevel) : '普通服务',
      grantDays: order.grantDays,
      payTime: order.payTime,
      expireAt: order.expireAt,
      closedAt: order.closedAt,
      refundReason: order.refundReason,
      refundAt: order.refundAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      checkoutPath: this.buildCheckoutPath(order.orderNo),
      serviceEntryUrl: order.orderType === MEMBERSHIP_PRODUCT_TYPE ? '/personal-center#membership' : `/services/${encodeURIComponent(order.product.id)}`,
      entryLabel: order.orderType === MEMBERSHIP_PRODUCT_TYPE ? '查看会员权益' : '服务入口',
      canContinuePay: order.payStatus === PAYMENT_STATUS_UNPAID,
      product: {
        id: order.product.id,
        name: order.product.name,
        productType: this.normalizeProductType(order.product.productType),
      },
      wechatCodeUrl: order.wechatCodeUrl,
      wechatH5Url: order.wechatH5Url,
      wechatTransactionId: order.wechatTransactionId,
    };
  }

  private detectPayScene(userAgent?: string, scene?: string | null): WechatPayScene {
    const normalized = String(scene || '').trim().toLowerCase();
    if (normalized === 'jsapi' || normalized === 'h5' || normalized === 'native') {
      return normalized;
    }

    const ua = userAgent || '';
    if (WECHAT_USER_AGENT_PATTERN.test(ua)) {
      return 'jsapi';
    }
    if (MOBILE_USER_AGENT_PATTERN.test(ua)) {
      return 'h5';
    }
    return 'native';
  }

  private normalizeProductType(productType?: string | null) {
    return String(productType || SERVICE_PRODUCT_TYPE).trim().toLowerCase() === MEMBERSHIP_PRODUCT_TYPE
      ? MEMBERSHIP_PRODUCT_TYPE
      : SERVICE_PRODUCT_TYPE;
  }

  private normalizeTradeState(tradeState?: string | null) {
    return String(tradeState || '').trim().toUpperCase();
  }

  private normalizeRefundStatus(status?: string | null) {
    return String(status || '').trim().toUpperCase();
  }

  private extractClientIp(context?: PaymentRequestContext) {
    const forwardedFor = context?.forwardedFor || '';
    if (forwardedFor) {
      return forwardedFor.split(',')[0]?.trim() || undefined;
    }
    return context?.requestIp || undefined;
  }

  private normalizeNotifyHeaders(headers: Record<string, string | string[] | undefined>) {
    return Object.entries(headers).reduce<Record<string, string>>((accumulator, [key, value]) => {
      if (typeof value === 'string' && value.trim()) {
        accumulator[key] = value;
      }
      if (Array.isArray(value) && value[0]) {
        accumulator[key] = value[0];
      }
      return accumulator;
    }, {});
  }

  private toFrontendAction(scene: WechatPayScene, payment: WechatGatewayPrepayResponse) {
    if (scene === 'jsapi' && payment.jsapiParams) {
      return 'invoke_jsapi' as const;
    }
    if (scene === 'h5' && payment.h5Url) {
      return 'redirect_h5' as const;
    }
    return 'show_qrcode' as const;
  }

  private buildCheckoutPath(orderNo: string, extraQuery?: Record<string, string>) {
    const query = new URLSearchParams({ orderNo, ...(extraQuery ?? {}) });
    return `/checkout?${query.toString()}`;
  }

  private buildPublicUrl(path: string) {
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    return `${this.getPublicBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private buildPaymentNotifyUrl() {
    const configured = env.wechatPayNotifyUrl.trim();
    if (configured) {
      return configured;
    }
    return this.buildPublicUrl('/api/proxy/payments/wechat/notify');
  }

  private buildRefundNotifyUrl() {
    const configured = env.wechatPayRefundNotifyUrl.trim();
    if (configured) {
      return configured;
    }
    return this.buildPublicUrl('/api/proxy/payments/wechat/refund/notify');
  }

  private getPublicBaseUrl() {
    const base = env.webAppBaseUrl.trim();
    if (!base) {
      throw new BadRequestException('未配置 WEB_APP_BASE_URL，无法生成微信授权回调或 H5 返回地址');
    }
    return base.replace(/\/$/, '');
  }

  private getOrderExpireMinutes() {
    return Number.isFinite(env.wechatPayOrderExpireMinutes) && env.wechatPayOrderExpireMinutes > 0
      ? env.wechatPayOrderExpireMinutes
      : ORDER_EXPIRE_MINUTES_DEFAULT;
  }

  private async generateOrderNo() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = `WX${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const existing = await this.prisma.serviceOrder.findUnique({ where: { orderNo: candidate } });
      if (!existing) {
        return candidate;
      }
    }
    return `WX${Date.now()}${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  }

  private buildOutRefundNo(order: OrderWithRelations) {
    return this.readStoredOutRefundNo(order.callbackPayload) || `${order.orderNo}-R1`;
  }

  private readStoredOutRefundNo(value: Prisma.JsonValue | null | undefined) {
    const root = this.toPlainObject(value);
    const refund = this.toPlainObject(root.refund);
    const outRefundNo = refund.outRefundNo;
    return typeof outRefundNo === 'string' && outRefundNo.trim() ? outRefundNo.trim() : '';
  }

  private buildCallbackPayloadSection(current: Prisma.JsonValue | null | undefined, section: string, nextValue: Record<string, unknown>) {
    const root = this.toPlainObject(current);
    const sectionValue = this.toPlainObject(root[section]);
    root[section] = {
      ...sectionValue,
      ...nextValue,
    };
    return JSON.parse(JSON.stringify(root)) as Prisma.InputJsonValue;
  }

  private toPlainObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private extractRefundResponsePayload(refund: WechatGatewayRefundResponse, fallbackOutRefundNo: string) {
    return {
      refundId: refund.refundId ?? null,
      outRefundNo: refund.outRefundNo ?? fallbackOutRefundNo,
      status: refund.status ?? null,
      raw: refund.raw ?? null,
    };
  }

  private toPrismaJson(value: unknown) {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return Prisma.JsonNull;
    }
    return value as Prisma.InputJsonValue;
  }

  private appendRemark(current: string | null | undefined, next: string) {
    const normalizedCurrent = String(current || '').trim();
    const normalizedNext = next.trim();
    if (!normalizedCurrent) {
      return normalizedNext;
    }
    if (!normalizedNext || normalizedCurrent.includes(normalizedNext)) {
      return normalizedCurrent;
    }
    return `${normalizedCurrent}\n${normalizedNext}`;
  }

  private toFen(amount: Prisma.Decimal | number) {
    return Math.round(Number(amount) * 100);
  }
}
