import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { StorageModule } from '../storage/storage.module';
import { InterviewTranscriptController } from './interview-transcript.controller';
import { InterviewTranscriptService } from './interview-transcript.service';

@Module({
  imports: [StorageModule],
  controllers: [InterviewTranscriptController],
  providers: [InterviewTranscriptService, PrismaService],
})
export class InterviewTranscriptModule {}
