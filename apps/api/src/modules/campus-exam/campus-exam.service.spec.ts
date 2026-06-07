import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { CampusExamService } from './campus-exam.service';

function createService(prisma: Record<string, unknown> = {}) {
  return new CampusExamService(prisma as never, {} as never, {} as never, {} as never);
}

describe('CampusExamService question rules', () => {
  it('多选题按题目选项数生成 2~4 个的选择约束', () => {
    const service = createService() as any;

    const rule = service.buildQuestionInteractionRule({
      questionType: 2,
      optionsJson: [
        { key: 'A', label: 'A', value: '1' },
        { key: 'B', label: 'B', value: '2' },
        { key: 'C', label: 'C', value: '3' },
        { key: 'D', label: 'D', value: '4' },
        { key: 'E', label: 'E', value: '5' },
      ],
      answerJson: { type: 'multiple', values: ['A', 'B'] },
    });

    expect(rule.minSelectionCount).toBe(2);
    expect(rule.maxSelectionCount).toBe(4);
  });

  it('判断题能把 A/B 选项值收敛成 true/false 判分值', () => {
    const service = createService() as any;

    const answer = service.sanitizePracticeUserAnswer(
      3,
      { type: 'judge', values: ['A'] },
      [
        { key: 'A', label: 'A', value: '正确' },
        { key: 'B', label: 'B', value: '错误' },
      ],
    );

    expect(answer.values).toEqual(['true']);
  });

  it('服务端会拦截只选 1 个选项的多选题提交', () => {
    const service = createService() as any;
    const rule = service.buildQuestionInteractionRule({
      questionType: 2,
      optionsJson: [
        { key: 'A', label: 'A', value: '1' },
        { key: 'B', label: 'B', value: '2' },
        { key: 'C', label: 'C', value: '3' },
      ],
      answerJson: { type: 'multiple', values: ['A', 'B'] },
    });

    expect(() => service.assertPracticeAnswerValid(
      2,
      { type: 'multiple', values: ['A'] },
      rule,
      [
        { key: 'A', label: 'A', value: '1' },
        { key: 'B', label: 'B', value: '2' },
        { key: 'C', label: 'C', value: '3' },
      ],
    )).toThrow(BadRequestException);
  });

  it('允许下一题默认提交未完成的多选题作答内容', () => {
    const service = createService() as any;
    const rule = service.buildQuestionInteractionRule({
      questionType: 2,
      optionsJson: [
        { key: 'A', label: 'A', value: '1' },
        { key: 'B', label: 'B', value: '2' },
        { key: 'C', label: 'C', value: '3' },
      ],
      answerJson: { type: 'multiple', values: ['A', 'B'] },
    });

    expect(() => service.assertPracticeAnswerValid(
      2,
      { type: 'multiple', values: ['A'] },
      rule,
      [
        { key: 'A', label: 'A', value: '1' },
        { key: 'B', label: 'B', value: '2' },
        { key: 'C', label: 'C', value: '3' },
      ],
      { allowIncompleteSubmit: true },
    )).not.toThrow();
  });

  it('允许下一题默认提交未填完的多项填空内容', () => {
    const service = createService() as any;
    const rule = service.buildQuestionInteractionRule({
      questionType: 5,
      optionsJson: null,
      answerJson: { type: 'blank_multiple', values: ['答案1', '答案2'] },
    });

    expect(() => service.assertPracticeAnswerValid(
      5,
      { type: 'blank_multiple', values: ['答案1', ''] },
      rule,
      null,
      { allowIncompleteSubmit: true },
    )).not.toThrow();
  });

  it('练习会话答完全部题目后会标记为 completed', () => {
    const service = createService() as any;

    expect(service.resolvePracticeSessionStatus(3, 3)).toBe('completed');
    expect(service.resolvePracticeSessionStatus(2, 3)).toBe('ongoing');
  });

  it('顺序练习会优先按导入行号保留题目固有顺序', () => {
    const service = createService() as any;
    const questions = [
      { id: 'q3', sourceRowNo: 3, createdAt: new Date('2026-05-01T00:00:03Z') },
      { id: 'q1', sourceRowNo: 1, createdAt: new Date('2026-05-01T00:00:01Z') },
      { id: 'q2', sourceRowNo: 2, createdAt: new Date('2026-05-01T00:00:02Z') },
    ];

    const ordered = [...questions].sort((left, right) => service.comparePracticeQuestionSequence(left, right));

    expect(ordered.map((item) => item.id)).toEqual(['q1', 'q2', 'q3']);
  });

  it('顺序练习在没有导入行号时回退到创建时间排序', () => {
    const service = createService() as any;
    const questions = [
      { id: 'q2', sourceRowNo: null, createdAt: new Date('2026-05-01T00:00:02Z') },
      { id: 'q1', sourceRowNo: null, createdAt: new Date('2026-05-01T00:00:01Z') },
    ];

    const ordered = [...questions].sort((left, right) => service.comparePracticeQuestionSequence(left, right));

    expect(ordered.map((item) => item.id)).toEqual(['q1', 'q2']);
  });

  it('错题顺序练习会按分类、专项与题目固有顺序生成题目序列', async () => {
    const service = createService({
      campusExamWrongQuestion: {
        findMany: async () => ([
          {
            question: {
              id: 'q-3',
              sourceRowNo: 2,
              createdAt: new Date('2026-05-02T00:00:03Z'),
              special: {
                sortOrder: 2,
                createdAt: new Date('2026-05-02T00:00:00Z'),
                category: {
                  sortOrder: 1,
                  createdAt: new Date('2026-05-01T00:00:00Z'),
                },
              },
            },
          },
          {
            question: {
              id: 'q-1',
              sourceRowNo: 1,
              createdAt: new Date('2026-05-02T00:00:01Z'),
              special: {
                sortOrder: 1,
                createdAt: new Date('2026-05-01T00:00:00Z'),
                category: {
                  sortOrder: 1,
                  createdAt: new Date('2026-05-01T00:00:00Z'),
                },
              },
            },
          },
          {
            question: {
              id: 'q-2',
              sourceRowNo: 3,
              createdAt: new Date('2026-05-02T00:00:02Z'),
              special: {
                sortOrder: 1,
                createdAt: new Date('2026-05-01T00:00:00Z'),
                category: {
                  sortOrder: 2,
                  createdAt: new Date('2026-05-03T00:00:00Z'),
                },
              },
            },
          },
        ]),
      },
    });

    await expect((service as any).buildPracticeSessionSeed('user-1', 'wrong_practice', {})).resolves.toMatchObject({
      title: '错题顺序练习',
      questionOrder: ['q-1', 'q-3', 'q-2'],
    });
  });

  it('收藏顺序练习会按收藏题库内的题目顺序生成题目序列', async () => {
    const service = createService({
      campusExamFavorite: {
        findMany: async () => ([
          {
            question: {
              id: 'q-2',
              sourceRowNo: 2,
              createdAt: new Date('2026-05-01T00:00:02Z'),
              special: {
                sortOrder: 1,
                createdAt: new Date('2026-05-01T00:00:00Z'),
                category: {
                  sortOrder: 1,
                  createdAt: new Date('2026-05-01T00:00:00Z'),
                },
              },
            },
          },
          {
            question: {
              id: 'q-1',
              sourceRowNo: 1,
              createdAt: new Date('2026-05-01T00:00:01Z'),
              special: {
                sortOrder: 1,
                createdAt: new Date('2026-05-01T00:00:00Z'),
                category: {
                  sortOrder: 1,
                  createdAt: new Date('2026-05-01T00:00:00Z'),
                },
              },
            },
          },
        ]),
      },
    });

    await expect((service as any).buildPracticeSessionSeed('user-1', 'favorite_practice', {})).resolves.toMatchObject({
      title: '收藏顺序练习',
      questionOrder: ['q-1', 'q-2'],
    });
  });

  it('导入模板导出的 12 个字段名与顺序必须完全固定', () => {
    const service = createService() as any;
    const payload = service.getImportTemplate();
    const workbook = XLSX.read(Buffer.from(payload.content, 'base64'), { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, blankrows: false }) as string[][];

    expect(payload.filename).toBe('校招笔试题库导入模板.xlsx');
    expect(rows[0]).toEqual([
      '题目(必填)',
      '题型（必填）：1单选 2多选 3判断 4单项填空 5多项填空 6简答（填写对应的数字）',
      '题目类型（必填）（1:文字 2:图片 ）（填写对应的数字）',
      '分类专项id （必填）（管理后台分类专项id，对应题库分类，请勿填错）',
      '难度（必填）（填写1-5）',
      '是否高频错题（必填）（0:否 1：是）（填写对应的数字）',
      '选项（必填）（用英文分号;隔开。例如：选项1;选项2;选项3;选项4）',
      '选项类型（必填）（1：文字 2：图片）（填写对应的数字）',
      '答案（必填）(选择题答案为大写英文字母，填空题，简答题答案为中文)',
      '题目解析（选填）',
      '题目图片链接（选填）',
      '解析图片链接（选填）',
    ]);
  });

  it('表头不会再接受别名，必须与模板字段名完全一致', () => {
    const service = createService() as any;
    const result = service.resolveImportHeaderMap([
      '题目',
      '题型（必填）：1单选 2多选 3判断 4单项填空 5多项填空 6简答（填写对应的数字）',
      '题目类型（必填）（1:文字 2:图片 ）（填写对应的数字）',
      '分类专项id （必填）（管理后台分类专项id，对应题库分类，请勿填错）',
      '难度（必填）（填写1-5）',
      '是否高频错题（必填）（0:否 1：是）（填写对应的数字）',
      '选项（必填）（用英文分号;隔开。例如：选项1;选项2;选项3;选项4）',
      '选项类型（必填）（1：文字 2：图片）（填写对应的数字）',
      '答案（必填）(选择题答案为大写英文字母，填空题，简答题答案为中文)',
      '题目解析（选填）',
      '题目图片链接（选填）',
      '解析图片链接（选填）',
    ]);

    expect(result.missingRequired).toContain('题目(必填)');
    expect(result.unexpectedHeaders).toEqual([{ columnNo: 1, header: '题目' }]);
  });

  it('文件夹批量导入时允许 Excel 不再提供分类专项id 列', () => {
    const service = createService() as any;
    const result = service.resolveImportHeaderMap([
      '题目(必填)',
      '题型（必填）：1单选 2多选 3判断 4单项填空 5多项填空 6简答（填写对应的数字）',
      '题目类型（必填）（1:文字 2:图片 ）（填写对应的数字）',
      '难度（必填）（填写1-5）',
      '是否高频错题（必填）（0:否 1：是）（填写对应的数字）',
      '选项（必填）（用英文分号;隔开。例如：选项1;选项2;选项3;选项4）',
      '选项类型（必填）（1：文字 2：图片）（填写对应的数字）',
      '答案（必填）(选择题答案为大写英文字母，填空题，简答题答案为中文)',
      '题目解析（选填）',
      '题目图片链接（选填）',
      '解析图片链接（选填）',
    ], { requireSpecialId: false });

    expect(result.missingRequired).toEqual([]);
    expect(result.unexpectedHeaders).toEqual([]);
    expect(result.positionMismatches).toEqual([]);
  });

  it('文件夹批量导入时也兼容包含分类专项id列的旧模板', () => {
    const service = createService() as any;
    const result = service.resolveImportHeaderMap([
      '题目(必填)',
      '题型（必填）：1单选 2多选 3判断 4单项填空 5多项填空 6简答（填写对应的数字）',
      '题目类型（必填）（1:文字 2:图片 ）（填写对应的数字）',
      '分类专项id （必填）（管理后台分类专项id，对应题库分类，请勿填错）',
      '难度（必填）（填写1-5）',
      '是否高频错题（必填）（0:否 1：是）（填写对应的数字）',
      '选项（必填）（用英文分号;隔开。例如：选项1;选项2;选项3;选项4）',
      '选项类型（必填）（1：文字 2：图片）（填写对应的数字）',
      '答案（必填）(选择题答案为大写英文字母，填空题，简答题答案为中文)',
      '题目解析（选填）',
      '题目图片链接（选填）',
      '解析图片链接（选填）',
    ], { requireSpecialId: false });

    expect(result.missingRequired).toEqual([]);
    expect(result.unexpectedHeaders).toEqual([]);
    expect(result.positionMismatches).toEqual([]);
  });

  it('单文件上传预览时会忽略 Excel 内填写的分类专项id，并统一绑定当前所选专项', () => {
    const service = createService() as any;
    const headerResult = service.resolveImportHeaderMap([
      '题目(必填)',
      '题型（必填）：1单选 2多选 3判断 4单项填空 5多项填空 6简答（填写对应的数字）',
      '题目类型（必填）（1:文字 2:图片 ）（填写对应的数字）',
      '分类专项id （必填）（管理后台分类专项id，对应题库分类，请勿填错）',
      '难度（必填）（填写1-5）',
      '是否高频错题（必填）（0:否 1：是）（填写对应的数字）',
      '选项（必填）（用英文分号;隔开。例如：选项1;选项2;选项3;选项4）',
      '选项类型（必填）（1：文字 2：图片）（填写对应的数字）',
      '答案（必填）(选择题答案为大写英文字母，填空题，简答题答案为中文)',
      '题目解析（选填）',
      '题目图片链接（选填）',
      '解析图片链接（选填）',
    ], { requireSpecialId: false });

    const row = service.normalizeImportRow([
      '判断题题干',
      '3',
      '1',
      '999999',
      '3',
      '0',
      '',
      '1',
      '正确',
      '',
      '',
      '',
    ], headerResult.map, 108, 2, { validateSpecialId: false });

    expect(row.specialId).toBe(108);
  });

  it('创建二级分类时会自动分配内部ID与随机专项业务ID', async () => {
    const service = createService({
      campusExamCategory: {
        findUnique: async () => ({ id: 'cat-1' }),
      },
      campusExamSpecial: {
        aggregate: async () => ({ _max: { id: 27 } }),
        findUnique: async ({ where }: { where: { id?: number; specialCode?: string } }) => {
          if (where.specialCode) {
            return null;
          }
          return null;
        },
        create: async ({ data }: { data: Record<string, unknown> }) => data,
      },
    });

    await expect((service as any).createAdminSpecial({
      categoryId: 'cat-1',
      name: '计算机网络',
      sortOrder: 2,
      status: 'active',
    })).resolves.toMatchObject({
      id: 28,
      categoryId: 'cat-1',
      name: '计算机网络',
      sortOrder: 2,
      status: 'active',
      specialCode: expect.stringMatching(/^SP[A-Z0-9]{12}$/),
    });
  });

  it('文件夹批量上传仅接受一级目录下的 Excel 文件', () => {
    const service = createService() as any;

    expect(() => service.normalizeCategoryFolderUpload(
      [{
        buffer: Buffer.from('1'),
        size: 1,
        originalname: 'test.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }],
      ['前端题库/React/test.xlsx'],
    )).toThrow(BadRequestException);

    const result = service.normalizeCategoryFolderUpload(
      [{
        buffer: Buffer.from('1'),
        size: 1,
        originalname: 'React.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }],
      ['前端题库/React.xlsx'],
    );

    expect(result).toMatchObject({
      totalFileCount: 1,
      folderName: '前端题库',
      skippedFiles: [],
      validFiles: [{
        relativePath: '前端题库/React.xlsx',
        folderName: '前端题库',
        fileName: 'React.xlsx',
        specialName: 'React',
      }],
    });
  });
});

describe('CampusExamService delete actions', () => {
  it('删除一级分类时返回级联删除统计', async () => {
    const deleteMock = async () => ({ id: 'cat-1' });
    const service = createService({
      campusExamCategory: {
        findUnique: async () => ({
          id: 'cat-1',
          name: '技术类',
          _count: { specials: 3 },
        }),
        delete: deleteMock,
      },
      campusExamQuestion: {
        count: async () => 28,
      },
      $transaction: async (callback: (tx: { campusExamCategory: { delete: typeof deleteMock } }) => Promise<unknown>) => callback({
        campusExamCategory: { delete: deleteMock },
      }),
    });

    await expect((service as any).deleteAdminCategory('cat-1')).resolves.toEqual({
      id: 'cat-1',
      name: '技术类',
      deletedSpecialCount: 3,
      deletedQuestionCount: 28,
      status: 'deleted',
    });
  });

  it('删除二级分类时仅返回当前专项题目删除统计', async () => {
    const deleteMock = async () => ({ id: 101 });
    const service = createService({
      campusExamSpecial: {
        findUnique: async () => ({
          id: 101,
          name: '计算机网络',
        }),
        delete: deleteMock,
      },
      campusExamQuestion: {
        count: async () => 12,
      },
      $transaction: async (callback: (tx: { campusExamSpecial: { delete: typeof deleteMock } }) => Promise<unknown>) => callback({
        campusExamSpecial: { delete: deleteMock },
      }),
    });

    await expect((service as any).deleteAdminSpecial(101)).resolves.toEqual({
      id: 101,
      name: '计算机网络',
      deletedQuestionCount: 12,
      status: 'deleted',
    });
  });
});

describe('CampusExamService history metrics', () => {
  it('练习历史会同时返回最终得分率和未完成时的实时得分率', async () => {
    const service = createService({
      campusExamPracticeSession: {
        findMany: async () => ([
          {
            id: 'session-1',
            mode: 'quick_practice',
            title: '快速练习',
            specialId: null,
            special: null,
            totalQuestions: 10,
            answeredCount: 4,
            correctCount: 3,
            status: 'ongoing',
            lastQuestionId: 'q-4',
            createdAt: new Date('2026-05-31T09:00:00Z'),
            updatedAt: new Date('2026-05-31T10:00:00Z'),
            answers: [
              { score: 1 },
              { score: 1 },
              { score: 1 },
              { score: 0 },
            ],
          },
          {
            id: 'session-2',
            mode: 'smart_mock',
            title: '智能模考',
            specialId: null,
            special: null,
            totalQuestions: 5,
            answeredCount: 5,
            correctCount: 4,
            status: 'completed',
            lastQuestionId: 'q-5',
            createdAt: new Date('2026-05-31T08:00:00Z'),
            updatedAt: new Date('2026-05-31T11:00:00Z'),
            answers: [
              { score: 1 },
              { score: 1 },
              { score: 1 },
              { score: 1 },
              { score: 0 },
            ],
          },
        ]),
      },
    });

    await expect((service as any).getHistory('user-1')).resolves.toMatchObject([
      {
        sessionId: 'session-1',
        answeredCount: 4,
        totalQuestions: 10,
        currentScoreRate: 75,
        scoreRate: 30,
        status: 'ongoing',
      },
      {
        sessionId: 'session-2',
        answeredCount: 5,
        totalQuestions: 5,
        currentScoreRate: 80,
        scoreRate: 80,
        status: 'completed',
      },
    ]);
  });
});
