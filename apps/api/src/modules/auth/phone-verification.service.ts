import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../../prisma.service';
import { env } from '../../config/env';
import { AliyunSmsService } from './aliyun-sms.service';
import { AUTH_CODE_BUSINESS_LABELS, AuthCodeBusiness } from './auth-code.constants';

@Injectable()
export class PhoneVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aliyunSmsService: AliyunSmsService,
  ) {}

  async sendCode(phone: string, business: AuthCodeBusiness) {
    const normalizedPhone = phone.trim();
    const normalizedBusiness = business.trim() as AuthCodeBusiness;
    const now = new Date();
    const activeRecord = await this.prisma.phoneVerificationCode.findUnique({
      where: {
        phone_business: {
          phone: normalizedPhone,
          business: normalizedBusiness,
        },
      },
    });

    if (activeRecord && activeRecord.expiresAt.getTime() > now.getTime()) {
      return {
        business: normalizedBusiness,
        businessLabel: AUTH_CODE_BUSINESS_LABELS[normalizedBusiness],
        phone: normalizedPhone,
        expiresAt: activeRecord.expiresAt.toISOString(),
        reused: true,
        sent: false,
        cooldownSeconds: 60,
      };
    }

    const code = this.generateCode();
    // 强制使用 300 秒（5 分钟）有效期，确保后端时效性准确
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
    const smsResult = await this.aliyunSmsService.sendVerificationCode(normalizedPhone, code);

    await this.prisma.phoneVerificationCode.upsert({
      where: {
        phone_business: {
          phone: normalizedPhone,
          business: normalizedBusiness,
        },
      },
      create: {
        phone: normalizedPhone,
        business: normalizedBusiness,
        codeHash: this.hashCode(normalizedPhone, normalizedBusiness, code),
        expiresAt,
        lastSentAt: now,
        sendCount: 1,
      },
      update: {
        codeHash: this.hashCode(normalizedPhone, normalizedBusiness, code),
        expiresAt,
        lastSentAt: now,
        verifiedAt: null,
        sendCount: {
          increment: 1,
        },
      },
    });

    return {
      business: normalizedBusiness,
      businessLabel: AUTH_CODE_BUSINESS_LABELS[normalizedBusiness],
      phone: normalizedPhone,
      expiresAt: expiresAt.toISOString(),
      reused: false,
      sent: true,
      cooldownSeconds: 60,
      deliveryMode: smsResult.deliveryMode,
      debugCode: smsResult.debugCode,
    };
  }

  async verifyCode(phone: string, business: AuthCodeBusiness, inputCode: string) {
    const normalizedPhone = phone.trim();
    const normalizedBusiness = business.trim() as AuthCodeBusiness;
    const record = await this.prisma.phoneVerificationCode.findUnique({
      where: {
        phone_business: {
          phone: normalizedPhone,
          business: normalizedBusiness,
        },
      },
    });

    if (!record || record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(`${AUTH_CODE_BUSINESS_LABELS[normalizedBusiness]}验证码已失效，请重新获取`);
    }

    const normalizedCode = inputCode.trim();
    if (record.codeHash !== this.hashCode(normalizedPhone, normalizedBusiness, normalizedCode)) {
      throw new BadRequestException('验证码错误，请重新输入');
    }

    await this.prisma.phoneVerificationCode.update({
      where: { id: record.id },
      data: { verifiedAt: new Date() },
    });

    return {
      business: normalizedBusiness,
      businessLabel: AUTH_CODE_BUSINESS_LABELS[normalizedBusiness],
      verified: true,
      expiresAt: record.expiresAt.toISOString(),
    };
  }

  async clearCode(phone: string, business: AuthCodeBusiness) {
    const normalizedPhone = phone.trim();
    const normalizedBusiness = business.trim() as AuthCodeBusiness;
    await this.prisma.phoneVerificationCode.deleteMany({
      where: {
        phone: normalizedPhone,
        business: normalizedBusiness,
      },
    });
  }

  private generateCode() {
    const max = 10 ** env.authCodeLength;
    const min = 10 ** (env.authCodeLength - 1);
    return String(randomInt(min, max));
  }

  private hashCode(phone: string, business: AuthCodeBusiness, code: string) {
    return createHash('sha256')
      .update(`${env.authCodeSecret}:${phone}:${business}:${code.trim()}`)
      .digest('hex');
  }
}
