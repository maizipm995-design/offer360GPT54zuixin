import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../prisma.service';
import type { AdminImportResponse } from './admin-bulk.service';
import {
  NORMALIZATION_ALIAS_HEADERS,
  NORMALIZATION_ALIAS_SHEET,
  NORMALIZATION_EXCEL_MIME_TYPE,
  NORMALIZATION_IMPORT_ALLOWED_MIME_TYPES,
  NORMALIZATION_IMPORT_MAX_FILE_SIZE,
  NORMALIZATION_LOCATION_HEADERS,
  NORMALIZATION_LOCATION_SHEET,
  NORMALIZATION_TERM_HEADERS,
  NORMALIZATION_TERM_SHEET,
  NORMALIZATION_TEMPLATE_SAMPLE_ROWS,
} from './admin-normalization.constants';
import { AdminNormalizationService } from './admin-normalization.service';
import type { JobsNormalizationDomain } from '../jobs/jobs-normalization.types';

export interface UploadedNormalizationExcelFile {
  buffer: Buffer;
  size: number;
  originalname: string;
  mimetype?: string;
}

type SheetCellValue = string | number | boolean | Date | null | undefined;

type ImportErrorItem = AdminImportResponse['errors'][number];

type ParsedWorkbookSheets = {
  termsRows: SheetCellValue[][];
  aliasRows: SheetCellValue[][];
  locationRows: SheetCellValue[][];
};

@Injectable()
export class AdminNormalizationBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminNormalizationService: AdminNormalizationService,
  ) {}

  getTemplate() {
    return this.buildExcelDownload('标准化词典导入模板.xlsx', [
      {
        name: NORMALIZATION_TERM_SHEET,
        rows: [Array.from(NORMALIZATION_TERM_HEADERS), ...NORMALIZATION_TEMPLATE_SAMPLE_ROWS.terms.map((row) => [...row])],
      },
      {
        name: NORMALIZATION_ALIAS_SHEET,
        rows: [Array.from(NORMALIZATION_ALIAS_HEADERS), ...NORMALIZATION_TEMPLATE_SAMPLE_ROWS.aliases.map((row) => [...row])],
      },
      {
        name: NORMALIZATION_LOCATION_SHEET,
        rows: [Array.from(NORMALIZATION_LOCATION_HEADERS), ...NORMALIZATION_TEMPLATE_SAMPLE_ROWS.locationHierarchy.map((row) => [...row])],
      },
    ]);
  }

  async exportAll() {
    const [terms, aliases, locationHierarchies] = await Promise.all([
      this.prisma.normalizationTerm.findMany({
        orderBy: [{ domain: 'asc' }, { sortOrder: 'asc' }, { canonicalName: 'asc' }],
      }),
      this.prisma.normalizationAlias.findMany({
        include: { term: true },
        orderBy: [{ term: { domain: 'asc' } }, { term: { canonicalName: 'asc' } }, { sortOrder: 'asc' }, { aliasName: 'asc' }],
      }),
      this.prisma.locationHierarchy.findMany({
        include: { provinceTerm: true, cityTerm: true },
        orderBy: [{ provinceTerm: { canonicalName: 'asc' } }, { cityTerm: { canonicalName: 'asc' } }],
      }),
    ]);

    return this.buildExcelDownload('标准化词典全量导出.xlsx', [
      {
        name: NORMALIZATION_TERM_SHEET,
        rows: [
          Array.from(NORMALIZATION_TERM_HEADERS),
          ...terms.map((item) => [
            item.domain,
            item.canonicalName,
            item.canonicalCode ?? '',
            item.level ?? '',
            item.status,
            item.sortOrder,
            item.metadata ? JSON.stringify(item.metadata) : '',
          ]),
        ],
      },
      {
        name: NORMALIZATION_ALIAS_SHEET,
        rows: [
          Array.from(NORMALIZATION_ALIAS_HEADERS),
          ...aliases.map((item) => [
            item.term.domain,
            item.term.canonicalName,
            item.aliasName,
            item.matchMode,
            item.status,
            item.source ?? '',
            item.sortOrder,
          ]),
        ],
      },
      {
        name: NORMALIZATION_LOCATION_SHEET,
        rows: [
          Array.from(NORMALIZATION_LOCATION_HEADERS),
          ...locationHierarchies.map((item) => [
            item.provinceTerm.canonicalName,
            item.cityTerm.canonicalName,
            item.status,
          ]),
        ],
      },
    ]);
  }

  async importAll(file?: UploadedNormalizationExcelFile): Promise<AdminImportResponse> {
    const startedAt = Date.now();
    this.assertImportFile(file);
    const workbook = this.readWorkbook(file as UploadedNormalizationExcelFile);

    const errors: ImportErrorItem[] = [];
    let total = 0;
    let success = 0;

    total += this.countNonEmptyRows(workbook.termsRows);
    total += this.countNonEmptyRows(workbook.aliasRows);
    total += this.countNonEmptyRows(workbook.locationRows);

    success += await this.importTermRows(workbook.termsRows, errors);
    success += await this.importAliasRows(workbook.aliasRows, errors);
    success += await this.importLocationRows(workbook.locationRows, errors);

    if (success > 0) {
      await this.adminNormalizationService.refreshCaches();
    }

    return {
      total,
      success,
      failed: total - success,
      durationMs: Date.now() - startedAt,
      errors: errors.slice(0, 20),
    };
  }

  private async importTermRows(rows: SheetCellValue[][], errors: ImportErrorItem[]) {
    let success = 0;
    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index];
      if (!this.hasRowValue(row)) {
        continue;
      }
      const rowMap = this.toSheetRowMap(NORMALIZATION_TERM_HEADERS, row);
      try {
        await this.adminNormalizationService.upsertTermByImport({
          domain: this.readRequiredCell(rowMap, 'domain') as JobsNormalizationDomain,
          canonicalName: this.readRequiredCell(rowMap, 'canonicalName'),
          canonicalCode: this.readOptionalCell(rowMap, 'canonicalCode'),
          level: this.readOptionalLevel(rowMap, 'level'),
          status: this.readOptionalStatus(rowMap, 'status'),
          sortOrder: this.readOptionalNumber(rowMap, 'sortOrder'),
          metadata: this.readOptionalJsonObject(rowMap, 'metadataJson'),
        }, { skipCacheRefresh: true });
        success += 1;
      } catch (error) {
        errors.push({ row: index + 1, message: `terms：${error instanceof Error ? error.message : '导入失败'}` });
      }
    }
    return success;
  }

  private async importAliasRows(rows: SheetCellValue[][], errors: ImportErrorItem[]) {
    let success = 0;
    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index];
      if (!this.hasRowValue(row)) {
        continue;
      }
      const rowMap = this.toSheetRowMap(NORMALIZATION_ALIAS_HEADERS, row);
      try {
        await this.adminNormalizationService.upsertAliasByImport({
          domain: this.readRequiredCell(rowMap, 'domain') as JobsNormalizationDomain,
          canonicalName: this.readRequiredCell(rowMap, 'canonicalName'),
          aliasName: this.readRequiredCell(rowMap, 'aliasName'),
          matchMode: this.readOptionalMatchMode(rowMap, 'matchMode'),
          status: this.readOptionalStatus(rowMap, 'status'),
          source: this.readOptionalCell(rowMap, 'source'),
          sortOrder: this.readOptionalNumber(rowMap, 'sortOrder'),
        }, { skipCacheRefresh: true });
        success += 1;
      } catch (error) {
        errors.push({ row: index + 1, message: `aliases：${error instanceof Error ? error.message : '导入失败'}` });
      }
    }
    return success;
  }

  private async importLocationRows(rows: SheetCellValue[][], errors: ImportErrorItem[]) {
    let success = 0;
    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index];
      if (!this.hasRowValue(row)) {
        continue;
      }
      const rowMap = this.toSheetRowMap(NORMALIZATION_LOCATION_HEADERS, row);
      try {
        await this.adminNormalizationService.upsertLocationHierarchyByImport({
          provinceCanonicalName: this.readRequiredCell(rowMap, 'provinceCanonicalName'),
          cityCanonicalName: this.readRequiredCell(rowMap, 'cityCanonicalName'),
          status: this.readOptionalStatus(rowMap, 'status'),
        }, { skipCacheRefresh: true });
        success += 1;
      } catch (error) {
        errors.push({ row: index + 1, message: `location_hierarchy：${error instanceof Error ? error.message : '导入失败'}` });
      }
    }
    return success;
  }

  private readWorkbook(file: UploadedNormalizationExcelFile): ParsedWorkbookSheets {
    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
      const termsRows = this.readSheetRows(workbook, NORMALIZATION_TERM_SHEET, NORMALIZATION_TERM_HEADERS);
      const aliasRows = this.readSheetRows(workbook, NORMALIZATION_ALIAS_SHEET, NORMALIZATION_ALIAS_HEADERS);
      const locationRows = this.readSheetRows(workbook, NORMALIZATION_LOCATION_SHEET, NORMALIZATION_LOCATION_HEADERS);
      return { termsRows, aliasRows, locationRows };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Excel 文件解析失败，请确认文件格式为 .xlsx 或 .xls');
    }
  }

  private readSheetRows(
    workbook: XLSX.WorkBook,
    sheetName: string,
    headers: readonly string[],
  ) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new BadRequestException(`Excel 中缺少工作表：${sheetName}`);
    }
    const rows = XLSX.utils.sheet_to_json<SheetCellValue[]>(worksheet, {
      header: 1,
      raw: true,
      defval: '',
    });
    if (!rows.length) {
      throw new BadRequestException(`工作表 ${sheetName} 不能为空`);
    }
    this.assertSheetHeaders(rows[0], headers, sheetName);
    return rows;
  }

  private assertImportFile(file?: UploadedNormalizationExcelFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请先选择 Excel 文件后再开始导入');
    }
    if (file.size > NORMALIZATION_IMPORT_MAX_FILE_SIZE) {
      throw new BadRequestException(`Excel 文件不能超过 ${Math.round(NORMALIZATION_IMPORT_MAX_FILE_SIZE / 1024 / 1024)}MB`);
    }
    if (!/\.(xlsx|xls)$/i.test(file.originalname || '')) {
      throw new BadRequestException('请上传 .xlsx 或 .xls 格式的 Excel 文件');
    }
    const normalizedMimeType = (file.mimetype || '').toLowerCase();
    if (normalizedMimeType && !NORMALIZATION_IMPORT_ALLOWED_MIME_TYPES.has(normalizedMimeType)) {
      throw new BadRequestException('Excel 文件格式不受支持，请重新导出标准 .xlsx / .xls 文件后上传');
    }
  }

  private assertSheetHeaders(headers: SheetCellValue[], expectedHeaders: readonly string[], sheetName: string) {
    const normalizedHeaders = headers.map((item) => this.normalizeCellText(item).replace(/^\uFEFF/, ''));
    const isValid = normalizedHeaders.length >= expectedHeaders.length
      && expectedHeaders.every((header, index) => normalizedHeaders[index] === header);
    if (!isValid) {
      throw new BadRequestException(`工作表 ${sheetName} 的列头不匹配，请严格使用系统模板`);
    }
  }

  private buildExcelDownload(
    filename: string,
    sheets: Array<{ name: string; rows: Array<Array<string | number | boolean | null | undefined>> }>,
  ) {
    const workbook = XLSX.utils.book_new();
    sheets.forEach((sheet) => {
      const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
    });
    const content = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return {
      filename,
      mimeType: NORMALIZATION_EXCEL_MIME_TYPE,
      encoding: 'base64' as const,
      content: Buffer.from(content).toString('base64'),
    };
  }

  private toSheetRowMap(headers: readonly string[], row: SheetCellValue[]) {
    return new Map(headers.map((header, index) => [header, row[index]]));
  }

  private countNonEmptyRows(rows: SheetCellValue[][]) {
    return rows.slice(1).filter((row) => this.hasRowValue(row)).length;
  }

  private hasRowValue(row: SheetCellValue[]) {
    return row.some((item) => this.normalizeCellText(item));
  }

  private readRequiredCell(rowMap: Map<string, SheetCellValue>, key: string) {
    const value = this.normalizeCellText(rowMap.get(key));
    if (!value) {
      throw new BadRequestException(`${key} 不能为空`);
    }
    return value;
  }

  private readOptionalCell(rowMap: Map<string, SheetCellValue>, key: string) {
    return this.normalizeCellText(rowMap.get(key));
  }

  private readOptionalNumber(rowMap: Map<string, SheetCellValue>, key: string) {
    const value = this.readOptionalCell(rowMap, key);
    if (!value) {
      return undefined;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(`${key} 必须是数字`);
    }
    return Math.trunc(parsed);
  }

  private readOptionalStatus(rowMap: Map<string, SheetCellValue>, key: string) {
    const value = this.readOptionalCell(rowMap, key);
    return value ? (value as 'active' | 'inactive') : undefined;
  }

  private readOptionalLevel(rowMap: Map<string, SheetCellValue>, key: string) {
    const value = this.readOptionalCell(rowMap, key);
    return value ? (value as 'province' | 'city') : undefined;
  }

  private readOptionalMatchMode(rowMap: Map<string, SheetCellValue>, key: string) {
    const value = this.readOptionalCell(rowMap, key);
    return value ? (value as 'exact' | 'contains') : undefined;
  }

  private readOptionalJsonObject(rowMap: Map<string, SheetCellValue>, key: string) {
    const value = this.readOptionalCell(rowMap, key);
    if (!value) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new BadRequestException(`${key} 仅支持 JSON 对象`);
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`${key} 必须是合法 JSON`);
    }
  }

  private normalizeCellText(value: SheetCellValue) {
    if (value === null || value === undefined) {
      return '';
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value).trim();
  }
}
