import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { PrismaService } from '../../prisma.service';
import { ResumeController } from './resume.controller';
import { ResumePrintController } from './resume-print.controller';
import { ResumeService } from './resume.service';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [ResumeController, ResumePrintController],
  providers: [ResumeService, PrismaService],
  exports: [ResumeService],
})
export class ResumeModule {}
