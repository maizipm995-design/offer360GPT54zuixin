import { describe, expect, it, vi } from 'vitest';
import { JobsNormalizationService } from '../jobs-normalization.service';

function createService() {
  const repository = {
    getActiveTerms: vi.fn().mockResolvedValue([
      {
        id: 'loc-shandong',
        domain: 'LOCATION',
        canonicalName: '山东',
        level: 'province',
        aliases: [{ aliasName: '山东' }, { aliasName: '山东省' }, { aliasName: '鲁' }],
      },
      {
        id: 'loc-shenzhen',
        domain: 'LOCATION',
        canonicalName: '深圳',
        level: 'city',
        aliases: [{ aliasName: '深圳' }, { aliasName: '深圳市' }, { aliasName: '深' }],
      },
      {
        id: 'job-backend',
        domain: 'JOB_TITLE',
        canonicalName: '后端',
        level: null,
        aliases: [
          { aliasName: 'Java开发', matchMode: 'contains' },
          { aliasName: 'Java后端', matchMode: 'contains' },
          { aliasName: 'Java工程师', matchMode: 'contains' },
        ],
      },
      {
        id: 'job-admin',
        domain: 'JOB_TITLE',
        canonicalName: '人事 / 行政',
        level: null,
        aliases: [
          { aliasName: '行政', matchMode: 'exact' },
          { aliasName: '行政文员', matchMode: 'contains' },
          { aliasName: '行政助理', matchMode: 'contains' },
        ],
      },
      {
        id: 'major-computer',
        domain: 'MAJOR',
        canonicalName: '计算机',
        level: null,
        aliases: [
          { aliasName: '计科', matchMode: 'exact' },
          { aliasName: '计算机科学与技术', matchMode: 'contains' },
          { aliasName: '计算机科学', matchMode: 'contains' },
          { aliasName: '计算机工程', matchMode: 'contains' },
        ],
      },
      {
        id: 'degree-bachelor',
        domain: 'DEGREE',
        canonicalName: '本科',
        level: null,
        aliases: [{ aliasName: '本科' }, { aliasName: '全日制本科' }],
      },
      {
        id: 'company-tencent',
        domain: 'COMPANY',
        canonicalName: '腾讯',
        level: null,
        aliases: [{ aliasName: '腾讯' }, { aliasName: '腾讯控股' }, { aliasName: '腾讯科技' }],
      },
    ]),
    getActiveLocationHierarchies: vi.fn().mockResolvedValue([
      {
        provinceTerm: { id: 'loc-shandong', canonicalName: '山东' },
        cityTerm: { id: 'loc-jinan', canonicalName: '济南' },
      },
      {
        provinceTerm: { id: 'loc-shandong', canonicalName: '山东' },
        cityTerm: { id: 'loc-qingdao', canonicalName: '青岛' },
      },
      {
        provinceTerm: { id: 'loc-guangdong', canonicalName: '广东' },
        cityTerm: { id: 'loc-shenzhen', canonicalName: '深圳' },
      },
    ]),
  };

  return new JobsNormalizationService(repository as never);
}

describe('JobsNormalizationService', () => {
  it('可将岗位别名统一归一到同一标准岗位', async () => {
    const service = createService();
    const result = await service.normalizePreferences('JOB_TITLE', ['Java开发', 'Java工程师']);

    expect(result).toHaveLength(1);
    expect(result[0]?.canonical).toBe('后端');
  });

  it('可归一企业、学历和专业别名', async () => {
    const service = createService();
    const [company, degree, major] = await Promise.all([
      service.normalizeSingle('COMPANY', '腾讯控股'),
      service.normalizeSingle('DEGREE', '全日制本科'),
      service.normalizeSingle('MAJOR', '计算机'),
    ]);

    expect(company?.canonical).toBe('腾讯');
    expect(degree?.canonical).toBe('本科');
    expect(major?.canonical).toBe('计算机');
  });

  it('可把地点简称归一并补出父级省份', async () => {
    const service = createService();
    const result = await service.normalizeLocationPreferences(['深', '鲁']);

    expect(result[0]).toMatchObject({ canonical: '深圳', kind: 'city', parentProvince: '广东' });
    expect(result[1]).toMatchObject({ canonical: '山东', kind: 'province', parentProvince: null });
  });

  it('可在写库前把偏好别名收敛为标准词', async () => {
    const service = createService();
    const [locations, jobs, companies] = await Promise.all([
      service.normalizePreferencesForStorage('LOCATION', ['深', '深圳市']),
      service.normalizePreferencesForStorage('JOB_TITLE', ['Java开发', 'Java工程师']),
      service.normalizePreferencesForStorage('COMPANY', ['腾讯科技', '腾讯控股']),
    ]);

    expect(locations).toEqual(['深圳']);
    expect(jobs).toEqual(['后端']);
    expect(companies).toEqual(['腾讯']);
  });

  it('可在写库前把学历和专业单值收敛为标准词', async () => {
    const service = createService();
    const [degree, major] = await Promise.all([
      service.normalizeOptionalValueForStorage('DEGREE', '全日制本科'),
      service.normalizeOptionalValueForStorage('MAJOR', '计算机工程'),
    ]);

    expect(degree).toBe('本科');
    expect(major).toBe('计算机');
  });

  it('高歧义 alias 仅参与归一，不进入文本召回关键词', async () => {
    const service = createService();
    const result = await service.normalizeSingle('JOB_TITLE', '行政');

    expect(result?.canonical).toBe('人事 / 行政');
    expect(result?.aliases).toContain('行政');
    expect(result?.searchKeywords ?? []).not.toContain('行政');
    expect(result?.searchKeywords ?? []).toEqual(['人事 / 行政', '行政文员', '行政助理']);
  });

  it('搜索扩展会保留原词，并补齐标准词及关联别名供并行召回', async () => {
    const service = createService();
    const result = await service.expandSearchKeywords('COMPANY', '腾讯控股');

    expect(result).toEqual(expect.arrayContaining(['腾讯控股', '腾讯', '腾讯科技']));
  });

  it('建议词只返回推荐项，不会直接改写输入值', async () => {
    const service = createService();
    const result = await service.getSuggestions('JOB_TITLE', 'Java', 5);

    expect(result).toEqual([
      expect.objectContaining({
        domain: 'JOB_TITLE',
        canonical: '后端',
        matchedAlias: 'Java工程师',
      }),
    ]);
  });
});
