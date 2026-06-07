import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { CurrentAdmin, type CurrentAdminPayload } from '../admin/decorators/current-admin.decorator';
import { RequireAdminPermissions } from '../admin/decorators/require-admin-permissions.decorator';
import { AdminJwtAuthGuard } from '../admin/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../admin/guards/admin-permission.guard';
import { CampusExamService } from './campus-exam.service';
import { CAMPUS_EXAM_MAX_IMPORT_FILE_SIZE, type UploadedCampusExamFile } from './campus-exam.types';

@ApiTags('admin-campus-exam')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
@Controller('admin/campus-exam')
export class CampusExamAdminController {
  constructor(private readonly campusExamService: CampusExamService) {}

  @Get('categories')
  @RequireAdminPermissions('admin:job:manage')
  getCategories(@Query() query: Record<string, string | undefined>) {
    return this.campusExamService.getAdminCategories(query);
  }

  @Post('categories')
  @RequireAdminPermissions('admin:job:manage')
  createCategory(@Body() body: Record<string, unknown>) {
    return this.campusExamService.createAdminCategory(body);
  }

  @Patch('categories/:id')
  @RequireAdminPermissions('admin:job:manage')
  updateCategory(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.campusExamService.updateAdminCategory(id, body);
  }

  @Delete('categories/:id')
  @RequireAdminPermissions('admin:job:manage')
  deleteCategory(@Param('id') id: string) {
    return this.campusExamService.deleteAdminCategory(id);
  }

  @Post('categories/import-folder')
  @RequireAdminPermissions('admin:job:manage')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files', 'relativePaths'],
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: `一级分类文件夹内的全部题库 Excel 文件（.xlsx / .xls，单文件最大 ${Math.round(CAMPUS_EXAM_MAX_IMPORT_FILE_SIZE / 1024 / 1024)}MB）`,
        },
        relativePaths: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: '浏览器提供的文件相对路径，用于识别顶层文件夹与文件结构',
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', 200, { limits: { files: 200, fileSize: CAMPUS_EXAM_MAX_IMPORT_FILE_SIZE } }))
  importCategoryFolder(
    @UploadedFiles() files: UploadedCampusExamFile[] | undefined,
    @Body() body: Record<string, unknown>,
    @CurrentAdmin() admin: CurrentAdminPayload,
  ) {
    return this.campusExamService.importCategoryFolder(files, body, admin);
  }

  @Get('specials')
  @RequireAdminPermissions('admin:job:manage')
  getSpecials(@Query() query: Record<string, string | undefined>) {
    return this.campusExamService.getAdminSpecials(query);
  }

  @Post('specials')
  @RequireAdminPermissions('admin:job:manage')
  createSpecial(@Body() body: Record<string, unknown>) {
    return this.campusExamService.createAdminSpecial(body);
  }

  @Get('specials/import/template')
  @RequireAdminPermissions('admin:job:manage')
  getImportTemplate() {
    return this.campusExamService.getImportTemplate();
  }

  @Get('specials/:specialId')
  @RequireAdminPermissions('admin:job:manage')
  getSpecialDetail(@Param('specialId') specialId: string) {
    return this.campusExamService.getAdminSpecialDetail(Number(specialId));
  }

  @Patch('specials/:specialId')
  @RequireAdminPermissions('admin:job:manage')
  updateSpecial(@Param('specialId') specialId: string, @Body() body: Record<string, unknown>) {
    return this.campusExamService.updateAdminSpecial(Number(specialId), body);
  }

  @Delete('specials/:specialId')
  @RequireAdminPermissions('admin:job:manage')
  deleteSpecial(@Param('specialId') specialId: string) {
    return this.campusExamService.deleteAdminSpecial(Number(specialId));
  }

  @Post('specials/:specialId/import/preview')
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
          description: `校招笔试 Excel 文件（.xlsx / .xls，最大 ${Math.round(CAMPUS_EXAM_MAX_IMPORT_FILE_SIZE / 1024 / 1024)}MB）`,
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1, fileSize: CAMPUS_EXAM_MAX_IMPORT_FILE_SIZE } }))
  previewImport(
    @Param('specialId') specialId: string,
    @UploadedFile() file: UploadedCampusExamFile,
    @CurrentAdmin() admin: CurrentAdminPayload,
  ) {
    return this.campusExamService.previewImport(Number(specialId), file, admin);
  }

  @Post('specials/:specialId/import/confirm')
  @RequireAdminPermissions('admin:job:manage')
  confirmImport(
    @Param('specialId') specialId: string,
    @Body() body: Record<string, unknown>,
    @CurrentAdmin() admin: CurrentAdminPayload,
  ) {
    return this.campusExamService.confirmImport(Number(specialId), body, admin);
  }

  @Get('import-batches')
  @RequireAdminPermissions('admin:job:manage')
  getImportBatches(@Query() query: Record<string, string | undefined>) {
    return this.campusExamService.getAdminImportBatches(query);
  }

  @Get('import-batches/:batchId')
  @RequireAdminPermissions('admin:job:manage')
  getImportBatchDetail(@Param('batchId') batchId: string) {
    return this.campusExamService.getAdminImportBatchDetail(batchId);
  }

  @Get('import-batches/:batchId/errors')
  @RequireAdminPermissions('admin:job:manage')
  getImportBatchErrors(@Param('batchId') batchId: string) {
    return this.campusExamService.getAdminImportBatchErrors(batchId);
  }

  @Post('import-batches/:batchId/retry-assets')
  @RequireAdminPermissions('admin:job:manage')
  retryImportBatchAssets(@Param('batchId') batchId: string) {
    return this.campusExamService.retryImportBatchAssets(batchId);
  }

  @Get('questions')
  @RequireAdminPermissions('admin:job:manage')
  getQuestions(@Query() query: Record<string, string | undefined>) {
    return this.campusExamService.getAdminQuestions(query);
  }

  @Get('questions/:id')
  @RequireAdminPermissions('admin:job:manage')
  getQuestionDetail(@Param('id') id: string) {
    return this.campusExamService.getAdminQuestionDetail(id);
  }

  @Patch('questions/:id')
  @RequireAdminPermissions('admin:job:manage')
  updateQuestion(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.campusExamService.updateAdminQuestion(id, body);
  }

  @Patch('questions/:id/status')
  @RequireAdminPermissions('admin:job:manage')
  updateQuestionStatus(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.campusExamService.updateAdminQuestionStatus(id, body);
  }

  @Get('subjective-judgements')
  @RequireAdminPermissions('admin:job:manage')
  getSubjectiveJudgements(@Query() query: Record<string, string | undefined>) {
    return this.campusExamService.getAdminSubjectiveJudgements(query);
  }

  @Get('subjective-judgements/:id')
  @RequireAdminPermissions('admin:job:manage')
  getSubjectiveJudgementDetail(@Param('id') id: string) {
    return this.campusExamService.getAdminSubjectiveJudgementDetail(id);
  }

  @Patch('subjective-judgements/:id/quality')
  @RequireAdminPermissions('admin:job:manage')
  updateSubjectiveJudgementQuality(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.campusExamService.updateAdminSubjectiveJudgementQuality(id, body);
  }
}
