import { Injectable } from '@nestjs/common';
import type { CampusExamAnswerJson } from './campus-exam.types';
import { CampusExamSubjectiveAiService } from './campus-exam-subjective-ai.service';
import { CampusExamSubjectiveRuleService } from './campus-exam-subjective-rule.service';
import { clampNumber, normalizeLooseText } from './campus-exam.utils';

@Injectable()
export class CampusExamSubjectiveScoringService {
  constructor(
    private readonly ruleService: CampusExamSubjectiveRuleService,
    private readonly aiService: CampusExamSubjectiveAiService,
  ) {}

  async score(input: {
    stemHtml: string;
    referenceAnswer: CampusExamAnswerJson;
    userAnswerText: string;
  }) {
    const ruleScore = this.ruleService.score(input.referenceAnswer, input.userAnswerText);
    const aiScore = ruleScore.needsAi
      ? await this.aiService.scoreWithAi({
          stemHtml: input.stemHtml,
          referenceAnswer: input.referenceAnswer,
          userAnswerText: input.userAnswerText,
          ruleScore,
        })
      : null;

    const finalScore = aiScore?.score ?? ruleScore.normalizedScore;
    const finalResult = aiScore?.result ?? ruleScore.judgementResult;
    const matchedKeywords = aiScore?.matchedPoints?.length ? aiScore.matchedPoints : ruleScore.matchedKeywords;
    const missingKeywords = aiScore?.missingPoints?.length ? aiScore.missingPoints : ruleScore.missingKeywords;

    return {
      scoringMode: aiScore ? aiScore.scoringMode : 'rule',
      matchedKeywords,
      missingKeywords,
      rawScore: clampNumber(finalScore, 0, 1),
      normalizedScore: clampNumber(finalScore, 0, 1),
      judgementResult: finalResult,
      reason: normalizeLooseText(aiScore?.reason || ruleScore.reason),
      aiModelCode: aiScore?.modelCode ?? null,
      aiReasoning: aiScore?.reason ?? null,
    };
  }
}
