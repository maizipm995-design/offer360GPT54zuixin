import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  getMemberLevelLabel,
  normalizeStoredMemberLevel,
  parseMemberLevelInput,
} from '../../common/utils/member-access';
import { PrismaService } from '../../prisma.service';
import { stringifyCsv } from './utils/csv';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const REDEEM_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const REDEEM_CODE_LENGTH = 20;
const MIN_RANDOM_CODE_BATCH_SIZE = 32;

interface PaginationInput {
  page: number;
  limit: number;
  skip: number;
}

@Injectable()
export class AdminRedeemService {
  constructor(private readonly prisma: PrismaService) {}

  async getRedeemBatches(query: Record<string, string | undefined>) {
    const pagination = this.getPagination(query);
    const where = this.buildRedeemBatchWhere(query);
    const [list, total] = await this.prisma.$transaction([
      this.prisma.membershipRedeemCodeBatch.findMany({
        where,
        include: {
          createdByAdmin: {
            select: {
              id: true,
              username: true,
              realName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.membershipRedeemCodeBatch.count({ where }),
    ]);

    return {
      list: list.map((item) => this.toRedeemBatchItem(item)),
      pagination: this.toPagination(total, pagination),
    };
  }

  async createRedeemBatch(body: Record<string, unknown>, adminId: string) {
    const batchNo = await this.resolveBatchNo(this.readOptionalString(body.batchNo));
    const memberLevel = parseMemberLevelInput(body.memberLevel, 'standard');
    const cardType = this.readRequiredString(body.cardType, '卡类型不能为空');
    const grantDays = this.readRequiredNumber(body.grantDays, '赠送天数不能为空');
    const quantity = this.readRequiredNumber(body.quantity, '兑换码数量不能为空');

    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 5000) {
      throw new BadRequestException('单批次兑换码数量需在 1 到 5000 之间');
    }
    if (!Number.isInteger(grantDays) || grantDays <= 0) {
      throw new BadRequestException('赠送天数必须为大于 0 的整数');
    }

    const validFrom = this.readOptionalDate(body.validFrom);
    const validUntil = this.readOptionalDate(body.validUntil);
    if (validFrom && validUntil && validFrom > validUntil) {
      throw new BadRequestException('生效时间不能晚于失效时间');
    }

    const remark = this.readOptionalString(body.remark) || null;
    const status = this.readOptionalString(body.status) || 'active';

    const batch = await this.prisma.$transaction(async (tx) => {
      const createdBatch = await tx.membershipRedeemCodeBatch.create({
        data: {
          batchNo,
          memberLevel,
          cardType,
          grantDays,
          quantity,
          usedCount: 0,
          status,
          validFrom,
          validUntil,
          remark,
          createdByAdminId: adminId,
        },
        include: {
          createdByAdmin: {
            select: {
              id: true,
              username: true,
              realName: true,
            },
          },
        },
      });

      await tx.membershipRedeemCode.createMany({
        data: (await this.generateRedeemCodes(tx, quantity)).map((code) => ({
          code,
          batchId: createdBatch.id,
          validUntil,
          status: 'unused',
        })),
      });

      return createdBatch;
    });

    return this.toRedeemBatchItem(batch);
  }

  async updateRedeemBatch(id: string, body: Record<string, unknown>) {
    const existing = await this.prisma.membershipRedeemCodeBatch.findUnique({
      where: { id },
      include: {
        createdByAdmin: {
          select: {
            id: true,
            username: true,
            realName: true,
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('兑换码批次不存在');
    }

    const validFrom = body.validFrom === undefined ? existing.validFrom : this.readOptionalDate(body.validFrom);
    const validUntil = body.validUntil === undefined ? existing.validUntil : this.readOptionalDate(body.validUntil);
    if (validFrom && validUntil && validFrom > validUntil) {
      throw new BadRequestException('生效时间不能晚于失效时间');
    }

    const nextMemberLevel = body.memberLevel === undefined
      ? normalizeStoredMemberLevel(existing.memberLevel) ?? 'standard'
      : parseMemberLevelInput(body.memberLevel, 'standard');

    if (body.memberLevel !== undefined && existing.usedCount > 0 && nextMemberLevel !== normalizeStoredMemberLevel(existing.memberLevel)) {
      throw new BadRequestException('已有兑换记录的批次不可修改会员等级');
    }

    const updated = await this.prisma.membershipRedeemCodeBatch.update({
      where: { id },
      data: {
        memberLevel: nextMemberLevel,
        status: this.readOptionalString(body.status) || existing.status,
        validFrom,
        validUntil,
        remark: body.remark === undefined ? existing.remark : this.readOptionalString(body.remark) || null,
      },
      include: {
        createdByAdmin: {
          select: {
            id: true,
            username: true,
            realName: true,
          },
        },
      },
    });

    if (validUntil !== existing.validUntil) {
      await this.prisma.membershipRedeemCode.updateMany({
        where: {
          batchId: id,
          status: 'unused',
        },
        data: { validUntil },
      });
    }

    return this.toRedeemBatchItem(updated);
  }

  async getRedeemCodes(query: Record<string, string | undefined>) {
    const pagination = this.getPagination(query);
    const where = this.buildRedeemCodeWhere(query);
    const [list, total, unusedCount, usedCount, voidCount, expiredCount] = await Promise.all([
      this.prisma.membershipRedeemCode.findMany({
        where,
        include: {
          batch: {
            select: {
              id: true,
              batchNo: true,
              memberLevel: true,
              cardType: true,
              grantDays: true,
              status: true,
              validFrom: true,
              validUntil: true,
            },
          },
          invalidatedByAdmin: {
            select: {
              id: true,
              username: true,
              realName: true,
            },
          },
          useLogs: {
            orderBy: { usedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.membershipRedeemCode.count({ where }),
      this.prisma.membershipRedeemCode.count({ where: { ...where, status: 'unused', OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }] } }),
      this.prisma.membershipRedeemCode.count({ where: { ...where, status: 'used' } }),
      this.prisma.membershipRedeemCode.count({ where: { ...where, status: 'void' } }),
      this.prisma.membershipRedeemCode.count({ where: { ...where, status: 'unused', validUntil: { lt: new Date() } } }),
    ]);

    const userIds = Array.from(new Set(list.map((item) => item.usedByUserId).filter(Boolean))) as string[];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, phone: true },
        })
      : [];
    const userMap = new Map(users.map((item) => [item.id, item.phone]));

    return {
      stats: {
        total,
        unusedCount,
        usedCount,
        voidCount,
        expiredCount,
      },
      list: list.map((item) => this.toRedeemCodeItem(item, userMap)),
      pagination: this.toPagination(total, pagination),
    };
  }

  async exportRedeemCodes(query: Record<string, string | undefined>) {
    const where = this.buildRedeemCodeWhere(query);
    const list = await this.prisma.membershipRedeemCode.findMany({
      where,
      include: {
        batch: {
          select: {
            batchNo: true,
            memberLevel: true,
            cardType: true,
            grantDays: true,
            status: true,
            validFrom: true,
            validUntil: true,
          },
        },
        invalidatedByAdmin: {
          select: {
            username: true,
            realName: true,
          },
        },
        useLogs: {
          orderBy: { usedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { code: 'asc' }],
    });

    const userIds = Array.from(new Set(list.map((item) => item.usedByUserId).filter(Boolean))) as string[];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, phone: true },
        })
      : [];
    const userMap = new Map(users.map((item) => [item.id, item.phone]));

    return this.buildDownload('会员兑换码全量导出.csv', [
      ['兑换码', '批次号', '会员等级', '会员等级文案', '时长类型', '发放天数', '状态', '批次状态', '批次生效时间', '批次失效时间', '兑换码失效时间', '使用用户手机号', '使用时间', '作废管理员', '作废原因', '最近备注', '创建时间', '更新时间'],
      ...list.map((item) => {
        const latestLog = item.useLogs[0];
        const effectiveStatus = this.getEffectiveCodeStatus(item.status, item.validUntil);
        return [
          item.code,
          item.batch.batchNo,
          normalizeStoredMemberLevel(item.batch.memberLevel) ?? 'standard',
          getMemberLevelLabel(item.batch.memberLevel),
          item.batch.cardType,
          item.batch.grantDays,
          effectiveStatus,
          item.batch.status,
          this.readString(item.batch.validFrom),
          this.readString(item.batch.validUntil),
          this.readString(item.validUntil),
          item.usedByUserId ? userMap.get(item.usedByUserId) || '' : '',
          this.readString(item.usedAt),
          item.invalidatedByAdmin?.realName || item.invalidatedByAdmin?.username || '',
          this.readString(item.invalidReason),
          latestLog?.remark || '',
          this.readString(item.createdAt),
          this.readString(item.updatedAt),
        ];
      }),
    ]);
  }

  async getRedeemRecords(query: Record<string, string | undefined>) {
    const pagination = this.getPagination(query);
    const keyword = query.keyword?.trim();
    const where = await this.buildRedeemRecordWhere(query, keyword);
    const [list, total] = await Promise.all([
      this.prisma.membershipRedeemUseLog.findMany({
        where,
        include: {
          batch: {
            select: {
              id: true,
              batchNo: true,
              memberLevel: true,
              cardType: true,
              grantDays: true,
            },
          },
          code: {
            select: {
              id: true,
              code: true,
            },
          },
        },
        orderBy: { usedAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.membershipRedeemUseLog.count({ where }),
    ]);

    const userIds = Array.from(new Set(list.map((item) => item.userId).filter(Boolean)));
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, phone: true },
        })
      : [];
    const userMap = new Map(users.map((item) => [item.id, item.phone]));

    return {
      list: list.map((item) => ({
        id: String(item.id),
        batchId: item.batchId,
        batchNo: item.batch.batchNo,
        codeId: item.codeId,
        code: item.code.code,
        userId: item.userId,
        userPhone: userMap.get(item.userId) || '',
        memberLevel: normalizeStoredMemberLevel(item.batch.memberLevel) ?? 'standard',
        memberLevelLabel: getMemberLevelLabel(item.batch.memberLevel),
        cardType: item.batch.cardType,
        grantDays: item.grantDays,
        usedAt: item.usedAt,
        remark: item.remark,
      })),
      pagination: this.toPagination(total, pagination),
    };
  }

  async updateRedeemCode(id: string, body: Record<string, unknown>, adminId: string) {
    const code = await this.prisma.membershipRedeemCode.findUnique({ where: { id } });
    if (!code) {
      throw new NotFoundException('兑换码不存在');
    }

    const nextStatus = this.readRequiredString(body.status, '请选择兑换码状态');
    const now = new Date();

    if (nextStatus === 'void') {
      if (code.status === 'used') {
        throw new BadRequestException('已使用兑换码不可作废');
      }
      if (this.getEffectiveCodeStatus(code.status, code.validUntil) === 'expired') {
        throw new BadRequestException('已过期兑换码不可再次作废');
      }

      await this.prisma.membershipRedeemCode.update({
        where: { id },
        data: {
          status: 'void',
          invalidatedAt: now,
          invalidatedByAdminId: adminId,
          invalidReason: this.readOptionalString(body.invalidReason) || '后台手动作废',
        },
      });
    } else if (nextStatus === 'unused') {
      if (code.status !== 'void') {
        throw new BadRequestException('仅作废兑换码支持恢复为未使用');
      }
      if (code.validUntil && code.validUntil < now) {
        throw new BadRequestException('已过期兑换码不可恢复为未使用');
      }

      await this.prisma.membershipRedeemCode.update({
        where: { id },
        data: {
          status: 'unused',
          invalidatedAt: null,
          invalidatedByAdminId: null,
          invalidReason: null,
        },
      });
    } else {
      throw new BadRequestException('当前仅支持作废或恢复兑换码');
    }

    const result = await this.getRedeemCodes({ id, page: '1', limit: '1' });
    if (!result.list.length) {
      throw new NotFoundException('兑换码不存在');
    }
    return result.list[0];
  }

  private getPagination(query: Record<string, string | undefined>): PaginationInput {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    return {
      page,
      limit,
      skip: (page - 1) * limit,
    };
  }

  private toPagination(total: number, pagination: PaginationInput) {
    return {
      page: pagination.page,
      limit: pagination.limit,
      total,
      hasMore: pagination.page * pagination.limit < total,
    };
  }

  private buildRedeemBatchWhere(query: Record<string, string | undefined>): Prisma.MembershipRedeemCodeBatchWhereInput {
    const keyword = query.keyword?.trim();
    const and: Prisma.MembershipRedeemCodeBatchWhereInput[] = [];

    if (keyword) {
      and.push({
        OR: [{ batchNo: { contains: keyword } }, { cardType: { contains: keyword } }, { remark: { contains: keyword } }],
      });
    }
    if (query.status) {
      and.push({ status: query.status });
    }
    if (query.memberLevel) {
      and.push({ memberLevel: parseMemberLevelInput(query.memberLevel) });
    }

    return and.length ? { AND: and } : {};
  }

  private buildRedeemCodeWhere(query: Record<string, string | undefined>): Prisma.MembershipRedeemCodeWhereInput {
    const keyword = query.keyword?.trim();
    const now = new Date();
    const and: Prisma.MembershipRedeemCodeWhereInput[] = [];

    if (query.id) {
      and.push({ id: query.id });
    }
    if (query.batchId) {
      and.push({ batchId: query.batchId });
    }
    if (query.memberLevel) {
      and.push({ batch: { is: { memberLevel: parseMemberLevelInput(query.memberLevel) } } });
    }
    if (keyword) {
      and.push({
        OR: [{ code: { contains: keyword } }, { batch: { is: { batchNo: { contains: keyword } } } }],
      });
    }

    if (query.status === 'unused') {
      and.push({ status: 'unused' });
      and.push({ OR: [{ validUntil: null }, { validUntil: { gte: now } }] });
    } else if (query.status === 'expired') {
      and.push({ status: 'unused' });
      and.push({ validUntil: { lt: now } });
    } else if (query.status) {
      and.push({ status: query.status });
    }

    return and.length ? { AND: and } : {};
  }

  private async buildRedeemRecordWhere(query: Record<string, string | undefined>, keyword?: string): Promise<Prisma.MembershipRedeemUseLogWhereInput> {
    const and: Prisma.MembershipRedeemUseLogWhereInput[] = [];

    if (query.batchId) {
      and.push({ batchId: query.batchId });
    }
    if (query.cardType) {
      and.push({ batch: { is: { cardType: query.cardType } } });
    }
    if (query.memberLevel) {
      and.push({ batch: { is: { memberLevel: parseMemberLevelInput(query.memberLevel) } } });
    }
    if (keyword) {
      const matchedUsers = await this.prisma.user.findMany({
        where: { phone: { contains: keyword } },
        select: { id: true },
        take: 50,
      });
      const matchedUserIds = matchedUsers.map((item) => item.id);
      const keywordOr: Prisma.MembershipRedeemUseLogWhereInput[] = [
        { code: { is: { code: { contains: keyword } } } },
        { batch: { is: { batchNo: { contains: keyword } } } },
      ];
      if (matchedUserIds.length) {
        keywordOr.push({ userId: { in: matchedUserIds } });
      }
      and.push({ OR: keywordOr });
    }

    return and.length ? { AND: and } : {};
  }

  private getEffectiveCodeStatus(status: string, validUntil?: Date | null) {
    if (status === 'unused' && validUntil && validUntil.getTime() < Date.now()) {
      return 'expired';
    }
    return status;
  }

  private async resolveBatchNo(input?: string) {
    const preferred = input?.trim().toUpperCase();
    if (preferred) {
      const exists = await this.prisma.membershipRedeemCodeBatch.findUnique({ where: { batchNo: preferred } });
      if (exists) {
        throw new BadRequestException('批次号已存在');
      }
      return preferred;
    }

    const day = new Date();
    const prefix = `RC${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, '0')}${String(day.getDate()).padStart(2, '0')}`;
    for (let index = 1; index <= 50; index += 1) {
      const candidate = `${prefix}${String(index).padStart(2, '0')}`;
      const exists = await this.prisma.membershipRedeemCodeBatch.findUnique({ where: { batchNo: candidate } });
      if (!exists) {
        return candidate;
      }
    }

    return `${prefix}${Math.floor(Date.now() / DAY_IN_MS)}`;
  }

  private async generateRedeemCodes(tx: Prisma.TransactionClient, quantity: number) {
    const result = new Set<string>();

    while (result.size < quantity) {
      const remaining = quantity - result.size;
      const nextBatchSize = Math.max(MIN_RANDOM_CODE_BATCH_SIZE, remaining * 2);
      const localCandidates = new Set<string>();

      while (localCandidates.size < nextBatchSize) {
        const candidate = this.buildRandomRedeemCode();
        if (!result.has(candidate)) {
          localCandidates.add(candidate);
        }
      }

      const candidateList = Array.from(localCandidates);
      const existing = await tx.membershipRedeemCode.findMany({
        where: { code: { in: candidateList } },
        select: { code: true },
      });
      const existingSet = new Set(existing.map((item) => item.code));

      for (const candidate of candidateList) {
        if (!existingSet.has(candidate)) {
          result.add(candidate);
          if (result.size >= quantity) {
            break;
          }
        }
      }
    }

    return Array.from(result);
  }

  private buildRandomRedeemCode() {
    while (true) {
      const bytes = randomBytes(REDEEM_CODE_LENGTH);
      let code = '';

      for (let index = 0; index < REDEEM_CODE_LENGTH; index += 1) {
        code += REDEEM_CODE_ALPHABET[bytes[index] % REDEEM_CODE_ALPHABET.length];
      }

      // 每个兑换码都至少包含 1 个字母和 1 个数字，避免出现纯字母或纯数字。
      if (/[A-Z]/.test(code) && /\d/.test(code)) {
        return code;
      }
    }
  }

  private toRedeemBatchItem(
    item: Prisma.MembershipRedeemCodeBatchGetPayload<{
      include: {
        createdByAdmin: {
          select: {
            id: true;
            username: true;
            realName: true;
          };
        };
      };
    }>,
  ) {
    const memberLevel = normalizeStoredMemberLevel(item.memberLevel) ?? 'standard';
    return {
      id: item.id,
      batchNo: item.batchNo,
      memberLevel,
      memberLevelLabel: getMemberLevelLabel(item.memberLevel),
      cardType: item.cardType,
      grantDays: item.grantDays,
      quantity: item.quantity,
      usedCount: item.usedCount,
      unusedCount: Math.max(item.quantity - item.usedCount, 0),
      status: item.status,
      validFrom: item.validFrom,
      validUntil: item.validUntil,
      remark: item.remark,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      createdByAdminName: item.createdByAdmin?.realName || item.createdByAdmin?.username || '',
    };
  }

  private toRedeemCodeItem(
    item: Prisma.MembershipRedeemCodeGetPayload<{
      include: {
        batch: {
          select: {
            id: true;
            batchNo: true;
            memberLevel: true;
            cardType: true;
            grantDays: true;
            status: true;
            validFrom: true;
            validUntil: true;
          };
        };
        invalidatedByAdmin: {
          select: {
            id: true;
            username: true;
            realName: true;
          };
        };
        useLogs: true;
      };
    }>,
    userMap: Map<string, string>,
  ) {
    const latestLog = item.useLogs[0];
    const effectiveStatus = this.getEffectiveCodeStatus(item.status, item.validUntil);
    return {
      id: item.id,
      code: item.code,
      batchId: item.batchId,
      batchNo: item.batch.batchNo,
      memberLevel: normalizeStoredMemberLevel(item.batch.memberLevel) ?? 'standard',
      memberLevelLabel: getMemberLevelLabel(item.batch.memberLevel),
      cardType: item.batch.cardType,
      grantDays: item.batch.grantDays,
      status: effectiveStatus,
      validUntil: item.validUntil,
      usedByUserId: item.usedByUserId,
      usedByUserPhone: item.usedByUserId ? userMap.get(item.usedByUserId) || '' : '',
      usedAt: item.usedAt,
      invalidatedAt: item.invalidatedAt,
      invalidReason: item.invalidReason,
      invalidatedByAdminName: item.invalidatedByAdmin?.realName || item.invalidatedByAdmin?.username || '',
      latestRemark: latestLog?.remark || '',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private buildDownload(filename: string, rows: Array<Array<string | number | boolean | null | undefined>>) {
    return {
      filename,
      mimeType: 'text/csv;charset=utf-8',
      content: `\uFEFF${stringifyCsv(rows)}`,
    };
  }

  private readRequiredString(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(message);
    }
    return value.trim();
  }

  private readOptionalString(value: unknown) {
    if (value === null || value === undefined) return undefined;
    return String(value).trim();
  }

  private readRequiredNumber(value: unknown, message: string) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException(message);
    }
    return parsed;
  }

  private readOptionalDate(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('日期格式不正确');
    }
    return date;
  }

  private readString(value: unknown) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  }
}
