import {
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import { getUserMemberAccess } from '../../common/utils/member-access';
import { PrismaService } from '../../prisma.service';
import { createHash } from 'node:crypto';
import { ResumeService } from '../resume/resume.service';
import { OptimizeResumeGlobalDto } from './dto/optimize-resume-global.dto';
import {
  OptimizeResumeEntryDto,
  type ResumeAiEntrySectionId,
} from './dto/optimize-resume-entry.dto';
import { OptimizeResumeProfessionalDto } from './dto/optimize-resume-professional.dto';
import {
  OptimizeResumeSectionDto,
  type ResumeAiSectionId,
} from './dto/optimize-resume-section.dto';
import { ResumeAiPromptBuilder } from './resume-ai.prompt';
import {
  TranslateResumeDto,
} from './dto/translate-resume.dto';
import {
  type AiProviderResult,
  VolcengineArkProvider,
} from './providers/volcengine-ark.provider';
import { AiConfigCryptoService } from './ai-config-crypto.service';

type ResumeAiEntryRecord = Record<string, unknown> & { id: string };
type ResumeAiTextRecord = Record<string, unknown> & { id: string };
type ResumeAiGlobalTextUpdate = { entryId: string; value: string };
type ResumeAiOptimizeMode = 'entry' | 'section' | 'global' | 'translate' | 'professional';
type ResumeAiAsyncOptimizeType = 'global' | 'translate' | 'professional';
type ResumeAiSuggestionSectionId = ResumeAiEntrySectionId | ResumeAiSectionId;
type ResumeAiEntryTextFieldKey = 'description' | 'content';

interface ResumeAiOptimizationFocus {
  primaryJobTarget: string;
  targetSource: 'request' | 'resume_expected_role' | 'entry_role' | 'resume_role_signal' | 'education_major' | 'unknown';
  roleSignals: string[];
  focusSummary: string;
}

interface ResumeAiEntryAssessmentResult {
  suggestions: string[];
}

interface ResumeAiSuggestionUpsert {
  resumeId: string;
  sectionId: ResumeAiSuggestionSectionId;
  entryId: string;
  suggestions: string[];
  contentHash: string;
}

interface ResumeAiSuggestionTarget {
  sectionId: ResumeAiSuggestionSectionId;
  entryId: string;
}

const SINGLE_FIELD_SECTION_LABEL_MAP: Record<ResumeAiSectionId, string> = {
  selfEvaluation: '个人总结',
  personalSummary: '个人简介',
};

const GLOBAL_OPTIMIZE_TASK_TIMEOUT_MS = 15 * 60 * 1000;

interface ResumeAiGlobalUpdates {
  personalSummary?: string;
  selfEvaluation?: string;
  education?: ResumeAiGlobalTextUpdate[];
  internships?: ResumeAiGlobalTextUpdate[];
  projects?: ResumeAiGlobalTextUpdate[];
  campusRoles?: ResumeAiGlobalTextUpdate[];
  awards?: ResumeAiGlobalTextUpdate[];
  languages?: ResumeAiGlobalTextUpdate[];
  skills?: ResumeAiGlobalTextUpdate[];
}

export interface ResumeAiGlobalTaskSummary {
  updatedFieldCount: number;
  updatedSections: string[];
}

interface ResumeAiTranslateResult {
  title?: string;
  sectionLabels?: Record<string, string>;
  personal?: {
    name?: string;
    expectedRole?: string;
    expectedCity?: string;
    availability?: string;
    summary?: string;
  };
  selfEvaluation?: string;
  education?: Array<Record<string, unknown> & { entryId: string }>;
  internships?: Array<Record<string, unknown> & { entryId: string }>;
  projects?: Array<Record<string, unknown> & { entryId: string }>;
  campusRoles?: Array<Record<string, unknown> & { entryId: string }>;
  awards?: Array<Record<string, unknown> & { entryId: string }>;
  languages?: Array<Record<string, unknown> & { entryId: string }>;
  skills?: Array<Record<string, unknown> & { entryId: string }>;
  links?: Array<Record<string, unknown> & { entryId: string }>;
}

@Injectable()
export class ResumeAiService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ResumeService))
    private readonly resumeService: ResumeService,
    private readonly promptBuilder: ResumeAiPromptBuilder,
    private readonly provider: VolcengineArkProvider,
    private readonly cryptoService: AiConfigCryptoService,
  ) {}

  async optimizeEntry(userId: string, resumeId: string, dto: OptimizeResumeEntryDto) {
    await this.ensureAiPermission(userId, 'entry');
    const draft = await this.getOwnedDraft(userId, resumeId);
    const content = this.cloneContentJson(draft.contentJson);
    const targetEntry = this.findEntry(content, dto.sectionId, dto.entryId);
    const fieldKey = this.getEntryTextFieldKey(dto.sectionId);
    const previousTextContent = this.readString(targetEntry[fieldKey]);
    const selectedSuggestion = this.readString(dto.selectedSuggestion);

    const config = await this.getActiveDefaultConfig();
    const apiKey = this.cryptoService.decryptApiKey(config.apiKeyEncrypted);
    const entryPayload = this.buildEntryPayload(dto.sectionId, targetEntry);
    const optimizationFocus = this.buildOptimizationFocus(content, {
      requestedJobTarget: dto.jobTarget,
      entrySectionId: dto.sectionId,
      entry: targetEntry,
    });
    const prompt = this.promptBuilder.buildEntryOptimizePrompt({
      sectionId: dto.sectionId,
      entryPayload,
      entryId: dto.entryId,
      title: this.buildEntryTitle(dto.sectionId, targetEntry),
      fieldKey,
      tone: dto.tone,
      jobTarget: optimizationFocus.primaryJobTarget,
      selectedSuggestion,
      optimizationFocus,
      systemPromptTemplate: config.systemPrompt,
      entryPromptTemplate: config.entryPromptTemplate,
    });

    const requestPayload = {
      sectionId: dto.sectionId,
      entryId: dto.entryId,
      tone: dto.tone?.trim() || 'professional',
      jobTarget: optimizationFocus.primaryJobTarget,
      selectedSuggestion,
      optimizationFocus,
      entry: entryPayload,
    };

    const log = await this.prisma.resumeAiOptimizationLog.create({
      data: {
        userId,
        resumeId,
        provider: config.provider,
        modelName: config.modelName,
        optimizeType: 'entry',
        sectionId: dto.sectionId,
        entryId: dto.entryId,
        status: 'processing',
        requestPayload: requestPayload as unknown as InputJsonValue,
        beforeContent: { [fieldKey]: previousTextContent } as InputJsonValue,
      },
    });

    const startedAt = Date.now();
    let providerResult: AiProviderResult | null = null;

    try {
      providerResult = await this.callProvider(config, apiKey, prompt.systemPrompt, prompt.userPayloadText, 'entry');
      const updatedTextContent = this.parseAndValidateEntryTextContent(providerResult.rawText, dto, fieldKey);
      const nextContent = this.applyUpdatedEntryText(content, dto.sectionId, dto.entryId, fieldKey, updatedTextContent);

      await this.prisma.$transaction([
        this.prisma.resumeDraft.update({
          where: { id: resumeId },
          data: {
            contentJson: nextContent as InputJsonValue,
            lastValidatedAt: null,
          },
        }),
        this.prisma.resumeAiOptimizationLog.update({
          where: { id: log.id },
          data: {
            status: 'success',
            responsePayload: providerResult.rawResponse as InputJsonValue,
            responseText: providerResult.rawText,
            afterContent: { [fieldKey]: updatedTextContent } as InputJsonValue,
            inputTokens: providerResult.usage.inputTokens,
            outputTokens: providerResult.usage.outputTokens,
            latencyMs: Date.now() - startedAt,
          },
        }),
      ]);

      return {
        logId: log.id,
        optimizeType: 'entry' as const,
        sectionId: dto.sectionId,
        entryId: dto.entryId,
        updatedFieldKeys: [fieldKey],
        updatedDraft: await this.resumeService.getDetail(userId, resumeId),
      };
    } catch (error) {
      await this.markLogFailed(log.id, providerResult, startedAt, error);
      throw this.normalizeServiceError(error);
    }
  }

  async optimizeSection(userId: string, resumeId: string, dto: OptimizeResumeSectionDto) {
    await this.ensureAiPermission(userId, 'entry');
    const draft = await this.getOwnedDraft(userId, resumeId);
    const content = this.cloneContentJson(draft.contentJson);
    const sectionValue = this.readSectionContent(content, dto.sectionId);
    const selectedSuggestion = this.readString(dto.selectedSuggestion);

    const config = await this.getActiveDefaultConfig();
    const apiKey = this.cryptoService.decryptApiKey(config.apiKeyEncrypted);
    const optimizationFocus = this.buildOptimizationFocus(content, {
      requestedJobTarget: dto.jobTarget,
    });
    const resumeContextPayload = this.buildSectionResumeContextPayload(content, dto.sectionId);
    const prompt = this.promptBuilder.buildSectionOptimizePrompt({
      sectionId: dto.sectionId,
      fieldValue: sectionValue,
      tone: dto.tone,
      jobTarget: optimizationFocus.primaryJobTarget,
      selectedSuggestion,
      optimizationFocus,
      resumeContextPayload,
      systemPromptTemplate: config.systemPrompt,
      entryPromptTemplate: config.entryPromptTemplate,
    });

    const requestPayload = {
      sectionId: dto.sectionId,
      tone: dto.tone?.trim() || 'professional',
      jobTarget: optimizationFocus.primaryJobTarget,
      selectedSuggestion,
      optimizationFocus,
      section: {
        content: sectionValue,
      },
      resumeContext: resumeContextPayload,
    };

    const log = await this.prisma.resumeAiOptimizationLog.create({
      data: {
        userId,
        resumeId,
        provider: config.provider,
        modelName: config.modelName,
        optimizeType: 'section',
        sectionId: dto.sectionId,
        entryId: 'section',
        status: 'processing',
        requestPayload: requestPayload as unknown as InputJsonValue,
        beforeContent: { content: sectionValue } as InputJsonValue,
      },
    });

    const startedAt = Date.now();
    let providerResult: AiProviderResult | null = null;

    try {
      providerResult = await this.callProvider(config, apiKey, prompt.systemPrompt, prompt.userPayloadText, 'section');
      const updatedContent = this.parseAndValidateSectionContent(providerResult.rawText, dto);
      this.applyUpdatedSectionContent(content, dto.sectionId, updatedContent);

      await this.prisma.$transaction([
        this.prisma.resumeDraft.update({
          where: { id: resumeId },
          data: {
            contentJson: content as InputJsonValue,
            lastValidatedAt: null,
          },
        }),
        this.prisma.resumeAiOptimizationLog.update({
          where: { id: log.id },
          data: {
            status: 'success',
            responsePayload: providerResult.rawResponse as InputJsonValue,
            responseText: providerResult.rawText,
            afterContent: { content: updatedContent } as InputJsonValue,
            inputTokens: providerResult.usage.inputTokens,
            outputTokens: providerResult.usage.outputTokens,
            latencyMs: Date.now() - startedAt,
          },
        }),
      ]);

      return {
        logId: log.id,
        optimizeType: 'section' as const,
        sectionId: dto.sectionId,
        updatedFieldKeys: [dto.sectionId],
        updatedDraft: await this.resumeService.getDetail(userId, resumeId),
      };
    } catch (error) {
      await this.markLogFailed(log.id, providerResult, startedAt, error);
      throw this.normalizeServiceError(error);
    }
  }

  async optimizeResume(userId: string, resumeId: string, dto: OptimizeResumeGlobalDto) {
    await this.ensureAiPermission(userId, 'global');
    const draft = await this.getOwnedDraft(userId, resumeId);
    const config = await this.getActiveDefaultConfig();
    const staleProcessingTask = await this.findStaleGlobalProcessingTask(userId, resumeId);
    if (staleProcessingTask) {
      await this.expireGlobalTask(staleProcessingTask.id);
    }

    const processingTask = await this.prisma.resumeAiOptimizationLog.findFirst({
      where: {
        userId,
        resumeId,
        optimizeType: 'global',
        status: 'processing',
      },
      orderBy: [{ createdAt: 'desc' }],
    });
    if (processingTask) {
      return this.buildGlobalTaskSubmitResponse(processingTask.id, processingTask.createdAt);
    }

    const content = this.cloneContentJson(draft.contentJson);
    const apiKey = this.cryptoService.decryptApiKey(config.apiKeyEncrypted);
    const resumePayload = this.buildGlobalResumePayload(content);
    const optimizationFocus = this.buildOptimizationFocus(content, {
      requestedJobTarget: dto.jobTarget,
    });
    const prompt = this.promptBuilder.buildGlobalOptimizePrompt({
      resumePayload,
      tone: dto.tone,
      jobTarget: optimizationFocus.primaryJobTarget,
      optimizationFocus,
      systemPromptTemplate: config.systemPrompt,
      globalPromptTemplate: config.globalPromptTemplate,
    });

    const requestPayload = {
      tone: dto.tone?.trim() || 'professional',
      jobTarget: optimizationFocus.primaryJobTarget,
      optimizationFocus,
      resume: resumePayload,
    };

    const log = await this.prisma.resumeAiOptimizationLog.create({
      data: {
        userId,
        resumeId,
        provider: config.provider,
        modelName: config.modelName,
        optimizeType: 'global',
        sectionId: 'global',
        entryId: 'global',
        status: 'processing',
        requestPayload: requestPayload as unknown as InputJsonValue,
        beforeContent: resumePayload as InputJsonValue,
      },
    });

    const startedAt = Date.now();
    // Detach the model call from the request lifecycle to avoid long frontend blocking.
    setTimeout(() => {
      void this.runOptimizeResumeTask({
        userId,
        resumeId,
        dto,
        logId: log.id,
        submittedContent: content,
        startedAt,
        config,
        apiKey,
        systemPrompt: prompt.systemPrompt,
        userPayloadText: prompt.userPayloadText,
      });
    }, 0);

    return this.buildGlobalTaskSubmitResponse(log.id, log.createdAt);
  }

  async getOptimizeResumeTaskStatus(userId: string, resumeId: string, taskId: string) {
    await this.ensureAiPermission(userId, 'global');
    await this.getOwnedDraft(userId, resumeId);

    const log = await this.prisma.resumeAiOptimizationLog.findFirst({
      where: {
        id: taskId,
        userId,
        resumeId,
        optimizeType: 'global',
      },
    });
    if (!log) {
      throw new NotFoundException('优化任务不存在');
    }

    if (log.status === 'processing' && this.isGlobalTaskStale(log.createdAt)) {
      await this.expireGlobalTask(log.id);
      return {
        taskId,
        resumeId,
        optimizeType: 'global' as const,
        status: 'failed' as const,
        errorMessage: '优化任务已超时或中断，请重新提交',
      };
    }

    if (log.status === 'success') {
      return {
        taskId,
        resumeId,
        optimizeType: 'global' as const,
        status: 'success' as const,
        summary: this.readGlobalTaskSummary(log.afterContent, log.beforeContent),
        updatedDraft: await this.resumeService.getDetail(userId, resumeId),
      };
    }

    if (log.status === 'failed') {
      return {
        taskId,
        resumeId,
        optimizeType: 'global' as const,
        status: 'failed' as const,
        errorMessage: log.errorMessage || 'AI 优化失败，请稍后重试',
      };
    }

    return {
      taskId,
      resumeId,
      optimizeType: 'global' as const,
      status: 'processing' as const,
    };
  }

  async translateResume(userId: string, resumeId: string, dto: TranslateResumeDto) {
    await this.ensureAiPermission(userId, 'entry');
    await this.getOwnedDraft(userId, resumeId);
    const duplicatedDraft = await this.resumeService.duplicate(userId, resumeId, {
      titleSuffix: dto.direction === 'zh-to-en' ? ' - 英文版' : ' - 中文版',
    });
    const content = this.cloneContentJson(duplicatedDraft.contentJson);
    const config = await this.getActiveDefaultConfig();
    const apiKey = this.cryptoService.decryptApiKey(config.apiKeyEncrypted);
    const resumePayload = this.buildTranslatableResumePayload(duplicatedDraft.title, content);
    const prompt = this.promptBuilder.buildTranslatePrompt({
      direction: dto.direction,
      resumePayload,
      jobTarget: dto.jobTarget,
      systemPromptTemplate: config.systemPrompt,
      globalPromptTemplate: config.globalPromptTemplate,
    });

    const requestPayload = {
      direction: dto.direction,
      jobTarget: dto.jobTarget?.trim() || '',
      resume: resumePayload,
    };

    const log = await this.prisma.resumeAiOptimizationLog.create({
      data: {
        userId,
        resumeId: duplicatedDraft.id,
        provider: config.provider,
        modelName: config.modelName,
        optimizeType: 'translate',
        sectionId: 'global',
        entryId: dto.direction,
        status: 'processing',
        requestPayload: requestPayload as unknown as InputJsonValue,
        beforeContent: resumePayload as InputJsonValue,
      },
    });

    const startedAt = Date.now();
    setTimeout(() => {
      void this.runTranslateResumeTask({
        userId,
        resumeId: duplicatedDraft.id,
        currentTitle: duplicatedDraft.title,
        submittedContent: content,
        logId: log.id,
        startedAt,
        config,
        apiKey,
        systemPrompt: prompt.systemPrompt,
        userPayloadText: prompt.userPayloadText,
      });
    }, 0);

    return this.buildAsyncTaskSubmitResponse(log.id, log.createdAt, 'translate', duplicatedDraft.id, resumeId);
  }

  async getTranslateResumeTaskStatus(userId: string, resumeId: string, taskId: string) {
    await this.ensureAiPermission(userId, 'entry');
    return this.getAsyncTaskStatus(userId, resumeId, taskId, 'translate');
  }

  async optimizeProfessionalResume(userId: string, resumeId: string, dto: OptimizeResumeProfessionalDto) {
    await this.ensureAiPermission(userId, 'entry');
    await this.getOwnedDraft(userId, resumeId);
    const duplicatedDraft = await this.resumeService.duplicate(userId, resumeId, {
      titleSuffix: ' - 专业优化版',
    });
    const content = this.cloneContentJson(duplicatedDraft.contentJson);
    const config = await this.getActiveDefaultConfig();
    const apiKey = this.cryptoService.decryptApiKey(config.apiKeyEncrypted);
    const resumePayload = this.buildGlobalResumePayload(content);
    const optimizationFocus = this.buildOptimizationFocus(content, {
      requestedJobTarget: dto.jobTarget,
    });
    const prompt = this.promptBuilder.buildProfessionalOptimizePrompt({
      resumePayload,
      tone: dto.tone,
      jobTarget: optimizationFocus.primaryJobTarget,
      optimizationFocus,
      systemPromptTemplate: config.systemPrompt,
      professionalPromptTemplate: (config as typeof config & { professionalPromptTemplate?: string | null }).professionalPromptTemplate,
    });

    const requestPayload = {
      tone: dto.tone?.trim() || 'professional',
      jobTarget: optimizationFocus.primaryJobTarget,
      optimizationFocus,
      resume: resumePayload,
    };

    const log = await this.prisma.resumeAiOptimizationLog.create({
      data: {
        userId,
        resumeId: duplicatedDraft.id,
        provider: config.provider,
        modelName: config.modelName,
        optimizeType: 'professional',
        sectionId: 'global',
        entryId: 'global',
        status: 'processing',
        requestPayload: requestPayload as unknown as InputJsonValue,
        beforeContent: resumePayload as InputJsonValue,
      },
    });

    const startedAt = Date.now();
    setTimeout(() => {
      void this.runProfessionalOptimizeTask({
        userId,
        resumeId: duplicatedDraft.id,
        submittedContent: content,
        logId: log.id,
        startedAt,
        config,
        apiKey,
        systemPrompt: prompt.systemPrompt,
        userPayloadText: prompt.userPayloadText,
      });
    }, 0);

    return this.buildAsyncTaskSubmitResponse(log.id, log.createdAt, 'professional', duplicatedDraft.id, resumeId);
  }

  async getProfessionalOptimizeTaskStatus(userId: string, resumeId: string, taskId: string) {
    await this.ensureAiPermission(userId, 'entry');
    return this.getAsyncTaskStatus(userId, resumeId, taskId, 'professional');
  }

  async assessEntry(
    userId: string,
    resumeId: string,
    dto: { sectionId: ResumeAiEntrySectionId; entryId: string; jobTarget?: string },
  ) {
    const draft = await this.getOwnedDraft(userId, resumeId);
    const content = this.cloneContentJson(draft.contentJson);
    const targetEntry = this.findEntry(content, dto.sectionId, dto.entryId);
    const entryPayload = this.buildEntryPayload(dto.sectionId, targetEntry);

    if (!this.hasMeaningfulFields(entryPayload, this.getEntryAssessmentFieldKeys(dto.sectionId))) {
      return {
        sectionId: dto.sectionId,
        entryId: dto.entryId,
        suggestions: [] as string[],
      };
    }

    const config = await this.getActiveDefaultConfig();
    const apiKey = this.cryptoService.decryptApiKey(config.apiKeyEncrypted);
    const optimizationFocus = this.buildOptimizationFocus(content, {
      requestedJobTarget: dto.jobTarget,
      entrySectionId: dto.sectionId,
      entry: targetEntry,
    });
    const prompt = this.promptBuilder.buildEntryAssessmentPrompt({
      sectionId: dto.sectionId,
      title: this.buildEntryTitle(dto.sectionId, targetEntry),
      entryPayload,
      jobTarget: optimizationFocus.primaryJobTarget,
      optimizationFocus,
      systemPromptTemplate: config.systemPrompt,
      assessmentPromptTemplate: (config as typeof config & { assessmentPromptTemplate?: string | null }).assessmentPromptTemplate,
    });

    const contentHash = this.hashSuggestionInput({
      sectionId: dto.sectionId,
      entryId: dto.entryId,
      entryPayload,
      jobTarget: optimizationFocus.primaryJobTarget,
    });

    const existing = await this.prisma.resumeAiSuggestion.findUnique({
      where: {
        resumeId_sectionId_entryId: {
          resumeId,
          sectionId: dto.sectionId,
          entryId: dto.entryId,
        },
      },
    });

    if (existing && existing.contentHash === contentHash) {
      return {
        sectionId: dto.sectionId,
        entryId: dto.entryId,
        suggestions: Array.isArray(existing.suggestions) ? (existing.suggestions as unknown as string[]) : [],
      };
    }

    const providerResult = await this.callProvider(config, apiKey, prompt.systemPrompt, prompt.userPayloadText, 'entry');
    const result = this.parseAndValidateAssessmentSuggestions(providerResult.rawText);

    await this.upsertSuggestions({
      resumeId,
      sectionId: dto.sectionId,
      entryId: dto.entryId,
      suggestions: result.suggestions,
      contentHash,
    });

    return {
      sectionId: dto.sectionId,
      entryId: dto.entryId,
      suggestions: result.suggestions,
    };
  }

  async assessSection(userId: string, resumeId: string, dto: { sectionId: ResumeAiSectionId; jobTarget?: string }) {
    const draft = await this.getOwnedDraft(userId, resumeId);
    const content = this.cloneContentJson(draft.contentJson);
    const sectionValue = this.readSectionContent(content, dto.sectionId);
    if (!sectionValue.trim()) {
      return {
        sectionId: dto.sectionId,
        suggestions: [] as string[],
      };
    }

    const config = await this.getActiveDefaultConfig();
    const apiKey = this.cryptoService.decryptApiKey(config.apiKeyEncrypted);
    const optimizationFocus = this.buildOptimizationFocus(content, {
      requestedJobTarget: dto.jobTarget,
    });
    const prompt = this.promptBuilder.buildSectionAssessmentPrompt({
      sectionId: dto.sectionId,
      sectionLabel: SINGLE_FIELD_SECTION_LABEL_MAP[dto.sectionId],
      content: sectionValue,
      jobTarget: optimizationFocus.primaryJobTarget,
      optimizationFocus,
      systemPromptTemplate: config.systemPrompt,
      assessmentPromptTemplate: (config as typeof config & { assessmentPromptTemplate?: string | null }).assessmentPromptTemplate,
    });

    const contentHash = this.hashSuggestionInput({
      sectionId: dto.sectionId,
      entryId: 'section',
      entryPayload: { content: sectionValue },
      jobTarget: optimizationFocus.primaryJobTarget,
    });

    const existing = await this.prisma.resumeAiSuggestion.findUnique({
      where: {
        resumeId_sectionId_entryId: {
          resumeId,
          sectionId: dto.sectionId,
          entryId: 'section',
        },
      },
    });

    if (existing && existing.contentHash === contentHash) {
      return {
        sectionId: dto.sectionId,
        suggestions: Array.isArray(existing.suggestions) ? (existing.suggestions as unknown as string[]) : [],
      };
    }

    const providerResult = await this.callProvider(config, apiKey, prompt.systemPrompt, prompt.userPayloadText, 'section');
    const result = this.parseAndValidateAssessmentSuggestions(providerResult.rawText);

    await this.upsertSuggestions({
      resumeId,
      sectionId: dto.sectionId,
      entryId: 'section',
      suggestions: result.suggestions,
      contentHash,
    });

    return {
      sectionId: dto.sectionId,
      suggestions: result.suggestions,
    };
  }

  async listSuggestions(userId: string, resumeId: string) {
    const draft = await this.getOwnedDraft(userId, resumeId);
    const content = this.cloneContentJson(draft.contentJson);
    const suggestions = await this.prisma.resumeAiSuggestion.findMany({
      where: { resumeId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
    const suggestibleTargets = this.collectSuggestibleTargets(content);
    const existingSuggestionKeys = new Set(
      suggestions.map((item) => `${item.sectionId}:${item.entryId}`),
    );
    const pendingTargets = suggestibleTargets.filter(
      (target) => !existingSuggestionKeys.has(`${target.sectionId}:${target.entryId}`),
    );

    if (pendingTargets.length) {
      void this.refreshSuggestionsForTargets(resumeId, content, pendingTargets);
    }

    return {
      suggestions: suggestions.map((item) => ({
        sectionId: item.sectionId as ResumeAiSuggestionSectionId,
        entryId: item.entryId,
        suggestions: Array.isArray(item.suggestions) ? (item.suggestions as unknown as string[]) : [],
        updatedAt: item.updatedAt.toISOString(),
      })),
      pendingTargets: pendingTargets.map((target) => ({
        sectionId: target.sectionId,
        entryId: target.entryId,
      })),
    };
  }

  collectChangedSuggestionTargets(previousContentJson: unknown, nextContentJson: unknown) {
    const previousContent = this.cloneContentJson(previousContentJson);
    const nextContent = this.cloneContentJson(nextContentJson);
    const targets: ResumeAiSuggestionTarget[] = [];

    if (this.readString(this.readRecord(previousContent.personal).summary) !== this.readString(this.readRecord(nextContent.personal).summary)) {
      targets.push({ sectionId: 'personalSummary', entryId: 'section' });
    }
    if (this.readString(previousContent.selfEvaluation) !== this.readString(nextContent.selfEvaluation)) {
      targets.push({ sectionId: 'selfEvaluation', entryId: 'section' });
    }

    this.collectChangedArraySuggestionTargets(targets, 'education', 'description', previousContent.education, nextContent.education);
    this.collectChangedArraySuggestionTargets(targets, 'internships', 'description', previousContent.internships, nextContent.internships);
    this.collectChangedArraySuggestionTargets(targets, 'projects', 'description', previousContent.projects, nextContent.projects);
    this.collectChangedArraySuggestionTargets(targets, 'campusRoles', 'description', previousContent.campusRoles, nextContent.campusRoles);
    this.collectChangedArraySuggestionTargets(targets, 'awards', 'description', previousContent.awards, nextContent.awards);
    this.collectChangedArraySuggestionTargets(targets, 'languages', 'description', previousContent.languages, nextContent.languages);
    this.collectChangedArraySuggestionTargets(targets, 'skills', 'content', previousContent.skills, nextContent.skills);

    return targets;
  }

  collectSuggestibleTargets(contentJson: unknown) {
    const content = this.cloneContentJson(contentJson);
    const targets: ResumeAiSuggestionTarget[] = [];

    if (this.readString(this.readRecord(content.personal).summary)) {
      targets.push({ sectionId: 'personalSummary', entryId: 'section' });
    }
    if (this.readString(content.selfEvaluation)) {
      targets.push({ sectionId: 'selfEvaluation', entryId: 'section' });
    }

    this.collectSuggestibleEntryTargets(targets, content, 'education');
    this.collectSuggestibleEntryTargets(targets, content, 'internships');
    this.collectSuggestibleEntryTargets(targets, content, 'projects');
    this.collectSuggestibleEntryTargets(targets, content, 'campusRoles');
    this.collectSuggestibleEntryTargets(targets, content, 'awards');
    this.collectSuggestibleEntryTargets(targets, content, 'languages');
    this.collectSuggestibleEntryTargets(targets, content, 'skills');

    return this.uniqueSuggestionTargets(targets);
  }

  async clearSuggestionsForTargets(resumeId: string, targets: ResumeAiSuggestionTarget[]) {
    const uniqueTargets = this.uniqueSuggestionTargets(targets);
    if (!uniqueTargets.length) {
      return;
    }

    await this.prisma.resumeAiSuggestion.deleteMany({
      where: {
        resumeId,
        OR: uniqueTargets.map((target) => ({
          sectionId: target.sectionId,
          entryId: target.entryId,
        })),
      },
    });
  }

  async refreshSuggestionsForTargets(
    resumeId: string,
    nextContentJson: unknown,
    targets: ResumeAiSuggestionTarget[],
  ) {
    const uniqueTargets = this.uniqueSuggestionTargets(targets);
    if (!uniqueTargets.length) {
      return;
    }

    let config: Awaited<ReturnType<ResumeAiService['getActiveDefaultConfig']>> | null = null;
    let apiKey = '';
    try {
      config = await this.getActiveDefaultConfig();
      apiKey = this.cryptoService.decryptApiKey(config.apiKeyEncrypted);
    } catch {
      return;
    }

    const content = this.cloneContentJson(nextContentJson);
    for (const target of uniqueTargets) {
      try {
        if (this.isEntrySuggestionSectionId(target.sectionId)) {
          await this.generateEntrySuggestionsForTarget(
            resumeId,
            content,
            { ...target, sectionId: target.sectionId },
            config,
            apiKey,
          );
          continue;
        }
        await this.generateSectionSuggestionsForTarget(
          resumeId,
          content,
          { ...target, sectionId: target.sectionId },
          config,
          apiKey,
        );
      } catch {
        continue;
      }
    }
  }

  private async getOwnedDraft(userId: string, resumeId: string) {
    const draft = await this.prisma.resumeDraft.findFirst({
      where: { id: resumeId, userId },
    });
    if (!draft) {
      throw new NotFoundException('简历不存在或无权访问');
    }
    return draft;
  }

  private async findStaleGlobalProcessingTask(userId: string, resumeId: string) {
    const latestProcessingTask = await this.prisma.resumeAiOptimizationLog.findFirst({
      where: {
        userId,
        resumeId,
        optimizeType: 'global',
        status: 'processing',
      },
      orderBy: [{ createdAt: 'desc' }],
    });
    if (!latestProcessingTask || !this.isGlobalTaskStale(latestProcessingTask.createdAt)) {
      return null;
    }
    return latestProcessingTask;
  }

  private isGlobalTaskStale(createdAt: Date) {
    return Date.now() - createdAt.getTime() >= GLOBAL_OPTIMIZE_TASK_TIMEOUT_MS;
  }

  private async expireGlobalTask(taskId: string) {
    await this.prisma.resumeAiOptimizationLog.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        errorCode: 'task_timeout',
        errorMessage: '优化任务已超时或中断，请重新提交',
      },
    }).catch(() => undefined);
  }

  private buildGlobalTaskSubmitResponse(taskId: string, createdAt: Date) {
    return this.buildAsyncTaskSubmitResponse(taskId, createdAt, 'global');
  }

  private buildAsyncTaskSubmitResponse(
    taskId: string,
    createdAt: Date,
    optimizeType: ResumeAiAsyncOptimizeType,
    resumeId?: string,
    sourceResumeId?: string,
  ) {
    return {
      taskId,
      optimizeType,
      status: 'processing' as const,
      createdAt: createdAt.toISOString(),
      pollingIntervalMs: 2000,
      ...(resumeId ? { resumeId } : {}),
      ...(sourceResumeId ? { sourceResumeId } : {}),
    };
  }

  private async getAsyncTaskStatus(
    userId: string,
    resumeId: string,
    taskId: string,
    optimizeType: ResumeAiAsyncOptimizeType,
  ) {
    await this.getOwnedDraft(userId, resumeId);
    const log = await this.prisma.resumeAiOptimizationLog.findFirst({
      where: {
        id: taskId,
        userId,
        resumeId,
        optimizeType,
      },
    });
    if (!log) {
      throw new NotFoundException('优化任务不存在');
    }
    if (log.status === 'processing' && this.isGlobalTaskStale(log.createdAt)) {
      await this.expireGlobalTask(log.id);
      return {
        taskId,
        resumeId,
        optimizeType,
        status: 'failed' as const,
        errorMessage: '优化任务已超时或中断，请重新提交',
      };
    }
    if (log.status === 'success') {
      return {
        taskId,
        resumeId,
        optimizeType,
        status: 'success' as const,
        summary: this.readGlobalTaskSummary(log.afterContent, log.beforeContent),
        updatedDraft: await this.resumeService.getDetail(userId, resumeId),
      };
    }
    if (log.status === 'failed') {
      return {
        taskId,
        resumeId,
        optimizeType,
        status: 'failed' as const,
        errorMessage: log.errorMessage || 'AI 优化失败，请稍后重试',
      };
    }
    return {
      taskId,
      resumeId,
      optimizeType,
      status: 'processing' as const,
    };
  }

  private async runOptimizeResumeTask(input: {
    userId: string;
    resumeId: string;
    dto: OptimizeResumeGlobalDto;
    logId: string;
    submittedContent: Record<string, unknown>;
    startedAt: number;
    config: Awaited<ReturnType<ResumeAiService['getActiveDefaultConfig']>>;
    apiKey: string;
    systemPrompt: string;
    userPayloadText: string;
  }) {
    let providerResult: AiProviderResult | null = null;
    try {
      const providerResultLocal = await this.callProvider(
        input.config,
        input.apiKey,
        input.systemPrompt,
        input.userPayloadText,
        'global',
      );
      providerResult = providerResultLocal;
      const updates = this.parseAndValidateGlobalUpdates(providerResultLocal.rawText);
      const currentDraft = await this.getOwnedDraft(input.userId, input.resumeId);
      const currentContent = this.cloneContentJson(currentDraft.contentJson);
      const applyResult = this.applyGlobalUpdatesWithConflictCheck(currentContent, input.submittedContent, updates);
      const mergedResumePayload = this.buildGlobalResumePayload(currentContent);

      await this.prisma.$transaction(async (tx) => {
        if (applyResult.updatedFieldCount > 0) {
          await tx.resumeDraft.update({
            where: { id: input.resumeId },
            data: {
              contentJson: currentContent as InputJsonValue,
              lastValidatedAt: null,
            },
          });
        }
        await tx.resumeAiOptimizationLog.update({
          where: { id: input.logId },
          data: {
            status: 'success',
            responsePayload: providerResultLocal.rawResponse as InputJsonValue,
            responseText: providerResultLocal.rawText,
            afterContent: {
              summary: applyResult,
              resume: mergedResumePayload,
            } as unknown as InputJsonValue,
            inputTokens: providerResultLocal.usage.inputTokens,
            outputTokens: providerResultLocal.usage.outputTokens,
            latencyMs: Date.now() - input.startedAt,
          },
        });
      });
    } catch (error) {
      await this.markLogFailed(input.logId, providerResult, input.startedAt, error);
    }
  }

  private async runTranslateResumeTask(input: {
    userId: string;
    resumeId: string;
    currentTitle: string;
    submittedContent: Record<string, unknown>;
    logId: string;
    startedAt: number;
    config: Awaited<ReturnType<ResumeAiService['getActiveDefaultConfig']>>;
    apiKey: string;
    systemPrompt: string;
    userPayloadText: string;
  }) {
    let providerResult: AiProviderResult | null = null;
    try {
      const providerResultLocal = await this.callProvider(
        input.config,
        input.apiKey,
        input.systemPrompt,
        input.userPayloadText,
        'translate',
      );
      providerResult = providerResultLocal;
      const translatedResume = this.parseAndValidateTranslatedResume(providerResultLocal.rawText);
      const currentDraft = await this.getOwnedDraft(input.userId, input.resumeId);
      const currentContent = this.cloneContentJson(currentDraft.contentJson);
      const applyResult = this.applyTranslatedResume(currentDraft.title, currentContent, translatedResume);
      if (!applyResult.updatedFieldCount) {
        throw new BadRequestException('AI 未产出可应用的翻译结果，本次未改动原内容');
      }

      const nextTitle = applyResult.title ?? currentDraft.title;
      const nextResumePayload = this.buildTranslatableResumePayload(nextTitle, currentContent);
      await this.prisma.$transaction([
        this.prisma.resumeDraft.update({
          where: { id: input.resumeId },
          data: {
            title: nextTitle,
            contentJson: currentContent as InputJsonValue,
            lastValidatedAt: null,
          },
        }),
        this.prisma.resumeAiOptimizationLog.update({
          where: { id: input.logId },
          data: {
            status: 'success',
            responsePayload: providerResultLocal.rawResponse as InputJsonValue,
            responseText: providerResultLocal.rawText,
            afterContent: {
              summary: applyResult,
              resume: nextResumePayload,
            } as unknown as InputJsonValue,
            inputTokens: providerResultLocal.usage.inputTokens,
            outputTokens: providerResultLocal.usage.outputTokens,
            latencyMs: Date.now() - input.startedAt,
          },
        }),
      ]);
    } catch (error) {
      await this.markLogFailed(input.logId, providerResult, input.startedAt, error);
    }
  }

  private async runProfessionalOptimizeTask(input: {
    userId: string;
    resumeId: string;
    submittedContent: Record<string, unknown>;
    logId: string;
    startedAt: number;
    config: Awaited<ReturnType<ResumeAiService['getActiveDefaultConfig']>>;
    apiKey: string;
    systemPrompt: string;
    userPayloadText: string;
  }) {
    let providerResult: AiProviderResult | null = null;
    try {
      const providerResultLocal = await this.callProvider(
        input.config,
        input.apiKey,
        input.systemPrompt,
        input.userPayloadText,
        'professional',
      );
      providerResult = providerResultLocal;
      const updates = this.parseAndValidateGlobalUpdates(providerResultLocal.rawText);
      const currentDraft = await this.getOwnedDraft(input.userId, input.resumeId);
      const currentContent = this.cloneContentJson(currentDraft.contentJson);
      const applyResult = this.applyGlobalUpdatesWithConflictCheck(currentContent, input.submittedContent, updates);
      const mergedResumePayload = this.buildGlobalResumePayload(currentContent);

      await this.prisma.$transaction(async (tx) => {
        if (applyResult.updatedFieldCount > 0) {
          await tx.resumeDraft.update({
            where: { id: input.resumeId },
            data: {
              contentJson: currentContent as InputJsonValue,
              lastValidatedAt: null,
            },
          });
        }
        await tx.resumeAiOptimizationLog.update({
          where: { id: input.logId },
          data: {
            status: 'success',
            responsePayload: providerResultLocal.rawResponse as InputJsonValue,
            responseText: providerResultLocal.rawText,
            afterContent: {
              summary: applyResult,
              resume: mergedResumePayload,
            } as unknown as InputJsonValue,
            inputTokens: providerResultLocal.usage.inputTokens,
            outputTokens: providerResultLocal.usage.outputTokens,
            latencyMs: Date.now() - input.startedAt,
          },
        });
      });
    } catch (error) {
      await this.markLogFailed(input.logId, providerResult, input.startedAt, error);
    }
  }

  private async ensureAiPermission(userId: string, mode: 'global' | 'entry') {
    const access = await getUserMemberAccess(this.prisma, userId);
    if (mode === 'global') {
      if (access.memberRoleCode === 'FREE_USER') {
        throw new ForbiddenException('全文 AI 优化需开通标准会员或超级会员后使用');
      }
      return access;
    }
    if (access.memberRoleCode !== 'SUPER_MEMBER') {
      throw new ForbiddenException('单模块 AI 优化与二次深度优化仅限超级会员使用');
    }
    return access;
  }

  private async getActiveDefaultConfig() {
    const config = await this.prisma.aiModelConfig.findFirst({
      where: {
        enabled: true,
        isDefault: true,
        provider: 'volcengine-ark',
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
    if (!config) {
      throw new BadRequestException('AI 优化服务暂未配置，请联系管理员');
    }
    return config;
  }

  private async callProvider(
    config: {
      baseUrl: string;
      modelName: string;
      timeoutMs: number;
      maxOutputTokens: number | null;
      temperature: Prisma.Decimal | null;
      topP: Prisma.Decimal | null;
    },
    apiKey: string,
    systemPrompt: string,
    userPayloadText: string,
    mode: ResumeAiOptimizeMode,
  ) {
    return this.provider.generateText(
      {
        systemPrompt,
        userPayloadText,
        modelName: config.modelName,
        timeoutMs: config.timeoutMs,
        maxOutputTokens: this.resolveMaxOutputTokens(mode, config.maxOutputTokens),
        temperature: config.temperature ? Number(config.temperature) : undefined,
        topP: config.topP ? Number(config.topP) : undefined,
      },
      {
        apiKey,
        baseUrl: config.baseUrl,
      },
    );
  }

  private async markLogFailed(
    logId: string,
    providerResult: AiProviderResult | null,
    startedAt: number,
    error: unknown,
  ) {
    await this.prisma.resumeAiOptimizationLog.update({
      where: { id: logId },
      data: {
        status: 'failed',
        responsePayload: providerResult?.rawResponse as Prisma.InputJsonValue | undefined,
        responseText: providerResult?.rawText,
        errorCode: this.resolveErrorCode(error),
        errorMessage: this.resolveErrorMessage(error),
        inputTokens: providerResult?.usage.inputTokens,
        outputTokens: providerResult?.usage.outputTokens,
        latencyMs: Date.now() - startedAt,
      },
    }).catch(() => undefined);
  }

  private cloneContentJson(contentJson: unknown) {
    const source = this.readRecord(contentJson);
    return JSON.parse(JSON.stringify(source)) as Record<string, unknown>;
  }

  private findEntry(content: Record<string, unknown>, sectionId: ResumeAiEntrySectionId, entryId: string) {
    const section = this.readArray(content[sectionId]);
    const target = section.find((item) => this.isEntryRecord(item) && item.id === entryId);
    if (!this.isEntryRecord(target)) {
      throw new NotFoundException('当前优化目标不存在');
    }
    return target;
  }

  private buildEntryPayload(sectionId: ResumeAiEntrySectionId, entry: ResumeAiEntryRecord) {
    const payload = (() => {
      switch (sectionId) {
        case 'education':
          return {
            entryId: entry.id,
            schoolName: this.readString(entry.schoolName),
            degree: this.readString(entry.degree),
            major: this.readString(entry.major),
            startDate: this.readString(entry.startDate),
            endDate: this.readString(entry.endDate),
            description: this.readString(entry.description),
          };
        case 'internships':
          return {
            entryId: entry.id,
            companyName: this.readString(entry.companyName),
            roleName: this.readString(entry.roleName),
            city: this.readString(entry.city),
            startDate: this.readString(entry.startDate),
            endDate: this.readString(entry.endDate),
            description: this.readString(entry.description),
          };
        case 'projects':
          return {
            entryId: entry.id,
            projectName: this.readString(entry.projectName),
            roleName: this.readString(entry.roleName),
            city: this.readString(entry.city),
            startDate: this.readString(entry.startDate),
            endDate: this.readString(entry.endDate),
            description: this.readString(entry.description),
          };
        case 'campusRoles':
          return {
            entryId: entry.id,
            organization: this.readString(entry.organization),
            roleName: this.readString(entry.roleName),
            startDate: this.readString(entry.startDate),
            endDate: this.readString(entry.endDate),
            description: this.readString(entry.description),
          };
        case 'awards':
          return {
            entryId: entry.id,
            title: this.readString(entry.title),
            level: this.readString(entry.level),
            awardDate: this.readString(entry.awardDate),
            description: this.readString(entry.description),
          };
        case 'languages':
          return {
            entryId: entry.id,
            language: this.readString(entry.language),
            score: this.readString(entry.score),
            description: this.readString(entry.description),
          };
        case 'skills':
          return {
            entryId: entry.id,
            category: this.readString(entry.category),
            content: this.readString(entry.content),
          };
        default:
          return {
            entryId: entry.id,
            description: this.readString(entry.description),
          };
      }
    })();
    return this.readRecord(this.compactPayload(payload));
  }

  private buildEntryTitle(sectionId: ResumeAiEntrySectionId, entry: ResumeAiEntryRecord) {
    switch (sectionId) {
      case 'education':
        return this.readString(entry.schoolName) || this.readString(entry.major) || '教育经历';
      case 'internships':
        return this.readString(entry.companyName) || this.readString(entry.roleName) || '工作经历';
      case 'projects':
        return this.readString(entry.projectName) || this.readString(entry.roleName) || '项目经历';
      case 'campusRoles':
        return this.readString(entry.organization) || this.readString(entry.roleName) || '校内职务';
      case 'awards':
        return this.readString(entry.title) || this.readString(entry.level) || '荣誉奖项';
      case 'languages':
        return this.readString(entry.language) || this.readString(entry.score) || '语言能力';
      case 'skills':
        return this.readString(entry.category) || '专业技能';
      default:
        return '简历条目';
    }
  }

  private buildSectionResumeContextPayload(
    content: Record<string, unknown>,
    _sectionId: OptimizeResumeSectionDto['sectionId'],
  ) {
    const resumePayload = this.buildGlobalResumePayload(content);
    return this.readRecord(this.compactPayload({
      candidateIntent: resumePayload.candidateIntent,
      personalSummary: resumePayload.personalSummary,
      education: this.readArray(resumePayload.education).slice(0, 2),
      internships: this.readArray(resumePayload.internships).slice(0, 3),
      projects: this.readArray(resumePayload.projects).slice(0, 3),
      campusRoles: this.readArray(resumePayload.campusRoles).slice(0, 2),
      skills: this.readArray(resumePayload.skills).slice(0, 3),
    }));
  }

  private buildOptimizationFocus(
    content: Record<string, unknown>,
    options?: {
      requestedJobTarget?: string;
      entrySectionId?: ResumeAiEntrySectionId;
      entry?: ResumeAiEntryRecord;
    },
  ): ResumeAiOptimizationFocus {
    const requestedJobTarget = this.readString(options?.requestedJobTarget);
    if (requestedJobTarget) {
      return {
        primaryJobTarget: requestedJobTarget,
        targetSource: 'request',
        roleSignals: this.collectResumeRoleSignals(content),
        focusSummary: `优先围绕用户明确填写的求职意向“${requestedJobTarget}”优化内容，突出与该岗位直接相关的职责、能力与成果表达。`,
      };
    }

    const personal = this.readRecord(content.personal);
    const expectedRole = this.readString(personal.expectedRole);
    if (expectedRole) {
      return {
        primaryJobTarget: expectedRole,
        targetSource: 'resume_expected_role',
        roleSignals: this.collectResumeRoleSignals(content),
        focusSummary: `用户未单独输入求职意向，优先围绕简历中已填写的求职意向“${expectedRole}”统一优化整体表达。`,
      };
    }

    const entryRoleSignals = options?.entry && options.entrySectionId
      ? this.collectEntryRoleSignals(options.entrySectionId, options.entry)
      : [];
    if (entryRoleSignals.length) {
      return {
        primaryJobTarget: entryRoleSignals[0],
        targetSource: options?.entrySectionId === 'education' ? 'education_major' : 'entry_role',
        roleSignals: entryRoleSignals,
        focusSummary: `用户未填写求职意向，请围绕当前条目可识别的角色/专业信号 ${entryRoleSignals.join(' / ')} 进行扩写与润色，优先补足岗位职责、方法与价值表达。`,
      };
    }

    const resumeRoleSignals = this.collectResumeRoleSignals(content);
    if (resumeRoleSignals.length) {
      return {
        primaryJobTarget: resumeRoleSignals[0],
        targetSource: 'resume_role_signal',
        roleSignals: resumeRoleSignals,
        focusSummary: `用户未填写求职意向，请基于整份简历中可识别的岗位角色信号 ${resumeRoleSignals.join(' / ')} 推断最合理的优化方向，统一表达风格并增强岗位匹配度。`,
      };
    }

    return {
      primaryJobTarget: '',
      targetSource: 'unknown',
      roleSignals: [],
      focusSummary: '未识别到明确求职意向，请仅基于现有经历事实做专业扩写与润色，提升表达清晰度、职责完整度与竞争力。',
    };
  }

  private collectEntryRoleSignals(sectionId: ResumeAiEntrySectionId, entry: ResumeAiEntryRecord) {
    const signals: string[] = [];
    if (sectionId === 'education') {
      const major = this.readString(entry.major);
      const degree = this.readString(entry.degree);
      if (major) signals.push(major);
      if (degree) signals.push(degree);
      return this.uniqueTexts(signals);
    }

    const roleName = this.readString(entry.roleName);
    const fallbackTitle = this.buildEntryTitle(sectionId, entry);
    if (roleName) signals.push(roleName);
    if (fallbackTitle && fallbackTitle !== roleName) signals.push(fallbackTitle);
    return this.uniqueTexts(signals);
  }

  private collectResumeRoleSignals(content: Record<string, unknown>) {
    const personal = this.readRecord(content.personal);
    const signals = [
      ...this.readArray(content.internships)
        .filter((entry) => this.isEntryRecord(entry))
        .map((entry) => this.readString(entry.roleName)),
      ...this.readArray(content.projects)
        .filter((entry) => this.isEntryRecord(entry))
        .map((entry) => this.readString(entry.roleName)),
      ...this.readArray(content.campusRoles)
        .filter((entry) => this.isEntryRecord(entry))
        .map((entry) => this.readString(entry.roleName)),
      ...this.readArray(content.education)
        .filter((entry) => this.isEntryRecord(entry))
        .map((entry) => this.readString(entry.major)),
      this.readString(personal.expectedRole),
    ];
    return this.uniqueTexts(signals).slice(0, 6);
  }

  private uniqueTexts(values: string[]) {
    return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
  }

  private hasMeaningfulFields(record: Record<string, unknown>, fieldKeys: string[]) {
    return fieldKeys.some((fieldKey) => this.getPlainTextLength(this.readString(record[fieldKey])) > 0);
  }

  private resolveMaxOutputTokens(mode: ResumeAiOptimizeMode, configuredValue: number | null) {
    const configured = configuredValue ?? 0;
    switch (mode) {
      case 'global':
      case 'professional':
        return Math.max(configured, 2400);
      case 'translate':
        return Math.max(configured, 2800);
      case 'entry':
      case 'section':
      default:
        return configured > 0 ? configured : undefined;
    }
  }

  private compactPayload(value: unknown): unknown {
    if (typeof value === 'string') {
      const normalized = value.trim();
      return normalized ? normalized : undefined;
    }
    if (Array.isArray(value)) {
      const items = value
        .map((item) => this.compactPayload(item))
        .filter((item) => item !== undefined);
      return items.length ? items : undefined;
    }
    if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value).flatMap(([key, itemValue]) => {
        const compacted = this.compactPayload(itemValue);
        return compacted === undefined ? [] : [[key, compacted] as const];
      });
      return entries.length ? Object.fromEntries(entries) : undefined;
    }
    if (value === null || value === undefined) {
      return undefined;
    }
    return value;
  }

  private buildGlobalResumePayload(content: Record<string, unknown>) {
    const personal = this.readRecord(content.personal);
    return this.readRecord(this.compactPayload({
      candidateIntent: {
        expectedRole: this.readString(personal.expectedRole),
        expectedCity: this.readString(personal.expectedCity),
        availability: this.readString(personal.availability),
      },
      personalSummary: this.readString(personal.summary),
      selfEvaluation: this.readString(content.selfEvaluation),
      education: this.readArray(content.education)
        .filter((entry) => this.isEntryRecord(entry) && this.hasMeaningfulFields(entry, ['schoolName', 'major', 'degree', 'description']))
        .map((entry) => ({
          entryId: entry.id,
          schoolName: this.readString(entry.schoolName),
          degree: this.readString(entry.degree),
          major: this.readString(entry.major),
          description: this.readString(entry.description),
        })),
      internships: this.readArray(content.internships)
        .filter((entry) => this.isEntryRecord(entry) && this.hasMeaningfulFields(entry, ['companyName', 'roleName', 'description']))
        .map((entry) => ({
          entryId: entry.id,
          companyName: this.readString(entry.companyName),
          roleName: this.readString(entry.roleName),
          city: this.readString(entry.city),
          description: this.readString(entry.description),
        })),
      projects: this.readArray(content.projects)
        .filter((entry) => this.isEntryRecord(entry) && this.hasMeaningfulFields(entry, ['projectName', 'roleName', 'description']))
        .map((entry) => ({
          entryId: entry.id,
          projectName: this.readString(entry.projectName),
          roleName: this.readString(entry.roleName),
          city: this.readString(entry.city),
          description: this.readString(entry.description),
        })),
      campusRoles: this.readArray(content.campusRoles)
        .filter((entry) => this.isEntryRecord(entry) && this.hasMeaningfulFields(entry, ['organization', 'roleName', 'description']))
        .map((entry) => ({
          entryId: entry.id,
          organization: this.readString(entry.organization),
          roleName: this.readString(entry.roleName),
          description: this.readString(entry.description),
        })),
      awards: this.readArray(content.awards)
        .filter((entry) => this.isTextRecord(entry) && this.hasMeaningfulFields(entry, ['title', 'level', 'description']))
        .map((entry) => ({
          entryId: entry.id,
          title: this.readString(entry.title),
          level: this.readString(entry.level),
          awardDate: this.readString(entry.awardDate),
          description: this.readString(entry.description),
        })),
      languages: this.readArray(content.languages)
        .filter((entry) => this.isTextRecord(entry) && this.hasMeaningfulFields(entry, ['language', 'score', 'description']))
        .map((entry) => ({
          entryId: entry.id,
          language: this.readString(entry.language),
          score: this.readString(entry.score),
          description: this.readString(entry.description),
        })),
      skills: this.readArray(content.skills)
        .filter((entry) => this.isTextRecord(entry) && this.hasMeaningfulFields(entry, ['category', 'content']))
        .map((entry) => ({
          entryId: entry.id,
          category: this.readString(entry.category),
          content: this.readString(entry.content),
        })),
    }));
  }

  private buildTranslatableResumePayload(title: string, content: Record<string, unknown>) {
    const personal = this.readRecord(content.personal);
    return this.readRecord(this.compactPayload({
      title: title.trim(),
      sectionLabels: this.buildTranslatableSectionLabelsPayload(content),
      personal: {
        name: this.readString(personal.name),
        expectedRole: this.readString(personal.expectedRole),
        expectedCity: this.readString(personal.expectedCity),
        availability: this.readString(personal.availability),
        summary: this.readString(personal.summary),
      },
      selfEvaluation: this.readString(content.selfEvaluation),
      education: this.readArray(content.education)
        .filter((entry) => this.isTextRecord(entry) && this.hasMeaningfulFields(entry, ['schoolName', 'degree', 'major', 'description']))
        .map((entry) => ({
          entryId: entry.id,
          schoolName: this.readString(entry.schoolName),
          degree: this.readString(entry.degree),
          major: this.readString(entry.major),
          startDate: this.readString(entry.startDate),
          endDate: this.readString(entry.endDate),
          description: this.readString(entry.description),
        })),
      internships: this.readArray(content.internships)
        .filter((entry) => this.isTextRecord(entry) && this.hasMeaningfulFields(entry, ['companyName', 'roleName', 'description']))
        .map((entry) => ({
          entryId: entry.id,
          companyName: this.readString(entry.companyName),
          roleName: this.readString(entry.roleName),
          city: this.readString(entry.city),
          startDate: this.readString(entry.startDate),
          endDate: this.readString(entry.endDate),
          description: this.readString(entry.description),
        })),
      projects: this.readArray(content.projects)
        .filter((entry) => this.isTextRecord(entry) && this.hasMeaningfulFields(entry, ['projectName', 'roleName', 'description']))
        .map((entry) => ({
          entryId: entry.id,
          projectName: this.readString(entry.projectName),
          roleName: this.readString(entry.roleName),
          city: this.readString(entry.city),
          startDate: this.readString(entry.startDate),
          endDate: this.readString(entry.endDate),
          description: this.readString(entry.description),
        })),
      campusRoles: this.readArray(content.campusRoles)
        .filter((entry) => this.isTextRecord(entry) && this.hasMeaningfulFields(entry, ['organization', 'roleName', 'description']))
        .map((entry) => ({
          entryId: entry.id,
          organization: this.readString(entry.organization),
          roleName: this.readString(entry.roleName),
          startDate: this.readString(entry.startDate),
          endDate: this.readString(entry.endDate),
          description: this.readString(entry.description),
        })),
      awards: this.readArray(content.awards)
        .filter((entry) => this.isTextRecord(entry) && this.hasMeaningfulFields(entry, ['title', 'level', 'description']))
        .map((entry) => ({
          entryId: entry.id,
          title: this.readString(entry.title),
          level: this.readString(entry.level),
          awardDate: this.readString(entry.awardDate),
          description: this.readString(entry.description),
        })),
      languages: this.readArray(content.languages)
        .filter((entry) => this.isTextRecord(entry) && this.hasMeaningfulFields(entry, ['language', 'score', 'description']))
        .map((entry) => ({
          entryId: entry.id,
          language: this.readString(entry.language),
          score: this.readString(entry.score),
          description: this.readString(entry.description),
        })),
      skills: this.readArray(content.skills)
        .filter((entry) => this.isTextRecord(entry) && this.hasMeaningfulFields(entry, ['category', 'content']))
        .map((entry) => ({
          entryId: entry.id,
          category: this.readString(entry.category),
          content: this.readString(entry.content),
        })),
      links: this.readArray(content.links)
        .filter((entry) => this.isTextRecord(entry) && this.hasMeaningfulFields(entry, ['label', 'url']))
        .map((entry) => ({
          entryId: entry.id,
          label: this.readString(entry.label),
          url: this.readString(entry.url),
        })),
    }));
  }

  private buildTranslatableSectionLabelsPayload(content: Record<string, unknown>) {
    const currentLabels = this.readRecord(content.sectionLabels);
    const sectionIds: Array<
      'education' | 'internships' | 'projects' | 'skills' | 'awards' | 'languages' | 'campusRoles' | 'selfEvaluation' | 'links'
    > = ['education', 'internships', 'projects', 'skills', 'awards', 'languages', 'campusRoles', 'selfEvaluation', 'links'];

    return this.readRecord(this.compactPayload(
      Object.fromEntries(sectionIds.map((sectionId) => [sectionId, this.readString(currentLabels[sectionId]) || this.getDefaultSectionLabel(sectionId)])),
    ));
  }

  private readTranslatedSectionLabels(value: unknown) {
    const record = this.readRecord(value);
    const next: Record<string, string> = {};
    const validSectionIds = new Set([
      'education',
      'internships',
      'projects',
      'skills',
      'awards',
      'languages',
      'campusRoles',
      'selfEvaluation',
      'links',
    ]);
    Object.entries(record).forEach(([sectionId, label]) => {
      if (!validSectionIds.has(sectionId)) {
        return;
      }
      const normalizedLabel = this.readOptionalPlainText(label);
      if (normalizedLabel) {
        next[sectionId] = normalizedLabel;
      }
    });
    return Object.keys(next).length ? next : undefined;
  }

  private getDefaultSectionLabel(sectionId: string) {
    const labels: Record<string, string> = {
      education: '教育经历',
      internships: '工作经历',
      projects: '项目经历',
      skills: '专业技能',
      awards: '荣誉奖项',
      languages: '语言能力',
      campusRoles: '校园经历',
      selfEvaluation: '个人总结',
      links: '作品集',
    };
    return labels[sectionId] || sectionId;
  }

  private getEntryTextFieldKey(sectionId: ResumeAiEntrySectionId): ResumeAiEntryTextFieldKey {
    return sectionId === 'skills' ? 'content' : 'description';
  }

  private getEntryAssessmentFieldKeys(sectionId: ResumeAiEntrySectionId) {
    switch (sectionId) {
      case 'education':
        return ['description', 'schoolName', 'major', 'degree'];
      case 'internships':
        return ['description', 'companyName', 'roleName'];
      case 'projects':
        return ['description', 'projectName', 'roleName'];
      case 'campusRoles':
        return ['description', 'organization', 'roleName'];
      case 'awards':
        return ['description', 'title', 'level'];
      case 'languages':
        return ['description', 'language', 'score'];
      case 'skills':
        return ['content', 'category'];
      default:
        return ['description'];
    }
  }

  private isEntrySuggestionSectionId(sectionId: ResumeAiSuggestionSectionId): sectionId is ResumeAiEntrySectionId {
    return ([
      'education',
      'internships',
      'projects',
      'campusRoles',
      'awards',
      'languages',
      'skills',
    ] as const).includes(sectionId as ResumeAiEntrySectionId);
  }

  private readSectionContent(content: Record<string, unknown>, sectionId: ResumeAiSectionId) {
    if (sectionId === 'personalSummary') {
      return this.readString(this.readRecord(content.personal).summary);
    }
    return this.readString(content[sectionId]);
  }

  private applyUpdatedSectionContent(content: Record<string, unknown>, sectionId: ResumeAiSectionId, updatedContent: string) {
    if (sectionId === 'personalSummary') {
      const personal = this.readRecord(content.personal);
      content.personal = {
        ...personal,
        summary: updatedContent,
      };
      return content;
    }
    content[sectionId] = updatedContent;
    return content;
  }

  private collectChangedArraySuggestionTargets(
    targets: ResumeAiSuggestionTarget[],
    sectionId: ResumeAiEntrySectionId,
    fieldKey: ResumeAiEntryTextFieldKey,
    previousValue: unknown,
    nextValue: unknown,
  ) {
    const previousMap = this.buildArrayTextFieldMap(previousValue, fieldKey);
    const nextMap = this.buildArrayTextFieldMap(nextValue, fieldKey);
    const entryIds = new Set([...previousMap.keys(), ...nextMap.keys()]);
    for (const entryId of entryIds) {
      if ((previousMap.get(entryId) ?? '') !== (nextMap.get(entryId) ?? '')) {
        targets.push({ sectionId, entryId });
      }
    }
  }

  private buildArrayTextFieldMap(value: unknown, fieldKey: ResumeAiEntryTextFieldKey) {
    return new Map(
      this.readArray(value)
        .filter((item) => this.isTextRecord(item))
        .map((item) => [item.id, this.readString(item[fieldKey])]),
    );
  }

  private uniqueSuggestionTargets(targets: ResumeAiSuggestionTarget[]) {
    const uniqueKeys = new Set<string>();
    return targets.filter((target) => {
      const key = `${target.sectionId}:${target.entryId}`;
      if (uniqueKeys.has(key)) {
        return false;
      }
      uniqueKeys.add(key);
      return true;
    });
  }

  private collectSuggestibleEntryTargets(
    targets: ResumeAiSuggestionTarget[],
    content: Record<string, unknown>,
    sectionId: ResumeAiEntrySectionId,
  ) {
    for (const entry of this.readArray(content[sectionId])) {
      if (!this.isTextRecord(entry)) {
        continue;
      }
      const entryPayload = this.buildEntryPayload(sectionId, entry);
      if (!this.hasMeaningfulFields(entryPayload, this.getEntryAssessmentFieldKeys(sectionId))) {
        continue;
      }
      targets.push({
        sectionId,
        entryId: entry.id,
      });
    }
  }

  private async generateEntrySuggestionsForTarget(
    resumeId: string,
    content: Record<string, unknown>,
    target: ResumeAiSuggestionTarget & { sectionId: ResumeAiEntrySectionId },
    config: Awaited<ReturnType<ResumeAiService['getActiveDefaultConfig']>>,
    apiKey: string,
  ) {
    const targetEntry = this.findEntry(content, target.sectionId, target.entryId);
    const entryPayload = this.buildEntryPayload(target.sectionId, targetEntry);
    if (!this.hasMeaningfulFields(entryPayload, this.getEntryAssessmentFieldKeys(target.sectionId))) {
      return;
    }

    const optimizationFocus = this.buildOptimizationFocus(content, {
      requestedJobTarget: this.readString(this.readRecord(content.personal).expectedRole),
      entrySectionId: target.sectionId,
      entry: targetEntry,
    });
    const prompt = this.promptBuilder.buildEntryAssessmentPrompt({
      sectionId: target.sectionId,
      title: this.buildEntryTitle(target.sectionId, targetEntry),
      entryPayload,
      jobTarget: optimizationFocus.primaryJobTarget,
      optimizationFocus,
      systemPromptTemplate: config.systemPrompt,
      assessmentPromptTemplate: (config as typeof config & { assessmentPromptTemplate?: string | null }).assessmentPromptTemplate,
    });
    const providerResult = await this.callProvider(config, apiKey, prompt.systemPrompt, prompt.userPayloadText, 'entry');
    const result = this.parseAndValidateAssessmentSuggestions(providerResult.rawText);

    await this.upsertSuggestions({
      resumeId,
      sectionId: target.sectionId,
      entryId: target.entryId,
      suggestions: result.suggestions,
      contentHash: this.hashSuggestionInput({
        sectionId: target.sectionId,
        entryId: target.entryId,
        entryPayload,
        jobTarget: optimizationFocus.primaryJobTarget,
      }),
    });
  }

  private async generateSectionSuggestionsForTarget(
    resumeId: string,
    content: Record<string, unknown>,
    target: ResumeAiSuggestionTarget & { sectionId: ResumeAiSectionId },
    config: Awaited<ReturnType<ResumeAiService['getActiveDefaultConfig']>>,
    apiKey: string,
  ) {
    const sectionValue = this.readSectionContent(content, target.sectionId);
    if (!sectionValue.trim()) {
      return;
    }

    const optimizationFocus = this.buildOptimizationFocus(content, {
      requestedJobTarget: this.readString(this.readRecord(content.personal).expectedRole),
    });
    const prompt = this.promptBuilder.buildSectionAssessmentPrompt({
      sectionId: target.sectionId,
      sectionLabel: SINGLE_FIELD_SECTION_LABEL_MAP[target.sectionId],
      content: sectionValue,
      jobTarget: optimizationFocus.primaryJobTarget,
      optimizationFocus,
      systemPromptTemplate: config.systemPrompt,
      assessmentPromptTemplate: (config as typeof config & { assessmentPromptTemplate?: string | null }).assessmentPromptTemplate,
    });
    const providerResult = await this.callProvider(config, apiKey, prompt.systemPrompt, prompt.userPayloadText, 'section');
    const result = this.parseAndValidateAssessmentSuggestions(providerResult.rawText);

    await this.upsertSuggestions({
      resumeId,
      sectionId: target.sectionId,
      entryId: 'section',
      suggestions: result.suggestions,
      contentHash: this.hashSuggestionInput({
        sectionId: target.sectionId,
        entryId: 'section',
        entryPayload: { content: sectionValue },
        jobTarget: optimizationFocus.primaryJobTarget,
      }),
    });
  }

  private parseAndValidateEntryTextContent(
    rawText: string,
    dto: OptimizeResumeEntryDto,
    fieldKey: ResumeAiEntryTextFieldKey,
  ) {
    const parsed = this.parseAiJson<{
      success?: boolean;
      sectionId?: string;
      entryId?: string;
      updatedFields?: Record<string, unknown>;
    }>(rawText);

    if (parsed.success !== true) {
      throw new BadRequestException('AI 返回结果异常，本次未改动原内容');
    }
    if (parsed.sectionId && parsed.sectionId !== dto.sectionId) {
      throw new BadRequestException('AI 返回结果异常，本次未改动原内容');
    }
    if (parsed.entryId && parsed.entryId !== dto.entryId) {
      throw new BadRequestException('AI 返回结果异常，本次未改动原内容');
    }
    if (typeof parsed.updatedFields?.[fieldKey] !== 'string') {
      throw new BadRequestException('AI 返回结果异常，本次未改动原内容');
    }

    const sanitizedContent = this.sanitizeHtml(parsed.updatedFields[fieldKey] as string);
    if (this.getPlainTextLength(sanitizedContent) < 1) {
      throw new BadRequestException('AI 返回结果异常，本次未改动原内容');
    }
    return sanitizedContent;
  }

  private parseAndValidateSectionContent(rawText: string, dto: OptimizeResumeSectionDto) {
    const parsed = this.parseAiJson<{
      success?: boolean;
      sectionId?: string;
      updatedFields?: { content?: unknown };
    }>(rawText);

    if (parsed.success !== true) {
      throw new BadRequestException('AI 返回结果异常，本次未改动原内容');
    }
    if (parsed.sectionId && parsed.sectionId !== dto.sectionId) {
      throw new BadRequestException('AI 返回结果异常，本次未改动原内容');
    }
    if (typeof parsed.updatedFields?.content !== 'string') {
      throw new BadRequestException('AI 返回结果异常，本次未改动原内容');
    }

    const sanitizedContent = this.sanitizeHtml(parsed.updatedFields.content);
    if (this.getPlainTextLength(sanitizedContent) < 1) {
      throw new BadRequestException('AI 返回结果异常，本次未改动原内容');
    }
    return sanitizedContent;
  }

  private parseAndValidateGlobalUpdates(rawText: string): ResumeAiGlobalUpdates {
    const parsed = this.parseAiJson<{
      success?: boolean;
      updates?: Record<string, unknown>;
    }>(rawText);

    if (parsed.success !== true || !parsed.updates || typeof parsed.updates !== 'object') {
      throw new BadRequestException('AI 返回结果异常，本次未改动原内容');
    }

    const updates = parsed.updates;
    return {
      personalSummary: this.readOptionalSanitizedHtml(updates.personalSummary),
      selfEvaluation: this.readOptionalSanitizedHtml(updates.selfEvaluation),
      education: this.readArrayTextUpdates(updates.education, 'description'),
      internships: this.readArrayTextUpdates(updates.internships, 'description'),
      projects: this.readArrayTextUpdates(updates.projects, 'description'),
      campusRoles: this.readArrayTextUpdates(updates.campusRoles, 'description'),
      awards: this.readArrayTextUpdates(updates.awards, 'description'),
      languages: this.readArrayTextUpdates(updates.languages, 'description'),
      skills: this.readArrayTextUpdates(updates.skills, 'content'),
    };
  }

  private parseAndValidateTranslatedResume(rawText: string): ResumeAiTranslateResult {
    const parsed = this.parseAiJson<{
      success?: boolean;
      translatedResume?: Record<string, unknown>;
    }>(rawText);

    if (parsed.success !== true || !parsed.translatedResume || typeof parsed.translatedResume !== 'object') {
      throw new BadRequestException('AI 返回结果异常，本次未改动原内容');
    }

    const translatedResume = parsed.translatedResume;
    return {
      title: this.readOptionalPlainText(translatedResume.title),
      sectionLabels: this.readTranslatedSectionLabels(translatedResume.sectionLabels),
      personal: this.readTranslatedPersonal(translatedResume.personal),
      selfEvaluation: this.readOptionalSanitizedHtml(translatedResume.selfEvaluation),
      education: this.readTranslatedArray(translatedResume.education),
      internships: this.readTranslatedArray(translatedResume.internships),
      projects: this.readTranslatedArray(translatedResume.projects),
      campusRoles: this.readTranslatedArray(translatedResume.campusRoles),
      awards: this.readTranslatedArray(translatedResume.awards),
      languages: this.readTranslatedArray(translatedResume.languages),
      skills: this.readTranslatedArray(translatedResume.skills),
      links: this.readTranslatedArray(translatedResume.links),
    };
  }

  private parseAndValidateAssessmentSuggestions(rawText: string): ResumeAiEntryAssessmentResult {
    const parsed = this.parseAiJson<{
      success?: boolean;
      suggestions?: unknown;
    }>(rawText);

    if (parsed.success !== true) {
      throw new BadRequestException('AI 建议生成失败，请稍后重试');
    }

    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions
        .map((item) => this.readString(item))
        .map((item) => this.normalizeAssessmentSuggestion(item))
        .filter(Boolean)
      : [];

    const uniqueSuggestions = Array.from(new Set(suggestions)).slice(0, 3);
    if (!uniqueSuggestions.length) {
      throw new BadRequestException('AI 建议生成失败，请稍后重试');
    }

    return {
      suggestions: this.ensureMinimumAssessmentSuggestions(uniqueSuggestions),
    };
  }

  private normalizeAssessmentSuggestion(value: string) {
    return value
      .replace(/^[\s\-*•\d.、()（）]+/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40);
  }

  private ensureMinimumAssessmentSuggestions(suggestions: string[]) {
    const fallbackSuggestions = ['突出岗位匹配度', '补强过程量化', '优化结构层次'];
    const merged = Array.from(new Set([...suggestions, ...fallbackSuggestions]))
      .map((item) => this.normalizeAssessmentSuggestion(item))
      .filter(Boolean)
      .slice(0, 3);
    return merged;
  }

  private hashSuggestionInput(payload: { sectionId: string; entryId: string; entryPayload: unknown; jobTarget: string }) {
    return createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  private async upsertSuggestions(input: ResumeAiSuggestionUpsert) {
    await this.prisma.resumeAiSuggestion.upsert({
      where: {
        resumeId_sectionId_entryId: {
          resumeId: input.resumeId,
          sectionId: input.sectionId,
          entryId: input.entryId,
        },
      },
      update: {
        suggestions: input.suggestions as unknown as InputJsonValue,
        contentHash: input.contentHash,
      },
      create: {
        resumeId: input.resumeId,
        sectionId: input.sectionId,
        entryId: input.entryId,
        suggestions: input.suggestions as unknown as InputJsonValue,
        contentHash: input.contentHash,
      },
    });
  }

  private applyUpdatedEntryText(
    content: Record<string, unknown>,
    sectionId: ResumeAiEntrySectionId,
    entryId: string,
    fieldKey: ResumeAiEntryTextFieldKey,
    fieldValue: string,
  ) {
    const section = this.readArray(content[sectionId]);
    content[sectionId] = section.map((item) => {
      if (!this.isTextRecord(item) || item.id !== entryId) {
        return item;
      }
      return {
        ...item,
        [fieldKey]: fieldValue,
      };
    });
    return content;
  }

  private applyGlobalUpdatesWithConflictCheck(
    currentContent: Record<string, unknown>,
    submittedContent: Record<string, unknown>,
    updates: ResumeAiGlobalUpdates,
  ): ResumeAiGlobalTaskSummary {
    let updatedFieldCount = 0;
    const updatedSections = new Set<string>();
    const currentPersonal = this.readRecord(currentContent.personal);
    const submittedPersonal = this.readRecord(submittedContent.personal);

    if (
      updates.personalSummary
      && this.readString(currentPersonal.summary) === this.readString(submittedPersonal.summary)
      && updates.personalSummary !== this.readString(currentPersonal.summary)
    ) {
      currentContent.personal = {
        ...currentPersonal,
        summary: updates.personalSummary,
      };
      updatedFieldCount += 1;
      updatedSections.add('personal');
    }

    if (
      updates.selfEvaluation
      && this.readString(currentContent.selfEvaluation) === this.readString(submittedContent.selfEvaluation)
      && updates.selfEvaluation !== this.readString(currentContent.selfEvaluation)
    ) {
      currentContent.selfEvaluation = updates.selfEvaluation;
      updatedFieldCount += 1;
      updatedSections.add('selfEvaluation');
    }

    updatedFieldCount += this.applyArrayFieldUpdatesWithConflictCheck(
      currentContent,
      submittedContent,
      'education',
      'description',
      updates.education,
      updatedSections,
    );
    updatedFieldCount += this.applyArrayFieldUpdatesWithConflictCheck(
      currentContent,
      submittedContent,
      'internships',
      'description',
      updates.internships,
      updatedSections,
    );
    updatedFieldCount += this.applyArrayFieldUpdatesWithConflictCheck(
      currentContent,
      submittedContent,
      'projects',
      'description',
      updates.projects,
      updatedSections,
    );
    updatedFieldCount += this.applyArrayFieldUpdatesWithConflictCheck(
      currentContent,
      submittedContent,
      'campusRoles',
      'description',
      updates.campusRoles,
      updatedSections,
    );
    updatedFieldCount += this.applyArrayFieldUpdatesWithConflictCheck(
      currentContent,
      submittedContent,
      'awards',
      'description',
      updates.awards,
      updatedSections,
    );
    updatedFieldCount += this.applyArrayFieldUpdatesWithConflictCheck(
      currentContent,
      submittedContent,
      'languages',
      'description',
      updates.languages,
      updatedSections,
    );
    updatedFieldCount += this.applyArrayFieldUpdatesWithConflictCheck(
      currentContent,
      submittedContent,
      'skills',
      'content',
      updates.skills,
      updatedSections,
    );

    return {
      updatedFieldCount,
      updatedSections: Array.from(updatedSections),
    };
  }

  private applyTranslatedResume(
    currentTitle: string,
    content: Record<string, unknown>,
    translatedResume: ResumeAiTranslateResult,
  ) {
    let updatedFieldCount = 0;
    const updatedSections = new Set<string>();
    let nextTitle: string | undefined;
    const personal = this.readRecord(content.personal);

    if (translatedResume.title && translatedResume.title !== currentTitle.trim()) {
      nextTitle = translatedResume.title;
      updatedFieldCount += 1;
      updatedSections.add('title');
    }

    const currentSectionLabels = this.readRecord(content.sectionLabels);
    if (translatedResume.sectionLabels) {
      const nextSectionLabels = { ...currentSectionLabels };
      Object.entries(translatedResume.sectionLabels).forEach(([sectionId, label]) => {
        const normalizedLabel = label.trim();
        if (!normalizedLabel) {
          return;
        }
        if (this.readString(nextSectionLabels[sectionId]) === normalizedLabel) {
          return;
        }
        nextSectionLabels[sectionId] = normalizedLabel;
        updatedFieldCount += 1;
        updatedSections.add('sectionLabels');
      });
      content.sectionLabels = nextSectionLabels;
    }

    if (translatedResume.personal?.name && translatedResume.personal.name !== this.readString(personal.name)) {
      personal.name = translatedResume.personal.name;
      updatedFieldCount += 1;
      updatedSections.add('personal');
    }
    if (translatedResume.personal?.expectedRole && translatedResume.personal.expectedRole !== this.readString(personal.expectedRole)) {
      personal.expectedRole = translatedResume.personal.expectedRole;
      updatedFieldCount += 1;
      updatedSections.add('personal');
    }
    if (translatedResume.personal?.expectedCity && translatedResume.personal.expectedCity !== this.readString(personal.expectedCity)) {
      personal.expectedCity = translatedResume.personal.expectedCity;
      updatedFieldCount += 1;
      updatedSections.add('personal');
    }
    if (translatedResume.personal?.availability && translatedResume.personal.availability !== this.readString(personal.availability)) {
      personal.availability = translatedResume.personal.availability;
      updatedFieldCount += 1;
      updatedSections.add('personal');
    }
    if (translatedResume.personal?.summary && translatedResume.personal.summary !== this.readString(personal.summary)) {
      personal.summary = translatedResume.personal.summary;
      updatedFieldCount += 1;
      updatedSections.add('personal');
    }
    content.personal = personal;

    if (translatedResume.selfEvaluation && translatedResume.selfEvaluation !== this.readString(content.selfEvaluation)) {
      content.selfEvaluation = translatedResume.selfEvaluation;
      updatedFieldCount += 1;
      updatedSections.add('selfEvaluation');
    }

    updatedFieldCount += this.applyArrayObjectUpdates(content, 'education', translatedResume.education, {
      schoolName: 'text',
      degree: 'text',
      major: 'text',
      description: 'html',
    }, updatedSections);
    updatedFieldCount += this.applyArrayObjectUpdates(content, 'internships', translatedResume.internships, {
      companyName: 'text',
      roleName: 'text',
      city: 'text',
      description: 'html',
    }, updatedSections);
    updatedFieldCount += this.applyArrayObjectUpdates(content, 'projects', translatedResume.projects, {
      projectName: 'text',
      roleName: 'text',
      city: 'text',
      description: 'html',
    }, updatedSections);
    updatedFieldCount += this.applyArrayObjectUpdates(content, 'campusRoles', translatedResume.campusRoles, {
      organization: 'text',
      roleName: 'text',
      description: 'html',
    }, updatedSections);
    updatedFieldCount += this.applyArrayObjectUpdates(content, 'awards', translatedResume.awards, {
      title: 'text',
      level: 'text',
      description: 'html',
    }, updatedSections);
    updatedFieldCount += this.applyArrayObjectUpdates(content, 'languages', translatedResume.languages, {
      language: 'text',
      score: 'text',
      description: 'html',
    }, updatedSections);
    updatedFieldCount += this.applyArrayObjectUpdates(content, 'skills', translatedResume.skills, {
      category: 'text',
      content: 'html',
    }, updatedSections);
    updatedFieldCount += this.applyArrayObjectUpdates(content, 'links', translatedResume.links, {
      label: 'text',
    }, updatedSections);

    return {
      title: nextTitle,
      updatedFieldCount,
      updatedSections: Array.from(updatedSections),
    };
  }

  private applyArrayFieldUpdatesWithConflictCheck(
    currentContent: Record<string, unknown>,
    submittedContent: Record<string, unknown>,
    sectionKey: string,
    fieldKey: ResumeAiEntryTextFieldKey,
    updates: ResumeAiGlobalTextUpdate[] | undefined,
    updatedSections: Set<string>,
  ) {
    if (!updates?.length) {
      return 0;
    }

    const submittedMap = this.buildArrayTextFieldMap(submittedContent[sectionKey], fieldKey);
    const updateMap = new Map(updates.map((item) => [item.entryId, item.value]));
    let changedCount = 0;
    const section = this.readArray(currentContent[sectionKey]);
    currentContent[sectionKey] = section.map((item) => {
      if (!this.isTextRecord(item)) {
        return item;
      }
      const nextValue = updateMap.get(item.id);
      if (!nextValue) {
        return item;
      }
      const currentValue = this.readString(item[fieldKey]);
      const submittedValue = submittedMap.get(item.id) ?? '';
      if (currentValue !== submittedValue || currentValue === nextValue) {
        return item;
      }
      changedCount += 1;
      return {
        ...item,
        [fieldKey]: nextValue,
      };
    });

    if (changedCount) {
      updatedSections.add(sectionKey);
    }
    return changedCount;
  }

  private applyArrayObjectUpdates(
    content: Record<string, unknown>,
    sectionKey: string,
    updates: Array<Record<string, unknown> & { entryId: string }> | undefined,
    fieldModes: Record<string, 'text' | 'html'>,
    updatedSections: Set<string>,
  ) {
    if (!updates?.length) {
      return 0;
    }

    const updateMap = new Map(updates.map((item) => [item.entryId, item]));
    let changedCount = 0;
    const section = this.readArray(content[sectionKey]);
    content[sectionKey] = section.map((item) => {
      if (!this.isTextRecord(item)) {
        return item;
      }
      const updateItem = updateMap.get(item.id);
      if (!updateItem) {
        return item;
      }

      let changed = false;
      const nextItem: Record<string, unknown> = { ...item };
      for (const [fieldKey, mode] of Object.entries(fieldModes)) {
        const rawValue = updateItem[fieldKey];
        const nextValue = mode === 'html' ? this.readOptionalSanitizedHtml(rawValue) : this.readOptionalPlainText(rawValue);
        if (!nextValue || this.readString(item[fieldKey]) === nextValue) {
          continue;
        }
        nextItem[fieldKey] = nextValue;
        changed = true;
      }

      if (!changed) {
        return item;
      }
      changedCount += 1;
      return nextItem;
    });

    if (changedCount) {
      updatedSections.add(sectionKey);
    }
    return changedCount;
  }

  private readOptionalSanitizedHtml(value: unknown) {
    if (typeof value !== 'string') {
      return undefined;
    }
    const sanitized = this.sanitizeHtml(value);
    if (this.getPlainTextLength(sanitized) < 1) {
      return undefined;
    }
    return sanitized;
  }

  private readOptionalPlainText(value: unknown) {
    if (typeof value !== 'string') {
      return undefined;
    }
    const normalized = value.trim();
    return normalized ? normalized : undefined;
  }

  private readTranslatedPersonal(value: unknown) {
    const record = this.readRecord(value);
    if (!Object.keys(record).length) {
      return undefined;
    }
    return {
      name: this.readOptionalPlainText(record.name),
      expectedRole: this.readOptionalPlainText(record.expectedRole),
      expectedCity: this.readOptionalPlainText(record.expectedCity),
      availability: this.readOptionalPlainText(record.availability),
      summary: this.readOptionalSanitizedHtml(record.summary),
    };
  }

  private readTranslatedArray(value: unknown) {
    if (!Array.isArray(value)) {
      return undefined;
    }

    return value.flatMap((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return [];
      }
      const record = item as Record<string, unknown>;
      if (typeof record.entryId !== 'string' || !record.entryId.trim()) {
        return [];
      }
      return [{ ...record, entryId: record.entryId.trim() }];
    });
  }

  private readArrayTextUpdates(value: unknown, fieldKey: 'description' | 'content') {
    if (!Array.isArray(value)) {
      return undefined;
    }

    return value.flatMap((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return [];
      }
      const record = item as Record<string, unknown>;
      if (typeof record.entryId !== 'string' || typeof record[fieldKey] !== 'string') {
        return [];
      }
      const sanitized = this.sanitizeHtml(record[fieldKey] as string);
      if (this.getPlainTextLength(sanitized) < 1) {
        return [];
      }
      return [{ entryId: record.entryId.trim(), value: sanitized }];
    });
  }

  private sanitizeHtml(value: string) {
    const withoutDangerousBlocks = value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+on\w+=('([^']*)'|"([^"]*)"|[^\s>]+)/gi, '')
      .replace(/javascript:/gi, '')
      .trim();

    const allowedTags = new Set(['p', 'ul', 'ol', 'li', 'strong', 'br']);
    return withoutDangerousBlocks.replace(/<\/?([a-z0-9-]+)(?:\s[^>]*)?>/gi, (match, tagName: string) => {
      const normalizedTag = tagName.toLowerCase();
      if (!allowedTags.has(normalizedTag)) {
        return '';
      }
      const isClosing = /^<\s*\//.test(match);
      if (normalizedTag === 'br') {
        return '<br>';
      }
      return isClosing ? `</${normalizedTag}>` : `<${normalizedTag}>`;
    });
  }

  private extractJsonText(rawText: string) {
    return rawText
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  private parseAiJson<T>(rawText: string) {
    const jsonText = this.extractJsonText(rawText);
    try {
      return JSON.parse(jsonText) as T;
    } catch {
      const repaired = this.repairJsonText(jsonText);
      try {
        return JSON.parse(repaired) as T;
      } catch {
        throw new BadRequestException('AI 返回结果异常，本次未改动原内容');
      }
    }
  }

  private repairJsonText(jsonText: string) {
    let inString = false;
    let escaping = false;
    let output = '';

    for (let i = 0; i < jsonText.length; i += 1) {
      const ch = jsonText[i];
      if (inString) {
        if (!escaping && ch === '"') {
          inString = false;
          output += ch;
          continue;
        }

        if (!escaping && ch === '\\') {
          escaping = true;
          output += ch;
          continue;
        }

        if (escaping) {
          escaping = false;
          output += ch;
          continue;
        }

        if (ch === '\n') {
          output += '\\n';
          continue;
        }

        if (ch === '\r') {
          output += '\\r';
          continue;
        }

        if (ch === '\t') {
          output += '\\t';
          continue;
        }

        if (ch === '\b') {
          output += '\\b';
          continue;
        }

        if (ch === '\f') {
          output += '\\f';
          continue;
        }

        const code = ch.charCodeAt(0);
        if (code >= 0 && code < 0x20) {
          output += `\\u${code.toString(16).padStart(4, '0')}`;
          continue;
        }

        output += ch;
        continue;
      }

      if (ch === '"') {
        inString = true;
        escaping = false;
        output += ch;
        continue;
      }

      output += ch;
    }

    return output;
  }

  private getPlainTextLength(value: string) {
    return value
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, '')
      .trim()
      .length;
  }

  private readGlobalTaskSummary(afterContent: unknown, beforeContent: unknown): ResumeAiGlobalTaskSummary {
    const afterRecord = this.readRecord(afterContent);
    const summaryRecord = this.readRecord(afterRecord.summary);
    const updatedFieldCount = typeof summaryRecord.updatedFieldCount === 'number'
      ? summaryRecord.updatedFieldCount
      : undefined;
    const updatedSections = Array.isArray(summaryRecord.updatedSections)
      ? summaryRecord.updatedSections
        .map((item) => this.readString(item))
        .filter(Boolean)
      : undefined;

    if (updatedFieldCount !== undefined && updatedSections) {
      return {
        updatedFieldCount,
        updatedSections,
      };
    }

    const normalizedAfterContent = Object.keys(this.readRecord(afterRecord.resume)).length
      ? afterRecord.resume
      : afterContent;
    return this.summarizeGlobalPayloadChanges(beforeContent, normalizedAfterContent);
  }

  private summarizeGlobalPayloadChanges(beforeContent: unknown, afterContent: unknown): ResumeAiGlobalTaskSummary {
    const before = this.readRecord(beforeContent);
    const after = this.readRecord(afterContent);
    let updatedFieldCount = 0;
    const updatedSections = new Set<string>();

    if (this.readString(before.personalSummary) !== this.readString(after.personalSummary)) {
      updatedFieldCount += 1;
      updatedSections.add('personal');
    }
    if (this.readString(before.selfEvaluation) !== this.readString(after.selfEvaluation)) {
      updatedFieldCount += 1;
      updatedSections.add('selfEvaluation');
    }

    updatedFieldCount += this.countArrayPayloadChanges(before.education, after.education, 'description', 'education', updatedSections);
    updatedFieldCount += this.countArrayPayloadChanges(before.internships, after.internships, 'description', 'internships', updatedSections);
    updatedFieldCount += this.countArrayPayloadChanges(before.projects, after.projects, 'description', 'projects', updatedSections);
    updatedFieldCount += this.countArrayPayloadChanges(before.campusRoles, after.campusRoles, 'description', 'campusRoles', updatedSections);
    updatedFieldCount += this.countArrayPayloadChanges(before.awards, after.awards, 'description', 'awards', updatedSections);
    updatedFieldCount += this.countArrayPayloadChanges(before.languages, after.languages, 'description', 'languages', updatedSections);
    updatedFieldCount += this.countArrayPayloadChanges(before.skills, after.skills, 'content', 'skills', updatedSections);

    return {
      updatedFieldCount,
      updatedSections: Array.from(updatedSections),
    };
  }

  private countArrayPayloadChanges(
    beforeValue: unknown,
    afterValue: unknown,
    fieldKey: 'description' | 'content',
    sectionKey: string,
    updatedSections: Set<string>,
  ) {
    const beforeMap = this.buildPayloadTextFieldMap(beforeValue, fieldKey);
    const afterMap = this.buildPayloadTextFieldMap(afterValue, fieldKey);
    let changedCount = 0;
    for (const [entryId, nextValue] of afterMap.entries()) {
      if ((beforeMap.get(entryId) ?? '') === nextValue) {
        continue;
      }
      changedCount += 1;
    }
    if (changedCount) {
      updatedSections.add(sectionKey);
    }
    return changedCount;
  }

  private buildPayloadTextFieldMap(value: unknown, fieldKey: 'description' | 'content') {
    return new Map(
      this.readArray(value)
        .map((item) => this.readRecord(item))
        .filter((item) => this.readString(item.entryId))
        .map((item) => [this.readString(item.entryId), this.readString(item[fieldKey])]),
    );
  }

  private resolveErrorCode(error: unknown) {
    const message = this.resolveErrorMessage(error);
    if (message.includes('超时')) {
      return 'ai_timeout';
    }
    if (message.includes('暂未配置')) {
      return 'ai_not_configured';
    }
    if (message.includes('结果异常')) {
      return 'ai_invalid_response';
    }
    if (message.includes('目标不存在')) {
      return 'entry_not_found';
    }
    return 'ai_optimize_failed';
  }

  private resolveErrorMessage(error: unknown) {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }
    return 'AI 优化失败，请稍后重试';
  }

  private normalizeServiceError(error: unknown) {
    const message = this.resolveErrorMessage(error);
    if (message.toLowerCase().includes('timeout')) {
      return new GatewayTimeoutException('AI 优化超时，请稍后重试');
    }
    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      return error;
    }
    return new BadRequestException('AI 优化失败，请稍后重试');
  }

  private readRecord(value: unknown) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private readArray(value: unknown) {
    return Array.isArray(value) ? value : [];
  }

  private readString(value: unknown) {
    if (typeof value !== 'string') {
      return '';
    }
    return value.trim();
  }

  private isEntryRecord(value: unknown): value is ResumeAiEntryRecord {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }
    const record = value as Record<string, unknown>;
    return typeof record.id === 'string' && typeof record.description === 'string';
  }

  private isTextRecord(value: unknown): value is ResumeAiTextRecord {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }
    return typeof (value as Record<string, unknown>).id === 'string';
  }
}
