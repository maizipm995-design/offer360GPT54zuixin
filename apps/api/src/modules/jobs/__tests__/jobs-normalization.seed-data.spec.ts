import { describe, expect, it } from 'vitest';
import {
  companyAliasRound1SeedItems,
  companyTermRound1SeedItems,
  degreeAliasRound1SeedItems,
  degreeTermRound1SeedItems,
  jobTitleAliasRound1SeedItems,
  jobTitleTermRound1SeedItems,
  locationAliasSeedItems,
  locationHierarchySeedItems,
  locationTermRound1SeedItems,
  majorAliasRound1SeedItems,
  majorTermRound1SeedItems,
  normalizationAliasSeedItems,
  normalizationSeedMetadata,
  normalizationTermSeedItems,
} from '../jobs-normalization.seed-data';

function normalizeAlias(value: string) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·•（）()【】\[\]，,、；;｜|/]/g, '');
}

describe('jobs-normalization.seed-data', () => {
  it('LOCATION 首轮主表补数覆盖 31 个省级词和 289 个城市词', () => {
    const provinces = locationTermRound1SeedItems.filter((item) => item.level === 'province');
    const cities = locationTermRound1SeedItems.filter((item) => item.level === 'city');
    const canonicalNames = locationTermRound1SeedItems.map((item) => item.canonicalName);

    expect(provinces).toHaveLength(31);
    expect(cities).toHaveLength(289);
    expect(new Set(canonicalNames).size).toBe(canonicalNames.length);
    expect(locationTermRound1SeedItems.every((item) => item.canonicalCode?.startsWith('CN-'))).toBe(true);
  });

  it('LOCATION 城市主表数据都保留 intendedProvince 元信息，便于下一轮补地点关系', () => {
    const cities = locationTermRound1SeedItems.filter((item) => item.level === 'city');

    cities.forEach((item) => {
      expect(item.metadata).toMatchObject({
        source: 'seed',
        seedLayer: 'terms',
        locationLevel: 'city',
        coverage: 'mainland-round1',
      });
      expect(typeof item.metadata?.intendedProvince).toBe('string');
      expect(String(item.metadata?.intendedProvince).trim().length).toBeGreaterThan(0);
    });
  });

  it('四个非 LOCATION 域主表首轮补数覆盖预期范围并保留兼容锚点', () => {
    expect(jobTitleTermRound1SeedItems).toHaveLength(39);
    expect(companyTermRound1SeedItems).toHaveLength(23);
    expect(degreeTermRound1SeedItems).toHaveLength(5);
    expect(majorTermRound1SeedItems).toHaveLength(24);

    const jobTitleNames = jobTitleTermRound1SeedItems.map((item) => item.canonicalName);
    const companyNames = companyTermRound1SeedItems.map((item) => item.canonicalName);
    const degreeNames = degreeTermRound1SeedItems.map((item) => item.canonicalName);
    const majorNames = majorTermRound1SeedItems.map((item) => item.canonicalName);

    expect(jobTitleNames).toEqual(expect.arrayContaining(['开发', '研发', '后端', '前端', '产品', '运营', '财务', '管培生']));
    expect(companyNames).toEqual(
      expect.arrayContaining([
        '烟草',
        '电网',
        '字节',
        '移动',
        '建设银行',
        '石油',
        '石化',
        '海油',
        '航空',
        '航天',
      ]),
    );
    expect(degreeNames).toEqual(['中专', '专科', '本科', '硕士', '博士']);
    expect(majorNames).toEqual(expect.arrayContaining(['计算机', '人工智能', '电子信息', '财务', '法学', '物流供应链']));

    const nonLocationItems = [
      ...jobTitleTermRound1SeedItems,
      ...companyTermRound1SeedItems,
      ...degreeTermRound1SeedItems,
      ...majorTermRound1SeedItems,
    ];

    expect(nonLocationItems.every((item) => item.level === undefined)).toBe(true);
    expect(nonLocationItems.every((item) => item.metadata?.source === 'seed')).toBe(true);
    expect(nonLocationItems.every((item) => item.metadata?.seedRound === 'main-terms-r2-20260429')).toBe(true);
    expect(nonLocationItems.every((item) => item.metadata?.seedLayer === 'terms')).toBe(true);
    expect(jobTitleTermRound1SeedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ canonicalName: '数据', metadata: expect.objectContaining({ coverage: 'core-round2', track: 'data-analysis' }) }),
        expect.objectContaining({ canonicalName: '工程师', metadata: expect.objectContaining({ coverage: 'core-round2', track: 'engineering' }) }),
        expect.objectContaining({ canonicalName: 'IT', metadata: expect.objectContaining({ coverage: 'core-round2', track: 'it-support' }) }),
        expect.objectContaining({ canonicalName: '其他职位', metadata: expect.objectContaining({ coverage: 'fallback-round2', track: 'fallback' }) }),
      ]),
    );
  });

  it('四个非 LOCATION 域 alias 首轮补数覆盖高频入口且不出现跨标准词冲突', () => {
    expect(jobTitleAliasRound1SeedItems.length).toBeGreaterThanOrEqual(80);
    expect(companyAliasRound1SeedItems.length).toBeGreaterThanOrEqual(40);
    expect(degreeAliasRound1SeedItems.length).toBeGreaterThanOrEqual(10);
    expect(majorAliasRound1SeedItems.length).toBeGreaterThanOrEqual(35);

    const aliasGroups = new Map<string, Set<string>>();
    normalizationAliasSeedItems.forEach((item) => {
      const key = `${item.domain}:${normalizeAlias(item.aliasName)}`;
      const canonicalNames = aliasGroups.get(key) ?? new Set<string>();
      canonicalNames.add(item.canonicalName);
      aliasGroups.set(key, canonicalNames);
    });

    aliasGroups.forEach((canonicalNames) => {
      expect(canonicalNames.size).toBe(1);
    });

    expect(jobTitleAliasRound1SeedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ canonicalName: '后端', aliasName: 'Java后端开发', matchMode: 'contains' }),
        expect.objectContaining({ canonicalName: '运营', aliasName: '短视频内容运营', matchMode: 'contains' }),
        expect.objectContaining({ canonicalName: '管培生', aliasName: '管理培训生', matchMode: 'contains' }),
        expect.objectContaining({ canonicalName: '行政', aliasName: '行政岗', matchMode: 'contains' }),
        expect.objectContaining({ canonicalName: '产品', aliasName: '产品经理', matchMode: 'contains' }),
      ]),
    );
    expect(companyAliasRound1SeedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ canonicalName: '字节', aliasName: '字节跳动', matchMode: 'exact' }),
        expect.objectContaining({ canonicalName: '建设银行', aliasName: '建行', matchMode: 'exact' }),
        expect.objectContaining({ canonicalName: '烟草', aliasName: '中国烟草', matchMode: 'exact' }),
        expect.objectContaining({ canonicalName: '移动', aliasName: '中国移动', matchMode: 'exact' }),
        expect.objectContaining({ canonicalName: '石油', aliasName: '中国石油', matchMode: 'exact' }),
        expect.objectContaining({ canonicalName: '石化', aliasName: '中国石化', matchMode: 'exact' }),
        expect.objectContaining({ canonicalName: '海油', aliasName: '中国海油', matchMode: 'exact' }),
        expect.objectContaining({ canonicalName: '航空', aliasName: '中国航空工业集团', matchMode: 'exact' }),
        expect.objectContaining({ canonicalName: '航天', aliasName: '中国航天科技集团', matchMode: 'exact' }),
      ]),
    );
    expect(degreeAliasRound1SeedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ canonicalName: '本科', aliasName: '大学本科', matchMode: 'contains' }),
        expect.objectContaining({ canonicalName: '硕士', aliasName: '研究生', matchMode: 'exact' }),
      ]),
    );
    expect(majorAliasRound1SeedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ canonicalName: '计算机', aliasName: '计科', matchMode: 'exact' }),
        expect.objectContaining({ canonicalName: '人工智能', aliasName: 'AI', matchMode: 'exact' }),
        expect.objectContaining({ canonicalName: '财务', aliasName: '会计', matchMode: 'exact' }),
        expect.objectContaining({ canonicalName: '法学', aliasName: '法学专业', matchMode: 'contains' }),
        expect.objectContaining({ canonicalName: '医学', aliasName: '护理', matchMode: 'exact' }),
      ]),
    );
  });

  it('LOCATION 城市父级关系已按 intendedProvince 全量补齐', () => {
    const cities = locationTermRound1SeedItems.filter((item) => item.level === 'city');

    expect(locationHierarchySeedItems).toHaveLength(cities.length);

    const hierarchyMap = new Map(locationHierarchySeedItems.map((item) => [item.cityCanonicalName, item.provinceCanonicalName]));
    cities.forEach((item) => {
      expect(hierarchyMap.get(item.canonicalName)).toBe(item.metadata?.intendedProvince);
    });

    expect(normalizationSeedMetadata.locationHierarchyRound).toBe('location-hierarchy-r1-20260428');
    expect(locationAliasSeedItems.length).toBeGreaterThan(0);
  });

  it('alias 与 location hierarchy seed 均能回指到已存在的标准词', () => {
    const termKeySet = new Set(normalizationTermSeedItems.map((item) => `${item.domain}:${item.canonicalName}`));

    normalizationAliasSeedItems.forEach((item) => {
      expect(termKeySet.has(`${item.domain}:${item.canonicalName}`)).toBe(true);
    });

    locationHierarchySeedItems.forEach((item) => {
      expect(termKeySet.has(`LOCATION:${item.provinceCanonicalName}`)).toBe(true);
      expect(termKeySet.has(`LOCATION:${item.cityCanonicalName}`)).toBe(true);
    });
  });

  it('全部主表标准词在各自 domain 下保持唯一，便于后续继续治理', () => {
    const termKeys = normalizationTermSeedItems.map((item) => `${item.domain}:${item.canonicalName}`);
    expect(new Set(termKeys).size).toBe(termKeys.length);
  });
});
