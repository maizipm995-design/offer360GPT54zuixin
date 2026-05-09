import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateResumeDraftDto } from './dto/create-resume-draft.dto';
import { UpdateResumeDraftDto } from './dto/update-resume-draft.dto';
import { ResumeService } from './resume.service';

@ApiTags('resume-drafts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/resume-drafts')
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) {}

  @Get()
  getList(@CurrentUser() user: CurrentUserPayload) {
    return this.resumeService.getList(user.userId);
  }

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateResumeDraftDto) {
    return this.resumeService.create(user.userId, dto);
  }

  @Get('templates')
  getTemplateConfigs() {
    return this.resumeService.getTemplateConfigs();
  }

  @Get(':id')
  getDetail(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.resumeService.getDetail(user.userId, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() dto: UpdateResumeDraftDto) {
    return this.resumeService.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.resumeService.remove(user.userId, id);
  }

  @Post(':id/validate-layout')
  validateLayout(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.resumeService.validateLayout(user.userId, id);
  }

  @Post(':id/export-pdf')
  exportPdf(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.resumeService.exportPdf(user.userId, id);
  }
}
