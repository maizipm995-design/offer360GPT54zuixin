import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { env } from '../../config/env';
import { resolveMembershipState } from '../../common/utils/member-access';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../../prisma.service';
import { CreateInterviewTranscriptTaskDto } from './dto/create-interview-transcript-task.dto';
import {
  deletePersistedResumeFile,
  persistResumeFile,
  readPersistedResumeFileBuffer,
} from './persisted-files';

type ResumeMode = 'structured' | 'upload';
type TaskStatus = 'processing' | 'completed' | 'failed';
type OutputMode = 'url' | 'text';
type QuotaType = 'free' | 'super';

type UploadedResumeFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type InterviewTranscriptTaskRecord = {
  id: string;
  companyName: string;
  jobName: string;
  interviewType: string;
  jobRequirement: string;
  resumeMode: ResumeMode;
  structuredResumeTitle: string | null;
  uploadedFileName: string | null;
  status: TaskStatus;
  outputMode: OutputMode | null;
  downloadUrl: string | null;
  finalOutput: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type InterviewTranscriptTaskRow = {
  id: string;
  companyName: string;
  jobName: string;
  interviewType: string;
  jobRequirement: string | null;
  resumeMode: ResumeMode;
  structuredResumeTitle: string | null;
  uploadedFileName: string | null;
  status: TaskStatus;
  outputMode: OutputMode | null;
  downloadUrl: string | null;
  finalOutput: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type WorkflowPayload = {
  resume_text: string;
  resume_file: { url: string; file_type: string } | null;
  resume_structured: Record<string, unknown> | null;
  company_name: string;
  job_name: string;
  interview_type: string;
  job_requirement: string;
};

type StoredWorkflowInput = {
  companyName: string;
  jobName: string;
  interviewType: string;
  jobRequirement: string;
  resumeMode: ResumeMode;
  structuredResume: Record<string, unknown> | null;
};

type ProcessingTaskRow = InterviewTranscriptTaskRow & {
  workflowInput: string | null;
  uploadedFilePath: string | null;
  uploadedFileContentType: string | null;
  processingAttemptCount: number;
  processingStartedAt: Date | null;
};

type WorkflowStreamEvent = {
  id: string | null;
  event: string | null;
  dataText: string;
  data: Record<string, unknown> | null;
};

const MAX_UPLOAD_FILE_SIZE = 20 * 1024 * 1024;
const WORKER_POLL_INTERVAL_MS = 60 * 1000;
const WORKER_STALE_MS = 20 * 60 * 1000;
const WORKER_CONCURRENCY = 1;
const MAX_PROCESSING_ATTEMPTS = 3;
const WORKFLOW_REQUEST_TIMEOUT_MS = 15 * 60 * 1000;
const FREE_TRANSCRIPT_COUNT = 1;
const SUPER_MEMBER_TRANSCRIPT_COUNT = 20;

class RetryableWorkflowError extends Error {}

// #region debug-point A:debug-reporter
function reportInterviewTranscriptDebugEvent(input: {
  hypothesisId: 'A' | 'B' | 'C' | 'D';
  location: string;
  msg: string;
  data?: Record<string, unknown>;
  traceId?: string;
}) {
  let debugServerUrl = 'http://127.0.0.1:7777/event';
  let debugSessionId = 'resume-upload-fail';
  try {
    const content = readFileSync(`${process.cwd()}/.dbg/resume-upload-fail.env`, 'utf8');
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
      traceId: input.traceId,
      ts: Date.now(),
    }),
  }).catch(() => undefined);
}
// #endregion

function normalizeText(value?: string | null) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseStructuredResume(value?: string | null) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }
  try {
    const parsed = JSON.parse(normalized);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    throw new BadRequestException('结构化简历数据格式不正确');
  }
}

function normalizeInterviewType(value: string) {
  return value === '通用综合面试' ? '通用综合面' : value;
}

function detectWorkflowFileType(contentType: string) {
  if (contentType.startsWith('image/')) {
    return 'image';
  }
  if (contentType.startsWith('audio/')) {
    return 'audio';
  }
  if (contentType.startsWith('video/')) {
    return 'video';
  }
  return 'document';
}

function isHttpUrl(value?: string | null) {
  if (!value) {
    return false;
  }
  return /^https?:\/\//i.test(value.trim());
}

function parseWorkflowResponse(text: string) {
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function parseWorkflowStreamEvents(text: string) {
  const normalized = text.trim();
  if (!normalized || !normalized.includes('data:')) {
    return [] as WorkflowStreamEvent[];
  }

  const events: WorkflowStreamEvent[] = [];
  const blocks = normalized.split(/\r?\n\r?\n+/);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    let id: string | null = null;
    let event: string | null = null;
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith('id:')) {
        id = line.slice(3).trim() || null;
        continue;
      }
      if (line.startsWith('event:')) {
        event = line.slice(6).trim() || null;
        continue;
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    const dataText = dataLines.join('\n').trim();
    if (!dataText) {
      continue;
    }
    events.push({
      id,
      event,
      dataText,
      data: parseWorkflowResponse(dataText),
    });
  }
  return events;
}

function extractMeaningfulString(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }
  const normalized = value.trim();
  if (!normalized) {
    return '';
  }
  if (
    normalized.startsWith('{') ||
    normalized.startsWith('[') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('event:') ||
    normalized.startsWith('id:')
  ) {
    return '';
  }
  return normalized;
}

function extractWorkflowFinalOutputFromUnknown(value: unknown, depth = 0): string {
  if (value == null || depth > 6) {
    return '';
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) {
      return '';
    }
    const parsed = parseWorkflowResponse(normalized);
    if (parsed) {
      return extractWorkflowFinalOutputFromUnknown(parsed, depth + 1);
    }
    return normalized.includes('\nevent:') || normalized.includes('\ndata:')
      ? ''
      : extractMeaningfulString(normalized);
  }

  if (Array.isArray(value)) {
    for (let index = value.length - 1; index >= 0; index -= 1) {
      const nested = extractWorkflowFinalOutputFromUnknown(value[index], depth + 1);
      if (nested) {
        return nested;
      }
    }
    return '';
  }

  if (typeof value !== 'object') {
    return '';
  }

  const record = value as Record<string, unknown>;
  const directOutput = extractMeaningfulString(record.final_output) || extractMeaningfulString(record.finalOutput);
  if (directOutput) {
    return directOutput;
  }

  const prioritizedKeys = ['data', 'outputs', 'output', 'result', 'content', 'final_output', 'finalOutput'];
  for (const key of prioritizedKeys) {
    if (!(key in record)) {
      continue;
    }
    const nested = extractWorkflowFinalOutputFromUnknown(record[key], depth + 1);
    if (nested) {
      return nested;
    }
  }

  for (const nestedValue of Object.values(record).reverse()) {
    const nested = extractWorkflowFinalOutputFromUnknown(nestedValue, depth + 1);
    if (nested) {
      return nested;
    }
  }

  return '';
}

function extractWorkflowErrorMessageFromUnknown(value: unknown, depth = 0): string {
  if (value == null || depth > 5) {
    return '';
  }
  if (typeof value === 'string') {
    const parsed = parseWorkflowResponse(value);
    if (parsed) {
      return extractWorkflowErrorMessageFromUnknown(parsed, depth + 1);
    }
    return '';
  }
  if (Array.isArray(value)) {
    for (let index = value.length - 1; index >= 0; index -= 1) {
      const nested = extractWorkflowErrorMessageFromUnknown(value[index], depth + 1);
      if (nested) {
        return nested;
      }
    }
    return '';
  }
  if (typeof value !== 'object') {
    return '';
  }

  const record = value as Record<string, unknown>;
  for (const key of ['msg', 'message', 'error', 'error_message']) {
    const nested = extractMeaningfulString(record[key]);
    if (nested) {
      return nested;
    }
  }

  for (const nestedValue of Object.values(record).reverse()) {
    const nested = extractWorkflowErrorMessageFromUnknown(nestedValue, depth + 1);
    if (nested) {
      return nested;
    }
  }

  return '';
}

function extractWorkflowFinalOutput(result: Record<string, unknown> | null, events: WorkflowStreamEvent[], fallbackText: string) {
  const directOutput = extractWorkflowFinalOutputFromUnknown(result);
  if (directOutput) {
    return directOutput;
  }

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const eventOutput = extractWorkflowFinalOutputFromUnknown(events[index].data);
    if (eventOutput) {
      return eventOutput;
    }
    const textOutput = extractWorkflowFinalOutputFromUnknown(events[index].dataText);
    if (textOutput) {
      return textOutput;
    }
  }

  const fallbackOutput = extractWorkflowFinalOutputFromUnknown(fallbackText);
  return fallbackOutput || '';
}

function extractWorkflowErrorMessage(result: Record<string, unknown> | null, events: WorkflowStreamEvent[], fallbackText: string) {
  const directMessage = extractWorkflowErrorMessageFromUnknown(result);
  if (directMessage) {
    return directMessage;
  }

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const message = extractWorkflowErrorMessageFromUnknown(events[index].data);
    if (message) {
      return message;
    }
  }

  return extractMeaningfulString(fallbackText) || '工作流调用失败';
}

function isOssObjectReference(value?: string | null) {
  return normalizeText(value).startsWith('oss://');
}

function parseStoredWorkflowInput(value?: string | null) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }
  try {
    const parsed = JSON.parse(normalized);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as StoredWorkflowInput) : null;
  } catch {
    return null;
  }
}

function toTaskRecord(row: InterviewTranscriptTaskRow): InterviewTranscriptTaskRecord {
  return {
    id: row.id,
    companyName: row.companyName,
    jobName: row.jobName,
    interviewType: row.interviewType,
    jobRequirement: row.jobRequirement ?? '',
    resumeMode: row.resumeMode,
    structuredResumeTitle: row.structuredResumeTitle,
    uploadedFileName: row.uploadedFileName,
    status: row.status,
    outputMode: row.outputMode,
    downloadUrl: row.downloadUrl,
    finalOutput: row.finalOutput,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function isQuotaType(value: string | null | undefined): value is QuotaType {
  return value === 'free' || value === 'super';
}

@Injectable()
export class InterviewTranscriptService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InterviewTranscriptService.name);
  private workerTimer: NodeJS.Timeout | null = null;
  private dispatching = false;
  private readonly activeTaskIds = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async getQuotaSummary(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        interviewTranscriptFreeCount: true,
        interviewTranscriptSuperCount: true,
        membership: {
          select: {
            memberLevel: true,
            startAt: true,
            endAt: true,
            standardStartAt: true,
            standardEndAt: true,
            superStartAt: true,
            superEndAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    return this.buildQuotaSummary(user);
  }

  onModuleInit() {
    this.workerTimer = setInterval(() => {
      void this.dispatchProcessingTasks();
    }, WORKER_POLL_INTERVAL_MS);
    void this.dispatchProcessingTasks();
  }

  onModuleDestroy() {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
    }
  }

  async createTask(userId: string, dto: CreateInterviewTranscriptTaskDto, file?: UploadedResumeFile) {
    const companyName = normalizeText(dto.companyName);
    const jobName = normalizeText(dto.jobName);
    const jobRequirement = normalizeText(dto.jobRequirement);
    const structuredResumeTitle = normalizeText(dto.structuredResumeTitle) || null;
    const resumeMode = dto.resumeMode;
    // #region debug-point A:create-task-entry
    reportInterviewTranscriptDebugEvent({
      hypothesisId: 'A',
      location: 'interview-transcript.service.ts:createTask',
      msg: 'createTask entry',
      data: {
        companyName,
        jobName,
        interviewType: dto.interviewType,
        resumeMode,
        hasStructuredResume: Boolean(dto.structuredResume),
        structuredResumeTitle,
        hasUploadFile: Boolean(file),
        uploadFileName: file?.originalname ?? null,
        uploadFileSize: file?.size ?? null,
      },
    });
    // #endregion

    if (!companyName || !jobName || !dto.interviewType) {
      throw new BadRequestException('公司名称、岗位名称、面试类型为必填项');
    }

    const structuredResume = resumeMode === 'structured' ? parseStructuredResume(dto.structuredResume) : null;
    if (resumeMode === 'structured' && !structuredResume) {
      throw new BadRequestException('请选择一份有效的站内结构化简历');
    }

    if (resumeMode === 'upload') {
      if (!file || file.size <= 0) {
        throw new BadRequestException('请上传一份有效的本地简历附件');
      }
      if (file.size > MAX_UPLOAD_FILE_SIZE) {
        throw new BadRequestException(`简历附件不能超过 ${Math.round(MAX_UPLOAD_FILE_SIZE / 1024 / 1024)}MB`);
      }
    }

    const taskId = randomUUID();
    const now = new Date();
    const storedInput = JSON.stringify({
      companyName,
      jobName,
      interviewType: dto.interviewType,
      jobRequirement,
      resumeMode,
      structuredResume,
    } satisfies StoredWorkflowInput);
    let persistedFilePath: string | null = null;
    let persistedFileContentType: string | null = null;

    try {
      if (resumeMode === 'upload' && file) {
        if (this.storageService.isConfigured()) {
          try {
            const uploaded = await this.storageService.uploadBuffer({
              pathSegments: ['interview-transcripts', 'temp-resume-files'],
              actorType: 'admin',
              actorId: taskId,
              bizId: 'workflow',
              fileName: file.originalname || 'resume',
              contentType: file.mimetype || 'application/octet-stream',
              buffer: file.buffer,
            });
            persistedFilePath = this.storageService.toStoredObjectReference(uploaded.objectKey);
            persistedFileContentType = file.mimetype || 'application/octet-stream';
            // #region debug-point B:upload-buffer-stored
            reportInterviewTranscriptDebugEvent({
              hypothesisId: 'B',
              location: 'interview-transcript.service.ts:createTask',
              msg: 'upload file stored to oss',
              traceId: taskId,
              data: {
                taskId,
                uploadedFileName: file.originalname || 'resume',
                fileMimeType: file.mimetype || 'application/octet-stream',
                fileSize: file.size,
                persistedFilePath,
                persistedFileContentType,
                storageConfigured: true,
                usedFallback: false,
              },
            });
            // #endregion
          } catch (error) {
            const persistedFile = persistResumeFile({
              taskId,
              fileName: file.originalname || 'resume',
              contentType: file.mimetype || 'application/octet-stream',
              buffer: file.buffer,
            });
            persistedFilePath = persistedFile.absolutePath;
            persistedFileContentType = persistedFile.contentType;
            // #region debug-point B:upload-buffer-fallback
            reportInterviewTranscriptDebugEvent({
              hypothesisId: 'B',
              location: 'interview-transcript.service.ts:createTask',
              msg: 'oss upload failed, fallback to local persisted file',
              traceId: taskId,
              data: {
                taskId,
                uploadedFileName: file.originalname || 'resume',
                fileMimeType: file.mimetype || 'application/octet-stream',
                fileSize: file.size,
                persistedFilePath,
                persistedFileContentType,
                storageConfigured: true,
                usedFallback: true,
                uploadErrorMessage: error instanceof Error ? error.message : String(error),
              },
            });
            // #endregion
          }
        } else {
          const persistedFile = persistResumeFile({
            taskId,
            fileName: file.originalname || 'resume',
            contentType: file.mimetype || 'application/octet-stream',
            buffer: file.buffer,
          });
          persistedFilePath = persistedFile.absolutePath;
          persistedFileContentType = persistedFile.contentType;
          // #region debug-point B:upload-buffer-persisted
          reportInterviewTranscriptDebugEvent({
            hypothesisId: 'B',
            location: 'interview-transcript.service.ts:createTask',
            msg: 'upload file persisted locally',
            traceId: taskId,
            data: {
              taskId,
              uploadedFileName: file.originalname || 'resume',
              fileMimeType: file.mimetype || 'application/octet-stream',
              fileSize: file.size,
              persistedFilePath,
              persistedFileContentType,
              storageConfigured: false,
            },
          });
          // #endregion
        }
      }

      await this.prisma.$transaction(async (tx) => {
        const quotaType = await this.consumeQuotaWithTx(tx, userId);

        await tx.$executeRaw`
          INSERT INTO interview_transcript_tasks (
            id,
            user_id,
            company_name,
            job_name,
            interview_type,
            job_requirement,
            resume_mode,
            workflow_input,
            structured_resume_title,
            uploaded_file_name,
            uploaded_file_path,
            uploaded_file_content_type,
            status,
            quota_type,
            processing_attempt_count,
            processing_started_at,
            created_at,
            updated_at
          ) VALUES (
            ${taskId},
            ${userId},
            ${companyName},
            ${jobName},
            ${dto.interviewType},
            ${jobRequirement},
            ${resumeMode},
            ${storedInput},
            ${structuredResumeTitle},
            ${resumeMode === 'upload' ? file?.originalname ?? '未命名文件' : null},
            ${persistedFilePath},
            ${persistedFileContentType},
            ${'processing'},
            ${quotaType},
            ${0},
            ${null},
            ${now},
            ${now}
          )
        `;
      });
    } catch (error) {
      await this.cleanupUploadedFile(persistedFilePath);
      throw error;
    }
    // #region debug-point A:create-task-inserted
    reportInterviewTranscriptDebugEvent({
      hypothesisId: 'A',
      location: 'interview-transcript.service.ts:createTask',
      msg: 'task inserted',
      traceId: taskId,
      data: {
        taskId,
        resumeMode,
        uploadedFileName: resumeMode === 'upload' ? file?.originalname ?? null : null,
      },
    });
    // #endregion

    const created = await this.getTaskById(taskId);
    if (!created) {
      throw new BadRequestException('逐字稿任务创建失败');
    }

    void this.dispatchProcessingTasks();
    return created;
  }

  async queryTasks(ids: string[]) {
    if (!ids.length) {
      return [];
    }
    const rows = await this.prisma.$queryRaw<InterviewTranscriptTaskRow[]>(Prisma.sql`
      SELECT
        id,
        company_name AS companyName,
        job_name AS jobName,
        interview_type AS interviewType,
        job_requirement AS jobRequirement,
        resume_mode AS resumeMode,
        structured_resume_title AS structuredResumeTitle,
        uploaded_file_name AS uploadedFileName,
        status,
        output_mode AS outputMode,
        download_url AS downloadUrl,
        final_output AS finalOutput,
        error_message AS errorMessage,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM interview_transcript_tasks
      WHERE id IN (${Prisma.join(ids)})
      ORDER BY updated_at DESC
    `);
    return rows.map(toTaskRecord);
  }

  private async getTaskById(taskId: string) {
    const rows = await this.prisma.$queryRaw<InterviewTranscriptTaskRow[]>(Prisma.sql`
      SELECT
        id,
        company_name AS companyName,
        job_name AS jobName,
        interview_type AS interviewType,
        job_requirement AS jobRequirement,
        resume_mode AS resumeMode,
        structured_resume_title AS structuredResumeTitle,
        uploaded_file_name AS uploadedFileName,
        status,
        output_mode AS outputMode,
        download_url AS downloadUrl,
        final_output AS finalOutput,
        error_message AS errorMessage,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM interview_transcript_tasks
      WHERE id = ${taskId}
      LIMIT 1
    `);
    return rows[0] ? toTaskRecord(rows[0]) : null;
  }

  async getTaskFile(taskId: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        uploadedFileName: string | null;
        uploadedFilePath: string | null;
        uploadedFileContentType: string | null;
      }>
    >(Prisma.sql`
      SELECT
        uploaded_file_name AS uploadedFileName,
        uploaded_file_path AS uploadedFilePath,
        uploaded_file_content_type AS uploadedFileContentType
      FROM interview_transcript_tasks
      WHERE id = ${taskId}
      LIMIT 1
    `);

    const row = rows[0];
    if (!row?.uploadedFilePath || !row.uploadedFileName || isOssObjectReference(row.uploadedFilePath)) {
      return null;
    }

    try {
      return {
        fileName: row.uploadedFileName,
        contentType: row.uploadedFileContentType || 'application/octet-stream',
        buffer: readPersistedResumeFileBuffer(row.uploadedFilePath),
      };
    } catch {
      return null;
    }
  }

  private async dispatchProcessingTasks() {
    if (this.dispatching || this.activeTaskIds.size >= WORKER_CONCURRENCY) {
      return;
    }

    this.dispatching = true;
    try {
      while (this.activeTaskIds.size < WORKER_CONCURRENCY) {
        const task = await this.claimNextProcessingTask();
        if (!task) {
          break;
        }

        this.activeTaskIds.add(task.id);
        void this.processClaimedTask(task)
          .catch((error) => {
            this.logger.error(`面试逐字稿后台任务执行失败: ${task.id}`, error instanceof Error ? error.stack : undefined);
          })
          .finally(() => {
            this.activeTaskIds.delete(task.id);
            void this.dispatchProcessingTasks();
          });
      }
    } finally {
      this.dispatching = false;
    }
  }

  private async claimNextProcessingTask() {
    const staleBefore = new Date(Date.now() - WORKER_STALE_MS);
    const candidates = await this.prisma.$queryRaw<ProcessingTaskRow[]>(Prisma.sql`
      SELECT
        id,
        company_name AS companyName,
        job_name AS jobName,
        interview_type AS interviewType,
        job_requirement AS jobRequirement,
        resume_mode AS resumeMode,
        workflow_input AS workflowInput,
        structured_resume_title AS structuredResumeTitle,
        uploaded_file_name AS uploadedFileName,
        uploaded_file_path AS uploadedFilePath,
        uploaded_file_content_type AS uploadedFileContentType,
        status,
        processing_attempt_count AS processingAttemptCount,
        processing_started_at AS processingStartedAt,
        output_mode AS outputMode,
        download_url AS downloadUrl,
        final_output AS finalOutput,
        error_message AS errorMessage,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM interview_transcript_tasks
      WHERE status = ${'processing'}
        AND (processing_started_at IS NULL OR processing_started_at < ${staleBefore})
      ORDER BY created_at ASC
      LIMIT 5
    `);

    for (const candidate of candidates) {
      if (this.activeTaskIds.has(candidate.id)) {
        continue;
      }

      const claimedAt = new Date();
      const updated = await this.prisma.$executeRaw`
        UPDATE interview_transcript_tasks
        SET
          processing_started_at = ${claimedAt},
          processing_attempt_count = processing_attempt_count + 1,
          updated_at = ${claimedAt}
        WHERE id = ${candidate.id}
          AND status = ${'processing'}
          AND (processing_started_at IS NULL OR processing_started_at < ${staleBefore})
      `;

      if (updated > 0) {
        return {
          ...candidate,
          processingAttemptCount: candidate.processingAttemptCount + 1,
          processingStartedAt: claimedAt,
          updatedAt: claimedAt,
        };
      }
    }

    return null;
  }

  private async processClaimedTask(task: ProcessingTaskRow) {
    const storedInput = parseStoredWorkflowInput(task.workflowInput);
    if (!storedInput) {
      await this.markTaskFailed(task.id, '任务输入数据已损坏，无法继续生成', {
        cleanupUploadedFile: true,
      });
      return;
    }

    try {
      if (!env.interviewTranscriptWorkflowToken) {
        throw new Error('缺少 INTERVIEW_TRANSCRIPT_WORKFLOW_TOKEN 配置');
      }

      const payload: WorkflowPayload = {
        resume_text: '',
        resume_file: null,
        resume_structured: null,
        company_name: storedInput.companyName,
        job_name: storedInput.jobName,
        interview_type: normalizeInterviewType(storedInput.interviewType),
        job_requirement: storedInput.jobRequirement,
      };

      if (storedInput.resumeMode === 'structured') {
        payload.resume_structured = storedInput.structuredResume;
      }

      if (storedInput.resumeMode === 'upload') {
        if (!task.uploadedFilePath || !task.uploadedFileName) {
          throw new Error('本地简历附件不存在，无法继续生成逐字稿');
        }
        const resumeFileUrl = isOssObjectReference(task.uploadedFilePath)
          ? await this.storageService.createSignedReadUrl(task.uploadedFilePath)
          : `${this.getPublicApiBaseUrl()}/interview-transcripts/files/${task.id}`;
        // #region debug-point B:resume-file-url-built
        reportInterviewTranscriptDebugEvent({
          hypothesisId: 'B',
          location: 'interview-transcript.service.ts:processTask',
          msg: 'resume file url generated',
          traceId: task.id,
          data: {
            taskId: task.id,
            uploadedFilePath: task.uploadedFilePath,
            uploadedFileName: task.uploadedFileName,
            uploadedFileContentType: task.uploadedFileContentType,
            usesOssObjectReference: isOssObjectReference(task.uploadedFilePath),
            resumeFileUrl,
          },
        });
        // #endregion
        if (!resumeFileUrl) {
          throw new Error('简历附件地址生成失败，无法继续生成逐字稿');
        }
        payload.resume_file = {
          url: resumeFileUrl,
          file_type: detectWorkflowFileType(task.uploadedFileContentType || 'application/octet-stream'),
        };
      }
      // #region debug-point B:workflow-request
      reportInterviewTranscriptDebugEvent({
        hypothesisId: 'B',
        location: 'interview-transcript.service.ts:processTask',
        msg: 'workflow request prepared',
        traceId: task.id,
        data: {
          taskId: task.id,
          workflowRunUrl: this.getWorkflowRunUrl(),
          attemptCount: task.processingAttemptCount,
          resumeMode: storedInput.resumeMode,
          companyName: storedInput.companyName,
          jobName: storedInput.jobName,
          interviewType: payload.interview_type,
          hasToken: Boolean(env.interviewTranscriptWorkflowToken),
          hasResumeStructured: Boolean(payload.resume_structured),
          resumeFile: payload.resume_file,
        },
      });
      // #endregion

      const workflowResponse = await fetch(this.getWorkflowRunUrl(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.interviewTranscriptWorkflowToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(WORKFLOW_REQUEST_TIMEOUT_MS),
        body: JSON.stringify(payload),
      });

      const text = await workflowResponse.text();
      const result = parseWorkflowResponse(text);
      const streamEvents = parseWorkflowStreamEvents(text);
      // #region debug-point C:workflow-response
      reportInterviewTranscriptDebugEvent({
        hypothesisId: 'C',
        location: 'interview-transcript.service.ts:processTask',
        msg: 'workflow response received',
        traceId: task.id,
        data: {
          taskId: task.id,
          status: workflowResponse.status,
          ok: workflowResponse.ok,
          bodyPreview: text.slice(0, 500),
          responseKeys: result ? Object.keys(result) : [],
          streamEventCount: streamEvents.length,
          streamEventTypes: Array.from(new Set(streamEvents.map((item) => item.data?.type).filter((item) => typeof item === 'string'))).slice(0, 10),
        },
      });
      // #endregion

      if (!workflowResponse.ok) {
        const message = extractWorkflowErrorMessage(result, streamEvents, text);
        if (workflowResponse.status >= 500 || workflowResponse.status === 429 || workflowResponse.status === 408) {
          throw new RetryableWorkflowError(message);
        }
        throw new Error(message);
      }

      const finalOutput = extractWorkflowFinalOutput(result, streamEvents, text);
      if (!finalOutput) {
        throw new RetryableWorkflowError('工作流未返回有效的逐字稿结果');
      }

      const outputMode: OutputMode = isHttpUrl(finalOutput) ? 'url' : 'text';
      const updatedAt = new Date();
      await this.prisma.$executeRaw`
        UPDATE interview_transcript_tasks
        SET
          status = ${'completed'},
          processing_started_at = ${null},
          output_mode = ${outputMode},
          download_url = ${outputMode === 'url' ? finalOutput : null},
          final_output = ${finalOutput},
          error_message = ${null},
          uploaded_file_path = ${null},
          uploaded_file_content_type = ${null},
          updated_at = ${updatedAt}
        WHERE id = ${task.id}
      `;
      await this.cleanupUploadedFile(task.uploadedFilePath);
      // #region debug-point D:task-completed
      reportInterviewTranscriptDebugEvent({
        hypothesisId: 'D',
        location: 'interview-transcript.service.ts:processTask',
        msg: 'task marked completed',
        traceId: task.id,
        data: {
          taskId: task.id,
          outputMode,
          hasDownloadUrl: outputMode === 'url',
          finalOutputLength: finalOutput.length,
        },
      });
      // #endregion
    } catch (error) {
      const message = error instanceof Error ? error.message : '面试逐字稿生成失败，请稍后重试';
      // #region debug-point D:task-failed
      reportInterviewTranscriptDebugEvent({
        hypothesisId: 'D',
        location: 'interview-transcript.service.ts:processTask',
        msg: 'task failed',
        traceId: task.id,
        data: {
          taskId: task.id,
          attemptCount: task.processingAttemptCount,
          message,
          stack: error instanceof Error ? error.stack?.slice(0, 1000) ?? null : null,
        },
      });
      // #endregion
      const isRetryable =
        error instanceof RetryableWorkflowError ||
        message === 'fetch failed' ||
        message.toLowerCase().includes('timed out') ||
        message.toLowerCase().includes('timeout') ||
        message.toLowerCase().includes('socket') ||
        message.toLowerCase().includes('econnreset') ||
        message.toLowerCase().includes('gateway timeout');

      if (isRetryable && task.processingAttemptCount < MAX_PROCESSING_ATTEMPTS) {
        await this.releaseTaskForRetry(task.id, message);
        return;
      }

      await this.markTaskFailed(task.id, message, {
        cleanupUploadedFile: true,
      });
    }
  }

  private async releaseTaskForRetry(taskId: string, message: string) {
    const updatedAt = new Date();
    await this.prisma.$executeRaw`
      UPDATE interview_transcript_tasks
      SET
        processing_started_at = ${null},
        error_message = ${message.slice(0, 255)},
        updated_at = ${updatedAt}
      WHERE id = ${taskId}
    `;
  }

  private async markTaskFailed(
    taskId: string,
    message: string,
    options?: {
      cleanupUploadedFile?: boolean;
    },
  ) {
    const row = await this.prisma.$queryRaw<Array<{
      userId: string | null;
      quotaType: string | null;
      status: string;
      uploadedFilePath: string | null;
    }>>(Prisma.sql`
      SELECT
        user_id AS userId,
        quota_type AS quotaType,
        status,
        uploaded_file_path AS uploadedFilePath
      FROM interview_transcript_tasks
      WHERE id = ${taskId}
      LIMIT 1
    `);

    const task = row[0];
    const updatedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE interview_transcript_tasks
        SET
          status = ${'failed'},
          processing_started_at = ${null},
          error_message = ${message.slice(0, 255)},
          output_mode = ${null},
          download_url = ${null},
          uploaded_file_path = ${null},
          uploaded_file_content_type = ${null},
          updated_at = ${updatedAt}
        WHERE id = ${taskId}
      `;

      if (task?.status === 'processing' && task.userId && isQuotaType(task.quotaType)) {
        await this.refundQuotaWithTx(tx, task.userId, task.quotaType);
      }
    });

    if (options?.cleanupUploadedFile) {
      await this.cleanupUploadedFile(task?.uploadedFilePath ?? null);
    }
  }

  private buildQuotaSummary(user: {
    interviewTranscriptFreeCount: number;
    interviewTranscriptSuperCount: number;
    membership: {
      memberLevel?: string | null;
      startAt?: Date | null;
      endAt?: Date | null;
      standardStartAt?: Date | null;
      standardEndAt?: Date | null;
      superStartAt?: Date | null;
      superEndAt?: Date | null;
    } | null;
  }) {
    const resolvedMembership = resolveMembershipState(user.membership, new Date());
    const hasActiveSuperMembership = resolvedMembership.activeLevel === 'super';
    const freeRemainingCount = Math.max(Number(user.interviewTranscriptFreeCount ?? 0), 0);
    const superRemainingCount = Math.max(Number(user.interviewTranscriptSuperCount ?? 0), 0);
    const activeQuotaType: QuotaType = hasActiveSuperMembership ? 'super' : 'free';

    return {
      freeRemainingCount,
      superRemainingCount,
      activeQuotaType,
      hasActiveSuperMembership,
      availableRemainingCount: activeQuotaType === 'super' ? superRemainingCount : freeRemainingCount,
    };
  }

  private async consumeQuotaWithTx(tx: Prisma.TransactionClient, userId: string): Promise<QuotaType> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        interviewTranscriptFreeCount: true,
        interviewTranscriptSuperCount: true,
        membership: {
          select: {
            memberLevel: true,
            startAt: true,
            endAt: true,
            standardStartAt: true,
            standardEndAt: true,
            superStartAt: true,
            superEndAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    const summary = this.buildQuotaSummary(user);
    if (summary.availableRemainingCount <= 0) {
      throw new BadRequestException(
        summary.activeQuotaType === 'super'
          ? '你的面试逐字稿次数已用尽，请开通或续费超级会员后继续使用。'
          : '你的免费生成次数已用尽，请开通超级会员后继续使用。',
      );
    }

    const fieldName = summary.activeQuotaType === 'super' ? 'interviewTranscriptSuperCount' : 'interviewTranscriptFreeCount';
    const updated = await tx.user.updateMany({
      where: {
        id: userId,
        [fieldName]: { gt: 0 },
      },
      data: {
        [fieldName]: { decrement: 1 },
      },
    });

    if (updated.count <= 0) {
      throw new BadRequestException('可用生成次数已发生变化，请刷新后重试。');
    }

    return summary.activeQuotaType;
  }

  private async refundQuotaWithTx(tx: Prisma.TransactionClient, userId: string, quotaType: QuotaType) {
    await tx.user.update({
      where: { id: userId },
      data: {
        interviewTranscriptFreeCount: quotaType === 'free' ? { increment: 1 } : undefined,
        interviewTranscriptSuperCount: quotaType === 'super' ? { increment: 1 } : undefined,
      },
    });
  }

  private async cleanupUploadedFile(storedPath?: string | null) {
    const normalized = normalizeText(storedPath);
    if (!normalized) {
      return;
    }
    if (isOssObjectReference(normalized)) {
      await this.storageService.deleteObject(normalized).catch((error) => {
        this.logger.warn(
          `面试逐字稿临时 OSS 文件清理失败: ${normalized}`,
          error instanceof Error ? error.stack : undefined,
        );
      });
      return;
    }
    deletePersistedResumeFile(normalized);
  }

  private getWorkflowRunUrl() {
    const configuredUrl = normalizeText(env.interviewTranscriptWorkflowRunUrl) || 'https://5f7454nvm6.coze.site/stream_run';
    return configuredUrl.replace(/\/run$/, '/stream_run');
  }

  private getPublicApiBaseUrl() {
    const baseUrl = env.webAppBaseUrl.trim().replace(/\/$/, '');
    if (!baseUrl) {
      throw new Error('缺少 WEB_APP_BASE_URL 配置，无法为上传附件生成公网访问地址');
    }
    const hostname = new URL(baseUrl).hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      throw new Error('上传本地附件模式需要可被外部工作流访问的公网域名，请先配置 WEB_APP_BASE_URL');
    }
    return `${baseUrl}/api`;
  }
}
