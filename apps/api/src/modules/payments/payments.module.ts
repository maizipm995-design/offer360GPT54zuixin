import { Module } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { PrismaService } from '../../prisma.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { WechatGatewayClient } from './wechat-gateway.client';

@Module({
  imports: [MembershipsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, WechatGatewayClient, PrismaService],
  exports: [PaymentsService, WechatGatewayClient],
})
export class PaymentsModule {}
