import { Module, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ResumeModule } from '../resume/resume.module';
import { AiConfigCryptoService } from './ai-config-crypto.service';
import { ResumeAiAdminService } from './resume-ai-admin.service';
import { ResumeAiController } from './resume-ai.controller';
import { ResumeAiPromptBuilder } from './resume-ai.prompt';
import { ResumeAiService } from './resume-ai.service';
import { VolcengineArkProvider } from './providers/volcengine-ark.provider';

@Module({
  imports: [forwardRef(() => ResumeModule)],
  controllers: [ResumeAiController],
  providers: [
    PrismaService,
    AiConfigCryptoService,
    ResumeAiPromptBuilder,
    ResumeAiService,
    ResumeAiAdminService,
    VolcengineArkProvider,
  ],
  exports: [AiConfigCryptoService, ResumeAiAdminService, ResumeAiService, VolcengineArkProvider],
})
export class ResumeAiModule {}
