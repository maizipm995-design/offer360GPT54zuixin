import { describe, expect, it } from 'vitest';
import { buildLocationRecallClauses, matchLocationPreferences } from '../jobs-recommendation-location';
import type { LocationDictionarySnapshot, LocationPreferenceKeyword } from '../jobs-normalization.types';

const locationDictionary: LocationDictionarySnapshot = {
  aliasEntries: [
    { canonical: '山东', aliases: ['山东', '山东省', '鲁'] },
    { canonical: '广东', aliases: ['广东', '广东省', '粤'] },
    { canonical: '上海', aliases: ['上海', '上海市', '沪'] },
    { canonical: '杭州', aliases: ['杭州', '杭州市', '杭'] },
    { canonical: '济南', aliases: ['济南', '济南市'] },
    { canonical: '青岛', aliases: ['青岛', '青岛市'] },
    { canonical: '烟台', aliases: ['烟台', '烟台市'] },
    { canonical: '深圳', aliases: ['深圳', '深圳市', '深'] },
  ],
  cityParentProvinceMap: {
    济南: '山东',
    青岛: '山东',
    烟台: '山东',
    深圳: '广东',
  },
};

function createCityPreference(raw: string, canonical: string, parentProvince: string, aliases: string[]): LocationPreferenceKeyword {
  return {
    raw,
    canonical,
    aliases,
    kind: 'city',
    parentProvince,
    parentProvinceAliases: [parentProvince, `${parentProvince}省`],
    siblingCityKeywords: Object.entries(locationDictionary.cityParentProvinceMap)
      .filter(([city, province]) => province === parentProvince && city !== canonical)
      .map(([city]) => city),
  };
}

describe('jobs-recommendation-location', () => {
  it('支持地点别名召回关键词与省级别名输出', () => {
    const clauses = buildLocationRecallClauses(createCityPreference('深', '深圳', '广东', ['深圳', '深圳市', '深']));
    expect(clauses.exactKeywords).toEqual(['深圳', '深圳市', '深']);
    expect(clauses.parentProvinceKeywords).toEqual(['广东', '广东省']);
  });

  it('城市精确命中时返回 exactMatches', () => {
    const result = matchLocationPreferences(
      '深圳市 南山区',
      [createCityPreference('深', '深圳', '广东', ['深圳', '深圳市', '深'])],
      locationDictionary,
    );

    expect(result.exactMatches).toEqual(['深']);
    expect(result.parentMatches).toEqual([]);
  });

  it('岗位只写父级省份时仅记为父级弱命中', () => {
    const result = matchLocationPreferences(
      '山东省',
      [createCityPreference('济南', '济南', '山东', ['济南', '济南市'])],
      locationDictionary,
    );

    expect(result.exactMatches).toEqual([]);
    expect(result.parentMatches).toEqual(['济南']);
  });

  it('同省其他城市公告不会误判为父级弱命中', () => {
    const result = matchLocationPreferences(
      '青岛,山东',
      [createCityPreference('济南', '济南', '山东', ['济南', '济南市'])],
      locationDictionary,
    );

    expect(result.exactMatches).toEqual([]);
    expect(result.parentMatches).toEqual([]);
    expect(result.excludedBySiblingCity).toEqual(['济南']);
  });

  it('支持省份简称直接命中标准省名', () => {
    const result = matchLocationPreferences(
      '山东省',
      [{
        raw: '鲁',
        canonical: '山东',
        aliases: ['山东', '山东省', '鲁'],
        kind: 'province',
        parentProvince: null,
        parentProvinceAliases: [],
        siblingCityKeywords: [],
      }],
      locationDictionary,
    );

    expect(result.exactMatches).toEqual(['鲁']);
    expect(result.parentMatches).toEqual([]);
  });
});
