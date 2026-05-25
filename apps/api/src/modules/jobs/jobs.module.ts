import { JwtModule } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma.service';
import { JobsController } from './jobs.controller';
import { JobsMetricsService } from './jobs-metrics.service';
import { JobsNormalizationRepository } from './jobs-normalization.repository';
import { JobsNormalizationService } from './jobs-normalization.service';
import { JobsRecommendationService } from './jobs-recommendation.service';
import { JobsService } from './jobs.service';

@Module({
  imports: [
    JwtModule.register({
      secret: env.jwtSecret,
    }),
  ],
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
