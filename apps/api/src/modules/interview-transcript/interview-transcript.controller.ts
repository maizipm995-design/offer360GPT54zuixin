import { Body, Controller, Get, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { readFileSync } from 'fs';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateInterviewTranscriptTaskDto } from './dto/create-interview-transcript-task.dto';
import { QueryInterviewTranscriptTasksDto } from './dto/query-interview-transcript-tasks.dto';
import { InterviewTranscriptService } from './interview-transcript.service';

const MAX_UPLOAD_FILE_SIZE = 20 * 1024 * 1024;

// #region debug-point A:debug-reporter
function reportInterviewTranscriptDebugEvent(input: {
  hypothesisId: 'A' | 'B' | 'C' | 'D';
  location: string;
  msg: string;
  data?: Record<string, unknown>;
}) {
  let debugServerUrl = 'http://127.0.0.1:7777/event';
  let debugSessionId = 'interview-transcript-500';
  try {
    const content = readFileSync(`${process.cwd()}/.dbg/interview-transcript-500.env`, 'utf8');
    debugServerUrl = content.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugServerUrl;
    debugSessionId = content.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || debugSessionId;
  } catch {}

  void fetch(debugServerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: debugSessionId,
      runId: 'pre-fix',
      hypothesisId: input.hypothesisId,
      location: input.location,
      msg: `[DEBUG] ${input.msg}`,
      data: input.data ?? {},
      ts: Date.now(),
    }),
  }).catch(() => undefined);
}
// #endregion

@ApiTags('interview-transcripts')
@Controller('interview-transcripts')
export class InterviewTranscriptController {
  constructor(private readonly interviewTranscriptService: InterviewTranscriptService) {}

  @Post('requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['companyName', 'jobName', 'interviewType', 'resumeMode'],
      properties: {
        companyName: { type: 'string' },
        jobName: { type: 'string' },
        interviewType: { type: 'string', enum: ['通用综合面试', 'HR面试', '业务面试', '总监面试', 'AI面试'] },
        jobRequirement: { type: 'string' },
        resumeMode: { type: 'string', enum: ['structured', 'upload'] },
        structuredResume: { type: 'string', description: '结构化简历 JSON 字符串' },
        structuredResumeTitle: { type: 'string' },
        resumeFile: {
          type: 'string',
          format: 'binary',
          description: `本地简历附件（最大 ${Math.round(MAX_UPLOAD_FILE_SIZE / 1024 / 1024)}MB）`,
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('resumeFile', { limits: { files: 1, fileSize: MAX_UPLOAD_FILE_SIZE } }))
  createTask(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateInterviewTranscriptTaskDto,
    @UploadedFile()
    file?: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ) {
    // #region debug-point A:controller-create-entry
    reportInterviewTranscriptDebugEvent({
      hypothesisId: 'A',
      location: 'interview-transcript.controller.ts:createTask',
      msg: 'controller createTask entry',
      data: {
        companyName: dto.companyName,
        jobName: dto.jobName,
        interviewType: dto.interviewType,
        resumeMode: dto.resumeMode,
        hasStructuredResume: Boolean(dto.structuredResume),
        hasUploadedFile: Boolean(file),
        uploadedFileName: file?.originalname ?? null,
        uploadedFileSize: file?.size ?? null,
      },
    });
    // #endregion
    return this.interviewTranscriptService.createTask(user.userId, dto, file);
  }

  @Get('quota')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getQuotaSummary(@CurrentUser() user: CurrentUserPayload) {
    return this.interviewTranscriptService.getQuotaSummary(user.userId);
  }

  @Post('tasks/query')
  queryTasks(@Body() dto: QueryInterviewTranscriptTasksDto) {
    return this.interviewTranscriptService.queryTasks(dto.ids);
  }

  @Get('files/:taskId')
  async getFile(@Param('taskId') taskId: string, @Res() response: Response) {
    const record = await this.interviewTranscriptService.getTaskFile(taskId);
    if (!record) {
      response.status(404).json({ message: '临时文件不存在或已过期' });
      return;
    }

    response.setHeader('Content-Type', record.contentType || 'application/octet-stream');
    response.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(record.fileName)}"`);
    response.setHeader('Cache-Control', 'no-store');
    response.status(200).send(record.buffer);
  }
}
