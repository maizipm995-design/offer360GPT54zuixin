import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResumeService } from './resume.service';

@ApiTags('resume-print')
@Controller('resume-drafts')
export class ResumePrintController {
  constructor(private readonly resumeService: ResumeService) {}

  @Get('print/:id')
  getPrintPayload(@Param('id') id: string, @Query('token') token?: string) {
    return this.resumeService.getPrintPayload(id, token ?? '');
  }
}
