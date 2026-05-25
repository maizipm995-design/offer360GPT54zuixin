import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptimizeResumeGlobalDto } from './dto/optimize-resume-global.dto';
import { OptimizeResumeEntryDto } from './dto/optimize-resume-entry.dto';
import { OptimizeResumeProfessionalDto } from './dto/optimize-resume-professional.dto';
import { OptimizeResumeSectionDto } from './dto/optimize-resume-section.dto';
import { TranslateResumeDto } from './dto/translate-resume.dto';
import { ResumeAiService } from './resume-ai.service';

@ApiTags('resume-ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/resume-drafts')
export class ResumeAiController {
  constructor(private readonly resumeAiService: ResumeAiService) {}

  @Post(':id/ai-optimize-entry')
  optimizeEntry(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: OptimizeResumeEntryDto,
  ) {
    return this.resumeAiService.optimizeEntry(user.userId, id, dto);
  }

  @Post(':id/ai-assess-entry')
  assessEntry(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: OptimizeResumeEntryDto,
  ) {
    return this.resumeAiService.assessEntry(user.userId, id, dto);
  }

  @Get(':id/ai-suggestions')
  listSuggestions(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.resumeAiService.listSuggestions(user.userId, id);
  }

  @Post(':id/ai-optimize-section')
  optimizeSection(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: OptimizeResumeSectionDto,
  ) {
    return this.resumeAiService.optimizeSection(user.userId, id, dto);
  }

  @Post(':id/ai-optimize')
  optimizeResume(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: OptimizeResumeGlobalDto,
  ) {
    return this.resumeAiService.optimizeResume(user.userId, id, dto);
  }

  @Get(':id/ai-optimize/tasks/:taskId')
  getOptimizeResumeTaskStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('taskId') taskId: string,
  ) {
    return this.resumeAiService.getOptimizeResumeTaskStatus(user.userId, id, taskId);
  }

  @Post(':id/ai-translate')
  translateResume(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: TranslateResumeDto,
  ) {
    return this.resumeAiService.translateResume(user.userId, id, dto);
  }

  @Get(':id/ai-translate/tasks/:taskId')
  getTranslateResumeTaskStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('taskId') taskId: string,
  ) {
    return this.resumeAiService.getTranslateResumeTaskStatus(user.userId, id, taskId);
  }

  @Post(':id/ai-professional-optimize')
  optimizeProfessionalResume(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: OptimizeResumeProfessionalDto,
  ) {
    return this.resumeAiService.optimizeProfessionalResume(user.userId, id, dto);
  }

  @Get(':id/ai-professional-optimize/tasks/:taskId')
  getProfessionalOptimizeTaskStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('taskId') taskId: string,
  ) {
    return this.resumeAiService.getProfessionalOptimizeTaskStatus(user.userId, id, taskId);
  }
}
