import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';

interface RecordAdminOperationInput {
  adminUserId?: string | null;
  module: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  requestMethod?: string | null;
  requestPath?: string | null;
  requestPayload?: unknown;
  responseSummary?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AdminOperationLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAdminOperationInput) {
    if (!input.adminUserId || !input.module || !input.action) {
      return;
    }

    await this.prisma.adminOperationLog.create({
      data: {
        adminUserId: input.adminUserId,
        module: input.module,
        action: input.action,
        targetType: input.targetType ?? undefined,
        targetId: input.targetId ?? undefined,
        requestMethod: input.requestMethod ?? undefined,
        requestPath: input.requestPath ?? undefined,
        requestPayload: this.toJsonValue(input.requestPayload),
        responseSummary: input.responseSummary ?? undefined,
        ip: input.ip ?? undefined,
        userAgent: input.userAgent ?? undefined,
      },
    });
  }

  sanitizePayload(payload: unknown) {
    return this.deepSanitize(payload, 0);
  }

  summarizeResponse(data: unknown) {
    if (data === null || data === undefined) {
      return '空响应';
    }

    if (typeof data === 'string') {
      return data.slice(0, 120);
    }

    if (typeof data === 'number' || typeof data === 'boolean') {
      return String(data);
    }

    if (Array.isArray(data)) {
      return `返回数组，数量 ${data.length}`;
    }

    if (typeof data === 'object') {
      const record = data as Record<string, unknown>;
      if (record.deleted === true) {
        return '删除成功';
      }
      if (typeof record.orderNo === 'string') {
        return `订单 ${record.orderNo}`;
      }
      if (typeof record.batchNo === 'string') {
        return `批次 ${record.batchNo}`;
      }
      if (typeof record.username === 'string') {
        return `后台账号 ${record.username}`;
      }
      if (typeof record.code === 'string') {
        return `角色 ${record.code}`;
      }
      if (typeof record.id === 'string' || typeof record.id === 'number' || typeof record.id === 'bigint') {
        return `返回 ID ${String(record.id)}`;
      }
      return `返回字段：${Object.keys(record).slice(0, 6).join('、')}`;
    }

    return '操作成功';
  }

  private deepSanitize(value: unknown, depth: number): Prisma.InputJsonValue | undefined {
    if (depth > 4) {
      return '[MaxDepth]' as Prisma.InputJsonValue;
    }

    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === 'string') {
      return value.length > 500 ? `${value.slice(0, 500)}...(truncated)` : value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.slice(0, 20).map((item) => this.deepSanitize(item, depth + 1) ?? null) as Prisma.InputJsonArray;
    }

    if (typeof value === 'object') {
      const result: Record<string, Prisma.InputJsonValue> = {};
      Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
        if (/(password|token|authorization|cookie|csvText)/i.test(key)) {
          result[key] = '[REDACTED]';
          return;
        }
        const sanitized = this.deepSanitize(item, depth + 1);
        if (sanitized !== undefined) {
          result[key] = sanitized;
        }
      });
      return result as Prisma.InputJsonObject;
    }

    return String(value);
  }

  private toJsonValue(payload: unknown) {
    const sanitized = this.sanitizePayload(payload);
    return sanitized === undefined ? undefined : sanitized;
  }
}
