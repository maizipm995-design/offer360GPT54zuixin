import { Injectable } from '@nestjs/common';
import { CAMPUS_EXAM_QUESTION_TYPE_CODE_MAP, type CampusExamAnswerJson, type CampusExamRuleScoreResult } from './campus-exam.types';
import { clampNumber, normalizeComparableText, normalizeLooseText, splitSentences } from './campus-exam.utils';

const NEGATIVE_PATTERNS = ['不是', '并非', '不能', '不会', '错误', '无关', '不属于'];
const STOP_WORDS = ['通过', '能够', '实现', '进行', '主要', '一般', '可以', '对于'];

@Injectable()
export class CampusExamSubjectiveRuleService {
  buildRuleConfig(answerJson: CampusExamAnswerJson) {
    const referenceText = normalizeLooseText(answerJson.values?.[0] ?? '');
    const existing = answerJson.ruleConfig;
    if (existing && Array.isArray(existing.keywords) && existing.keywords.length) {
      return existing;
    }

    const segments = splitSentences(referenceText)
      .flatMap((sentence) => sentence.split(/[，,、]/))
      .map((item) => item.trim())
      .filter((item) => item.length >= 2 && !STOP_WORDS.includes(item));
    const uniqueKeywords = Array.from(new Set(segments)).slice(0, 6);
    const keywords = uniqueKeywords.length ? uniqueKeywords : [referenceText].filter(Boolean);
    const score = keywords.length ? Number((1 / keywords.length).toFixed(2)) : 1;

    return {
      keywords,
      synonyms: Object.fromEntries(keywords.map((item) => [item, [] as string[]])),
      mustHit: keywords.slice(0, 1),
      scoreWeights: Object.fromEntries(keywords.map((item) => [item, score])),
    };
  }

  score(reference: CampusExamAnswerJson, userAnswerText: string): CampusExamRuleScoreResult {
    const ruleConfig = this.buildRuleConfig(reference);
    const normalizedAnswer = normalizeComparableText(userAnswerText);
    const matchedKeywords = ruleConfig.keywords.filter((keyword) => this.hitKeyword(keyword, normalizedAnswer, ruleConfig.synonyms[keyword] ?? []));
    const missingKeywords = ruleConfig.keywords.filter((keyword) => !matchedKeywords.includes(keyword));
    const mustHitSatisfied = ruleConfig.mustHit.every((keyword) => matchedKeywords.includes(keyword));

    let rawScore = matchedKeywords.reduce((total, keyword) => total + Number(ruleConfig.scoreWeights[keyword] ?? 0), 0);
    if (!mustHitSatisfied) {
      rawScore *= 0.5;
    }
    if (this.hasNegativeConflict(userAnswerText)) {
      rawScore *= 0.7;
    }

    const normalizedScore = clampNumber(Number(rawScore.toFixed(2)), 0, 1);
    let judgementResult: CampusExamRuleScoreResult['judgementResult'] = 'wrong';
    if (normalizedScore >= 0.85) {
      judgementResult = 'correct';
    } else if (normalizedScore >= 0.45) {
      judgementResult = 'partial';
    }

    return {
      scoringMode: 'rule',
      matchedKeywords,
      missingKeywords,
      mustHitSatisfied,
      rawScore: normalizedScore,
      normalizedScore,
      judgementResult,
      reason: matchedKeywords.length
        ? `命中 ${matchedKeywords.length} 个关键点，遗漏 ${missingKeywords.length} 个关键点`
        : '未命中参考答案关键点',
      needsAi: normalizedScore >= 0.4 && normalizedScore <= 0.6,
    };
  }

  private hitKeyword(keyword: string, normalizedAnswer: string, synonyms: string[]) {
    const candidates = [keyword, ...synonyms].map((item) => normalizeComparableText(item)).filter(Boolean);
    return candidates.some((item) => normalizedAnswer.includes(item));
  }

  private hasNegativeConflict(text: string) {
    const normalized = normalizeLooseText(text);
    return NEGATIVE_PATTERNS.some((pattern) => normalized.includes(pattern));
  }
}
