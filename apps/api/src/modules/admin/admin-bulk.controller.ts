import { Body, Controller, Get, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequireAdminPermissions } from './decorators/require-admin-permissions.decorator';
import { AdminBulkService, JOB_IMPORT_MAX_FILE_SIZE, type AdminImportResponse, type UploadedAdminJobFile } from './admin-bulk.service';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from './guards/admin-permission.guard';

@ApiTags('admin-bulk')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
@Controller('admin')
export class AdminBulkController {
  constructor(private readonly adminBulkService: AdminBulkService) {}

  @Get('jobs/template')
  @RequireAdminPermissions('admin:job:manage')
  getJobTemplate() {
    return this.adminBulkService.getJobTemplate();
  }

  @Get('jobs/export')
  @RequireAdminPermissions('admin:job:manage')
  exportJobs(@Query() query: Record<string, string | undefined>) {
    return this.adminBulkService.exportJobs(query);
  }

  @Post('jobs/import')
  @RequireAdminPermissions('admin:job:manage')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: `招聘公告 Excel 文件（.xlsx / .xls，最大 ${Math.round(JOB_IMPORT_MAX_FILE_SIZE / 1024 / 1024)}MB）`,
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1, fileSize: JOB_IMPORT_MAX_FILE_SIZE } }))
  importJobs(@UploadedFile() file?: UploadedAdminJobFile): Promise<AdminImportResponse> {
    return this.adminBulkService.importJobs(file);
  }

  @Get('users/template')
  @RequireAdminPermissions('admin:user:manage')
  getUserTemplate() {
    return this.adminBulkService.getUserTemplate();
  }

  @Get('users/export')
  @RequireAdminPermissions('admin:user:manage')
  exportUsers(@Query() query: Record<string, string | undefined>) {
    return this.adminBulkService.exportUsers(query);
  }

  @Post('users/import')
  @RequireAdminPermissions('admin:user:manage')
  importUsers(@Body('csvText') csvText?: string): Promise<AdminImportResponse> {
    return this.adminBulkService.importUsers(csvText ?? '');
  }
}
