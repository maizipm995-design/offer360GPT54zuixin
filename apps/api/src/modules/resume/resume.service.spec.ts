import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResumeService } from './resume.service';

const getUserMemberAccess = vi.fn();
const defaultTemplateConfigRows = [
  { templateCode: 'style-a', styleJson: {} },
  { templateCode: 'style-b', styleJson: {} },
  { templateCode: 'style-c', styleJson: {} },
  { templateCode: 'global-vertical-spacing', styleJson: { verticalSpacing: { bodyTextLineHeightPt: 20 } } },
];

vi.mock('../../common/utils/member-access', () => ({
  getUserMemberAccess: (...args: unknown[]) => getUserMemberAccess(...args),
}));

describe('ResumeService', () => {
  beforeEach(() => {
    getUserMemberAccess.mockReset();
    getUserMemberAccess.mockResolvedValue({
      memberRoleCode: 'FREE_USER',
      memberRoleName: '普通用户',
    });
  });

  it('新建草稿时会写入新的默认样式结构', async () => {
    const prisma = {
      resumeTemplateConfig: {
        findMany: vi.fn().mockResolvedValue(defaultTemplateConfigRows),
      },
      resumeDraft: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'draft-1',
          ...data,
        })),
      },
    };
    const service = new ResumeService(prisma as never, {} as never, {} as never);

    const result = await service.create('user-1', {});

    expect(prisma.resumeDraft.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        title: '我的简历',
        templateCode: 'style-a',
        styleJson: expect.objectContaining({
          templateCode: 'style-a',
          spacingScale: 1,
          lineHeight: 20,
          verticalSpacing: expect.objectContaining({
            bodyTextLineHeightPt: 20,
            listItemGapPt: 2,
          }),
        }),
      }),
    });
    expect(result.templateCode).toBe('style-a');
    expect(result.styleJson).toMatchObject({
      spacingScale: 1,
      lineHeight: 20,
      verticalSpacing: {
        bodyTextLineHeightPt: 20,
        pagePaddingTopPt: 50,
      },
    });
  });

  it('读取老草稿详情时会补齐 verticalSpacing 与 spacingScale', async () => {
    const prisma = {
      resumeTemplateConfig: {
        findMany: vi.fn().mockResolvedValue(defaultTemplateConfigRows),
      },
      resumeDraft: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'draft-legacy',
          userId: 'user-1',
          title: '旧简历',
          templateCode: 'classic',
          status: 'draft',
          contentJson: {},
          styleJson: {
            lineHeight: 18,
            pageMargin: 11,
          },
          layoutJson: [],
        }),
      },
    };
    const service = new ResumeService(prisma as never, {} as never, {} as never);

    const result = await service.getDetail('user-1', 'draft-legacy');

    expect(result.templateCode).toBe('style-a');
    expect(result.styleJson).toMatchObject({
      spacingScale: 1,
      lineHeight: 20,
      sectionSpacing: 20,
      itemSpacing: 20,
      pageMargin: 11,
      verticalSpacing: {
        bodyTextLineHeightPt: 20,
        sectionTitleToDividerPt: 3,
        headerPaddingBottomPt: 40,
      },
    });
  });

  it('更新草稿时会把旧字段样式归一化后再存储', async () => {
    const prisma = {
      resumeTemplateConfig: {
        findMany: vi.fn().mockResolvedValue(defaultTemplateConfigRows),
      },
      resumeDraft: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'draft-2',
          userId: 'user-1',
          title: '我的简历',
          templateCode: 'style-a',
          status: 'draft',
          contentJson: {},
          styleJson: {},
          layoutJson: [],
        }),
        update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'draft-2',
          userId: 'user-1',
          title: '我的简历',
          templateCode: 'style-a',
          status: 'draft',
          contentJson: {},
          styleJson: data.styleJson,
          layoutJson: [],
        })),
      },
    };
    const service = new ResumeService(prisma as never, {} as never, {} as never);

    const result = await service.update('user-1', 'draft-2', {
      styleJson: {
        spacingScale: 1.1,
        verticalSpacing: {
          bodyTextLineHeightPt: 21,
          listItemGapPt: 4,
        },
      },
    });

    expect(prisma.resumeDraft.update).toHaveBeenCalledWith({
      where: { id: 'draft-2' },
      data: expect.objectContaining({
        styleJson: expect.objectContaining({
          spacingScale: 1.1,
          lineHeight: 23.1,
          sectionSpacing: 23.1,
          itemSpacing: 23.1,
          verticalSpacing: expect.objectContaining({
            bodyTextLineHeightPt: 21,
            listItemGapPt: 4,
            paragraphGapPt: 2,
          }),
        }),
      }),
    });
    expect(result.styleJson).toMatchObject({
      spacingScale: 1.1,
      lineHeight: 23.1,
      verticalSpacing: {
        bodyTextLineHeightPt: 21,
        listItemGapPt: 4,
      },
    });
  });

  it('只有旧 lineHeight 的历史草稿会回落到全局垂直基准', async () => {
    const prisma = {
      resumeTemplateConfig: {
        findMany: vi.fn().mockResolvedValue(defaultTemplateConfigRows),
      },
      resumeDraft: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'draft-legacy-line-height-only',
          userId: 'user-1',
          title: '旧简历',
          templateCode: 'style-b',
          status: 'draft',
          contentJson: {},
          styleJson: {
            lineHeight: 18,
          },
          layoutJson: [],
        }),
      },
    };
    const service = new ResumeService(prisma as never, {} as never, {} as never);

    const result = await service.getDetail('user-1', 'draft-legacy-line-height-only');

    expect(result.styleJson.lineHeight).toBe(20);
    expect(result.styleJson.verticalSpacing.bodyTextLineHeightPt).toBe(20);
  });
});
