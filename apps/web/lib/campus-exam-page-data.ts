import { cache } from 'react';
import { serverGet } from '@/lib/api';
import type {
  CampusExamCategoryDetail,
  CampusExamQuestionDetail,
  CampusExamSpecialDetail,
} from '@/lib/campus-exam';

const campusExamRequestInit = {
  next: { revalidate: 300 },
} satisfies RequestInit;

export const getCampusExamCategoryDetail = cache(async (categorySlug: string) => serverGet<CampusExamCategoryDetail>(
  `/campus-exam/categories/${encodeURIComponent(categorySlug)}`,
  campusExamRequestInit,
));

export const getCampusExamSpecialDetail = cache(async (specialId: string) => serverGet<CampusExamSpecialDetail>(
  `/campus-exam/specials/${encodeURIComponent(specialId)}`,
  campusExamRequestInit,
));

export const getCampusExamQuestionDetail = cache(async (questionId: string) => serverGet<CampusExamQuestionDetail>(
  `/campus-exam/questions/${encodeURIComponent(questionId)}`,
  campusExamRequestInit,
));
