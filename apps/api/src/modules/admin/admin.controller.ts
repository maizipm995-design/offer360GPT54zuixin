import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequireAdminPermissions } from './decorators/require-admin-permissions.decorator';
import { TestAiModelConfigDto } from './dto/test-ai-model-config.dto';
import { UpdateAiModelConfigStatusDto } from './dto/update-ai-model-config-status.dto';
import { UpsertAiModelConfigDto } from './dto/upsert-ai-model-config.dto';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from './guards/admin-permission.guard';
import { AdminService } from './admin.service';
import { ResumeAiAdminService } from '../resume-ai/resume-ai-admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly resumeAiAdminService: ResumeAiAdminService,
  ) {}

  @Get('overview')
  @RequireAdminPermissions('dashboard:view')
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('jobs')
  @RequireAdminPermissions('admin:job:manage')
  getJobs(@Query() query: Record<string, string | undefined>) {
    return this.adminService.getJobs(query);
  }

  @Post('jobs')
  @RequireAdminPermissions('admin:job:manage')
  createJob(@Body() body: Record<string, unknown>) {
    return this.adminService.createJob(body);
  }

  @Patch('jobs/:id')
  @RequireAdminPermissions('admin:job:manage')
  updateJob(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.adminService.updateJob(id, body);
  }

  @Delete('jobs/:id')
  @RequireAdminPermissions('admin:job:manage')
  deleteJob(@Param('id') id: string) {
    return this.adminService.deleteJob(id);
  }

  @Get('jobs/deduplication/preview')
  @RequireAdminPermissions('admin:job:manage')
  getJobsDeduplicationPreview() {
    return this.adminService.getJobsDeduplicationPreview();
  }

  @Post('jobs/deduplication/execute')
  @RequireAdminPermissions('admin:job:manage')
  executeJobsDeduplication() {
    return this.adminService.executeJobsDeduplication();
  }

  @Get('jobs-recommendation-config')
  @RequireAdminPermissions('admin:job:manage')
  getJobsRecommendationConfig() {
    return this.adminService.getJobsRecommendationConfig();
  }

  @Patch('jobs-recommendation-config/:id')
  @RequireAdminPermissions('admin:job:manage')
  updateJobsRecommendationConfig(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.adminService.updateJobsRecommendationConfig(Number(id), body);
  }

  @Get('users')
  @RequireAdminPermissions('admin:user:manage')
  getUsers(@Query() query: Record<string, string | undefined>) {
    return this.adminService.getUsers(query);
  }

  @Post('users')
  @RequireAdminPermissions('admin:user:manage')
  createUser(@Body() body: Record<string, unknown>) {
    return this.adminService.createUser(body);
  }

  @Patch('users/:id')
  @RequireAdminPermissions('admin:user:manage')
  updateUser(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.adminService.updateUser(id, body);
  }

  @Delete('users/:id')
  @RequireAdminPermissions('admin:user:manage')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Get('memberships')
  @RequireAdminPermissions('admin:membership:manage')
  getMemberships(@Query() query: Record<string, string | undefined>) {
    return this.adminService.getMemberships(query);
  }

  @Post('memberships')
  @RequireAdminPermissions('admin:membership:manage')
  createMembership(@Body() body: Record<string, unknown>) {
    return this.adminService.createMembership(body);
  }

  @Patch('memberships/:id')
  @RequireAdminPermissions('admin:membership:manage')
  updateMembership(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.adminService.updateMembership(id, body);
  }

  @Delete('memberships/:id')
  @RequireAdminPermissions('admin:membership:manage')
  deleteMembership(@Param('id') id: string) {
    return this.adminService.deleteMembership(id);
  }

  @Get('member-permission-catalog')
  @RequireAdminPermissions('admin:membership:manage')
  getMemberPermissionCatalog() {
    return this.adminService.getMemberPermissionCatalog();
  }

  @Get('member-roles')
  @RequireAdminPermissions('admin:membership:manage')
  getMemberRoles() {
    return this.adminService.getMemberRoles();
  }

  @Patch('member-roles/:id')
  @RequireAdminPermissions('admin:membership:manage')
  updateMemberRole(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.adminService.updateMemberRole(id, body);
  }

  @Get('membership-contents')
  @RequireAdminPermissions('admin:membership:manage')
  getMembershipContents(@Query() query: Record<string, string | undefined>) {
    return this.adminService.getMembershipContents(query);
  }

  @Post('membership-contents')
  @RequireAdminPermissions('admin:membership:manage')
  createMembershipContent(@Body() body: Record<string, unknown>) {
    return this.adminService.createMembershipContent(body);
  }

  @Patch('membership-contents/:id')
  @RequireAdminPermissions('admin:membership:manage')
  updateMembershipContent(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.adminService.updateMembershipContent(id, body);
  }

  @Delete('membership-contents/:id')
  @RequireAdminPermissions('admin:membership:manage')
  deleteMembershipContent(@Param('id') id: string) {
    return this.adminService.deleteMembershipContent(id);
  }

  @Get('career-journey-content')
  @RequireAdminPermissions('admin:membership:manage')
  getCareerJourneyContent() {
    return this.adminService.getCareerJourneyContent();
  }

  @Patch('career-journey-content')
  @RequireAdminPermissions('admin:membership:manage')
  updateCareerJourneyContent(@Body() body: Record<string, unknown>) {
    return this.adminService.updateCareerJourneyContent(body);
  }

  @Get('html-content-positions')
  @RequireAdminPermissions('admin:membership:manage')
  getHtmlContentPositions() {
    return this.adminService.getHtmlContentPositions();
  }

  @Get('html-content-positions/:location')
  @RequireAdminPermissions('admin:membership:manage')
  getHtmlContentByLocation(@Param('location') location: string) {
    return this.adminService.getHtmlContentByLocation(location);
  }

  @Patch('html-content-positions/:location')
  @RequireAdminPermissions('admin:membership:manage')
  updateHtmlContentByLocation(@Param('location') location: string, @Body() body: Record<string, unknown>) {
    return this.adminService.updateHtmlContentByLocation(location, body);
  }

  @Get('service-products')
  @RequireAdminPermissions('admin:service:manage')
  getServiceProducts(@Query() query: Record<string, string | undefined>) {
    return this.adminService.getServiceProducts(query);
  }

  @Post('service-products')
  @RequireAdminPermissions('admin:service:manage')
  createServiceProduct(@Body() body: Record<string, unknown>) {
    return this.adminService.createServiceProduct(body);
  }

  @Patch('service-products/:id')
  @RequireAdminPermissions('admin:service:manage')
  updateServiceProduct(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.adminService.updateServiceProduct(id, body);
  }

  @Delete('service-products/:id')
  @RequireAdminPermissions('admin:service:manage')
  deleteServiceProduct(@Param('id') id: string) {
    return this.adminService.deleteServiceProduct(id);
  }

  @Get('resume-template-configs')
  @RequireAdminPermissions('admin:service:manage')
  getResumeTemplateConfigs() {
    return this.adminService.getResumeTemplateConfigs();
  }

  @Patch('resume-template-configs/global-vertical-spacing')
  @RequireAdminPermissions('admin:service:manage')
  updateResumeGlobalVerticalSpacing(@Body() body: Record<string, unknown>) {
    return this.adminService.updateResumeGlobalVerticalSpacing(body);
  }

  @Patch('resume-template-configs/:templateCode')
  @RequireAdminPermissions('admin:service:manage')
  updateResumeTemplateConfig(@Param('templateCode') templateCode: string, @Body() body: Record<string, unknown>) {
    return this.adminService.updateResumeTemplateConfig(templateCode, body);
  }

  @Get('orders')
  @RequireAdminPermissions('admin:service:manage')
  getOrders(@Query() query: Record<string, string | undefined>) {
    return this.adminService.getOrders(query);
  }

  @Get('commission-logs')
  @RequireAdminPermissions('admin:commission:manage')
  getCommissionLogs(@Query() query: Record<string, string | undefined>) {
    return this.adminService.getCommissionLogs(query);
  }

  @Get('commission-config')
  @RequireAdminPermissions('admin:commission:manage')
  getCommissionConfig() {
    return this.adminService.getCommissionConfig();
  }

  @Patch('commission-config/:id')
  @RequireAdminPermissions('admin:commission:manage')
  updateCommissionConfig(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.adminService.updateCommissionConfig(Number(id), body);
  }

  @Get('ai-model-configs')
  @RequireAdminPermissions('admin:ai:manage')
  getAiModelConfigs() {
    return this.resumeAiAdminService.getAiModelConfigs();
  }

  @Post('ai-model-configs')
  @RequireAdminPermissions('admin:ai:manage')
  createAiModelConfig(@Body() dto: UpsertAiModelConfigDto) {
    return this.resumeAiAdminService.createAiModelConfig(dto);
  }

  @Patch('ai-model-configs/:id')
  @RequireAdminPermissions('admin:ai:manage')
  updateAiModelConfig(@Param('id') id: string, @Body() dto: UpsertAiModelConfigDto) {
    return this.resumeAiAdminService.updateAiModelConfig(id, dto);
  }

  @Patch('ai-model-configs/:id/status')
  @RequireAdminPermissions('admin:ai:manage')
  updateAiModelConfigStatus(@Param('id') id: string, @Body() dto: UpdateAiModelConfigStatusDto) {
    return this.resumeAiAdminService.updateAiModelConfigStatus(id, dto);
  }

  @Post('ai-model-configs/:id/test')
  @RequireAdminPermissions('admin:ai:manage')
  testAiModelConfig(@Param('id') id: string, @Body() dto: TestAiModelConfigDto) {
    return this.resumeAiAdminService.testAiModelConfig(id, dto);
  }

  @Get('resume-ai-logs')
  @RequireAdminPermissions('admin:ai:manage')
  getResumeAiLogs(@Query() query: Record<string, string | undefined>) {
    return this.resumeAiAdminService.getResumeAiLogs(query);
  }
}
