import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { TestAiModelConfigDto } from '../admin/dto/test-ai-model-config.dto';
import { UpdateAiModelConfigStatusDto } from '../admin/dto/update-ai-model-config-status.dto';
import { UpsertAiModelConfigDto } from '../admin/dto/upsert-ai-model-config.dto';
import { AiConfigCryptoService } from './ai-config-crypto.service';
import { VolcengineArkProvider } from './providers/volcengine-ark.provider';

interface PaginationInput {
  page: number;
  limit: number;
  skip: number;
}

@Injectable()
export class ResumeAiAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: AiConfigCryptoService,
    private readonly provider: VolcengineArkProvider,
  ) {}

  async getAiModelConfigs() {
    const list = await this.prisma.aiModelConfig.findMany({
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    return list.map((item) => this.toPublicConfig(item));
  }

  async createAiModelConfig(dto: UpsertAiModelConfigDto) {
    this.validateConfigDto(dto);
    if (!dto.apiKey?.trim()) {
      throw new BadRequestException('新建模型配置时必须填写 API Key');
    }

    const encryptedApiKey = this.cryptoService.encryptApiKey(dto.apiKey);
    const apiKeyMask = this.cryptoService.maskApiKey(dto.apiKey);

    const created = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.aiModelConfig.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.aiModelConfig.create({
        data: {
          code: dto.code.trim(),
          provider: dto.provider,
          configName: dto.configName.trim(),
          baseUrl: dto.baseUrl.trim(),
          apiKeyEncrypted: encryptedApiKey,
          apiKeyMask,
          modelName: dto.modelName.trim(),
          endpointType: dto.endpointType,
          timeoutMs: dto.timeoutMs,
          maxOutputTokens: dto.maxOutputTokens ?? null,
          temperature: dto.temperature ?? null,
          topP: dto.topP ?? null,
          systemPrompt: this.toNullableText(dto.systemPrompt),
          globalPromptTemplate: this.toNullableText(dto.globalPromptTemplate),
          entryPromptTemplate: this.toNullableText(dto.entryPromptTemplate),
          professionalPromptTemplate: this.toNullableText(dto.professionalPromptTemplate),
          assessmentPromptTemplate: this.toNullableText(dto.assessmentPromptTemplate),
          enabled: dto.enabled,
          isDefault: dto.isDefault,
          remark: this.toNullableText(dto.remark),
        },
      });
    });

    return this.toPublicConfig(created);
  }

  async updateAiModelConfig(id: string, dto: UpsertAiModelConfigDto) {
    this.validateConfigDto(dto);
    const existing = await this.ensureConfigExists(id);

    const nextApiKey = dto.apiKey?.trim();
    const apiKeyEncrypted = nextApiKey
      ? this.cryptoService.encryptApiKey(nextApiKey)
      : existing.apiKeyEncrypted;
    const apiKeyMask = nextApiKey
      ? this.cryptoService.maskApiKey(nextApiKey)
      : existing.apiKeyMask;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.aiModelConfig.updateMany({
          where: { isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }

      return tx.aiModelConfig.update({
        where: { id },
        data: {
          code: dto.code.trim(),
          provider: dto.provider,
          configName: dto.configName.trim(),
          baseUrl: dto.baseUrl.trim(),
          apiKeyEncrypted,
          apiKeyMask,
          modelName: dto.modelName.trim(),
          endpointType: dto.endpointType,
          timeoutMs: dto.timeoutMs,
          maxOutputTokens: dto.maxOutputTokens ?? null,
          temperature: dto.temperature ?? null,
          topP: dto.topP ?? null,
          systemPrompt: this.toNullableText(dto.systemPrompt),
          globalPromptTemplate: this.toNullableText(dto.globalPromptTemplate),
          entryPromptTemplate: this.toNullableText(dto.entryPromptTemplate),
          professionalPromptTemplate: this.toNullableText(dto.professionalPromptTemplate),
          assessmentPromptTemplate: this.toNullableText(dto.assessmentPromptTemplate),
          enabled: dto.enabled,
          isDefault: dto.isDefault,
          remark: this.toNullableText(dto.remark),
        },
      });
    });

    return this.toPublicConfig(updated);
  }

  async updateAiModelConfigStatus(id: string, dto: UpdateAiModelConfigStatusDto) {
    const existing = await this.ensureConfigExists(id);
    const updated = await this.prisma.aiModelConfig.update({
      where: { id },
      data: {
        enabled: dto.enabled,
        isDefault: dto.enabled ? existing.isDefault : false,
      },
    });
    return this.toPublicConfig(updated);
  }

  async testAiModelConfig(id: string, dto: TestAiModelConfigDto) {
    const config = await this.ensureConfigExists(id);
    const apiKey = this.cryptoService.decryptApiKey(config.apiKeyEncrypted);
    const startedAt = Date.now();
    const result = await this.provider.generateText(
      {
        systemPrompt: config.systemPrompt?.trim() || '你是一个严格按要求返回文本的测试助手。',
        userPayloadText: dto.prompt?.trim() || '请严格返回 {"success":true,"message":"ok"}',
        modelName: config.modelName,
        timeoutMs: config.timeoutMs,
        maxOutputTokens: config.maxOutputTokens ?? undefined,
        temperature: config.temperature ? Number(config.temperature) : undefined,
        topP: config.topP ? Number(config.topP) : undefined,
      },
      {
        apiKey,
        baseUrl: config.baseUrl,
      },
    );

    return {
      success: true,
      modelName: config.modelName,
      latencyMs: Date.now() - startedAt,
      previewText: result.rawText,
    };
  }

  async getResumeAiLogs(query: Record<string, string | undefined>) {
    const pagination = this.getPagination(query);
    const where = this.buildLogsWhere(query);
    const [list, total] = await this.prisma.$transaction([
      this.prisma.resumeAiOptimizationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.resumeAiOptimizationLog.count({ where }),
    ]);

    return {
      list: list.map((item) => ({
        id: item.id,
        userId: item.userId,
        resumeId: item.resumeId,
        provider: item.provider,
        modelName: item.modelName,
        optimizeType: item.optimizeType,
        sectionId: item.sectionId,
        entryId: item.entryId,
        status: item.status,
        errorCode: item.errorCode,
        errorMessage: item.errorMessage,
        inputTokens: item.inputTokens,
        outputTokens: item.outputTokens,
        latencyMs: item.latencyMs,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      pagination: this.toPagination(total, pagination),
    };
  }

  private validateConfigDto(dto: UpsertAiModelConfigDto) {
    if (dto.isDefault && !dto.enabled) {
      throw new BadRequestException('默认模型配置必须保持启用状态');
    }
  }

  private async ensureConfigExists(id: string) {
    const item = await this.prisma.aiModelConfig.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('AI 模型配置不存在');
    }
    return item;
  }

  private toPublicConfig(item: {
    id: string;
    code: string;
    provider: string;
    configName: string;
    baseUrl: string;
    apiKeyMask: string | null;
    modelName: string;
    endpointType: string;
    timeoutMs: number;
    maxOutputTokens: number | null;
    temperature: Prisma.Decimal | null;
    topP: Prisma.Decimal | null;
    systemPrompt: string | null;
    globalPromptTemplate: string | null;
    entryPromptTemplate: string | null;
    professionalPromptTemplate: string | null;
    assessmentPromptTemplate: string | null;
    enabled: boolean;
    isDefault: boolean;
    remark: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: item.id,
      code: item.code,
      provider: item.provider,
      configName: item.configName,
      baseUrl: item.baseUrl,
      apiKeyMask: item.apiKeyMask,
      modelName: item.modelName,
      endpointType: item.endpointType,
      timeoutMs: item.timeoutMs,
      maxOutputTokens: item.maxOutputTokens,
      temperature: item.temperature ? Number(item.temperature) : null,
      topP: item.topP ? Number(item.topP) : null,
      systemPrompt: item.systemPrompt,
      globalPromptTemplate: item.globalPromptTemplate,
      entryPromptTemplate: item.entryPromptTemplate,
      professionalPromptTemplate: item.professionalPromptTemplate,
      assessmentPromptTemplate: item.assessmentPromptTemplate,
      enabled: item.enabled,
      isDefault: item.isDefault,
      remark: item.remark,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private buildLogsWhere(query: Record<string, string | undefined>): Prisma.ResumeAiOptimizationLogWhereInput {
    const keyword = query.keyword?.trim();
    const and: Prisma.ResumeAiOptimizationLogWhereInput[] = [];

    if (keyword) {
      and.push({
        OR: [
          { userId: { contains: keyword } },
          { resumeId: { contains: keyword } },
          { entryId: { contains: keyword } },
        ],
      });
    }
    if (query.status) {
      and.push({ status: query.status });
    }
    if (query.sectionId) {
      and.push({ sectionId: query.sectionId });
    }
    if (query.optimizeType) {
      and.push({ optimizeType: query.optimizeType });
    }

    return and.length ? { AND: and } : {};
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

  private toNullableText(value: string | undefined) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}
