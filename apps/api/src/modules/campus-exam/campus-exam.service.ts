import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../prisma.service';
import { StorageService } from '../storage/storage.service';
import type { CurrentAdminPayload } from '../admin/decorators/current-admin.decorator';
import { CampusExamSubjectiveRuleService } from './campus-exam-subjective-rule.service';
import { CampusExamSubjectiveScoringService } from './campus-exam-subjective-scoring.service';
import {
  CAMPUS_EXAM_ALLOWED_IMPORT_MIME_TYPES,
  CAMPUS_EXAM_HERO_CARDS,
  CAMPUS_EXAM_IMPORT_OVERWRITE_POLICIES,
  CAMPUS_EXAM_MAX_IMPORT_FILE_SIZE,
  CAMPUS_EXAM_QUESTION_TYPE_CODE_MAP,
  CAMPUS_EXAM_QUESTION_TYPE_LABEL_MAP,
  type CampusExamAnswerJson,
  type CampusExamAssetTransferItem,
  type CampusExamImportErrorItem,
  type UploadedCampusExamFile,
} from './campus-exam.types';
import {
  collectRichTextImageUrls,
  getQuestionAnswerType,
  normalizeRichTextContent,
  normalizeArrayValues,
  normalizeComparableText,
  normalizeLooseText,
  normalizeText,
  parseOptionLines,
  parseQuestionType,
  safeJsonParse,
  slugifyCampusExamCategory,
  splitAnswerValues,
  toBooleanFlag,
  toInt,
  toOptionalInt,
} from './campus-exam.utils';

const IMPORT_COLUMNS = [
  { key: 'stemHtml', required: true, templateHeader: '题目(必填)', aliases: ['题目(必填)', '题目', '题干', '题干HTML', 'stemHtml'] },
  { key: 'questionType', required: true, templateHeader: '题型（必填）：1单选 2多选 3判断 4单项填空 5多项填空 6简答（填写对应的数字）', aliases: ['题型（必填）：1单选 2多选 3判断 4单项填空 5多项填空 6简答（填写对应的数字）', '题型', 'questionType'] },
  { key: 'stemContentType', required: true, templateHeader: '题目类型（必填）（1:文字 2:图片 ）（填写对应的数字）', aliases: ['题目类型（必填）（1:文字 2:图片 ）（填写对应的数字）', '题目类型', '题干内容类型', 'stemContentType'] },
  { key: 'specialId', required: true, templateHeader: '分类专项id （必填）（管理后台分类专项id，对应题库分类，请勿填错）', aliases: ['分类专项id （必填）（管理后台分类专项id，对应题库分类，请勿填错）', '分类专项id', '专项id', 'specialId'] },
  { key: 'difficulty', required: true, templateHeader: '难度（必填）（填写1-5）', aliases: ['难度（必填）（填写1-5）', '难度', 'difficulty'] },
  { key: 'isHighFrequencyWrong', required: true, templateHeader: '是否高频错题（必填）（0:否 1：是）（填写对应的数字）', aliases: ['是否高频错题（必填）（0:否 1：是）（填写对应的数字）', '是否高频错题', '高频错题', 'isHighFrequencyWrong'] },
  { key: 'optionsRaw', required: true, templateHeader: '选项（必填）（用英文分号;隔开。例如：选项1;选项2;选项3;选项4）', aliases: ['选项（必填）（用英文分号;隔开。例如：选项1;选项2;选项3;选项4）', '选项', '选项JSON', 'options', 'optionsRaw'] },
  { key: 'optionContentType', required: true, templateHeader: '选项类型（必填）（1：文字 2：图片）（填写对应的数字）', aliases: ['选项类型（必填）（1：文字 2：图片）（填写对应的数字）', '选项类型', '选项内容类型', 'optionContentType'] },
  { key: 'answerRaw', required: true, templateHeader: '答案（必填）(选择题答案为大写英文字母，填空题，简答题答案为中文)', aliases: ['答案（必填）(选择题答案为大写英文字母，填空题，简答题答案为中文)', '答案', '标准答案', 'answer', 'answerRaw'] },
  { key: 'analysisHtml', required: false, templateHeader: '题目解析（选填）', aliases: ['题目解析（选填）', '题目解析', '解析', '答案解析', 'analysisHtml'] },
  { key: 'questionImageUrl', required: false, templateHeader: '题目图片链接（选填）', aliases: ['题目图片链接（选填）', '题目图片链接', '题目图片', '题干图片', 'questionImageUrl'] },
  { key: 'analysisImageUrl', required: false, templateHeader: '解析图片链接（选填）', aliases: ['解析图片链接（选填）', '解析图片链接', '解析图片', 'analysisImageUrl'] },
] as const;
const CAMPUS_EXAM_IMPORT_TEMPLATE_FILENAME = '校招笔试题库导入模板.xlsx';
const CAMPUS_EXAM_IMPORT_TEMPLATE_SHEET_NAME = '题库模板';
const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type ImportColumnKey = (typeof IMPORT_COLUMNS)[number]['key'];

type PreviewQuestionRow = {
  sourceRowNo: number;
  specialId: number;
  questionType: number;
  stemContentType: number;
  difficulty: number;
  isHighFrequencyWrong: boolean;
  optionContentType: number;
  stemHtml: string;
  optionsJson: Array<{ key: string; label: string; value: string }> | null;
  answerJson: CampusExamAnswerJson;
  analysisHtml: string | null;
  questionImageUrl: string | null;
  analysisImageUrl: string | null;
  status: string;
};

type CategoryFolderImportFileResult = {
  fileName: string;
  relativePath: string;
  specialName: string;
  specialId: number | null;
  batchId: string | null;
  totalCount: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  status: 'imported' | 'skipped_existing_special' | 'skipped_invalid_file' | 'skipped_invalid_template' | 'failed';
  message: string;
};

type CategoryFolderUploadCandidate = {
  file: UploadedCampusExamFile;
  relativePath: string;
  folderName: string;
  fileName: string;
  specialName: string;
};

type QuestionOptionItem = { key: string; label: string; value: string };

type CampusExamInteractionRule = {
  mode: 'single_choice' | 'multiple_choice' | 'judge' | 'blank_single' | 'blank_multiple' | 'essay';
  autoSubmitOnOptionClick: boolean;
  requiresManualSubmit: boolean;
  minSelectionCount: number;
  maxSelectionCount: number;
  blankCount: number;
  requiresNonEmptyAnswer: boolean;
};

@Injectable()
export class CampusExamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly subjectiveRuleService: CampusExamSubjectiveRuleService,
    private readonly subjectiveScoringService: CampusExamSubjectiveScoringService,
  ) {}

  async getAdminCategories(query: Record<string, string | undefined>) {
    const page = this.readPositiveInt(query.page, 1);
    const pageSize = this.readPositiveInt(query.pageSize, 10);
    const keyword = normalizeText(query.keyword);
    const status = this.readOptionalStatus(query.status);
    const where: Prisma.CampusExamCategoryWhereInput = {
      ...(keyword
        ? {
            OR: [
              { name: { contains: keyword } },
              { slug: { contains: keyword } },
            ],
          }
        : {}),
      ...(status ? { status } : {}),
    };

    const [total, list] = await Promise.all([
      this.prisma.campusExamCategory.count({ where }),
      this.prisma.campusExamCategory.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: { specials: true },
          },
        },
      }),
    ]);

    return {
      list: list.map((item) => ({
        id: item.id,
        specialCode: item.specialCode,
        name: item.name,
        slug: item.slug,
        description: item.description,
        sortOrder: item.sortOrder,
        status: item.status,
        specialCount: item._count.specials,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      pagination: this.buildPagination(page, pageSize, total),
    };
  }

  async createAdminCategory(body: Record<string, unknown>) {
    const name = this.readRequiredString(body.name, '分类名称不能为空');
    const slug = normalizeText(body.slug) || slugifyCampusExamCategory(name);
    await this.assertCategorySlugAvailable(slug);
    const created = await this.prisma.campusExamCategory.create({
      data: {
        specialCode: await this.generateUniqueCategorySpecialCode(),
        name,
        slug,
        description: this.readNullableString(body.description),
        sortOrder: this.readPositiveInt(body.sortOrder, 0),
        status: this.readStatus(body.status, 'active'),
      },
    });
    return created;
  }

  async updateAdminCategory(id: string, body: Record<string, unknown>) {
    const current = await this.prisma.campusExamCategory.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('一级分类不存在');
    }
    const nextSlug = body.slug !== undefined ? normalizeText(body.slug) : current.slug;
    if (nextSlug !== current.slug) {
      await this.assertCategorySlugAvailable(nextSlug, id);
    }
    return this.prisma.campusExamCategory.update({
      where: { id },
      data: {
        name: body.name !== undefined ? this.readRequiredString(body.name, '分类名称不能为空') : undefined,
        slug: nextSlug,
        description: body.description !== undefined ? this.readNullableString(body.description) : undefined,
        sortOrder: body.sortOrder !== undefined ? this.readPositiveInt(body.sortOrder, 0) : undefined,
        status: body.status !== undefined ? this.readStatus(body.status, current.status) : undefined,
      },
    });
  }

  async deleteAdminCategory(id: string) {
    const category = await this.prisma.campusExamCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            specials: true,
          },
        },
      },
    });
    if (!category) {
      throw new NotFoundException('一级分类不存在');
    }

    const questionCount = await this.prisma.campusExamQuestion.count({
      where: {
        special: {
          categoryId: id,
        },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.campusExamCategory.delete({
        where: { id },
      });
    });

    return {
      id: category.id,
      name: category.name,
      deletedSpecialCount: category._count.specials,
      deletedQuestionCount: questionCount,
      status: 'deleted',
    };
  }

  async deleteAdminSpecial(specialId: number) {
    const special = await this.prisma.campusExamSpecial.findUnique({
      where: { id: specialId },
    });
    if (!special) {
      throw new NotFoundException('二级分类不存在');
    }

    const questionCount = await this.prisma.campusExamQuestion.count({
      where: { specialId },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.campusExamSpecial.delete({
        where: { id: specialId },
      });
    });

    return {
      id: special.id,
      name: special.name,
      deletedQuestionCount: questionCount,
      status: 'deleted',
    };
  }

  async importCategoryFolder(
    files: UploadedCampusExamFile[] | undefined,
    body: Record<string, unknown>,
    admin: CurrentAdminPayload,
  ) {
    const uploadPayload = this.normalizeCategoryFolderUpload(files, body.relativePaths);
    const fileResults: CategoryFolderImportFileResult[] = [...uploadPayload.skippedFiles];
    const skippedFileCountBase = uploadPayload.skippedFiles.length;
    let skippedFileCount = skippedFileCountBase;
    let skippedSpecialCount = 0;
    let createdSpecialCount = 0;
    let importedQuestionCount = 0;
    let skippedQuestionCount = 0;
    let failedQuestionCount = 0;

    const readyFiles: CategoryFolderUploadCandidate[] = [];
    for (const item of uploadPayload.validFiles) {
      const precheckResult = this.precheckCategoryFolderImportFile(item.file);
      if (!precheckResult.ok) {
        skippedFileCount += 1;
        fileResults.push({
          fileName: item.fileName,
          relativePath: item.relativePath,
          specialName: item.specialName,
          specialId: null,
          batchId: null,
          totalCount: 0,
          importedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          status: precheckResult.status,
          message: precheckResult.message,
        });
        continue;
      }

      const existingSpecial = await this.prisma.campusExamSpecial.findFirst({
        where: { name: item.specialName },
        include: {
          category: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      if (existingSpecial) {
        skippedSpecialCount += 1;
        fileResults.push({
          fileName: item.fileName,
          relativePath: item.relativePath,
          specialName: item.specialName,
          specialId: existingSpecial.id,
          batchId: null,
          totalCount: 0,
          importedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          status: 'skipped_existing_special',
          message: `已跳过：二级分类“${item.specialName}”已存在，本次不重复创建，也不重复导入题目`,
        });
        continue;
      }

      readyFiles.push(item);
    }

    const categoryResult = readyFiles.length && uploadPayload.folderName
      ? await this.findOrCreateCategoryByName(uploadPayload.folderName)
      : null;
    let nextSpecialId = await this.readNextSpecialId();

    for (const item of readyFiles) {
      const specialId = nextSpecialId;
      nextSpecialId += 1;
      const createdSpecial = await this.prisma.campusExamSpecial.create({
        data: {
          id: specialId,
          specialCode: await this.generateUniqueSpecialCode(),
          categoryId: categoryResult!.category.id,
          name: item.specialName,
          status: 'active',
        },
      });
      createdSpecialCount += 1;

      try {
        const result = await this.importCategoryFolderFile(createdSpecial.id, item.file, item.relativePath, admin);
        importedQuestionCount += result.importedCount;
        skippedQuestionCount += result.skippedCount;
        failedQuestionCount += result.failedCount;
        fileResults.push({
          fileName: item.fileName,
          relativePath: item.relativePath,
          specialName: item.specialName,
          specialId: createdSpecial.id,
          ...result,
        });
      } catch (error) {
        fileResults.push({
          fileName: item.fileName,
          relativePath: item.relativePath,
          specialName: item.specialName,
          specialId: createdSpecial.id,
          batchId: null,
          totalCount: 0,
          importedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          status: 'failed',
          message: error instanceof Error ? `导入失败：${error.message}` : '导入失败：请检查文件内容后重试',
        });
      }
    }

    return {
      categoryId: categoryResult?.category.id ?? null,
      categoryName: categoryResult?.category.name ?? uploadPayload.folderName ?? '',
      categoryStatus: categoryResult?.status ?? 'not_created',
      totalFileCount: uploadPayload.totalFileCount,
      skippedFileCount,
      createdSpecialCount,
      skippedSpecialCount,
      importedQuestionCount,
      skippedQuestionCount,
      failedQuestionCount,
      fileResults,
    };
  }

  async getAdminSpecials(query: Record<string, string | undefined>) {
    const page = this.readPositiveInt(query.page, 1);
    const pageSize = this.readPositiveInt(query.pageSize, 10);
    const keyword = normalizeText(query.keyword);
    const status = this.readOptionalStatus(query.status);
    const categoryId = normalizeText(query.categoryId);
    const where: Prisma.CampusExamSpecialWhereInput = {
      ...(categoryId ? { categoryId } : {}),
      ...(status ? { status } : {}),
      ...(keyword ? { name: { contains: keyword } } : {}),
    };

    const [total, list] = await Promise.all([
      this.prisma.campusExamSpecial.count({ where }),
      this.prisma.campusExamSpecial.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: true,
          _count: {
            select: {
              questions: true,
              importBatches: true,
            },
          },
        },
      }),
    ]);

    return {
      list: list.map((item) => ({
        id: item.id,
        specialCode: item.specialCode,
        categoryId: item.categoryId,
        categorySpecialCode: item.category.specialCode,
        categoryName: item.category.name,
        name: item.name,
        description: item.description,
        questionCount: item.questionCount,
        status: item.status,
        sortOrder: item.sortOrder,
        importBatchCount: item._count.importBatches,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      pagination: this.buildPagination(page, pageSize, total),
    };
  }

  async createAdminSpecial(body: Record<string, unknown>) {
    const categoryId = this.readRequiredString(body.categoryId, '请选择所属一级分类');
    await this.ensureCategoryExists(categoryId);
    const id = await this.readNextSpecialId();
    return this.prisma.campusExamSpecial.create({
      data: {
        id,
        specialCode: await this.generateUniqueSpecialCode(),
        categoryId,
        name: this.readRequiredString(body.name, '二级分类名称不能为空'),
        description: this.readNullableString(body.description),
        sortOrder: this.readPositiveInt(body.sortOrder, 0),
        status: this.readStatus(body.status, 'active'),
      },
    });
  }

  async getAdminSpecialDetail(specialId: number) {
    const special = await this.prisma.campusExamSpecial.findUnique({
      where: { id: specialId },
      include: {
        category: true,
        importBatches: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            questions: true,
          },
        },
      },
    });
    if (!special) {
      throw new NotFoundException('二级分类不存在');
    }
    return {
      id: special.id,
      specialCode: special.specialCode,
      categoryId: special.categoryId,
      categorySpecialCode: special.category.specialCode,
      categoryName: special.category.name,
      name: special.name,
      description: special.description,
      questionCount: special.questionCount,
      status: special.status,
      sortOrder: special.sortOrder,
      latestImportBatches: special.importBatches.map((item) => ({
        id: item.id,
        fileName: item.fileName,
        totalCount: item.totalCount,
        successCount: item.successCount,
        failCount: item.failCount,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
      })),
      recentQuestionCount: special._count.questions,
      createdAt: special.createdAt.toISOString(),
      updatedAt: special.updatedAt.toISOString(),
    };
  }

  async updateAdminSpecial(specialId: number, body: Record<string, unknown>) {
    const special = await this.prisma.campusExamSpecial.findUnique({ where: { id: specialId } });
    if (!special) {
      throw new NotFoundException('二级分类不存在');
    }
    const nextCategoryId = body.categoryId !== undefined ? this.readRequiredString(body.categoryId, '请选择所属一级分类') : special.categoryId;
    if (nextCategoryId !== special.categoryId) {
      await this.ensureCategoryExists(nextCategoryId);
    }
    return this.prisma.campusExamSpecial.update({
      where: { id: specialId },
      data: {
        categoryId: nextCategoryId,
        name: body.name !== undefined ? this.readRequiredString(body.name, '二级分类名称不能为空') : undefined,
        description: body.description !== undefined ? this.readNullableString(body.description) : undefined,
        sortOrder: body.sortOrder !== undefined ? this.readPositiveInt(body.sortOrder, 0) : undefined,
        status: body.status !== undefined ? this.readStatus(body.status, special.status) : undefined,
      },
    });
  }

  async previewImport(specialId: number, file: UploadedCampusExamFile | undefined, admin: CurrentAdminPayload) {
    const special = await this.ensureSpecialExists(specialId);
    this.assertImportFile(file);
    const rows = this.readExcelRows(file!.buffer);
    if (rows.length <= 1) {
      throw new BadRequestException('上传失败：Excel 中未检测到可预览的数据，请确认第 1 行为表头，且至少包含 1 行题目数据');
    }

    const headerResult = this.resolveImportHeaderMap(rows[0], { requireSpecialId: false });
    const errors: CampusExamImportErrorItem[] = [];
    const previewRows: PreviewQuestionRow[] = [];
    let totalCount = 0;

    if (headerResult.missingRequired.length || headerResult.positionMismatches.length || headerResult.unexpectedHeaders.length) {
      headerResult.missingRequired.forEach((header, index) => {
        errors.push({
          rowNo: 1,
          fieldName: '表头',
          errorCode: 'HEADER_MISSING',
          errorMessage: `缺少必要表头：${header}`,
          rawPayload: { index, header } as Prisma.InputJsonValue,
        });
      });
      headerResult.positionMismatches.forEach((item) => {
        errors.push({
          rowNo: 1,
          fieldName: '表头顺序',
          errorCode: 'HEADER_ORDER_INVALID',
          errorMessage: `第 ${item.columnNo} 列应为“${item.expectedHeader}”，当前识别为“${item.actualHeader || '空列'}”`,
          rawPayload: item as unknown as Prisma.InputJsonValue,
        });
      });
      headerResult.unexpectedHeaders.forEach((item) => {
        errors.push({
          rowNo: 1,
          fieldName: '表头',
          errorCode: 'HEADER_UNEXPECTED',
          errorMessage: `检测到模板之外的表头：第 ${item.columnNo} 列“${item.header}”`,
          rawPayload: item as unknown as Prisma.InputJsonValue,
        });
      });
    } else {
      for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        if (!row.some((item) => normalizeText(item))) {
          continue;
        }
        totalCount += 1;
        try {
          previewRows.push(this.normalizeImportRow(row, headerResult.map, specialId, rowIndex + 1, {
            validateSpecialId: false,
          }));
        } catch (error) {
          errors.push({
            rowNo: rowIndex + 1,
            fieldName: '行校验',
            errorCode: 'ROW_INVALID',
            errorMessage: error instanceof Error ? error.message : '行数据不合法',
            rawPayload: this.toJsonRow(row) as Prisma.InputJsonValue,
          });
        }
      }
    }

    const summary = {
      headerErrors: headerResult.missingRequired.length + headerResult.positionMismatches.length + headerResult.unexpectedHeaders.length,
      categoryMismatch: errors.filter((item) => item.errorMessage.includes('分类专项')).length,
      imageValidationErrors: errors.filter((item) => item.errorMessage.includes('图片')).length,
      answerFormatErrors: errors.filter((item) => item.errorMessage.includes('答案')).length,
      previewRows,
    };

    const batch = await this.prisma.campusExamImportBatch.create({
      data: {
        specialId,
        fileName: file!.originalname,
        uploadedByAdminId: admin.adminId,
        totalCount,
        successCount: previewRows.length,
        failCount: errors.length,
        status: errors.length ? 'preview_with_errors' : 'previewed',
        summaryJson: summary as unknown as Prisma.InputJsonValue,
      },
    });

    if (errors.length) {
      await this.prisma.campusExamImportError.createMany({
        data: errors.map((item) => ({
          batchId: batch.id,
          rowNo: item.rowNo,
          fieldName: item.fieldName,
          errorCode: item.errorCode,
          errorMessage: item.errorMessage,
          rawPayload: item.rawPayload ?? Prisma.JsonNull,
        })),
      });
    }

    return {
      batchId: batch.id,
      specialId,
      specialName: special.name,
      fileName: batch.fileName,
      totalCount,
      successCount: previewRows.length,
      failCount: errors.length,
      summary: {
        headerErrors: summary.headerErrors,
        categoryMismatch: summary.categoryMismatch,
        imageValidationErrors: summary.imageValidationErrors,
        answerFormatErrors: summary.answerFormatErrors,
      },
      previewRowCount: previewRows.length,
      previewRowsTruncated: previewRows.length > 20,
      previewRows: previewRows.slice(0, 20).map((row) => ({
        ...row,
        questionTypeLabel: CAMPUS_EXAM_QUESTION_TYPE_LABEL_MAP[row.questionType] ?? '未知题型',
      })),
      errors: errors.slice(0, 50),
    };
  }

  getImportTemplate() {
    return this.buildExcelDownload(
      CAMPUS_EXAM_IMPORT_TEMPLATE_FILENAME,
      [IMPORT_COLUMNS.map((column) => column.templateHeader)],
      CAMPUS_EXAM_IMPORT_TEMPLATE_SHEET_NAME,
    );
  }

  async confirmImport(specialId: number, body: Record<string, unknown>, _admin: CurrentAdminPayload) {
    const batchId = this.readRequiredString(body.batchId, '缺少预览批次号');
    const overwritePolicy = normalizeText(body.overwritePolicy || 'skip_existing');
    if (!CAMPUS_EXAM_IMPORT_OVERWRITE_POLICIES.includes(overwritePolicy as (typeof CAMPUS_EXAM_IMPORT_OVERWRITE_POLICIES)[number])) {
      throw new BadRequestException('正式导入失败：当前选择的覆盖策略无效，请重新选择后再试');
    }
    const batch = await this.prisma.campusExamImportBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch || batch.specialId !== specialId) {
      throw new NotFoundException('正式导入失败：未找到对应的预览批次，或该批次不属于当前二级分类');
    }
    const summaryJson = (batch.summaryJson ?? {}) as Record<string, unknown>;
    const previewRows = Array.isArray(summaryJson.previewRows) ? (summaryJson.previewRows as PreviewQuestionRow[]) : [];
    if (!previewRows.length) {
      throw new BadRequestException('正式导入失败：当前预览批次没有可导入的有效题目，请先修复 Excel 问题后重新预览');
    }

    const confirmErrors: CampusExamImportErrorItem[] = [];
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (const row of previewRows) {
      try {
        const result = await this.persistPreviewQuestion(row, batchId, overwritePolicy);
        if (result === 'skipped') {
          skippedCount += 1;
        } else {
          successCount += 1;
        }
      } catch (error) {
        failCount += 1;
        confirmErrors.push({
          rowNo: row.sourceRowNo,
          fieldName: '正式导入',
          errorCode: 'IMPORT_FAILED',
          errorMessage: error instanceof Error ? error.message : '正式导入失败',
          rawPayload: row as unknown as Prisma.InputJsonValue,
        });
      }
    }

    if (confirmErrors.length) {
      await this.prisma.campusExamImportError.createMany({
        data: confirmErrors.map((item) => ({
          batchId,
          rowNo: item.rowNo,
          fieldName: item.fieldName,
          errorCode: item.errorCode,
          errorMessage: item.errorMessage,
          rawPayload: item.rawPayload ?? Prisma.JsonNull,
        })),
      });
    }

    await this.prisma.campusExamImportBatch.update({
      where: { id: batchId },
      data: {
        successCount,
        failCount: batch.failCount + failCount,
        status: failCount ? 'imported_with_errors' : 'imported',
        summaryJson: {
          ...(summaryJson as Record<string, unknown>),
          confirmResult: {
            overwritePolicy,
            importedCount: successCount,
            skippedCount,
            failedCount: failCount,
          },
        } as Prisma.InputJsonValue,
      },
    });
    await this.refreshSpecialQuestionCount(specialId);

    return {
      batchId,
      overwritePolicy,
      importedCount: successCount,
      skippedCount,
      failedCount: failCount,
      status: failCount ? 'imported_with_errors' : 'imported',
    };
  }

  async getAdminImportBatches(query: Record<string, string | undefined>) {
    const page = this.readPositiveInt(query.page, 1);
    const pageSize = this.readPositiveInt(query.pageSize, 10);
    const status = normalizeText(query.status);
    const specialId = toOptionalInt(query.specialId);
    const categoryId = normalizeText(query.categoryId);
    const where: Prisma.CampusExamImportBatchWhereInput = {
      ...(status ? { status } : {}),
      ...(specialId ? { specialId } : {}),
      ...(categoryId ? { special: { categoryId } } : {}),
    };
    const [total, list] = await Promise.all([
      this.prisma.campusExamImportBatch.count({ where }),
      this.prisma.campusExamImportBatch.findMany({
        where,
        include: {
          special: { include: { category: true } },
          _count: { select: { errors: true, questions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      list: list.map((item) => ({
        id: item.id,
        fileName: item.fileName,
        specialId: item.specialId,
        specialName: item.special.name,
        categoryName: item.special.category.name,
        totalCount: item.totalCount,
        successCount: item.successCount,
        failCount: item.failCount,
        errorCount: item._count.errors,
        importedQuestionCount: item._count.questions,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      pagination: this.buildPagination(page, pageSize, total),
    };
  }

  async getAdminImportBatchDetail(batchId: string) {
    const batch = await this.prisma.campusExamImportBatch.findUnique({
      where: { id: batchId },
      include: {
        special: { include: { category: true } },
        questions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!batch) {
      throw new NotFoundException('导入批次不存在');
    }
    const summaryJson = (batch.summaryJson ?? {}) as Record<string, any>;
    return {
      id: batch.id,
      fileName: batch.fileName,
      specialId: batch.specialId,
      specialName: batch.special.name,
      categoryName: batch.special.category.name,
      totalCount: batch.totalCount,
      successCount: batch.successCount,
      failCount: batch.failCount,
      status: batch.status,
      summary: summaryJson,
      questions: await Promise.all(batch.questions.map((item) => this.toQuestionItem(item))),
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString(),
    };
  }

  async getAdminImportBatchErrors(batchId: string) {
    const errors = await this.prisma.campusExamImportError.findMany({
      where: { batchId },
      orderBy: [{ rowNo: 'asc' }, { createdAt: 'asc' }],
      take: 500,
    });
    return errors.map((item) => ({
      id: item.id.toString(),
      rowNo: item.rowNo,
      fieldName: item.fieldName,
      errorCode: item.errorCode,
      errorMessage: item.errorMessage,
      rawPayload: item.rawPayload,
      createdAt: item.createdAt.toISOString(),
    }));
  }

  async retryImportBatchAssets(batchId: string) {
    const questions = await this.prisma.campusExamQuestion.findMany({
      where: { importBatchId: batchId },
      take: 200,
    });
    let updatedCount = 0;
    let failedCount = 0;
    for (const question of questions) {
      try {
        const assetResult = await this.transferQuestionAssets(question.id, {
          stemHtml: question.stemHtml,
          optionsJson: question.optionsJson as Array<{ key: string; label: string; value: string }> | null | undefined,
          analysisHtml: question.analysisHtml,
          questionImageUrl: question.questionImageUrl,
          analysisImageUrl: question.analysisImageUrl,
        });
        await this.prisma.campusExamQuestion.update({
          where: { id: question.id },
          data: {
            stemHtml: assetResult.stemHtml,
            optionsJson: (assetResult.optionsJson ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
            analysisHtml: assetResult.analysisHtml,
            questionImageOssUrl: assetResult.questionImageOssUrl,
            analysisImageOssUrl: assetResult.analysisImageOssUrl,
            inlineAssetJson: assetResult.inlineAssetJson as unknown as Prisma.InputJsonValue,
          },
        });
        updatedCount += 1;
      } catch {
        failedCount += 1;
      }
    }
    return {
      batchId,
      total: questions.length,
      updatedCount,
      failedCount,
    };
  }

  async getAdminQuestions(query: Record<string, string | undefined>) {
    const page = this.readPositiveInt(query.page, 1);
    const pageSize = this.readPositiveInt(query.pageSize, 10);
    const where: Prisma.CampusExamQuestionWhereInput = {
      ...(normalizeText(query.keyword)
        ? {
            OR: [
              { stemHtml: { contains: normalizeText(query.keyword) } },
              { analysisHtml: { contains: normalizeText(query.keyword) } },
            ],
          }
        : {}),
      ...(normalizeText(query.status) ? { status: normalizeText(query.status) } : {}),
      ...(toOptionalInt(query.specialId) ? { specialId: toOptionalInt(query.specialId)! } : {}),
      ...(toOptionalInt(query.questionType) ? { questionType: toOptionalInt(query.questionType)! } : {}),
      ...(toOptionalInt(query.difficulty) ? { difficulty: toOptionalInt(query.difficulty)! } : {}),
      ...(normalizeText(query.categoryId) ? { special: { categoryId: normalizeText(query.categoryId) } } : {}),
      ...(query.isHighFrequencyWrong ? { isHighFrequencyWrong: toBooleanFlag(query.isHighFrequencyWrong) } : {}),
    };

    const [total, list] = await Promise.all([
      this.prisma.campusExamQuestion.count({ where }),
      this.prisma.campusExamQuestion.findMany({
        where,
        include: {
          special: { include: { category: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      list: await Promise.all(list.map((item) => this.toQuestionItem(item, true))),
      pagination: this.buildPagination(page, pageSize, total),
    };
  }

  async getAdminQuestionDetail(id: string) {
    const question = await this.prisma.campusExamQuestion.findUnique({
      where: { id },
      include: {
        special: { include: { category: true } },
        importBatch: true,
      },
    });
    if (!question) {
      throw new NotFoundException('题目不存在');
    }
    return this.toQuestionDetail(question);
  }

  async updateAdminQuestion(id: string, body: Record<string, unknown>) {
    const current = await this.prisma.campusExamQuestion.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('题目不存在');
    }
    const nextQuestionType = body.questionType !== undefined ? parseQuestionType(body.questionType) : current.questionType;
    const nextAnswerJson = body.answerJson !== undefined
      ? this.normalizeAnswerJson(nextQuestionType, body.answerJson)
      : (current.answerJson as unknown as CampusExamAnswerJson);
    const updated = await this.prisma.campusExamQuestion.update({
      where: { id },
      data: {
        questionType: nextQuestionType,
        stemContentType: body.stemContentType !== undefined ? this.readPositiveInt(body.stemContentType, current.stemContentType) : undefined,
        difficulty: body.difficulty !== undefined ? this.readPositiveInt(body.difficulty, current.difficulty) : undefined,
        isHighFrequencyWrong: body.isHighFrequencyWrong !== undefined ? toBooleanFlag(body.isHighFrequencyWrong) : undefined,
        optionContentType: body.optionContentType !== undefined ? this.readPositiveInt(body.optionContentType, current.optionContentType) : undefined,
      stemHtml: body.stemHtml !== undefined ? normalizeRichTextContent(this.readRequiredString(body.stemHtml, '题干不能为空')) : undefined,
        optionsJson: body.optionsJson !== undefined ? this.normalizeOptionsJson(body.optionsJson) as unknown as Prisma.InputJsonValue : undefined,
        answerJson: nextAnswerJson as unknown as Prisma.InputJsonValue,
      analysisHtml: body.analysisHtml !== undefined ? this.normalizeNullableRichText(body.analysisHtml) : undefined,
        questionImageUrl: body.questionImageUrl !== undefined ? this.readNullableString(body.questionImageUrl) : undefined,
        analysisImageUrl: body.analysisImageUrl !== undefined ? this.readNullableString(body.analysisImageUrl) : undefined,
        questionImageOssUrl: body.questionImageOssUrl !== undefined ? this.readNullableString(body.questionImageOssUrl) : undefined,
        analysisImageOssUrl: body.analysisImageOssUrl !== undefined ? this.readNullableString(body.analysisImageOssUrl) : undefined,
        status: body.status !== undefined ? this.readStatus(body.status, current.status) : undefined,
      },
    });
    await this.refreshSpecialQuestionCount(updated.specialId);
    return this.toQuestionDetail(updated);
  }

  async updateAdminQuestionStatus(id: string, body: Record<string, unknown>) {
    const current = await this.prisma.campusExamQuestion.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('题目不存在');
    }
    const updated = await this.prisma.campusExamQuestion.update({
      where: { id },
      data: { status: this.readStatus(body.status, current.status) },
    });
    await this.refreshSpecialQuestionCount(updated.specialId);
    return {
      id: updated.id,
      status: updated.status,
    };
  }

  async getAdminSubjectiveJudgements(query: Record<string, string | undefined>) {
    const page = this.readPositiveInt(query.page, 1);
    const pageSize = this.readPositiveInt(query.pageSize, 10);
    const where: Prisma.CampusExamSubjectiveJudgementWhereInput = {
      ...(normalizeText(query.questionId) ? { questionId: normalizeText(query.questionId) } : {}),
      ...(normalizeText(query.userId) ? { userId: normalizeText(query.userId) } : {}),
      ...(normalizeText(query.scoringMode) ? { scoringMode: normalizeText(query.scoringMode) } : {}),
      ...(normalizeText(query.result) ? { judgementResult: normalizeText(query.result) } : {}),
      ...(normalizeText(query.qualityStatus) ? { qualityStatus: normalizeText(query.qualityStatus) } : {}),
    };
    const [total, list] = await Promise.all([
      this.prisma.campusExamSubjectiveJudgement.count({ where }),
      this.prisma.campusExamSubjectiveJudgement.findMany({
        where,
        include: {
          question: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      list: list.map((item) => ({
        id: item.id.toString(),
        userId: item.userId,
        questionId: item.questionId,
        questionStem: normalizeLooseText(item.question.stemHtml).slice(0, 80),
        scoringMode: item.scoringMode,
        judgementResult: item.judgementResult,
        normalizedScore: Number(item.normalizedScore),
        matchedKeywords: normalizeArrayValues(item.matchedKeywordsJson),
        aiReasoning: item.aiReasoning,
        qualityStatus: item.qualityStatus,
        qualityNote: item.qualityNote,
        createdAt: item.createdAt.toISOString(),
      })),
      pagination: this.buildPagination(page, pageSize, total),
    };
  }

  async getAdminSubjectiveJudgementDetail(id: string) {
    const numericId = BigInt(id);
    const judgement = await this.prisma.campusExamSubjectiveJudgement.findUnique({
      where: { id: numericId },
      include: {
        question: true,
        answer: true,
      },
    });
    if (!judgement) {
      throw new NotFoundException('判分记录不存在');
    }
    return {
      id: judgement.id.toString(),
      answerId: judgement.answerId.toString(),
      questionId: judgement.questionId,
      userId: judgement.userId,
      scoringMode: judgement.scoringMode,
      matchedKeywords: normalizeArrayValues(judgement.matchedKeywordsJson),
      referenceAnswerSnapshot: judgement.referenceAnswerSnapshot,
      userAnswerSnapshot: judgement.userAnswerSnapshot,
      rawScore: Number(judgement.rawScore),
      normalizedScore: Number(judgement.normalizedScore),
      judgementResult: judgement.judgementResult,
      aiModelCode: judgement.aiModelCode,
      aiReasoning: judgement.aiReasoning,
      qualityStatus: judgement.qualityStatus,
      qualityNote: judgement.qualityNote,
      questionStem: judgement.question.stemHtml,
      createdAt: judgement.createdAt.toISOString(),
    };
  }

  async updateAdminSubjectiveJudgementQuality(id: string, body: Record<string, unknown>) {
    const numericId = BigInt(id);
    const updated = await this.prisma.campusExamSubjectiveJudgement.update({
      where: { id: numericId },
      data: {
        qualityStatus: normalizeText(body.qualityStatus) || 'pending',
        qualityNote: this.readNullableString(body.qualityNote),
      },
    });
    return {
      id: updated.id.toString(),
      qualityStatus: updated.qualityStatus,
      qualityNote: updated.qualityNote,
    };
  }

  async getHome(userId: string | null) {
    const [categoryTree, history, stats] = await Promise.all([
      this.getCategoryTree(),
      userId ? this.getHistory(userId) : [],
      this.getStats(userId),
    ]);
    return {
      heroCards: CAMPUS_EXAM_HERO_CARDS,
      categoryTree,
      history,
      stats,
    };
  }

  async getCategoryTree() {
    const categories = await this.prisma.campusExamCategory.findMany({
      where: { status: 'active' },
      include: {
        specials: {
          where: { status: 'active' },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      specials: category.specials.map((special) => ({
        id: special.id,
        name: special.name,
        description: special.description,
        questionCount: special.questionCount,
        status: special.status,
      })),
    }));
  }

  async getCategoryDetail(slug: string) {
    const category = await this.prisma.campusExamCategory.findFirst({
      where: { slug, status: 'active' },
      include: {
        specials: {
          where: { status: 'active' },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!category) {
      throw new NotFoundException('分类不存在');
    }
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      updatedAt: category.updatedAt.toISOString(),
      specials: category.specials.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        questionCount: item.questionCount,
        updatedAt: item.updatedAt.toISOString(),
      })),
    };
  }

  async getSpecialDetail(specialId: number, userId: string | null) {
    const special = await this.prisma.campusExamSpecial.findUnique({
      where: { id: specialId },
      include: {
        category: true,
        questions: {
          where: { status: 'active' },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!special || special.status !== 'active') {
      throw new NotFoundException('专项不存在');
    }
    const latestSession = userId
      ? await this.prisma.campusExamPracticeSession.findFirst({
          where: {
            userId,
            specialId,
          },
          orderBy: { updatedAt: 'desc' },
        })
      : null;
    const questionTypeDistribution = this.countBy(special.questions.map((item) => item.questionType));
    const difficultyDistribution = this.countBy(special.questions.map((item) => item.difficulty));
    return {
      id: special.id,
      name: special.name,
      description: special.description,
      updatedAt: special.updatedAt.toISOString(),
      category: {
        id: special.category.id,
        name: special.category.name,
        slug: special.category.slug,
      },
      questionCount: special.questionCount,
      questionIds: special.questions.map((item) => item.id),
      questionTypeDistribution: Object.entries(questionTypeDistribution).map(([key, count]) => ({
        questionType: Number(key),
        label: CAMPUS_EXAM_QUESTION_TYPE_LABEL_MAP[Number(key)] ?? key,
        count,
      })),
      difficultyDistribution: Object.entries(difficultyDistribution).map(([key, count]) => ({
        difficulty: Number(key),
        count,
      })),
      latestSession: latestSession
        ? {
            sessionId: latestSession.id,
            answeredCount: latestSession.answeredCount,
            totalQuestions: latestSession.totalQuestions,
            lastQuestionId: latestSession.lastQuestionId,
          }
        : null,
    };
  }

  async createPracticeSession(userId: string, body: Record<string, unknown>) {
    const mode = normalizeText(body.mode || 'special_practice');
    const sessionSeed = await this.buildPracticeSessionSeed(userId, mode, body);
    const questionOrder = sessionSeed.questionOrder;
    const session = await this.prisma.campusExamPracticeSession.create({
      data: {
        userId,
        mode,
        specialId: sessionSeed.specialId,
        title: sessionSeed.title,
        totalQuestions: questionOrder.length,
        answeredCount: 0,
        correctCount: 0,
        lastQuestionId: questionOrder[0],
        questionOrderJson: questionOrder as unknown as Prisma.InputJsonValue,
      },
    });
    return {
      sessionId: session.id,
      title: session.title,
      totalQuestions: session.totalQuestions,
      lastQuestionId: session.lastQuestionId,
      firstQuestionId: questionOrder[0],
    };
  }

  async getPracticeSession(userId: string, sessionId: string) {
    const session = await this.prisma.campusExamPracticeSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        answers: true,
      },
    });
    if (!session) {
      throw new NotFoundException('练习会话不存在');
    }
    const questionOrder = Array.isArray(session.questionOrderJson) ? (session.questionOrderJson as string[]) : [];
    const questionGroups = await this.buildPracticeQuestionGroups(session.mode, session.specialId, questionOrder);
    return {
      sessionId: session.id,
      mode: session.mode,
      title: session.title,
      specialId: session.specialId,
      totalQuestions: session.totalQuestions,
      answeredCount: session.answeredCount,
      correctCount: session.correctCount,
      status: session.status,
      lastQuestionId: session.lastQuestionId,
      firstQuestionId: questionOrder[0] ?? null,
      questionOrder,
      questionGroups,
      answeredMap: Object.fromEntries(session.answers.map((item) => [item.questionId, {
        answerId: item.id.toString(),
        answerStatus: item.answerStatus,
        isCorrect: item.isCorrect,
        score: item.score === null ? null : Number(item.score),
      }])),
    };
  }

  async getQuestionDetail(questionId: string, userId: string | null, sessionId: string | null) {
    const question = await this.prisma.campusExamQuestion.findFirst({
      where: { id: questionId, status: 'active' },
      include: {
        special: { include: { category: true } },
      },
    });
    if (!question) {
      throw new NotFoundException('题目不存在');
    }
    const [answer, favorite] = await Promise.all([
      userId && sessionId
        ? this.prisma.campusExamPracticeAnswer.findFirst({
            where: {
              sessionId,
              questionId,
              session: { userId },
            },
            include: {
              judgements: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          })
        : Promise.resolve(null),
      userId
        ? this.prisma.campusExamFavorite.findUnique({
            where: {
              userId_questionId: {
                userId,
                questionId,
              },
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    return this.toQuestionDetail(question, answer, { isFavorited: Boolean(favorite) });
  }

  async favoriteQuestion(userId: string, questionId: string) {
    const question = await this.prisma.campusExamQuestion.findFirst({
      where: { id: questionId, status: 'active' },
      select: { id: true },
    });
    if (!question) {
      throw new NotFoundException('题目不存在');
    }
    await this.prisma.campusExamFavorite.upsert({
      where: {
        userId_questionId: {
          userId,
          questionId,
        },
      },
      create: {
        userId,
        questionId,
      },
      update: {},
    });
    return {
      questionId,
      isFavorited: true,
    };
  }

  async unfavoriteQuestion(userId: string, questionId: string) {
    await this.prisma.campusExamFavorite.deleteMany({
      where: {
        userId,
        questionId,
      },
    });
    return {
      questionId,
      isFavorited: false,
    };
  }

  async submitPracticeAnswer(userId: string, sessionId: string, body: Record<string, unknown>) {
    const questionId = this.readRequiredString(body.questionId, '缺少题目 id');
    const usedTimeSec = this.readPositiveInt(body.usedTimeSec, 0);
    const allowIncompleteSubmit = body.allowIncompleteSubmit === true;
    const session = await this.prisma.campusExamPracticeSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException('练习会话不存在');
    }
    const question = await this.prisma.campusExamQuestion.findUnique({ where: { id: questionId } });
    if (!question) {
      throw new NotFoundException('题目不存在');
    }
    const answerJson = question.answerJson as unknown as CampusExamAnswerJson;
    const optionsJson = Array.isArray(question.optionsJson)
      ? (question.optionsJson as QuestionOptionItem[])
      : null;
    const interactionRule = this.buildQuestionInteractionRule({
      questionType: question.questionType,
      optionsJson,
      answerJson,
    });
    const userAnswer = this.sanitizePracticeUserAnswer(
      question.questionType,
      this.normalizeUserAnswer(body.userAnswer),
      optionsJson,
    );
    this.assertPracticeAnswerValid(question.questionType, userAnswer, interactionRule, optionsJson, { allowIncompleteSubmit });
    let isCorrect: boolean | null = null;
    let score: number | null = null;
    let judgementResult: string | null = null;
    let subjectivePayload: Record<string, unknown> | null = null;

    if (question.questionType === 6) {
      if (allowIncompleteSubmit && !normalizeText(userAnswer.values[0] ?? '')) {
        isCorrect = false;
        score = 0;
        judgementResult = 'wrong';
      } else {
        const scoring = await this.subjectiveScoringService.score({
          stemHtml: question.stemHtml,
          referenceAnswer: answerJson,
          userAnswerText: userAnswer.values[0] ?? '',
        });
        isCorrect = scoring.judgementResult === 'correct';
        score = scoring.normalizedScore;
        judgementResult = scoring.judgementResult;
        subjectivePayload = {
          scoringMode: scoring.scoringMode,
          matchedKeywords: scoring.matchedKeywords,
          missingKeywords: scoring.missingKeywords,
          reason: scoring.reason,
        };
      }
    } else {
      const objectiveResult = this.scoreObjectiveQuestion(question.questionType, answerJson, userAnswer);
      isCorrect = objectiveResult.isCorrect;
      score = objectiveResult.score;
      judgementResult = objectiveResult.isCorrect ? 'correct' : 'wrong';
    }

    const persisted = await this.prisma.campusExamPracticeAnswer.upsert({
      where: {
        sessionId_questionId: {
          sessionId,
          questionId,
        },
      },
      create: {
        sessionId,
        questionId,
        userAnswerJson: userAnswer as unknown as Prisma.InputJsonValue,
        isCorrect,
        score: score === null ? null : new Prisma.Decimal(score),
        answerStatus: 'answered',
        usedTimeSec,
      },
      update: {
        userAnswerJson: userAnswer as unknown as Prisma.InputJsonValue,
        isCorrect,
        score: score === null ? null : new Prisma.Decimal(score),
        answerStatus: 'answered',
        usedTimeSec,
      },
    });

    if (question.questionType === 6 && score !== null) {
      const scoring = subjectivePayload as { scoringMode: string; matchedKeywords: string[]; reason: string };
      await this.prisma.campusExamSubjectiveJudgement.create({
        data: {
          answerId: persisted.id,
          questionId,
          userId,
          scoringMode: scoring.scoringMode,
          matchedKeywordsJson: scoring.matchedKeywords as unknown as Prisma.InputJsonValue,
          referenceAnswerSnapshot: JSON.stringify(answerJson),
          userAnswerSnapshot: JSON.stringify(userAnswer),
          rawScore: new Prisma.Decimal(score),
          normalizedScore: new Prisma.Decimal(score),
          judgementResult: judgementResult ?? 'pending_review',
          aiReasoning: scoring.reason,
          aiModelCode: scoring.scoringMode === 'hybrid' ? 'default' : null,
        },
      });
    }

    if (isCorrect === false) {
      await this.prisma.campusExamWrongQuestion.upsert({
        where: {
          userId_questionId: {
            userId,
            questionId,
          },
        },
        create: {
          userId,
          questionId,
          sourceAnswerId: persisted.id,
        },
        update: {
          sourceAnswerId: persisted.id,
        },
      });
    } else {
      await this.prisma.campusExamWrongQuestion.deleteMany({
        where: {
          userId,
          questionId,
        },
      });
    }

    await this.refreshPracticeSessionStats(sessionId, questionId);
    const latestJudgement = question.questionType === 6
      ? await this.prisma.campusExamSubjectiveJudgement.findFirst({
          where: { answerId: persisted.id },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    return {
      questionId,
      isCorrect,
      score,
      answerStatus: 'answered',
      judgementResult,
      correctAnswer: answerJson,
      analysisHtml: question.analysisHtml,
      subjectiveJudgement: latestJudgement
        ? {
            scoringMode: latestJudgement.scoringMode,
            matchedKeywords: normalizeArrayValues(latestJudgement.matchedKeywordsJson),
            reason: latestJudgement.aiReasoning,
          }
        : subjectivePayload,
    };
  }

  async getHistory(userId: string) {
    const sessions = await this.prisma.campusExamPracticeSession.findMany({
      where: { userId },
      include: {
        special: { include: { category: true } },
        answers: {
          select: {
            score: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    return sessions.map((item) => {
      const answeredScoreSum = item.answers.reduce((sum, answer) => sum + Number(answer.score ?? 0), 0);
      const scoreRate = item.totalQuestions
        ? Math.round((answeredScoreSum / item.totalQuestions) * 100)
        : 0;
      const currentScoreRate = item.answeredCount
        ? Math.round((answeredScoreSum / item.answeredCount) * 100)
        : 0;
      return {
      sessionId: item.id,
      mode: item.mode,
      title: item.title,
      specialId: item.specialId,
      specialName: item.special?.name ?? '',
      categoryName: item.special?.category.name ?? '',
      totalQuestions: item.totalQuestions,
      answeredCount: item.answeredCount,
      correctCount: item.correctCount,
      scoreRate,
      currentScoreRate,
      status: item.status,
      lastQuestionId: item.lastQuestionId,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      };
    });
  }

  async getStats(userId: string | null) {
    if (!userId) {
      return {
        predictedScore: 0,
        wrongCount: 0,
        noteCount: 0,
        favoriteCount: 0,
      };
    }
    const [wrongCount, noteCount, favoriteCount, answers] = await Promise.all([
      this.prisma.campusExamWrongQuestion.count({ where: { userId } }),
      this.prisma.campusExamNote.count({ where: { userId } }),
      this.prisma.campusExamFavorite.count({ where: { userId } }),
      this.prisma.campusExamPracticeAnswer.findMany({
        where: {
          session: { userId },
          score: { not: null },
        },
        select: { score: true },
        take: 200,
      }),
    ]);
    const predictedScore = answers.length
      ? Number(((answers.reduce((sum, item) => sum + Number(item.score ?? 0), 0) / answers.length) * 100).toFixed(1))
      : 0;
    return {
      predictedScore,
      wrongCount,
      noteCount,
      favoriteCount,
    };
  }

  async previewSubjectiveScore(questionId: string, body: Record<string, unknown>) {
    const question = await this.prisma.campusExamQuestion.findUnique({ where: { id: questionId } });
    if (!question) {
      throw new NotFoundException('题目不存在');
    }
    if (question.questionType !== 6) {
      throw new BadRequestException('当前题目不是简答题');
    }
    const userAnswer = this.normalizeUserAnswer(body.userAnswer);
    const score = await this.subjectiveScoringService.score({
      stemHtml: question.stemHtml,
      referenceAnswer: question.answerJson as unknown as CampusExamAnswerJson,
      userAnswerText: userAnswer.values[0] ?? '',
    });
    return {
      questionId,
      userAnswer,
      ...score,
    };
  }

  private async persistPreviewQuestion(row: PreviewQuestionRow, batchId: string, overwritePolicy: string) {
    const existing = await this.prisma.campusExamQuestion.findFirst({
      where: {
        specialId: row.specialId,
        stemHtml: row.stemHtml,
      },
    });
    if (existing) {
      if (overwritePolicy === 'skip_existing') {
        return 'skipped' as const;
      }
      if (overwritePolicy === 'fail_on_duplicate') {
        throw new BadRequestException('存在相同题干的题目，当前策略不允许重复导入');
      }
    }
    const questionId = existing?.id ?? randomUUID();
    const assets = await this.transferQuestionAssets(questionId, row);
    if (this.storageService.isConfigured() && assets.items.some((item) => item.status === 'failed')) {
      throw new BadRequestException('题目图片转存失败，请先修复资源后重试正式导入');
    }

    const data: Prisma.CampusExamQuestionUncheckedCreateInput = {
      id: questionId,
      specialId: row.specialId,
      questionType: row.questionType,
      stemContentType: row.stemContentType,
      difficulty: row.difficulty,
      isHighFrequencyWrong: row.isHighFrequencyWrong,
      optionContentType: row.optionContentType,
      stemHtml: assets.stemHtml,
      optionsJson: (assets.optionsJson ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
      answerJson: row.answerJson as unknown as Prisma.InputJsonValue,
      analysisHtml: assets.analysisHtml,
      questionImageUrl: row.questionImageUrl,
      analysisImageUrl: row.analysisImageUrl,
      questionImageOssUrl: assets.questionImageOssUrl,
      analysisImageOssUrl: assets.analysisImageOssUrl,
      inlineAssetJson: assets.items as unknown as Prisma.InputJsonValue,
      sourceRowNo: row.sourceRowNo,
      importBatchId: batchId,
      status: row.status,
    };

    if (existing && overwritePolicy === 'replace_existing') {
      await this.prisma.campusExamQuestion.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await this.prisma.campusExamQuestion.create({ data });
    }
    return 'imported' as const;
  }

  private async transferQuestionAssets(
    questionId: string,
    payload: {
      stemHtml: string;
      optionsJson: Array<{ key: string; label: string; value: string }> | null | undefined;
      analysisHtml: string | null | undefined;
      questionImageUrl: string | null | undefined;
      analysisImageUrl: string | null | undefined;
    },
  ) {
    const items: CampusExamAssetTransferItem[] = [];
    const questionImage = await this.transferSingleAsset(payload.questionImageUrl, {
      questionId,
      pathSegments: ['campus-exam', 'questions', questionId, 'stem'],
      assetType: 'stem_main',
      fileNamePrefix: 'main',
    });
    items.push(questionImage);
    const analysisImage = await this.transferSingleAsset(payload.analysisImageUrl, {
      questionId,
      pathSegments: ['campus-exam', 'questions', questionId, 'analysis'],
      assetType: 'analysis_main',
      fileNamePrefix: 'main',
    });
    items.push(analysisImage);
    const stemHtmlResult = await this.rewriteInlineImages(questionId, payload.stemHtml, 'stem_inline', items);
    const optionsJsonResult = await this.rewriteOptionImages(questionId, payload.optionsJson ?? null, items);
    const analysisHtmlResult = await this.rewriteInlineImages(questionId, payload.analysisHtml ?? '', 'analysis_inline', items);

    return {
      stemHtml: stemHtmlResult,
      optionsJson: optionsJsonResult,
      analysisHtml: analysisHtmlResult || null,
      questionImageOssUrl: questionImage.ossUrl ?? null,
      analysisImageOssUrl: analysisImage.ossUrl ?? null,
      inlineAssetJson: items,
      items,
    };
  }

  private async rewriteInlineImages(questionId: string, html: string, assetType: string, items: CampusExamAssetTransferItem[]) {
    let rewritten = html;
    const matches = Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi));
    for (let index = 0; index < matches.length; index += 1) {
      const sourceUrl = matches[index]?.[1];
      if (!sourceUrl) {
        continue;
      }
      const result = await this.transferSingleAsset(sourceUrl, {
        questionId,
        pathSegments: ['campus-exam', 'questions', questionId, 'inline'],
        assetType: `${assetType}_${index + 1}`,
        fileNamePrefix: `${assetType}-${index + 1}`,
      });
      items.push(result);
      if (result.ossUrl) {
        rewritten = rewritten.replace(sourceUrl, result.ossUrl);
      }
    }
    return rewritten;
  }

  private async rewriteOptionImages(
    questionId: string,
    options: Array<{ key: string; label: string; value: string }> | null,
    items: CampusExamAssetTransferItem[],
  ) {
    if (!options?.length) {
      return null;
    }
    return Promise.all(options.map(async (option, index) => ({
      ...option,
      value: await this.rewriteInlineImages(questionId, option.value, `option_inline_${index + 1}`, items),
    })));
  }

  private async transferSingleAsset(
    sourceUrl: string | null | undefined,
    input: {
      questionId: string;
      pathSegments: string[];
      assetType: string;
      fileNamePrefix: string;
    },
  ): Promise<CampusExamAssetTransferItem> {
    const normalized = normalizeText(sourceUrl);
    if (!normalized) {
      return {
        sourceUrl: '',
        assetType: input.assetType,
        status: 'skipped',
      };
    }
    if (!/^https?:\/\//i.test(normalized)) {
      return {
        sourceUrl: normalized,
        assetType: input.assetType,
        status: 'failed',
        errorMessage: '图片链接必须是 http/https 地址',
      };
    }
    if (!this.storageService.isConfigured()) {
      return {
        sourceUrl: normalized,
        assetType: input.assetType,
        status: 'skipped',
        ossUrl: normalized,
      };
    }
    try {
      const response = await fetch(normalized, {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        throw new Error(`资源下载失败（${response.status}）`);
      }
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        throw new Error('下载结果不是图片资源');
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const uploaded = await this.storageService.uploadBuffer({
        pathSegments: input.pathSegments,
        actorType: 'admin',
        actorId: 'system',
        bizId: input.questionId,
        fileName: `${input.fileNamePrefix}-${Date.now()}.${this.resolveExtension(contentType)}`,
        contentType,
        buffer,
      });
      return {
        sourceUrl: normalized,
        assetType: input.assetType,
        status: 'success',
        ossUrl: uploaded.objectKey,
        contentType,
        size: buffer.length,
      };
    } catch (error) {
      return {
        sourceUrl: normalized,
        assetType: input.assetType,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : '资源转存失败',
      };
    }
  }

  private resolveExtension(contentType: string) {
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('webp')) return 'webp';
    if (contentType.includes('gif')) return 'gif';
    return 'jpg';
  }

  private normalizeImportRow(
    row: unknown[],
    headerMap: Partial<Record<ImportColumnKey, number>>,
    specialId: number,
    sourceRowNo: number,
    options?: { validateSpecialId?: boolean },
  ): PreviewQuestionRow {
    const read = (key: ImportColumnKey) => {
      const index = headerMap[key];
      return index === undefined ? undefined : row[index];
    };
    if (options?.validateSpecialId !== false) {
      const rowSpecialId = toInt(read('specialId'));
      if (rowSpecialId !== specialId) {
        throw new BadRequestException(`分类专项id 不匹配，当前上传上下文为 ${specialId}，Excel 行值为 ${rowSpecialId}`);
      }
    }
    const questionType = parseQuestionType(read('questionType'));
    const stemHtml = normalizeRichTextContent(this.readRequiredString(read('stemHtml'), '题干不能为空'));
    const optionsJson = this.normalizeOptionsJson(read('optionsRaw'), questionType);
    const answerJson = this.parseAnswerJson(questionType, read('answerRaw'), null);
    const interactionRule = this.buildQuestionInteractionRule({ questionType, optionsJson, answerJson });
    const analysisHtml = this.normalizeNullableRichText(read('analysisHtml'));
    const questionImageUrl = this.readNullableString(read('questionImageUrl'));
    const analysisImageUrl = this.readNullableString(read('analysisImageUrl'));
    this.assertQuestionStructure(questionType, optionsJson, answerJson, interactionRule);
    this.assertImportRowImageUrlsValid({
      stemHtml,
      optionsJson,
      analysisHtml,
      questionImageUrl,
      analysisImageUrl,
    });
    return {
      sourceRowNo,
      specialId,
      questionType,
      stemContentType: toInt(this.readRequiredString(read('stemContentType'), '题目类型不能为空')),
      difficulty: toInt(this.readRequiredString(read('difficulty'), '难度不能为空')),
      isHighFrequencyWrong: toBooleanFlag(this.readRequiredString(read('isHighFrequencyWrong'), '是否高频错题不能为空')),
      optionContentType: this.readOptionContentType(questionType, read('optionContentType'), optionsJson),
      stemHtml,
      optionsJson,
      answerJson,
      analysisHtml,
      questionImageUrl,
      analysisImageUrl,
      status: 'active',
    };
  }

  private parseAnswerJson(questionType: number, rawValue: unknown, ruleConfigValue: unknown): CampusExamAnswerJson {
    const raw = this.readRequiredString(rawValue, '答案不能为空');
    const type = getQuestionAnswerType(questionType);
    if (raw.startsWith('{') || raw.startsWith('[')) {
      const parsed = safeJsonParse<CampusExamAnswerJson>(raw, { type, values: [] });
      if (questionType === 6) {
        parsed.ruleConfig = parsed.ruleConfig || this.subjectiveRuleService.buildRuleConfig(parsed);
      }
      return parsed;
    }

    if (questionType === 1) {
      return { type, values: [raw.replace(/[^A-Z]/gi, '').toUpperCase().slice(0, 1)] };
    }
    if (questionType === 2) {
      const separated = splitAnswerValues(raw);
      const values = separated.length
        ? separated.map((item) => item.replace(/[^A-Z]/gi, '').toUpperCase()).filter(Boolean)
        : raw.replace(/[^A-Z]/gi, '').toUpperCase().split('').filter(Boolean);
      return { type, values: Array.from(new Set(values)).sort() };
    }
    if (questionType === 3) {
      const normalized = normalizeComparableText(raw);
      return { type, values: [(['对', '正确', 'true', '1'].some((item) => normalized.includes(item)) ? 'true' : 'false')] };
    }
    if (questionType === 4 || questionType === 5) {
      const values = splitAnswerValues(raw);
      if (!values.length) {
        throw new BadRequestException('填空题答案格式不正确');
      }
      return { type, values };
    }

    const answer: CampusExamAnswerJson = {
      type,
      values: [raw],
    };
    if (ruleConfigValue) {
      answer.ruleConfig = typeof ruleConfigValue === 'string'
        ? safeJsonParse(ruleConfigValue, this.subjectiveRuleService.buildRuleConfig(answer))
        : (ruleConfigValue as CampusExamAnswerJson['ruleConfig']);
    }
    answer.ruleConfig = answer.ruleConfig || this.subjectiveRuleService.buildRuleConfig(answer);
    return answer;
  }

  private normalizeAnswerJson(questionType: number, value: unknown) {
    if (typeof value === 'string') {
      return this.parseAnswerJson(questionType, value, null);
    }
    const raw = value as CampusExamAnswerJson;
    const next: CampusExamAnswerJson = {
      type: raw.type || CAMPUS_EXAM_QUESTION_TYPE_CODE_MAP[questionType],
      values: normalizeArrayValues(raw.values),
      ruleConfig: raw.ruleConfig,
    };
    if (questionType === 6) {
      next.ruleConfig = next.ruleConfig || this.subjectiveRuleService.buildRuleConfig(next);
    }
    return next;
  }

  private normalizeOptionsJson(value: unknown, questionType?: number) {
    if (value === undefined || value === null || normalizeText(value) === '') {
      if (questionType === 3) {
        return [
          { key: 'A', label: 'A', value: normalizeRichTextContent('正确') },
          { key: 'B', label: 'B', value: normalizeRichTextContent('错误') },
        ];
      }
      return null;
    }
    if (Array.isArray(value)) {
      return value.map((item, index) => {
        const record = item as Record<string, unknown>;
        const label = normalizeText(record.label || record.key || String.fromCharCode(65 + index));
        return {
          key: label,
          label,
          value: normalizeRichTextContent(record.value),
        };
      });
    }
    return parseOptionLines(String(value)).map((item) => ({
      ...item,
      value: normalizeRichTextContent(item.value),
    }));
  }

  private normalizeUserAnswer(value: unknown) {
    const record = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
    return {
      type: normalizeText(record.type) || 'single',
      values: normalizeArrayValues(record.values),
    };
  }

  private scoreObjectiveQuestion(questionType: number, answerJson: CampusExamAnswerJson, userAnswer: { type: string; values: string[] }) {
    const expected = answerJson.values.map((item) => normalizeComparableText(item));
    const actual = userAnswer.values.map((item) => normalizeComparableText(item));
    let isCorrect = false;
    if (questionType === 2 || questionType === 5) {
      isCorrect = expected.length === actual.length && expected.every((item) => actual.includes(item));
    } else {
      isCorrect = expected[0] === actual[0];
    }
    return {
      isCorrect,
      score: isCorrect ? 1 : 0,
    };
  }

  private async refreshPracticeSessionStats(sessionId: string, lastQuestionId: string) {
    const [session, answers] = await Promise.all([
      this.prisma.campusExamPracticeSession.findUnique({
        where: { id: sessionId },
        select: { totalQuestions: true },
      }),
      this.prisma.campusExamPracticeAnswer.findMany({
        where: { sessionId },
        select: { isCorrect: true },
      }),
    ]);
    if (!session) {
      throw new NotFoundException('练习会话不存在');
    }
    const answeredCount = answers.length;
    const correctCount = answers.filter((item) => item.isCorrect).length;
    await this.prisma.campusExamPracticeSession.update({
      where: { id: sessionId },
      data: {
        answeredCount,
        correctCount,
        status: this.resolvePracticeSessionStatus(answeredCount, session.totalQuestions),
        lastQuestionId,
      },
    });
  }

  private async buildPracticeSessionSeed(userId: string, mode: string, body: Record<string, unknown>) {
    if (mode === 'special_practice') {
      const specialId = toInt(body.specialId);
      const special = await this.ensureSpecialExists(specialId);
      const questions = await this.prisma.campusExamQuestion.findMany({
        where: { specialId, status: 'active' },
        select: {
          id: true,
          sourceRowNo: true,
          createdAt: true,
        },
      });
      if (!questions.length) {
        throw new BadRequestException('当前专项暂无可练习题目');
      }
      const orderedQuestions = [...questions].sort((left, right) => this.comparePracticeQuestionSequence(left, right));
      return {
        specialId,
        title: `${special.name}专项顺序练习`,
        questionOrder: orderedQuestions.map((item) => item.id),
      };
    }

    if (mode === 'category_practice') {
      const categoryId = this.readRequiredString(body.categoryId, '缺少一级分类 id');
      return this.buildCategorySequentialPracticeSeed(categoryId);
    }

    if (mode === 'custom_practice') {
      return this.buildCustomPracticeSeed(body);
    }

    if (mode === 'quick_practice') {
      return this.buildCategoryGroupedPracticeSeed({
        title: '快速练习',
        countPerCategory: 5,
      });
    }

    if (mode === 'smart_mock') {
      return this.buildCategoryGroupedPracticeSeed({
        title: '智能模考',
        countPerCategory: 20,
      });
    }

    if (mode === 'wrong_practice') {
      return this.buildTaggedSequentialPracticeSeed(userId, 'wrong');
    }

    if (mode === 'favorite_practice') {
      return this.buildTaggedSequentialPracticeSeed(userId, 'favorite');
    }

    if (mode === 'wrong_retry') {
      const wrongQuestions = await this.prisma.campusExamWrongQuestion.findMany({
        where: {
          userId,
          question: { status: 'active' },
        },
        select: { questionId: true },
        orderBy: { createdAt: 'desc' },
      });
      const questionOrder = this.shuffleArray(wrongQuestions.map((item) => item.questionId)).slice(0, 10);
      if (!questionOrder.length) {
        throw new BadRequestException('当前错题库暂无可重练题目');
      }
      return {
        specialId: null,
        title: '错题重练',
        questionOrder,
      };
    }

    throw new BadRequestException('暂不支持该练习模式');
  }

  private async buildCategorySequentialPracticeSeed(categoryId: string) {
    const category = await this.ensureCategoryExists(categoryId);
    const questions = await this.prisma.campusExamQuestion.findMany({
      where: {
        status: 'active',
        special: {
          categoryId,
          status: 'active',
        },
      },
      select: {
        id: true,
        sourceRowNo: true,
        createdAt: true,
        special: {
          select: {
            id: true,
            sortOrder: true,
            createdAt: true,
          },
        },
      },
    });
    if (!questions.length) {
      throw new BadRequestException('当前一级分类暂无可练习题目');
    }
    const orderedQuestions = [...questions].sort((left, right) => {
      const bySpecialSort = (left.special?.sortOrder ?? 0) - (right.special?.sortOrder ?? 0);
      if (bySpecialSort !== 0) return bySpecialSort;
      const bySpecialCreated = new Date(left.special?.createdAt ?? 0).getTime() - new Date(right.special?.createdAt ?? 0).getTime();
      if (bySpecialCreated !== 0) return bySpecialCreated;
      return this.comparePracticeQuestionSequence(left, right);
    });
    return {
      specialId: null,
      title: `${category.name}顺序练习`,
      questionOrder: orderedQuestions.map((item) => item.id),
    };
  }

  private async buildCustomPracticeSeed(body: Record<string, unknown>) {
    const rawSpecialIds = Array.isArray(body.specialIds) ? body.specialIds : [];
    const specialIds = Array.from(new Set(rawSpecialIds.map((item) => toInt(item)).filter((item) => item > 0)));
    if (!specialIds.length) {
      throw new BadRequestException('请至少选择 1 个二级分类');
    }
    const specials = await this.prisma.campusExamSpecial.findMany({
      where: {
        id: { in: specialIds },
        status: 'active',
      },
      include: {
        category: true,
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    if (!specials.length) {
      throw new BadRequestException('所选二级分类暂不可练习');
    }
    const questions = await this.prisma.campusExamQuestion.findMany({
      where: {
        status: 'active',
        specialId: { in: specials.map((item) => item.id) },
      },
      select: { id: true },
    });
    if (!questions.length) {
      throw new BadRequestException('所选范围内暂无可练习题目');
    }
    const questionOrder = this.shuffleArray(questions.map((item) => item.id)).slice(0, 25);
    const categoryNames = Array.from(new Set(specials.map((item) => item.category.name)));
    return {
      specialId: null,
      title: `自定义刷题（${categoryNames.join(' / ')}）`,
      questionOrder,
    };
  }

  private async buildCategoryGroupedPracticeSeed(input: { title: string; countPerCategory: number }) {
    const categories = await this.prisma.campusExamCategory.findMany({
      where: { status: 'active' },
      include: {
        specials: {
          where: { status: 'active' },
          select: { id: true },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const questionOrder: string[] = [];
    for (const category of categories) {
      const specialIds = category.specials.map((item) => item.id);
      if (!specialIds.length) continue;
      const questions = await this.prisma.campusExamQuestion.findMany({
        where: {
          status: 'active',
          specialId: { in: specialIds },
        },
        select: { id: true },
      });
      if (!questions.length) continue;
      const sampled = this.shuffleArray(questions.map((item) => item.id)).slice(0, input.countPerCategory);
      questionOrder.push(...sampled);
    }

    if (!questionOrder.length) {
      throw new BadRequestException('当前题库暂无可练习题目');
    }

    return {
      specialId: null,
      title: input.title,
      questionOrder,
    };
  }

  private async buildTaggedSequentialPracticeSeed(userId: string, tag: 'wrong' | 'favorite') {
    const records = tag === 'wrong'
      ? await this.prisma.campusExamWrongQuestion.findMany({
          where: {
            userId,
            question: { status: 'active' },
          },
          include: {
            question: {
              include: {
                special: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        })
      : await this.prisma.campusExamFavorite.findMany({
          where: {
            userId,
            question: { status: 'active' },
          },
          include: {
            question: {
              include: {
                special: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        });
    if (!records.length) {
      throw new BadRequestException(tag === 'wrong' ? '当前错题库暂无可练习题目' : '当前收藏题库暂无可练习题目');
    }
    const orderedQuestions = [...records]
      .map((item) => item.question)
      .sort((left, right) => this.compareTaggedPracticeQuestionSequence(left, right));
    return {
      specialId: null,
      title: tag === 'wrong' ? '错题顺序练习' : '收藏顺序练习',
      questionOrder: orderedQuestions.map((item) => item.id),
    };
  }

  private async buildPracticeQuestionGroups(mode: string, specialId: number | null, questionOrder: string[]) {
    if (!questionOrder.length) return [];
    if (mode === 'wrong_retry') {
      return [{ label: '随机错题', questionIds: questionOrder }];
    }

    const questions = await this.prisma.campusExamQuestion.findMany({
      where: { id: { in: questionOrder } },
      include: {
        special: {
          include: {
            category: true,
          },
        },
      },
    });
    const questionMap = new Map(questions.map((item) => [item.id, item]));
    const groups: Array<{ label: string; questionIds: string[] }> = [];

    for (const questionId of questionOrder) {
      const question = questionMap.get(questionId);
      const label = mode === 'special_practice'
        ? question?.special?.name ?? (specialId ? `专项 ${specialId}` : '专项练习')
        : question?.special?.category?.name ?? '未分类';
      const currentGroup = groups[groups.length - 1];
      if (currentGroup?.label === label) {
        currentGroup.questionIds.push(questionId);
      } else {
        groups.push({
          label,
          questionIds: [questionId],
        });
      }
    }

    return groups;
  }

  private compareTaggedPracticeQuestionSequence(left: any, right: any) {
    const byCategorySort = (left.special?.category?.sortOrder ?? 0) - (right.special?.category?.sortOrder ?? 0);
    if (byCategorySort !== 0) return byCategorySort;
    const byCategoryCreated = new Date(left.special?.category?.createdAt ?? 0).getTime()
      - new Date(right.special?.category?.createdAt ?? 0).getTime();
    if (byCategoryCreated !== 0) return byCategoryCreated;
    const bySpecialSort = (left.special?.sortOrder ?? 0) - (right.special?.sortOrder ?? 0);
    if (bySpecialSort !== 0) return bySpecialSort;
    const bySpecialCreated = new Date(left.special?.createdAt ?? 0).getTime() - new Date(right.special?.createdAt ?? 0).getTime();
    if (bySpecialCreated !== 0) return bySpecialCreated;
    return this.comparePracticeQuestionSequence(left, right);
  }

  private shuffleArray<T>(list: T[]) {
    const next = [...list];
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
  }

  private comparePracticeQuestionSequence(
    left: { sourceRowNo?: number | null; createdAt: Date },
    right: { sourceRowNo?: number | null; createdAt: Date },
  ) {
    const leftSourceRowNo = left.sourceRowNo ?? null;
    const rightSourceRowNo = right.sourceRowNo ?? null;
    if (leftSourceRowNo !== null && rightSourceRowNo !== null && leftSourceRowNo !== rightSourceRowNo) {
      return leftSourceRowNo - rightSourceRowNo;
    }
    if (leftSourceRowNo !== null && rightSourceRowNo === null) {
      return -1;
    }
    if (leftSourceRowNo === null && rightSourceRowNo !== null) {
      return 1;
    }
    return left.createdAt.getTime() - right.createdAt.getTime();
  }

  private async toQuestionDetail(question: any, answer?: any, extra?: { isFavorited?: boolean }) {
    const detail = await this.toQuestionItem(question, false);
    return {
      ...detail,
      isFavorited: extra?.isFavorited ?? false,
      special: question.special
        ? {
            id: question.special.id,
            name: question.special.name,
            category: question.special.category
              ? {
                  id: question.special.category.id,
                  name: question.special.category.name,
                  slug: question.special.category.slug,
                }
              : null,
          }
        : null,
      importBatchId: question.importBatchId,
      answerRecord: answer
        ? {
            id: answer.id.toString(),
            userAnswer: answer.userAnswerJson,
            isCorrect: answer.isCorrect,
            score: answer.score === null ? null : Number(answer.score),
            answerStatus: answer.answerStatus,
            subjectiveJudgement: answer.judgements?.[0]
              ? {
                  id: answer.judgements[0].id.toString(),
                  scoringMode: answer.judgements[0].scoringMode,
                  matchedKeywords: normalizeArrayValues(answer.judgements[0].matchedKeywordsJson),
                  reason: answer.judgements[0].aiReasoning,
                  judgementResult: answer.judgements[0].judgementResult,
                }
              : null,
          }
        : null,
    };
  }

  private async toQuestionItem(question: any, compact = false) {
    const stemPreview = await this.storageService.buildHtmlPreviewPayload(question.stemHtml);
    const analysisPreview = await this.storageService.buildHtmlPreviewPayload(question.analysisHtml ?? '');
    const rawOptionsJson = Array.isArray(question.optionsJson)
      ? question.optionsJson as Array<{ key?: string; label?: string; value?: string }>
      : null;
    const optionPreviews = rawOptionsJson
      ? await Promise.all(rawOptionsJson.map(async (item: { key?: string; label?: string; value?: string }) => {
          const preview = await this.storageService.buildHtmlPreviewPayload(item?.value ?? '');
          return {
            key: item?.key ?? '',
            label: item?.label ?? '',
            value: item?.value ?? '',
            previewHtml: preview.previewHtml,
          };
        }))
      : null;
    const questionImagePreviewUrl = await this.storageService.resolveAssetAccessUrl(question.questionImageOssUrl || question.questionImageUrl);
    const analysisImagePreviewUrl = await this.storageService.resolveAssetAccessUrl(question.analysisImageOssUrl || question.analysisImageUrl);
    const answerJson = question.answerJson as CampusExamAnswerJson;
    return {
      id: question.id,
      specialId: question.specialId,
      questionType: question.questionType,
      questionTypeLabel: CAMPUS_EXAM_QUESTION_TYPE_LABEL_MAP[question.questionType] ?? '未知题型',
      questionTypeCode: CAMPUS_EXAM_QUESTION_TYPE_CODE_MAP[question.questionType] ?? 'single',
      difficulty: question.difficulty,
      isHighFrequencyWrong: question.isHighFrequencyWrong,
      status: question.status,
      stemHtml: compact ? undefined : question.stemHtml,
      stemPreviewHtml: stemPreview.previewHtml,
      optionsJson: optionPreviews,
      answerJson: compact ? undefined : question.answerJson,
      interactionRule: this.buildQuestionInteractionRule({
        questionType: question.questionType,
        optionsJson: rawOptionsJson as QuestionOptionItem[] | null,
        answerJson,
      }),
      analysisHtml: compact ? undefined : question.analysisHtml,
      analysisPreviewHtml: analysisPreview.previewHtml,
      questionImageUrl: question.questionImageUrl,
      questionImageOssUrl: question.questionImageOssUrl,
      questionImagePreviewUrl,
      analysisImageUrl: question.analysisImageUrl,
      analysisImageOssUrl: question.analysisImageOssUrl,
      analysisImagePreviewUrl,
      inlineAssetJson: question.inlineAssetJson,
      sourceRowNo: question.sourceRowNo,
      createdAt: question.createdAt.toISOString(),
      updatedAt: question.updatedAt.toISOString(),
      specialName: question.special?.name,
      categoryName: question.special?.category?.name,
      assetTransferStatus: this.resolveAssetTransferStatus(question),
    };
  }

  private resolveAssetTransferStatus(question: any) {
    const items = Array.isArray(question.inlineAssetJson) ? question.inlineAssetJson as Array<{ status?: string }> : [];
    if (items.some((item) => item.status === 'failed')) {
      return 'failed';
    }
    if (question.questionImageUrl && !question.questionImageOssUrl && this.storageService.isConfigured()) {
      return 'failed';
    }
    if (question.analysisImageUrl && !question.analysisImageOssUrl && this.storageService.isConfigured()) {
      return 'failed';
    }
    if (question.questionImageOssUrl || question.analysisImageOssUrl || items.some((item) => item.status === 'success')) {
      return 'success';
    }
    return 'pending';
  }

  private async ensureCategoryExists(categoryId: string) {
    const category = await this.prisma.campusExamCategory.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw new NotFoundException('一级分类不存在');
    }
    return category;
  }

  private async ensureSpecialExists(specialId: number) {
    const special = await this.prisma.campusExamSpecial.findUnique({ where: { id: specialId } });
    if (!special) {
      throw new NotFoundException('二级分类不存在');
    }
    return special;
  }

  private async assertCategorySlugAvailable(slug: string, excludeId?: string) {
    const existing = await this.prisma.campusExamCategory.findUnique({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException('分类 slug 已存在');
    }
  }

  private buildPagination(page: number, pageSize: number, total: number) {
    return {
      page,
      limit: pageSize,
      total,
      hasMore: page * pageSize < total,
    };
  }

  private readExcelRows(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new BadRequestException('Excel 文件中没有可读取的工作表');
    }
    const sheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
      raw: false,
    }) as unknown[][];
  }

  private resolveImportHeaderMap(headerRow: unknown[], options?: { requireSpecialId?: boolean }) {
    const requireSpecialId = options?.requireSpecialId ?? true;
    const normalizedHeaders = headerRow.map((item) => normalizeText(item));
    const containsSpecialIdHeader = normalizedHeaders.includes(
      IMPORT_COLUMNS.find((column) => column.key === 'specialId')!.templateHeader,
    );
    const expectedColumns = requireSpecialId || containsSpecialIdHeader
      ? IMPORT_COLUMNS
      : IMPORT_COLUMNS.filter((column) => column.key !== 'specialId');
    const map: Partial<Record<ImportColumnKey, number>> = {};
    const missingRequired: string[] = [];
    const positionMismatches: Array<{ columnNo: number; expectedHeader: string; actualHeader: string }> = [];
    const matchedIndexes = new Set<number>();
    for (const column of expectedColumns) {
      const matchedIndex = normalizedHeaders.findIndex((header) => header === column.templateHeader);
      if (matchedIndex === -1) {
        if (column.required) {
          missingRequired.push(column.templateHeader);
        }
        continue;
      }
      map[column.key] = matchedIndex;
      matchedIndexes.add(matchedIndex);
      if (matchedIndex !== expectedColumns.findIndex((item) => item.key === column.key)) {
        positionMismatches.push({
          columnNo: expectedColumns.findIndex((item) => item.key === column.key) + 1,
          expectedHeader: column.templateHeader,
          actualHeader: normalizeText(headerRow[matchedIndex]),
        });
      }
    }
    const unexpectedHeaders = headerRow
      .map((item, index) => ({ index, header: normalizeText(item) }))
      .filter((item) => item.header && !matchedIndexes.has(item.index))
      .map((item) => ({
        columnNo: item.index + 1,
        header: item.header,
      }));
    return { map, missingRequired, positionMismatches, unexpectedHeaders };
  }

  private countBy(values: number[]) {
    return values.reduce<Record<number, number>>((acc, item) => {
      acc[item] = (acc[item] ?? 0) + 1;
      return acc;
    }, {});
  }

  private resolvePracticeSessionStatus(answeredCount: number, totalQuestions: number) {
    if (totalQuestions > 0 && answeredCount >= totalQuestions) {
      return 'completed';
    }
    return 'ongoing';
  }

  private async refreshSpecialQuestionCount(specialId: number) {
    const count = await this.prisma.campusExamQuestion.count({
      where: {
        specialId,
        status: 'active',
      },
    });
    await this.prisma.campusExamSpecial.update({
      where: { id: specialId },
      data: { questionCount: count },
    });
  }

  private readPositiveInt(value: unknown, fallback: number) {
    const normalized = normalizeText(value);
    if (!normalized) {
      return fallback;
    }
    return Math.max(0, toInt(normalized, fallback));
  }

  private readRequiredString(value: unknown, message: string) {
    const normalized = normalizeText(value);
    if (!normalized) {
      throw new BadRequestException(message);
    }
    return normalized;
  }

  private readNullableString(value: unknown) {
    const normalized = normalizeText(value);
    return normalized || null;
  }

  private readStatus(value: unknown, fallback: string) {
    const normalized = normalizeText(value);
    if (!normalized) {
      return fallback;
    }
    if (!['active', 'inactive'].includes(normalized)) {
      throw new BadRequestException('状态值不合法');
    }
    return normalized;
  }

  private readOptionalStatus(value: unknown) {
    const normalized = normalizeText(value);
    return normalized || null;
  }

  private assertImportFile(file?: UploadedCampusExamFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请上传 Excel 文件');
    }
    if (!/\.(xlsx|xls)$/i.test(file.originalname || '')) {
      throw new BadRequestException('请上传 .xlsx 或 .xls 格式的 Excel 文件');
    }
    if (file.mimetype && !CAMPUS_EXAM_ALLOWED_IMPORT_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Excel 文件 MIME 类型不受支持');
    }
  }

  private toJsonRow(row: unknown[]) {
    return row.map((item) => normalizeText(item));
  }

  private buildExcelDownload(
    filename: string,
    rows: Array<Array<string | number | boolean | null | undefined>>,
    sheetName: string,
  ) {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const content = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      filename,
      mimeType: EXCEL_MIME_TYPE,
      encoding: 'base64' as const,
      content: Buffer.from(content).toString('base64'),
    };
  }

  private normalizeNullableRichText(value: unknown) {
    const normalized = normalizeRichTextContent(value);
    return normalized || null;
  }

  private readOptionContentType(questionType: number, value: unknown, optionsJson: QuestionOptionItem[] | null) {
    if (!optionsJson?.length && [4, 5, 6].includes(questionType)) {
      return normalizeText(value) ? toInt(value) : 1;
    }
    return toInt(this.readRequiredString(value, '选项类型不能为空'));
  }

  private buildQuestionInteractionRule(input: {
    questionType: number;
    optionsJson: QuestionOptionItem[] | null;
    answerJson?: CampusExamAnswerJson | null;
  }): CampusExamInteractionRule {
    const optionCount = input.optionsJson?.length ?? (input.questionType === 3 ? 2 : 0);
    const blankCount = Math.max(input.answerJson?.values?.length ?? (input.questionType === 5 ? 2 : 1), 1);

    if (input.questionType === 1) {
      return {
        mode: 'single_choice',
        autoSubmitOnOptionClick: true,
        requiresManualSubmit: false,
        minSelectionCount: 1,
        maxSelectionCount: 1,
        blankCount: 0,
        requiresNonEmptyAnswer: true,
      };
    }
    if (input.questionType === 2) {
      const maxSelectionCount = Math.max(2, Math.min(4, optionCount || 4));
      return {
        mode: 'multiple_choice',
        autoSubmitOnOptionClick: false,
        requiresManualSubmit: true,
        minSelectionCount: 2,
        maxSelectionCount,
        blankCount: 0,
        requiresNonEmptyAnswer: true,
      };
    }
    if (input.questionType === 3) {
      return {
        mode: 'judge',
        autoSubmitOnOptionClick: true,
        requiresManualSubmit: false,
        minSelectionCount: 1,
        maxSelectionCount: 1,
        blankCount: 0,
        requiresNonEmptyAnswer: true,
      };
    }
    if (input.questionType === 4) {
      return {
        mode: 'blank_single',
        autoSubmitOnOptionClick: false,
        requiresManualSubmit: true,
        minSelectionCount: 1,
        maxSelectionCount: 1,
        blankCount: 1,
        requiresNonEmptyAnswer: true,
      };
    }
    if (input.questionType === 5) {
      return {
        mode: 'blank_multiple',
        autoSubmitOnOptionClick: false,
        requiresManualSubmit: true,
        minSelectionCount: blankCount,
        maxSelectionCount: blankCount,
        blankCount,
        requiresNonEmptyAnswer: true,
      };
    }
    return {
      mode: 'essay',
      autoSubmitOnOptionClick: false,
      requiresManualSubmit: true,
      minSelectionCount: 1,
      maxSelectionCount: 1,
      blankCount: 1,
      requiresNonEmptyAnswer: true,
    };
  }

  private assertQuestionStructure(
    questionType: number,
    optionsJson: QuestionOptionItem[] | null,
    answerJson: CampusExamAnswerJson,
    interactionRule: CampusExamInteractionRule,
  ) {
    if ([1, 2].includes(questionType) && (!optionsJson?.length || optionsJson.length < 2)) {
      throw new BadRequestException('选择题至少需要提供 2 个选项');
    }
    if (questionType === 2 && answerJson.values.length < 2) {
      throw new BadRequestException('多选题标准答案至少需要 2 个选项');
    }
    if (questionType === 2 && answerJson.values.length > interactionRule.maxSelectionCount) {
      throw new BadRequestException(`多选题标准答案最多支持 ${interactionRule.maxSelectionCount} 个选项`);
    }
    if (questionType === 3 && answerJson.values.length !== 1) {
      throw new BadRequestException('判断题标准答案必须且只能有 1 个值');
    }
    if (questionType === 4 && answerJson.values.length !== 1) {
      throw new BadRequestException('单项填空题标准答案必须且只能有 1 个值');
    }
    if (questionType === 5 && answerJson.values.length < 2) {
      throw new BadRequestException('多项填空题标准答案至少需要 2 个值');
    }
    if (questionType === 6 && !answerJson.values.some((item) => normalizeText(item))) {
      throw new BadRequestException('简答题标准答案不能为空');
    }
    if ([1, 2].includes(questionType) && optionsJson?.length) {
      const optionKeys = new Set(optionsJson.map((item) => item.key.toUpperCase()));
      const invalidAnswer = answerJson.values.find((item) => !optionKeys.has(normalizeText(item).toUpperCase()));
      if (invalidAnswer) {
        throw new BadRequestException(`标准答案 ${invalidAnswer} 不在当前选项范围内`);
      }
    }
  }

  private sanitizePracticeUserAnswer(questionType: number, userAnswer: { type: string; values: string[] }, optionsJson: QuestionOptionItem[] | null) {
    if (questionType === 1 || questionType === 2) {
      return {
        ...userAnswer,
        values: Array.from(new Set(userAnswer.values.map((item) => normalizeText(item).toUpperCase()).filter(Boolean))),
      };
    }
    if (questionType === 3) {
      const firstValue = userAnswer.values[0] ?? '';
      return {
        ...userAnswer,
        values: [this.normalizeJudgeAnswerValue(firstValue, optionsJson)].filter(Boolean),
      };
    }
    return {
      ...userAnswer,
      values: userAnswer.values.map((item) => normalizeText(item)),
    };
  }

  private normalizeJudgeAnswerValue(value: string, optionsJson: QuestionOptionItem[] | null) {
    const normalized = normalizeText(value);
    if (!normalized) {
      return '';
    }
    const matchedOption = optionsJson?.find((item) => [item.key, item.label, item.value].some((candidate) => normalizeText(candidate) === normalized));
    const comparable = normalizeComparableText(matchedOption?.value || matchedOption?.label || normalized);
    if (['a', 'true'].includes(comparable) || ['对', '正确', '是', 'true', '1'].some((item) => comparable.includes(item))) {
      return 'true';
    }
    if (['b', 'false'].includes(comparable) || ['错', '错误', '否', 'false', '0'].some((item) => comparable.includes(item))) {
      return 'false';
    }
    return comparable;
  }

  private normalizeCategoryFolderUpload(files: UploadedCampusExamFile[] | undefined, relativePathsInput: unknown) {
    if (!files?.length) {
      throw new BadRequestException('请先选择一级分类文件夹');
    }
    const relativePaths = Array.isArray(relativePathsInput)
      ? relativePathsInput.map((item) => normalizeText(item))
      : [normalizeText(relativePathsInput)];
    if (relativePaths.length !== files.length) {
      throw new BadRequestException('上传文件路径信息不完整，请重新选择文件夹后重试');
    }

    const validFiles: CategoryFolderUploadCandidate[] = [];
    const skippedFiles: CategoryFolderImportFileResult[] = [];
    let folderName: string | null = null;

    files.forEach((file, index) => {
      const relativePath = relativePaths[index];
      if (!relativePath) {
        skippedFiles.push(this.buildSkippedCategoryFolderFileResult(file, '', 'skipped_invalid_file', `已跳过：文件 ${file.originalname} 未读取到文件夹路径信息，请重新选择文件夹后再试`));
        return;
      }
      const segments = relativePath.split('/').filter(Boolean);
      const nextFolderName = normalizeText(segments[0]);
      if (!folderName && nextFolderName) {
        folderName = nextFolderName;
      }
      if (segments.length !== 2) {
        skippedFiles.push(this.buildSkippedCategoryFolderFileResult(file, relativePath, 'skipped_invalid_file', '已跳过：目录结构不符合要求，仅支持“一级分类文件夹/题库文件.xlsx”'));
        return;
      }
      const fileName = normalizeText(segments[1]);
      if (!nextFolderName) {
        skippedFiles.push(this.buildSkippedCategoryFolderFileResult(file, relativePath, 'skipped_invalid_file', `已跳过：文件 ${file.originalname} 无法识别一级分类名称，请检查文件夹名称`));
        return;
      }
      if (folderName && nextFolderName !== folderName) {
        skippedFiles.push(this.buildSkippedCategoryFolderFileResult(file, relativePath, 'skipped_invalid_file', '已跳过：检测到其他一级分类文件夹下的文件，本次不参与导入'));
        return;
      }
      if (/^\.DS_Store$/i.test(fileName || file.originalname || '')) {
        skippedFiles.push(this.buildSkippedCategoryFolderFileResult(file, relativePath, 'skipped_invalid_file', '已跳过：系统文件 .DS_Store 不参与导入'));
        return;
      }
      if (!/\.(xlsx|xls)$/i.test(fileName || file.originalname || '')) {
        skippedFiles.push(this.buildSkippedCategoryFolderFileResult(file, relativePath, 'skipped_invalid_file', `已跳过：文件 ${file.originalname || fileName} 不是表格文件`));
        return;
      }
      if (file.size > CAMPUS_EXAM_MAX_IMPORT_FILE_SIZE) {
        skippedFiles.push(this.buildSkippedCategoryFolderFileResult(
          file,
          relativePath,
          'skipped_invalid_file',
          `已跳过：文件 ${file.originalname || fileName} 超过 ${Math.round(CAMPUS_EXAM_MAX_IMPORT_FILE_SIZE / 1024 / 1024)}MB 上限`,
        ));
        return;
      }
      const specialName = fileName.replace(/\.(xlsx|xls)$/i, '').trim();
      if (!specialName) {
        skippedFiles.push(this.buildSkippedCategoryFolderFileResult(file, relativePath, 'skipped_invalid_file', `已跳过：文件 ${file.originalname} 无法识别二级分类名称，请检查文件名`));
        return;
      }
      validFiles.push({
        file,
        relativePath,
        folderName: nextFolderName,
        fileName,
        specialName,
      });
    });
    return {
      totalFileCount: files.length,
      folderName,
      validFiles,
      skippedFiles,
    };
  }

  private precheckCategoryFolderImportFile(file: UploadedCampusExamFile) {
    try {
      this.assertImportFile(file);
    } catch (error) {
      return {
        ok: false as const,
        status: 'skipped_invalid_file' as const,
        message: error instanceof Error ? `已跳过：${error.message}` : '已跳过：文件不符合上传要求',
      };
    }
    try {
      const rows = this.readExcelRows(file.buffer);
      if (rows.length <= 1) {
        return {
          ok: false as const,
          status: 'skipped_invalid_template' as const,
          message: `已跳过：文件 ${file.originalname} 未检测到可导入数据`,
        };
      }
      const headerResult = this.resolveImportHeaderMap(rows[0], { requireSpecialId: false });
      if (headerResult.missingRequired.length || headerResult.positionMismatches.length || headerResult.unexpectedHeaders.length) {
        const firstError = headerResult.missingRequired[0]
          ? `缺少必要表头：${headerResult.missingRequired[0]}`
          : headerResult.positionMismatches[0]
            ? `表头顺序错误：第 ${headerResult.positionMismatches[0].columnNo} 列应为“${headerResult.positionMismatches[0].expectedHeader}”`
            : `存在非模板字段：${headerResult.unexpectedHeaders[0]?.header || '未知字段'}`;
        return {
          ok: false as const,
          status: 'skipped_invalid_template' as const,
          message: `已跳过：文件 ${file.originalname} 与标准模板不匹配。${firstError}`,
        };
      }
      return {
        ok: true as const,
      };
    } catch (error) {
      return {
        ok: false as const,
        status: 'skipped_invalid_file' as const,
        message: error instanceof Error ? `已跳过：文件 ${file.originalname} 无法读取。${error.message}` : `已跳过：文件 ${file.originalname} 无法读取`,
      };
    }
  }

  private buildSkippedCategoryFolderFileResult(
    file: UploadedCampusExamFile,
    relativePath: string,
    status: 'skipped_invalid_file' | 'skipped_invalid_template',
    message: string,
  ): CategoryFolderImportFileResult {
    const fileName = normalizeText(file.originalname) || normalizeText(relativePath.split('/').pop()) || '未识别文件';
    const specialName = fileName.replace(/\.(xlsx|xls)$/i, '').trim() || fileName;
    return {
      fileName,
      relativePath,
      specialName,
      specialId: null,
      batchId: null,
      totalCount: 0,
      importedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      status,
      message,
    };
  }

  private async findOrCreateCategoryByName(name: string) {
    const existing = await this.prisma.campusExamCategory.findFirst({
      where: { name },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      return {
        category: existing,
        status: 'reused' as const,
      };
    }
    const slug = await this.generateAvailableCategorySlug(name);
    const category = await this.prisma.campusExamCategory.create({
      data: {
        specialCode: await this.generateUniqueCategorySpecialCode(),
        name,
        slug,
        status: 'active',
      },
    });
    return {
      category,
      status: 'created' as const,
    };
  }

  private async generateAvailableCategorySlug(name: string) {
    const baseSlug = slugifyCampusExamCategory(name);
    let nextSlug = baseSlug;
    let suffix = 2;
    // 一级分类名称可能不重复，但 slug 仍可能因为历史数据冲突，需要自动避让。
    while (await this.prisma.campusExamCategory.findUnique({ where: { slug: nextSlug } })) {
      nextSlug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
    return nextSlug;
  }

  private async generateUniqueCategorySpecialCode() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const specialCode = this.buildRandomSpecialCode('CAT');
      const existing = await this.prisma.campusExamCategory.findUnique({
        where: { specialCode },
        select: { id: true },
      });
      if (!existing) {
        return specialCode;
      }
    }
    throw new BadRequestException('系统生成一级分类专项ID失败，请重试');
  }

  private async generateUniqueSpecialCode() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const specialCode = this.buildRandomSpecialCode('SP');
      const existing = await this.prisma.campusExamSpecial.findUnique({
        where: { specialCode },
        select: { id: true },
      });
      if (!existing) {
        return specialCode;
      }
    }
    throw new BadRequestException('系统生成二级分类专项ID失败，请重试');
  }

  private buildRandomSpecialCode(prefix: 'CAT' | 'SP') {
    return `${prefix}${Math.random().toString(36).slice(2, 10).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  private async readNextSpecialId() {
    const maxSpecial = await this.prisma.campusExamSpecial.aggregate({
      _max: { id: true },
    });
    return (maxSpecial._max.id ?? 0) + 1;
  }

  private async importCategoryFolderFile(
    specialId: number,
    file: UploadedCampusExamFile,
    relativePath: string,
    admin: CurrentAdminPayload,
  ) {
    this.assertImportFile(file);
    const rows = this.readExcelRows(file.buffer);
    if (rows.length <= 1) {
      throw new BadRequestException(`文件 ${file.originalname} 不包含可导入的数据行`);
    }

    const headerResult = this.resolveImportHeaderMap(rows[0], { requireSpecialId: false });
    const validationErrors: CampusExamImportErrorItem[] = [];
    const previewRows: PreviewQuestionRow[] = [];
    let totalCount = 0;

    if (headerResult.missingRequired.length || headerResult.positionMismatches.length || headerResult.unexpectedHeaders.length) {
      headerResult.missingRequired.forEach((header, index) => {
        validationErrors.push({
          rowNo: 1,
          fieldName: '表头',
          errorCode: 'HEADER_MISSING',
          errorMessage: `缺少必要表头：${header}`,
          rawPayload: { index, header } as Prisma.InputJsonValue,
        });
      });
      headerResult.positionMismatches.forEach((item) => {
        validationErrors.push({
          rowNo: 1,
          fieldName: '表头顺序',
          errorCode: 'HEADER_ORDER_INVALID',
          errorMessage: `第 ${item.columnNo} 列应为“${item.expectedHeader}”，当前识别为“${item.actualHeader || '空列'}”`,
          rawPayload: item as unknown as Prisma.InputJsonValue,
        });
      });
      headerResult.unexpectedHeaders.forEach((item) => {
        validationErrors.push({
          rowNo: 1,
          fieldName: '表头',
          errorCode: 'HEADER_UNEXPECTED',
          errorMessage: `检测到模板之外的表头：第 ${item.columnNo} 列“${item.header}”`,
          rawPayload: item as unknown as Prisma.InputJsonValue,
        });
      });
    } else {
      for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        if (!row.some((cell) => normalizeText(cell))) {
          continue;
        }
        totalCount += 1;
        try {
          previewRows.push(this.normalizeImportRow(row, headerResult.map, specialId, rowIndex + 1, {
            validateSpecialId: false,
          }));
        } catch (error) {
          validationErrors.push({
            rowNo: rowIndex + 1,
            fieldName: '行校验',
            errorCode: 'ROW_INVALID',
            errorMessage: error instanceof Error ? error.message : '行数据不合法',
            rawPayload: this.toJsonRow(row) as Prisma.InputJsonValue,
          });
        }
      }
    }

    const batch = await this.prisma.campusExamImportBatch.create({
      data: {
        specialId,
        fileName: file.originalname,
        uploadedByAdminId: admin.adminId,
        totalCount,
        successCount: 0,
        failCount: validationErrors.length,
        status: validationErrors.length ? 'imported_with_errors' : 'imported',
        summaryJson: {
          source: 'category_folder_import',
          relativePath,
        } as Prisma.InputJsonValue,
      },
    });

    let importedCount = 0;
    let skippedCount = 0;
    const importErrors: CampusExamImportErrorItem[] = [];

    for (const row of previewRows) {
      try {
        const result = await this.persistPreviewQuestion(row, batch.id, 'skip_existing');
        if (result === 'skipped') {
          skippedCount += 1;
        } else {
          importedCount += 1;
        }
      } catch (error) {
        importErrors.push({
          rowNo: row.sourceRowNo,
          fieldName: '正式导入',
          errorCode: 'IMPORT_FAILED',
          errorMessage: error instanceof Error ? error.message : '正式导入失败',
          rawPayload: row as unknown as Prisma.InputJsonValue,
        });
      }
    }

    const allErrors = [...validationErrors, ...importErrors];
    if (allErrors.length) {
      await this.prisma.campusExamImportError.createMany({
        data: allErrors.map((item) => ({
          batchId: batch.id,
          rowNo: item.rowNo,
          fieldName: item.fieldName,
          errorCode: item.errorCode,
          errorMessage: item.errorMessage,
          rawPayload: item.rawPayload ?? Prisma.JsonNull,
        })),
      });
    }

    await this.prisma.campusExamImportBatch.update({
      where: { id: batch.id },
      data: {
        successCount: importedCount,
        failCount: allErrors.length,
        status: allErrors.length ? 'imported_with_errors' : 'imported',
        summaryJson: {
          source: 'category_folder_import',
          relativePath,
          importedCount,
          skippedCount,
          failedCount: allErrors.length,
        } as Prisma.InputJsonValue,
      },
    });
    await this.refreshSpecialQuestionCount(specialId);

    return {
      batchId: batch.id,
      totalCount,
      importedCount,
      skippedCount,
      failedCount: allErrors.length,
      status: allErrors.length ? 'imported' as const : 'imported' as const,
      message: `导入完成：成功导入 ${importedCount} 题，跳过 ${skippedCount} 题，失败 ${allErrors.length} 题`,
    };
  }

  private assertPracticeAnswerValid(
    questionType: number,
    userAnswer: { type: string; values: string[] },
    interactionRule: CampusExamInteractionRule,
    optionsJson: QuestionOptionItem[] | null,
    options?: {
      allowIncompleteSubmit?: boolean;
    },
  ) {
    const nonEmptyValues = userAnswer.values.filter((item) => normalizeText(item));
    const allowIncompleteSubmit = options?.allowIncompleteSubmit === true;
    if (!allowIncompleteSubmit && interactionRule.requiresNonEmptyAnswer && !nonEmptyValues.length) {
      throw new BadRequestException('请先完成当前题目的作答');
    }
    if (questionType === 1) {
      if (nonEmptyValues.length !== 1) {
        throw new BadRequestException('单选题只能选择 1 个选项');
      }
      this.assertSelectedOptionExists(nonEmptyValues, optionsJson);
      return;
    }
    if (questionType === 2) {
      if (!allowIncompleteSubmit && (
        nonEmptyValues.length < interactionRule.minSelectionCount
        || nonEmptyValues.length > interactionRule.maxSelectionCount
      )) {
        throw new BadRequestException(`多选题需选择 ${interactionRule.minSelectionCount}~${interactionRule.maxSelectionCount} 个选项`);
      }
      if (allowIncompleteSubmit && nonEmptyValues.length > interactionRule.maxSelectionCount) {
        throw new BadRequestException(`多选题最多选择 ${interactionRule.maxSelectionCount} 个选项`);
      }
      this.assertSelectedOptionExists(nonEmptyValues, optionsJson);
      return;
    }
    if (questionType === 3) {
      if (nonEmptyValues.length !== 1 || !['true', 'false'].includes(nonEmptyValues[0])) {
        throw new BadRequestException('判断题需选择“正确”或“错误”');
      }
      return;
    }
    if (questionType === 4) {
      if (!allowIncompleteSubmit && nonEmptyValues.length !== 1) {
        throw new BadRequestException('单项填空题需要填写 1 个答案');
      }
      if (allowIncompleteSubmit && nonEmptyValues.length > 1) {
        throw new BadRequestException('单项填空题最多填写 1 个答案');
      }
      return;
    }
    if (questionType === 5) {
      if (!allowIncompleteSubmit && nonEmptyValues.length !== interactionRule.blankCount) {
        throw new BadRequestException(`多项填空题需要填写 ${interactionRule.blankCount} 个答案`);
      }
      if (allowIncompleteSubmit && nonEmptyValues.length > interactionRule.blankCount) {
        throw new BadRequestException(`多项填空题最多填写 ${interactionRule.blankCount} 个答案`);
      }
      return;
    }
    if (questionType === 6 && !allowIncompleteSubmit && !nonEmptyValues[0]) {
      throw new BadRequestException('简答题答案不能为空');
    }
  }

  private assertSelectedOptionExists(values: string[], optionsJson: QuestionOptionItem[] | null) {
    if (!optionsJson?.length) {
      throw new BadRequestException('当前题目缺少可作答选项');
    }
    const optionKeys = new Set(optionsJson.map((item) => item.key.toUpperCase()));
    const invalidValue = values.find((item) => !optionKeys.has(normalizeText(item).toUpperCase()));
    if (invalidValue) {
      throw new BadRequestException(`所选答案 ${invalidValue} 不在当前选项范围内`);
    }
  }

  private assertImportRowImageUrlsValid(payload: {
    stemHtml: string;
    optionsJson: Array<{ key: string; label: string; value: string }> | null;
    analysisHtml: string | null;
    questionImageUrl: string | null;
    analysisImageUrl: string | null;
  }) {
    const richTextSources = [
      { field: '题目', value: payload.stemHtml },
      { field: '题目解析', value: payload.analysisHtml ?? '' },
      ...(payload.optionsJson ?? []).map((item) => ({ field: `选项${item.label}`, value: item.value })),
    ];
    for (const source of richTextSources) {
      for (const url of collectRichTextImageUrls(source.value)) {
        this.assertHttpImageUrl(url, `${source.field}图片`);
      }
    }
    this.assertHttpImageUrl(payload.questionImageUrl, '题目图片链接');
    this.assertHttpImageUrl(payload.analysisImageUrl, '解析图片链接');
  }

  private assertHttpImageUrl(value: string | null | undefined, fieldName: string) {
    const normalized = normalizeText(value);
    if (!normalized) {
      return;
    }
    if (!/^https?:\/\//i.test(normalized)) {
      throw new BadRequestException(`${fieldName} 必须是 http/https 地址`);
    }
  }
}
