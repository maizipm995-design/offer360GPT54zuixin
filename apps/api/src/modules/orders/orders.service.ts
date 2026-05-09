import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async getMyOrders(userId: string) {
    const orders = await this.prisma.serviceOrder.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      orders.map(async (item) => ({
        id: item.id,
        orderNo: item.orderNo,
        orderType: item.orderType,
        title: item.title,
        amount: Number(item.amount),
        payStatus: item.payStatus,
        payScene: item.payScene,
        payTime: item.payTime,
        expireAt: item.expireAt,
        closedAt: item.closedAt,
        createdAt: item.createdAt,
        productName: item.product.name,
        serviceEntryUrl: item.orderType === 'membership' ? '/personal-center#membership' : `/services/${encodeURIComponent(item.product.id)}`,
        entryLabel: item.orderType === 'membership' ? '查看会员权益' : '服务入口',
        checkoutPath: `/checkout?orderNo=${encodeURIComponent(item.orderNo)}`,
        canContinuePay: item.payStatus === 'unpaid',
        orderServiceText: item.orderType === 'membership'
          ? null
          : item.product.orderServiceText?.trim() || `${item.product.name} 已购买成功，我们会根据服务流程尽快与您联系，请留意站内通知或客服消息。`,
        orderServiceImageUrl: item.orderType === 'membership'
          ? null
          : (await this.storageService.resolveAssetAccessUrl(item.product.orderServiceImageUrl)) || null,
      })),
    );
  }
}
