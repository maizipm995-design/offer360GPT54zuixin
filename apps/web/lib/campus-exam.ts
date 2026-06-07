export type CampusExamPracticeMode =
  | 'special_practice'
  | 'category_practice'
  | 'custom_practice'
  | 'quick_practice'
  | 'smart_mock'
  | 'wrong_practice'
  | 'favorite_practice'
  | 'wrong_retry';

export interface CampusExamHistoryItem {
  sessionId: string;
  mode: CampusExamPracticeMode;
  title: string;
  specialId?: number | null;
  specialName?: string;
  categoryName?: string;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  scoreRate: number;
  currentScoreRate: number;
  status: string;
  lastQuestionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampusExamCategoryTreeItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  specials: Array<{
    id: number;
    name: string;
    description?: string | null;
    questionCount: number;
    status?: string;
  }>;
}

export interface CampusExamCategoryDetail {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  updatedAt?: string;
  specials: Array<{
    id: number;
    name: string;
    description?: string | null;
    questionCount: number;
    updatedAt?: string;
  }>;
}

export interface CampusExamHomePayload {
  heroCards: Array<{ code: string; title: string; enabled: boolean }>;
  categoryTree: CampusExamCategoryTreeItem[];
  history: CampusExamHistoryItem[];
  stats: {
    predictedScore: number;
    wrongCount: number;
    noteCount: number;
    favoriteCount: number;
  };
}

export interface CampusExamPagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface CampusExamAdminCategory {
  id: string;
  specialCode: string;
  name: string;
  slug: string;
  description?: string | null;
  sortOrder: number;
  status: string;
  specialCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampusExamAdminSpecial {
  id: number;
  specialCode: string;
  categoryId: string;
  categorySpecialCode: string;
  categoryName: string;
  name: string;
  description?: string | null;
  questionCount: number;
  status: string;
  sortOrder: number;
  importBatchCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampusExamAdminSpecialDetail {
  id: number;
  specialCode: string;
  categoryId: string;
  categorySpecialCode: string;
  categoryName: string;
  name: string;
  description?: string | null;
  questionCount: number;
  status: string;
  sortOrder: number;
  recentQuestionCount: number;
  latestImportBatches: Array<{
    id: string;
    fileName: string;
    totalCount: number;
    successCount: number;
    failCount: number;
    status: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CampusExamAdminImportPreviewResult {
  batchId: string;
  specialId: number;
  specialName: string;
  fileName: string;
  totalCount: number;
  successCount: number;
  failCount: number;
  summary: {
    headerErrors: number;
    categoryMismatch: number;
    imageValidationErrors: number;
    answerFormatErrors: number;
  };
  previewRowCount: number;
  previewRowsTruncated: boolean;
  previewRows: Array<{
    sourceRowNo: number;
    specialId: number;
    questionType: number;
    questionTypeLabel: string;
    stemContentType: number;
    difficulty: number;
    isHighFrequencyWrong: boolean;
    optionContentType: number;
    stemHtml: string;
    optionsJson: Array<{ key: string; label: string; value: string }> | null;
    answerJson: { type: string; values: string[] };
    analysisHtml: string | null;
    questionImageUrl: string | null;
    analysisImageUrl: string | null;
    status: string;
  }>;
  errors: Array<{
    rowNo: number;
    fieldName: string;
    errorCode: string;
    errorMessage: string;
  }>;
}

export interface CampusExamAdminImportConfirmResult {
  batchId: string;
  overwritePolicy: string;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  status: string;
}

export interface CampusExamAdminCategoryFolderImportResult {
  categoryId: string | null;
  categoryName: string;
  categoryStatus: 'created' | 'reused' | 'not_created';
  totalFileCount: number;
  skippedFileCount: number;
  createdSpecialCount: number;
  skippedSpecialCount: number;
  importedQuestionCount: number;
  skippedQuestionCount: number;
  failedQuestionCount: number;
  fileResults: Array<{
    fileName: string;
    relativePath: string;
    specialName: string;
    specialId: number | null;
    batchId: string | null;
    totalCount: number;
    importedCount: number;
    skippedCount: number;
    failedCount: number;
    status: 'imported' | 'skipped_existing_special' | 'skipped_invalid_file' | 'skipped_invalid_template' | 'failed';
    message: string;
  }>;
}

export interface CampusExamAdminCategoryDeleteResult {
  id: string;
  name: string;
  deletedSpecialCount: number;
  deletedQuestionCount: number;
  status: 'deleted';
}

export interface CampusExamAdminSpecialDeleteResult {
  id: number;
  name: string;
  deletedQuestionCount: number;
  status: 'deleted';
}

export interface CampusExamAdminImportBatch {
  id: string;
  fileName: string;
  specialId: number;
  specialName: string;
  categoryName: string;
  totalCount: number;
  successCount: number;
  failCount: number;
  errorCount: number;
  importedQuestionCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampusExamAdminImportBatchDetail {
  id: string;
  fileName: string;
  specialId: number;
  specialName: string;
  categoryName: string;
  totalCount: number;
  successCount: number;
  failCount: number;
  status: string;
  summary: Record<string, unknown>;
  questions: CampusExamAdminQuestionListItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CampusExamAdminImportBatchError {
  id: string;
  rowNo: number;
  fieldName: string;
  errorCode: string;
  errorMessage: string;
  rawPayload?: unknown;
  createdAt: string;
}

export interface CampusExamSpecialDetail {
  id: number;
  name: string;
  description?: string | null;
  updatedAt?: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  questionCount: number;
  questionIds?: string[];
  questionTypeDistribution: Array<{ questionType: number; label: string; count: number }>;
  difficultyDistribution: Array<{ difficulty: number; count: number }>;
  latestSession?: {
    sessionId: string;
    answeredCount: number;
    totalQuestions: number;
    lastQuestionId?: string | null;
  } | null;
}

export interface CampusExamQuestionDetail {
  id: string;
  specialId: number;
  questionType: number;
  questionTypeLabel: string;
  questionTypeCode: string;
  difficulty: number;
  isHighFrequencyWrong: boolean;
  status: string;
  stemHtml?: string;
  stemPreviewHtml: string;
  optionsJson?: Array<{ key: string; label: string; value: string; previewHtml?: string }> | null;
  answerJson?: { type: string; values: string[] };
  analysisHtml?: string | null;
  analysisPreviewHtml: string;
  questionImageUrl?: string;
  questionImageOssUrl?: string;
  questionImagePreviewUrl?: string;
  analysisImageUrl?: string;
  analysisImageOssUrl?: string;
  analysisImagePreviewUrl?: string;
  isFavorited?: boolean;
  interactionRule: {
    mode: 'single_choice' | 'multiple_choice' | 'judge' | 'blank_single' | 'blank_multiple' | 'essay';
    autoSubmitOnOptionClick: boolean;
    requiresManualSubmit: boolean;
    minSelectionCount: number;
    maxSelectionCount: number;
    blankCount: number;
    requiresNonEmptyAnswer: boolean;
  };
  special?: {
    id: number;
    name: string;
    category?: {
      id: string;
      name: string;
      slug: string;
    } | null;
  } | null;
  answerRecord?: {
    id: string;
    userAnswer: { type: string; values: string[] };
    isCorrect?: boolean | null;
    score?: number | null;
    answerStatus: string;
    subjectiveJudgement?: {
      scoringMode: string;
      matchedKeywords?: string[];
      reason?: string | null;
      judgementResult?: string;
    } | null;
  } | null;
}

export interface CampusExamAdminQuestionListItem extends CampusExamQuestionDetail {
  specialName?: string;
  categoryName?: string;
  assetTransferStatus?: string;
  sourceRowNo?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampusExamSessionDetail {
  sessionId: string;
  mode: CampusExamPracticeMode;
  title: string;
  specialId?: number | null;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  status: string;
  lastQuestionId?: string | null;
  firstQuestionId?: string | null;
  questionOrder: string[];
  questionGroups: Array<{
    label: string;
    questionIds: string[];
  }>;
  answeredMap: Record<string, {
    answerId: string;
    answerStatus: string;
    isCorrect?: boolean | null;
    score?: number | null;
  }>;
}

export interface CampusExamAnswerSubmitResult {
  questionId: string;
  isCorrect?: boolean | null;
  score?: number | null;
  answerStatus: string;
  judgementResult?: string | null;
  correctAnswer?: { type: string; values: string[] };
  analysisHtml?: string | null;
  subjectiveJudgement?: {
    scoringMode: string;
    matchedKeywords?: string[];
    missingKeywords?: string[];
    reason?: string | null;
  } | null;
}

export interface CampusExamAdminSubjectiveJudgementListItem {
  id: string;
  userId: string;
  questionId: string;
  questionStem: string;
  scoringMode: string;
  judgementResult: string;
  normalizedScore: number;
  matchedKeywords?: string[];
  aiReasoning?: string | null;
  qualityStatus: string;
  qualityNote?: string | null;
  createdAt: string;
}

export interface CampusExamAdminSubjectiveJudgementDetail {
  id: string;
  answerId: string;
  questionId: string;
  userId: string;
  scoringMode: string;
  matchedKeywords?: string[];
  referenceAnswerSnapshot: string;
  userAnswerSnapshot: string;
  rawScore: number;
  normalizedScore: number;
  judgementResult: string;
  aiModelCode?: string | null;
  aiReasoning?: string | null;
  qualityStatus: string;
  qualityNote?: string | null;
  questionStem: string;
  createdAt: string;
}

export interface CampusExamListResponse<T> {
  list: T[];
  pagination: CampusExamPagination;
}

export function getPracticeEntryHref(mode: CampusExamPracticeMode, specialId?: number | null) {
  if (mode === 'special_practice' && specialId) {
    return `/campus-exam/special/${specialId}/practice`;
  }
  if (mode === 'category_practice' || mode === 'custom_practice') {
    return `/campus-exam/practice?mode=${mode}`;
  }
  return `/campus-exam/practice?mode=${mode}`;
}

export function getPracticeSessionHref(item: {
  mode: CampusExamPracticeMode;
  sessionId: string;
  specialId?: number | null;
}) {
  const baseHref = getPracticeEntryHref(item.mode, item.specialId);
  const separator = baseHref.includes('?') ? '&' : '?';
  return `${baseHref}${separator}sessionId=${item.sessionId}`;
}

export function renderPercent(value: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

export function formatPercentValue(value?: number | null) {
  return `${Math.max(0, Math.round(Number(value ?? 0)))}%`;
}
