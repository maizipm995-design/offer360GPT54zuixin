import type { Prisma } from '@prisma/client';

export const CAMPUS_EXAM_MAX_IMPORT_FILE_SIZE = 20 * 1024 * 1024;
export const CAMPUS_EXAM_ALLOWED_IMPORT_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);

export const CAMPUS_EXAM_HERO_CARDS = [
  { code: 'quick_practice', title: '快速练习', enabled: true },
  { code: 'smart_mock', title: '智能模考', enabled: true },
  { code: 'wrong_retry', title: '错题重练', enabled: true },
] as const;

export const CAMPUS_EXAM_QUESTION_TYPE_LABEL_MAP: Record<number, string> = {
  1: '单选题',
  2: '多选题',
  3: '判断题',
  4: '单项填空',
  5: '多项填空',
  6: '简答题',
};

export const CAMPUS_EXAM_QUESTION_TYPE_CODE_MAP: Record<number, string> = {
  1: 'single',
  2: 'multiple',
  3: 'judge',
  4: 'blank_single',
  5: 'blank_multiple',
  6: 'essay',
};

export const CAMPUS_EXAM_QUESTION_TYPE_INPUT_MAP: Record<string, number> = {
  '1': 1,
  single: 1,
  '单选': 1,
  '单选题': 1,
  '2': 2,
  multiple: 2,
  '多选': 2,
  '多选题': 2,
  '3': 3,
  judge: 3,
  boolean: 3,
  '判断': 3,
  '判断题': 3,
  '4': 4,
  blank_single: 4,
  '单项填空': 4,
  '单项填空题': 4,
  '单空填空': 4,
  '5': 5,
  blank_multiple: 5,
  '多项填空': 5,
  '多项填空题': 5,
  '多空填空': 5,
  '6': 6,
  essay: 6,
  subjective: 6,
  '简答': 6,
  '简答题': 6,
};

export const CAMPUS_EXAM_DIFFICULTY_OPTIONS = [1, 2, 3, 4, 5] as const;
export const CAMPUS_EXAM_STATUS_OPTIONS = ['active', 'inactive'] as const;
export const CAMPUS_EXAM_IMPORT_OVERWRITE_POLICIES = ['skip_existing', 'replace_existing', 'fail_on_duplicate'] as const;

export type UploadedCampusExamFile = {
  buffer: Buffer;
  size: number;
  originalname: string;
  mimetype?: string;
};

export interface CampusExamImportErrorItem {
  rowNo: number;
  fieldName: string;
  errorCode: string;
  errorMessage: string;
  rawPayload?: Prisma.InputJsonValue;
}

export interface CampusExamAssetTransferItem {
  sourceUrl: string;
  assetType: string;
  status: 'pending' | 'downloading' | 'uploading' | 'success' | 'failed' | 'skipped';
  ossUrl?: string;
  contentType?: string;
  size?: number;
  errorMessage?: string;
}

export interface CampusExamAnswerJson {
  type: string;
  values: string[];
  ruleConfig?: {
    keywords: string[];
    synonyms: Record<string, string[]>;
    mustHit: string[];
    scoreWeights: Record<string, number>;
  };
}

export interface CampusExamRuleScoreResult {
  scoringMode: 'rule';
  matchedKeywords: string[];
  missingKeywords: string[];
  mustHitSatisfied: boolean;
  rawScore: number;
  normalizedScore: number;
  judgementResult: 'correct' | 'partial' | 'wrong' | 'pending_review';
  reason: string;
  needsAi: boolean;
}

export interface CampusExamAiScoreResult {
  scoringMode: 'ai' | 'hybrid';
  score: number;
  result: 'correct' | 'partial' | 'wrong' | 'pending_review';
  matchedPoints: string[];
  missingPoints: string[];
  reason: string;
  modelCode?: string | null;
}
