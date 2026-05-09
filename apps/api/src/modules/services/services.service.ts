import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async getList() {
    const services = await this.prisma.serviceProduct.findMany({
      where: {
        status: true,
        productType: 'service',
      },
      orderBy: [{ isHot: 'desc' }, { salesCount: 'desc' }],
    });

    return Promise.all(services.map((item) => this.hydrateServiceProduct(item)));
  }

  async getDetail(id: string) {
    const item = await this.prisma.serviceProduct.findUnique({ where: { id } });
    if (!item || !item.status || item.productType !== 'service') {
      throw new NotFoundException('服务商品不存在');
    }

    return this.hydrateServiceProduct(item);
  }

  private async hydrateServiceProduct<
    T extends {
      price: { toString(): string } | number;
      originalPrice: { toString(): string } | number;
      score: { toString(): string } | number;
      detailHtml?: string | null;
      orderServiceImageUrl?: string | null;
    },
  >(item: T) {
    const detailPayload = await this.storageService.buildHtmlPreviewPayload(item.detailHtml ?? '');
    const orderServiceImagePreviewUrl = await this.storageService.resolveAssetAccessUrl(item.orderServiceImageUrl);

    return {
      ...item,
      price: Number(item.price),
      originalPrice: Number(item.originalPrice),
      score: Number(item.score),
      detailHtml: detailPayload.previewHtml || null,
      orderServiceImageUrl: orderServiceImagePreviewUrl || null,
    };
  }
}
