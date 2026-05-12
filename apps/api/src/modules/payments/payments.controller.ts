import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createOrder(@CurrentUser() user: CurrentUserPayload, @Body() body: { productId?: string; userAgent?: string }) {
    return this.paymentsService.createCheckoutOrder(user.userId, body);
  }

  @Get('orders/:orderNo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param('orderNo') orderNo: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-forwarded-for') forwardedFor?: string,
    @Req() request?: Request,
  ) {
    return this.paymentsService.getCheckoutOrder(user.userId, orderNo, {
      userAgent,
      forwardedFor,
      requestIp: request?.ip,
    });
  }

  @Post('orders/:orderNo/prepare')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  prepareOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param('orderNo') orderNo: string,
    @Body()
    body: {
      scene?: 'jsapi' | 'h5' | 'native';
      userAgent?: string;
      clientIp?: string;
      returnPath?: string;
      useBalance?: boolean;
    },
    @Headers('user-agent') userAgent?: string,
    @Headers('x-forwarded-for') forwardedFor?: string,
    @Req() request?: Request,
  ) {
    return this.paymentsService.prepareCheckoutPayment(user.userId, orderNo, {
      scene: body.scene,
      userAgent: body.userAgent || userAgent,
      clientIp: body.clientIp,
      forwardedFor,
      requestIp: request?.ip,
      returnPath: body.returnPath,
      useBalance: body.useBalance,
    });
  }

  @Post('orders/:orderNo/close')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  closeOrder(@CurrentUser() user: CurrentUserPayload, @Param('orderNo') orderNo: string) {
    return this.paymentsService.closeCheckoutOrder(user.userId, orderNo);
  }

  @Get('wechat/oauth-url/:orderNo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getWechatOauthUrl(
    @CurrentUser() user: CurrentUserPayload,
    @Param('orderNo') orderNo: string,
    @Headers('referer') referer?: string,
  ) {
    return this.paymentsService.buildWechatOauthUrl(user.userId, orderNo, referer);
  }

  @Post('wechat/oauth/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  completeWechatOauth(@CurrentUser() user: CurrentUserPayload, @Body() body: { orderNo?: string; code?: string }) {
    return this.paymentsService.completeWechatOauth(user.userId, body.orderNo ?? '', body.code ?? '');
  }

  @Post('wechat/notify')
  async handleWechatNotify(
    @Req() request: Request & { rawBody?: Buffer },
    @Res() response: Response,
  ) {
    try {
      const rawBody = request.rawBody?.toString('utf8') ?? '';
      await this.paymentsService.handleWechatPaymentNotify(rawBody, request.headers);
      response.status(200).json({ code: 'SUCCESS', message: '成功' });
    } catch (error) {
      response.status(500).json({
        code: 'FAIL',
        message: error instanceof Error ? error.message : '微信支付回调处理失败',
      });
    }
  }

  @Post('wechat/refund/notify')
  async handleWechatRefundNotify(
    @Req() request: Request & { rawBody?: Buffer },
    @Res() response: Response,
  ) {
    try {
      const rawBody = request.rawBody?.toString('utf8') ?? '';
      await this.paymentsService.handleWechatRefundNotify(rawBody, request.headers);
      response.status(200).json({ code: 'SUCCESS', message: '成功' });
    } catch (error) {
      response.status(500).json({
        code: 'FAIL',
        message: error instanceof Error ? error.message : '微信退款回调处理失败',
      });
    }
  }
}
