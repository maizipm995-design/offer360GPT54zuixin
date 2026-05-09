import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';

export interface JobsRecommendationConfigFields {
  companyWeight: number;
  jobWeight: number;
  cityExactWeight: number;
  cityParentWeight: number;
  degreeWeight: number;
  majorWeight: number;
  fresh3DaysWeight: number;
  fresh7DaysWeight: number;
  stateOwnedFallbackWeight: number;
  deliveredPenalty: number;
  heatMax: number;
  hotAccessThreshold: number;
  hotDeliveryThreshold: number;
}

export const DEFAULT_JOBS_RECOMMENDATION_CONFIG: JobsRecommendationConfigFields = {
  companyWeight: 35,
  jobWeight: 30,
  cityExactWeight: 20,
  cityParentWeight: 10,
  degreeWeight: 8,
  majorWeight: 8,
  fresh3DaysWeight: 6,
  fresh7DaysWeight: 3,
  stateOwnedFallbackWeight: 4,
  deliveredPenalty: -12,
  heatMax: 6,
  hotAccessThreshold: 50,
  hotDeliveryThreshold: 10,
};

export type JobsRecommendationConfigSnapshot = JobsRecommendationConfigFields & {
  id: number;
  updatedAt: Date;
};

type PrismaLike = PrismaService | Prisma.TransactionClient;

export async function ensureJobsRecommendationConfig(prisma: PrismaLike): Promise<JobsRecommendationConfigSnapshot> {
  const existing = await prisma.jobsRecommendationConfig.findFirst({ orderBy: { id: 'asc' } });
  if (existing) {
    return existing;
  }

  return prisma.jobsRecommendationConfig.create({
    data: { ...DEFAULT_JOBS_RECOMMENDATION_CONFIG },
  });
}
