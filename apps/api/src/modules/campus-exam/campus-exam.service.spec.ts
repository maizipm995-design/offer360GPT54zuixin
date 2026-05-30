import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { CampusExamService } from './campus-exam.service';

function createService() {
  return new CampusExamService({} as never, {} as never, {} as never, {} as never);
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
});
