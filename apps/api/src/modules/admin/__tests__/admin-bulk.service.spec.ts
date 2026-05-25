import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { AdminBulkService } from '../admin-bulk.service';
import { AdminService } from '../admin.service';

function createWorkbookBuffer(rows: Array<Array<string | number>>) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, '招聘公告');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function createService() {
  const prisma = {
    jobAnnouncement: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn(),
    },
  };
  const adminService = new AdminService({} as never, {} as never, {} as never, {} as never);
  const service = new AdminBulkService(prisma as never, adminService);

  return { prisma, service };
}

describe('AdminBulkService jobs import', () => {
  it('支持乱序表头、额外列，并按表头智能匹配到新字段结构', async () => {
    const { service, prisma } = createService();
    const buffer = createWorkbookBuffer([
      ['额外字段', '专业需求', '企业/单位全称', '毕业届别', '岗位名称'],
      ['忽略我', '计算机类、软件工程', '示例科技有限公司', '2026届', '后端工程师'],
    ]);

    const result = await service.importJobs({
      buffer,
      size: buffer.length,
      originalname: 'jobs.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    expect(result.success).toBe(1);
    expect(prisma.jobAnnouncement.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.jobAnnouncement.createMany.mock.calls[0]?.[0]).toMatchObject({
      data: [
        expect.objectContaining({
          companyFullName: '示例科技有限公司',
          majorRequirement: '计算机类、软件工程',
          graduationSession: '2026届',
          jobName: '后端工程师',
        }),
      ],
    });
  });

  it('缺少必填列头时直接阻断导入并返回清晰提示', async () => {
    const { service } = createService();
    const buffer = createWorkbookBuffer([
      ['岗位名称', '专业需求', '毕业届别'],
      ['后端工程师', '计算机类', '2026届'],
    ]);

    await expect(service.importJobs({
      buffer,
      size: buffer.length,
      originalname: 'jobs.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })).rejects.toThrow('Excel 缺少必填列头：企业/单位全称');
  });
});
