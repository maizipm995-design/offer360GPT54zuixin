import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CampusExamService } from './campus-exam.service';

@ApiTags('campus-exam')
@Controller('campus-exam')
export class CampusExamController {
  constructor(private readonly campusExamService: CampusExamService) {}

  @Get('home')
  @UseGuards(OptionalJwtAuthGuard)
  getHome(@CurrentUser() user?: CurrentUserPayload | null) {
    return this.campusExamService.getHome(user?.userId ?? null);
  }

  @Get('categories/tree')
  getCategoryTree() {
    return this.campusExamService.getCategoryTree();
  }

  @Get('categories/:slug')
  getCategoryDetail(@Param('slug') slug: string) {
    return this.campusExamService.getCategoryDetail(slug);
  }

  @Get('specials/:specialId')
  @UseGuards(OptionalJwtAuthGuard)
  getSpecialDetail(@Param('specialId') specialId: string, @CurrentUser() user?: CurrentUserPayload | null) {
    return this.campusExamService.getSpecialDetail(Number(specialId), user?.userId ?? null);
  }

  @Post('practice/sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createPracticeSession(@CurrentUser() user: CurrentUserPayload, @Body() body: Record<string, unknown>) {
    return this.campusExamService.createPracticeSession(user.userId, body);
  }

  @Get('practice/sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getPracticeSession(@CurrentUser() user: CurrentUserPayload, @Param('sessionId') sessionId: string) {
    return this.campusExamService.getPracticeSession(user.userId, sessionId);
  }

  @Post('practice/sessions/:sessionId/answers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  submitPracticeAnswer(
    @CurrentUser() user: CurrentUserPayload,
    @Param('sessionId') sessionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.campusExamService.submitPracticeAnswer(user.userId, sessionId, body);
  }

  @Get('questions/:questionId')
  @UseGuards(OptionalJwtAuthGuard)
  getQuestionDetail(
    @Param('questionId') questionId: string,
    @Query('sessionId') sessionId?: string,
    @CurrentUser() user?: CurrentUserPayload | null,
  ) {
    return this.campusExamService.getQuestionDetail(questionId, user?.userId ?? null, sessionId ?? null);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getHistory(@CurrentUser() user: CurrentUserPayload) {
    return this.campusExamService.getHistory(user.userId);
  }

  @Get('stats')
  @UseGuards(OptionalJwtAuthGuard)
  getStats(@CurrentUser() user?: CurrentUserPayload | null) {
    return this.campusExamService.getStats(user?.userId ?? null);
  }

  @Post('questions/:questionId/subjective-score-preview')
  @UseGuards(OptionalJwtAuthGuard)
  previewSubjectiveScore(@Param('questionId') questionId: string, @Body() body: Record<string, unknown>) {
    return this.campusExamService.previewSubjectiveScore(questionId, body);
  }
}
