import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AiConfigCryptoService } from '../resume-ai/ai-config-crypto.service';
import { VolcengineArkProvider } from '../resume-ai/providers/volcengine-ark.provider';
import type { CampusExamAiScoreResult, CampusExamAnswerJson, CampusExamRuleScoreResult } from './campus-exam.types';
import { normalizeLooseText, safeJsonParse } from './campus-exam.utils';

@Injectable()
export class CampusExamSubjectiveAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: VolcengineArkProvider,
    private readonly cryptoService: AiConfigCryptoService,
  ) {}

  async scoreWithAi(input: {
    stemHtml: string;
    referenceAnswer: CampusExamAnswerJson;
    userAnswerText: string;
    ruleScore: CampusExamRuleScoreResult;
  }): Promise<CampusExamAiScoreResult | null> {
    const config = await this.prisma.aiModelConfig.findFirst({
      where: { enabled: true, isDefault: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!config) {
      return null;
    }

    const apiKey = this.cryptoService.decryptApiKey(config.apiKeyEncrypted);
    const systemPrompt = '你是校招笔试简答题评分助手。只能输出合法 JSON，不要输出 Markdown，不要输出额外解释。';
    const userPayloadText = JSON.stringify({
      stem: normalizeLooseText(input.stemHtml),
      referenceAnswer: input.referenceAnswer,
      ruleScore: input.ruleScore,
      userAnswer: normalizeLooseText(input.userAnswerText),
      outputSchema: {
        score: '0-1 浮点数',
        result: 'correct | partial | wrong | pending_review',
        matchedPoints: ['命中点'],
        missingPoints: ['遗漏点'],
        reason: '一句话解释',
      },
    });

    try {
      const result = await this.provider.generateText({
        systemPrompt,
        userPayloadText,
        modelName: config.modelName,
        timeoutMs: config.timeoutMs,
        maxOutputTokens: config.maxOutputTokens ?? 600,
        temperature: config.temperature ? Number(config.temperature) : 0.2,
        topP: config.topP ? Number(config.topP) : 0.8,
      }, {
        apiKey,
        baseUrl: config.baseUrl,
      });
      const payload = safeJsonParse<{
        score?: number;
        result?: CampusExamAiScoreResult['result'];
        matchedPoints?: string[];
        missingPoints?: string[];
        reason?: string;
      }>(result.rawText, {});
      if (typeof payload.score !== 'number' || !payload.result) {
        return null;
      }
      return {
        scoringMode: 'hybrid',
        score: Math.max(0, Math.min(1, Number(payload.score.toFixed(2)))),
        result: payload.result,
        matchedPoints: Array.isArray(payload.matchedPoints) ? payload.matchedPoints.map((item) => normalizeLooseText(item)).filter(Boolean) : [],
        missingPoints: Array.isArray(payload.missingPoints) ? payload.missingPoints.map((item) => normalizeLooseText(item)).filter(Boolean) : [],
        reason: normalizeLooseText(payload.reason) || 'AI 已完成补充评分',
        modelCode: config.code,
      };
    } catch {
      return null;
    }
  }
}
