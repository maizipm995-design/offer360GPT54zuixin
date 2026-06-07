import { Body, Controller, Get, HttpException, InternalServerErrorException, Logger, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { JobsClickDto } from './dto/jobs-click.dto';
import { QueryJobSuggestionsDto } from './dto/query-job-suggestions.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { JobsService } from './jobs.service';

type ControlledJobsService = JobsService & {
  getList: (
    query: QueryJobsDto,
    currentUserId?: string | null,
    context?: ReturnType<JobsController['buildRequestContext']>,
  ) => unknown;
  getSearchSuggestions: (query: QueryJobSuggestionsDto, currentUserId?: string | null) => unknown;
  getFreeZoneList: (userId: string, context?: ReturnType<JobsController['buildRequestContext']>) => unknown;
  viewAnnouncement: (userId: string, id: string, context?: ReturnType<JobsController['buildRequestContext']>) => unknown;
  getDetail: (id: string, currentUserId?: string | null, context?: ReturnType<JobsController['buildRequestContext']>) => unknown;
};

type JobsRequestContext = {
  ip: string | null;
  userAgent: string | null;
  deviceId: string | null;
  sessionId: string | null;
  requestPath?: string | null;
  requestRoute?: 'list' | 'detail' | 'view_announcement' | 'deliver';
  page?: number | null;
  limit?: number | null;
  filterFingerprint?: string | null;
};

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  private readonly logger = new Logger(JobsController.name);

  constructor(private readonly jobsService: JobsService) {}

  private get controlledJobsService(): ControlledJobsService {
    return this.jobsService as ControlledJobsService;
  }

  private buildRequestContext(request: Request): JobsRequestContext {
    const forwardedFor = request.headers['x-forwarded-for'];
    const ip = typeof forwardedFor === 'string'
      ? forwardedFor.split(',')[0]?.trim() || null
      : request.ip || null;
    const userAgent = typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : null;
    const queryDeviceId = typeof request.query?.deviceId === 'string' ? request.query.deviceId : null;
    const querySessionId = typeof request.query?.sessionId === 'string' ? request.query.sessionId : null;
    const deviceId = typeof request.headers['x-device-id'] === 'string' ? request.headers['x-device-id'] : queryDeviceId;
    const sessionId = typeof request.headers['x-session-id'] === 'string' ? request.headers['x-session-id'] : querySessionId;

    return {
      ip,
      userAgent,
      deviceId,
      sessionId,
    };
  }

  private normalizeActionErrorMessage(error: unknown, fallback: string) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string' && response.trim()) {
        return response.trim();
      }
      if (response && typeof response === 'object') {
        const message = (response as { message?: string | string[] }).message;
        if (typeof message === 'string' && message.trim()) {
          return message.trim();
        }
        if (Array.isArray(message) && message.length > 0) {
          return message.join('；');
        }
      }
    }
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }
    return fallback;
  }

  private rethrowJobsActionError(error: unknown, actionLabel: string, jobId: string) {
    if (error instanceof HttpException) {
      throw error;
    }
    const detail = this.normalizeActionErrorMessage(error, '服务内部异常');
    this.logger.error(`${actionLabel}失败`, error instanceof Error ? error.stack : undefined, { jobId, detail });
    throw new InternalServerErrorException(`${actionLabel}失败：${detail}（岗位ID：${jobId}）`);
  }

  @Get('filters')
  getFilters() {
    return this.jobsService.getFilters();
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  getList(@Query() query: QueryJobsDto, @Req() request: Request, @CurrentUser() user?: CurrentUserPayload | null) {
    return this.controlledJobsService.getList(query, user?.userId, {
      ...this.buildRequestContext(request),
      requestPath: request.path,
      requestRoute: 'list',
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get('suggestions')
  @UseGuards(OptionalJwtAuthGuard)
  getSearchSuggestions(@Query() query: QueryJobSuggestionsDto, @CurrentUser() user?: CurrentUserPayload | null) {
    return this.controlledJobsService.getSearchSuggestions(query, user?.userId);
  }

  @Get('recommended')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getRecommendedList(@CurrentUser() user: CurrentUserPayload, @Query() query: QueryJobsDto) {
    return this.jobsService.getRecommendedList(user.userId, query);
  }

  @Get('free-zone')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getFreeZoneList(@CurrentUser() user: CurrentUserPayload, @Req() request: Request) {
    return this.controlledJobsService.getFreeZoneList(user.userId, {
      ...this.buildRequestContext(request),
      requestPath: request.path,
      requestRoute: 'list',
      page: 1,
      limit: 20,
    });
  }

  @Post(':id/click')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  recordClick(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() dto: JobsClickDto) {
    return this.jobsService.recordClick(user.userId, id, dto);
  }

  @Post(':id/view-announcement')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async viewAnnouncement(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Req() request: Request) {
    try {
      return await this.controlledJobsService.viewAnnouncement(user.userId, id, {
        ...this.buildRequestContext(request),
        requestPath: request.path,
        requestRoute: 'view_announcement',
      });
    } catch (error) {
      this.rethrowJobsActionError(error, '查看公告', id);
    }
  }

  @Post(':id/free-zone/view-announcement')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async viewAnnouncementFromFreeZone(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Req() request: Request) {
    try {
      return await this.jobsService.viewAnnouncement(user.userId, id, {
        ...this.buildRequestContext(request),
        requestPath: request.path,
        requestRoute: 'view_announcement',
      }, {
        bypassPermission: true,
      });
    } catch (error) {
      this.rethrowJobsActionError(error, '查看公告', id);
    }
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  getDetail(@Param('id') id: string, @Req() request: Request, @CurrentUser() user?: CurrentUserPayload | null) {
    return this.controlledJobsService.getDetail(id, user?.userId, {
      ...this.buildRequestContext(request),
      requestPath: request.path,
      requestRoute: 'detail',
    });
  }

  @Post(':id/deliver')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async deliver(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Req() request: Request) {
    try {
      return await this.jobsService.deliver(user.userId, id, {
        ...this.buildRequestContext(request),
        requestPath: request.path,
        requestRoute: 'deliver',
      });
    } catch (error) {
      this.rethrowJobsActionError(error, '立即投递', id);
    }
  }

  @Post(':id/free-zone/deliver')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async deliverFromFreeZone(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Req() request: Request) {
    try {
      return await this.jobsService.deliver(user.userId, id, {
        ...this.buildRequestContext(request),
        requestPath: request.path,
        requestRoute: 'deliver',
      }, {
        bypassPermission: true,
      });
    } catch (error) {
      this.rethrowJobsActionError(error, '立即投递', id);
    }
  }

  @Put(':id/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateProgress(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.jobsService.updateProgress(user.userId, id, dto);
  }

  @Put(':id/free-zone/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateProgressFromFreeZone(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.jobsService.updateProgress(user.userId, id, dto, {
      bypassPermission: true,
    });
  }

  @Get(':id/referral')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getReferral(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.jobsService.getReferral(user.userId, id);
  }

  @Get(':id/free-zone/referral')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getReferralFromFreeZone(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.jobsService.getReferral(user.userId, id, {
      bypassPermission: true,
    });
  }
}
