import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { JobsController } from './jobs.controller';
import { JobsMetricsService } from './jobs-metrics.service';
import { JobsNormalizationRepository } from './jobs-normalization.repository';
import { JobsNormalizationService } from './jobs-normalization.service';
import { JobsRecommendationService } from './jobs-recommendation.service';
import { JobsService } from './jobs.service';

@Module({
  controllers: [JobsController],
  providers: [
    JobsService,
    JobsRecommendationService,
    JobsMetricsService,
    JobsNormalizationRepository,
    JobsNormalizationService,
    PrismaService,
  ],
  exports: [JobsService, JobsRecommendationService, JobsMetricsService, JobsNormalizationService],
})
export class JobsModule {}
