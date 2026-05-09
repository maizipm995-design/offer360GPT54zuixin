import { Controller, Get, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { NORMALIZATION_IMPORT_MAX_FILE_SIZE } from './admin-normalization.constants';
import { AdminNormalizationBulkService, type UploadedNormalizationExcelFile } from './admin-normalization-bulk.service';
import { RequireAdminPermissions } from './decorators/require-admin-permissions.decorator';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from './guards/admin-permission.guard';

@ApiTags('admin-normalization-bulk')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
@Controller('admin')
export class AdminNormalizationBulkController {
  constructor(private readonly adminNormalizationBulkService: AdminNormalizationBulkService) {}

  @Get('normalization/template')
  @RequireAdminPermissions('admin:job:manage')
  getTemplate() {
    return this.adminNormalizationBulkService.getTemplate();
  }

  @Get('normalization/export')
  @RequireAdminPermissions('admin:job:manage')
  exportAll() {
    return this.adminNormalizationBulkService.exportAll();
  }

  @Post('normalization/import')
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
          description: `标准化词典 Excel 文件（.xlsx / .xls，最大 ${Math.round(NORMALIZATION_IMPORT_MAX_FILE_SIZE / 1024 / 1024)}MB）`,
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1, fileSize: NORMALIZATION_IMPORT_MAX_FILE_SIZE } }))
  importAll(@UploadedFile() file?: UploadedNormalizationExcelFile) {
    return this.adminNormalizationBulkService.importAll(file);
  }
}
