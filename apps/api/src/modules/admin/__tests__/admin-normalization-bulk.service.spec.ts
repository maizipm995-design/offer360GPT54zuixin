import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { AdminNormalizationBulkService } from '../admin-normalization-bulk.service';

function createWorkbookBuffer() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['domain', 'canonicalName', 'canonicalCode', 'level', 'status', 'sortOrder', 'metadataJson'],
    ['LOCATION', '山东', 'CN-SD', 'province', 'active', 10, ''],
  ]), 'terms');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['domain', 'canonicalName', 'aliasName', 'matchMode', 'status', 'source', 'sortOrder'],
    ['LOCATION', '山东', '山东省', 'exact', 'active', 'import', 10],
  ]), 'aliases');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['provinceCanonicalName', 'cityCanonicalName', 'status'],
    ['山东', '济南', 'active'],
  ]), 'location_hierarchy');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('AdminNormalizationBulkService', () => {
  it('会按三张 Sheet 顺序导入并在最后统一刷新缓存', async () => {
    const prisma = {};
    const adminNormalizationService = {
      upsertTermByImport: vi.fn().mockResolvedValue({ id: 'term-1' }),
      upsertAliasByImport: vi.fn().mockResolvedValue({ id: 'alias-1' }),
      upsertLocationHierarchyByImport: vi.fn().mockResolvedValue({ id: 'hierarchy-1' }),
      refreshCaches: vi.fn().mockResolvedValue(undefined),
    };
    const service = new AdminNormalizationBulkService(prisma as never, adminNormalizationService as never);

    const result = await service.importAll({
      buffer: createWorkbookBuffer(),
      size: 1024,
      originalname: 'normalization.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    expect(result.total).toBe(3);
    expect(result.success).toBe(3);
    expect(result.failed).toBe(0);
    expect(adminNormalizationService.upsertTermByImport).toHaveBeenCalledWith(expect.any(Object), { skipCacheRefresh: true });
    expect(adminNormalizationService.upsertAliasByImport).toHaveBeenCalledWith(expect.any(Object), { skipCacheRefresh: true });
    expect(adminNormalizationService.upsertLocationHierarchyByImport).toHaveBeenCalledWith(expect.any(Object), { skipCacheRefresh: true });
    expect(adminNormalizationService.refreshCaches).toHaveBeenCalledTimes(1);
  });

  it('模板列头错误时会直接阻断导入', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['badHeader'],
    ]), 'terms');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['domain', 'canonicalName', 'aliasName', 'matchMode', 'status', 'source', 'sortOrder'],
    ]), 'aliases');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['provinceCanonicalName', 'cityCanonicalName', 'status'],
    ]), 'location_hierarchy');

    const service = new AdminNormalizationBulkService({} as never, {
      upsertTermByImport: vi.fn(),
      upsertAliasByImport: vi.fn(),
      upsertLocationHierarchyByImport: vi.fn(),
      refreshCaches: vi.fn(),
    } as never);

    await expect(service.importAll({
      buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
      size: 512,
      originalname: 'bad.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })).rejects.toThrow('工作表 terms 的列头不匹配');
  });

  it('metadataJson 不是对象时会记录导入错误', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['domain', 'canonicalName', 'canonicalCode', 'level', 'status', 'sortOrder', 'metadataJson'],
      ['JOB_TITLE', '软件开发', 'job-dev', '', 'active', 10, '[]'],
    ]), 'terms');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['domain', 'canonicalName', 'aliasName', 'matchMode', 'status', 'source', 'sortOrder'],
    ]), 'aliases');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['provinceCanonicalName', 'cityCanonicalName', 'status'],
    ]), 'location_hierarchy');

    const adminNormalizationService = {
      upsertTermByImport: vi.fn(),
      upsertAliasByImport: vi.fn(),
      upsertLocationHierarchyByImport: vi.fn(),
      refreshCaches: vi.fn(),
    };
    const service = new AdminNormalizationBulkService({} as never, adminNormalizationService as never);

    const result = await service.importAll({
      buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
      size: 512,
      originalname: 'bad-metadata.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    expect(result.total).toBe(1);
    expect(result.success).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0]?.message).toContain('metadataJson 仅支持 JSON 对象');
    expect(adminNormalizationService.upsertTermByImport).not.toHaveBeenCalled();
    expect(adminNormalizationService.refreshCaches).not.toHaveBeenCalled();
  });
});
