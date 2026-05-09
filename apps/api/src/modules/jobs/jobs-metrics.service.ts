import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import {
  JOB_ACCESS_CLICK_ACTION_TYPES,
  JOBS_RECOMMENDATION_EFFECTIVE_PROGRESS_STATUSES,
} from './jobs-recommendation.constants';

export type JobAccessClickActionType = (typeof JOB_ACCESS_CLICK_ACTION_TYPES)[number];

type PrismaLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class JobsMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordAccessClick(jobId: string, _actionType: JobAccessClickActionType, client?: PrismaLike) {
    const db = client ?? this.prisma;
    const now = new Date();
    await db.$executeRaw(
      Prisma.sql`
        UPDATE job_announcements
        SET access_click_count = access_click_count + 1,
            last_access_at = ${now}
        WHERE id = ${jobId}
      `,
    );
  }

  async recordDeliveryMark(jobId: string, previousProgressStatus: string | null | undefined, nextProgressStatus: string, client?: PrismaLike) {
    if (this.isEffectiveProgress(previousProgressStatus) || !this.isEffectiveProgress(nextProgressStatus)) {
      return false;
    }

    const db = client ?? this.prisma;
    const now = new Date();
    await db.$executeRaw(
      Prisma.sql`
        UPDATE job_announcements
        SET delivery_mark_count = delivery_mark_count + 1,
            last_delivery_mark_at = ${now}
        WHERE id = ${jobId}
      `,
    );
    return true;
  }

  async assertJobExists(jobId: string, client?: PrismaLike) {
    const db = client ?? this.prisma;
    const job = await db.jobAnnouncement.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('岗位不存在');
    }
    return job;
  }

  isEffectiveProgress(progressStatus?: string | null) {
    return Boolean(progressStatus && JOBS_RECOMMENDATION_EFFECTIVE_PROGRESS_STATUSES.includes(progressStatus as (typeof JOBS_RECOMMENDATION_EFFECTIVE_PROGRESS_STATUSES)[number]));
  }
}
