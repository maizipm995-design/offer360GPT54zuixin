import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ResumeAiModule } from '../resume-ai/resume-ai.module';
import { StorageModule } from '../storage/storage.module';
import { CampusExamAdminController } from './campus-exam.admin.controller';
import { CampusExamController } from './campus-exam.controller';
import { CampusExamService } from './campus-exam.service';
import { CampusExamSubjectiveAiService } from './campus-exam-subjective-ai.service';
import { CampusExamSubjectiveRuleService } from './campus-exam-subjective-rule.service';
import { CampusExamSubjectiveScoringService } from './campus-exam-subjective-scoring.service';

@Module({
  imports: [StorageModule, ResumeAiModule],
  controllers: [CampusExamAdminController, CampusExamController],
  providers: [
    PrismaService,
    CampusExamService,
    CampusExamSubjectiveRuleService,
    CampusExamSubjectiveAiService,
    CampusExamSubjectiveScoringService,
  ],
  exports: [CampusExamService],
})
export class CampusExamModule {}
