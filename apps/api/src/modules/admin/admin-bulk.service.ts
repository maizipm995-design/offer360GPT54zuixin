import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { formatDateOnly, normalizeJobTextDate } from '../../common/utils/job-text-date';
import { PrismaService } from '../../prisma.service';
import { clearAllJobsRecommendationCache } from '../jobs/jobs-recommendation-cache';
import { AdminService } from './admin.service';
import { parseCsvText, stringifyCsv } from './utils/csv';

export interface ImportErrorItem {
  row: number;
  message: string;
}

export interface AdminImportResponse {
  total: number;
  success: number;
  failed: number;
  durationMs: number;
  errors: ImportErrorItem[];
}

export interface UploadedAdminJobFile {
  buffer: Buffer;
  size: number;
  originalname: string;
  mimetype?: string;
}

const JOB_EXCEL_HEADERS = [
  '企业/单位全称',
  '企业性质',
  '学历要求',
  '工作地点',
  '岗位名称',
  '岗位类别',
  '招聘类型',
  '截止日期',
  '公告链接',
  '投递链接',
  '相关专业',
  '内推码',
  '招聘公告标题',
  '行业',
  '录入日期',
] as const;

const JOB_EXCEL_HEADER_ALIASES: Partial<Record<(typeof JOB_EXCEL_HEADERS)[number], string[]>> = {
  相关专业: ['相关专业', '毕业届别'],
};

const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const JOB_IMPORT_BATCH_SIZE = 200;
export const JOB_IMPORT_MAX_FILE_SIZE = 50 * 1024 * 1024;
const JOB_IMPORT_ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);

type SheetCellValue = string | number | boolean | Date | null | undefined;

type PreparedJobImportRow = {
  row: number;
  data: Prisma.JobAnnouncementCreateManyInput;
};

@Injectable()
export class AdminBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
  ) {}

  getJobTemplate() {
    return this.buildExcelDownload('招聘公告导入模板.xlsx', [Array.from(JOB_EXCEL_HEADERS)]);
  }

  async exportJobs(query: Record<string, string | undefined>) {
    const result = await this.adminService.getJobs({ ...query, page: '1', limit: '1000' }) as { list: Array<Record<string, unknown>> };

    return this.buildExcelDownload('招聘公告导出结果.xlsx', [
      Array.from(JOB_EXCEL_HEADERS),
      ...result.list.map((item) => [
        this.readString(item.companyFullName),
        this.readString(item.enterpriseNature),
        this.readString(item.degreeRequirement),
        this.readString(item.workLocation),
        this.readString(item.jobName),
        this.readString(item.jobCategory),
        this.readString(item.recruitmentType),
        this.formatExcelDate(item.deadlineAt),
        this.readString(item.announcementUrl),
        this.readString(item.deliveryUrl),
        this.readString(item.graduationSession),
        this.readString(item.referralCode),
        this.readString(item.announcementTitle),
        this.readString(item.industry),
        this.formatExcelDate(item.entryDate),
      ]),
    ]);
  }

  async importJobs(file?: UploadedAdminJobFile) {
    const startedAt = Date.now();
    this.assertJobImportFile(file);

    const importFile = file as UploadedAdminJobFile;
    const rows = this.readExcelRows(importFile.buffer);
    if (rows.length <= 1) {
      throw new BadRequestException('请上传包含表头和数据行的招聘公告 Excel 文件');
    }

    this.assertJobExcelHeaders(rows[0]);

    const errors: ImportErrorItem[] = [];
    const preparedRows: PreparedJobImportRow[] = [];
    let total = 0;

    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index];
      if (!row.some((item) => this.normalizeCellText(item))) {
        continue;
      }

      total += 1;
      const rowMap = this.toSheetRowMap(JOB_EXCEL_HEADERS, row);

      try {
        preparedRows.push({
          row: index + 1,
          data: this.adminService.buildJobCreateInput({
            companyFullName: this.readRowValue(rowMap, '企业/单位全称'),
            enterpriseNature: this.readRowValue(rowMap, '企业性质'),
            degreeRequirement: this.readRowValue(rowMap, '学历要求'),
            workLocation: this.readRowValue(rowMap, '工作地点'),
            jobName: this.readRowValue(rowMap, '岗位名称'),
            jobCategory: this.readRowValue(rowMap, '岗位类别'),
            recruitmentType: this.readRowValue(rowMap, '招聘类型'),
            deadlineAt: this.readRowDateValue(rowMap, '截止日期'),
            announcementUrl: this.readRowValue(rowMap, '公告链接'),
            deliveryUrl: this.readRowValue(rowMap, '投递链接'),
            graduationSession: this.readRowValue(rowMap, '相关专业'),
            referralCode: this.readRowValue(rowMap, '内推码'),
            announcementTitle: this.readRowValue(rowMap, '招聘公告标题'),
            industry: this.readRowValue(rowMap, '行业'),
            entryDate: this.readRowDateValue(rowMap, '录入日期'),
          }),
        });
      } catch (error) {
        errors.push({ row: index + 1, message: error instanceof Error ? error.message : '导入失败' });
      }
    }

    let success = 0;
    for (let index = 0; index < preparedRows.length; index += JOB_IMPORT_BATCH_SIZE) {
      success += await this.persistJobImportBatch(preparedRows.slice(index, index + JOB_IMPORT_BATCH_SIZE), errors);
    }

    if (success > 0) {
      clearAllJobsRecommendationCache();
    }

    return {
      total,
      success,
      failed: total - success,
      durationMs: Date.now() - startedAt,
      errors: errors.slice(0, 20),
    };
  }

  getUserTemplate() {
    return this.buildTextDownload('用户导入模板.csv', 'text/csv;charset=utf-8', `\uFEFF${stringifyCsv([
      ['手机号', '初始密码', '姓名', '毕业年份', '学历', '学校', '专业', '上级邀请码', '意向城市', '意向岗位', '意向公司', '用户状态', '来源类型'],
    ])}`);
  }

  async exportUsers(query: Record<string, string | undefined>) {
    const result = await this.adminService.getUsers({ ...query, page: '1', limit: '1000' }) as { list: Array<Record<string, any>> };

    return this.buildTextDownload('用户导出结果.csv', 'text/csv;charset=utf-8', `\uFEFF${stringifyCsv([
      ['手机号', '姓名', '邀请码', '上级手机号', '上级邀请码', '毕业年份', '学历', '学校', '专业', '意向城市', '意向岗位', '意向公司', '用户状态', '来源类型', '会员状态', '可提现余额', '注册时间', '最后登录时间'],
      ...result.list.map((item) => [
        this.readString(item.phone),
        this.readString(item.profile?.name),
        this.readString(item.inviteCode),
        this.readString(item.parentPhone),
        this.readString(item.parentInviteCode),
        this.readString(item.profile?.graduationYear),
        this.readString(item.profile?.degree),
        this.readString(item.profile?.schoolName),
        this.readString(item.profile?.major),
        this.joinArray(item.preference?.intentionCity),
        this.joinArray(item.preference?.intentionJob),
        this.joinArray(item.preference?.intentionCompany),
        this.readString(item.status),
        this.readString(item.sourceType),
        item.membership?.isActive ? '会员' : '非会员',
        this.readString(item.wallet?.availableBalance),
        this.readString(item.createdAt),
        this.readString(item.lastLoginAt),
      ]),
    ])}`);
  }

  async importUsers(csvText: string): Promise<AdminImportResponse> {
    const records = parseCsvText(csvText);
    if (records.length <= 1) {
      throw new BadRequestException('请上传包含表头和数据行的用户 CSV 文件');
    }

    const headers = records[0];
    const errors: ImportErrorItem[] = [];
    const startedAt = Date.now();
    let total = 0;
    let success = 0;

    for (let index = 1; index < records.length; index += 1) {
      const row = records[index];
      if (!row.some((item) => item.trim())) {
        continue;
      }

      total += 1;
      const rowMap = this.toCsvRowMap(headers, row);

      try {
        await this.adminService.createUser({
          phone: this.pickValue(rowMap, ['手机号', 'phone']),
          password: this.pickValue(rowMap, ['初始密码', 'password']),
          name: this.pickValue(rowMap, ['姓名', 'name']),
          graduationYear: this.pickValue(rowMap, ['毕业年份', 'graduationYear']),
          degree: this.pickValue(rowMap, ['学历', 'degree']),
          schoolName: this.pickValue(rowMap, ['学校', 'schoolName']),
          major: this.pickValue(rowMap, ['专业', 'major']),
          parentInviteCode: this.pickValue(rowMap, ['上级邀请码', 'parentInviteCode']),
          intentionCity: this.splitTags(this.pickValue(rowMap, ['意向城市', 'intentionCity'])),
          intentionJob: this.splitTags(this.pickValue(rowMap, ['意向岗位', 'intentionJob'])),
          intentionCompany: this.splitTags(this.pickValue(rowMap, ['意向公司', 'intentionCompany'])),
          status: this.pickValue(rowMap, ['用户状态', 'status']) || 'active',
          sourceType: this.pickValue(rowMap, ['来源类型', 'sourceType']) || 'admin_import',
        });
        success += 1;
      } catch (error) {
        errors.push({ row: index + 1, message: error instanceof Error ? error.message : '导入失败' });
      }
    }

    return {
      total,
      success,
      failed: errors.length,
      durationMs: Date.now() - startedAt,
      errors: errors.slice(0, 20),
    };
  }

  private async persistJobImportBatch(rows: PreparedJobImportRow[], errors: ImportErrorItem[]) {
    if (!rows.length) {
      return 0;
    }

    try {
      const result = await this.prisma.jobAnnouncement.createMany({
        data: rows.map((item) => item.data),
      });
      return result.count;
    } catch {
      let success = 0;
      for (const item of rows) {
        try {
          await this.prisma.jobAnnouncement.create({ data: item.data });
          success += 1;
        } catch (error) {
          errors.push({ row: item.row, message: error instanceof Error ? error.message : '导入失败' });
        }
      }
      return success;
    }
  }

  private buildExcelDownload(filename: string, rows: Array<Array<string | number | boolean | null | undefined>>) {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, '招聘公告');
    const content = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      filename,
      mimeType: EXCEL_MIME_TYPE,
      encoding: 'base64' as const,
      content: Buffer.from(content).toString('base64'),
    };
  }

  private buildTextDownload(filename: string, mimeType: string, content: string) {
    return {
      filename,
      mimeType,
      content,
      encoding: 'utf8' as const,
    };
  }

  private readExcelRows(fileBuffer: Buffer) {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new BadRequestException('Excel 文件中未找到工作表');
      }

      const worksheet = workbook.Sheets[firstSheetName];
      return XLSX.utils.sheet_to_json<SheetCellValue[]>(worksheet, {
        header: 1,
        raw: true,
        defval: '',
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Excel 文件解析失败，请确认文件格式为 .xlsx 或 .xls');
    }
  }

  private assertJobImportFile(file?: UploadedAdminJobFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请先选择 Excel 文件后再开始导入');
    }
    if (file.size > JOB_IMPORT_MAX_FILE_SIZE) {
      throw new BadRequestException(`Excel 文件不能超过 ${Math.round(JOB_IMPORT_MAX_FILE_SIZE / 1024 / 1024)}MB`);
    }
    if (!/\.(xlsx|xls)$/i.test(file.originalname || '')) {
      throw new BadRequestException('请上传 .xlsx 或 .xls 格式的 Excel 文件');
    }
    const normalizedMimeType = (file.mimetype || '').toLowerCase();
    if (normalizedMimeType && !JOB_IMPORT_ALLOWED_MIME_TYPES.has(normalizedMimeType)) {
      throw new BadRequestException('Excel 文件格式不受支持，请重新导出标准 .xlsx / .xls 文件后上传');
    }
  }

  private assertJobExcelHeaders(headers: SheetCellValue[]) {
    const normalizedHeaders = headers.map((item) => this.normalizeHeader(item));
    const expectedHeaders = Array.from(JOB_EXCEL_HEADERS);
    const isValid = normalizedHeaders.length >= expectedHeaders.length
      && expectedHeaders.every((header, index) => {
        const aliases = JOB_EXCEL_HEADER_ALIASES[header] ?? [header];
        return aliases.includes(normalizedHeaders[index] ?? '');
      });

    if (!isValid) {
      throw new BadRequestException(`Excel 模板列头不匹配，请严格使用系统下载模板。正确列头顺序为：${expectedHeaders.join('、')}（其中“相关专业”兼容旧列名“毕业届别”）。`);
    }
  }

  private toSheetRowMap(headers: readonly string[], row: SheetCellValue[]) {
    return new Map(headers.map((header, index) => [header, row[index]]));
  }

  private toCsvRowMap(headers: string[], row: string[]) {
    return new Map(headers.map((header, index) => [header.trim(), row[index]?.trim() ?? '']));
  }

  private readRowValue(rowMap: Map<string, SheetCellValue>, key: string) {
    return this.normalizeCellText(rowMap.get(key));
  }

  private readRowDateValue(rowMap: Map<string, SheetCellValue>, key: string) {
    try {
      return normalizeJobTextDate(rowMap.get(key), { fieldLabel: key, emptyValue: '' }) || '';
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : `${key}格式不正确`);
    }
  }

  private normalizeHeader(value: SheetCellValue) {
    return this.normalizeCellText(value).replace(/^\uFEFF/, '');
  }

  private normalizeCellText(value: SheetCellValue) {
    if (value === null || value === undefined) {
      return '';
    }
    if (value instanceof Date) {
      return formatDateOnly(value);
    }
    return String(value).trim();
  }

  private formatExcelDate(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    if (value instanceof Date) {
      return formatDateOnly(value);
    }
    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        return formatDateOnly(new Date(parsed.y, parsed.m - 1, parsed.d));
      }
      return String(value);
    }
    const normalized = String(value).trim();
    if (!normalized) {
      return '';
    }
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? normalized : formatDateOnly(date);
  }

  private pickValue(rowMap: Map<string, string>, keys: string[]) {
    for (const key of keys) {
      const value = rowMap.get(key);
      if (value !== undefined) {
        return value;
      }
    }
    return '';
  }

  private splitTags(value: string) {
    return value
      .split(/[，,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private joinArray(value: unknown) {
    return Array.isArray(value) ? value.join('，') : '';
  }

  private readString(value: unknown) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  }
}
