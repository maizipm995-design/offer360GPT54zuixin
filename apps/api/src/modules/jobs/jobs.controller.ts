import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JobsClickDto } from './dto/jobs-click.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { JobsService } from './jobs.service';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('filters')
  getFilters() {
    return this.jobsService.getFilters();
  }

  @Get()
  getList(@Query() query: QueryJobsDto) {
    return this.jobsService.getList(query);
  }

  @Get('recommended')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getRecommendedList(@CurrentUser() user: CurrentUserPayload, @Query() query: QueryJobsDto) {
    return this.jobsService.getRecommendedList(user.userId, query);
  }

  @Post(':id/click')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  recordClick(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() dto: JobsClickDto) {
    return this.jobsService.recordClick(user.userId, id, dto);
  }

  @Get(':id')
  getDetail(@Param('id') id: string, @Query('userId') userId?: string) {
    return this.jobsService.getDetail(id, userId);
  }

  @Post(':id/deliver')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  deliver(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.jobsService.deliver(user.userId, id);
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

  @Get(':id/referral')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getReferral(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.jobsService.getReferral(user.userId, id);
  }
}
