import type { LocationDictionarySnapshot, LocationMatchResult, LocationPreferenceKeyword } from './jobs-normalization.types';

function normalizeLocationKeyword(value: string) {
  return value.trim().replace(/\s+/g, '').replace(/[·•]/g, '');
}

function normalizeLocationText(text: string) {
  return normalizeLocationKeyword(text)
    .replace(/[，、；;｜|/]/g, ',')
    .replace(/[()（）【】\[\]]/g, ',');
}

function buildLocationAliasLookup(dictionary: LocationDictionarySnapshot) {
  const lookup = new Map<string, string>();
  dictionary.aliasEntries.forEach((entry) => {
    entry.aliases.forEach((alias) => {
      const normalizedAlias = normalizeLocationKeyword(alias);
      if (normalizedAlias && !lookup.has(normalizedAlias)) {
        lookup.set(normalizedAlias, entry.canonical);
      }
    });
  });
  return lookup;
}

function extractLocationTokens(text: string | null | undefined, dictionary: LocationDictionarySnapshot) {
  if (!text) {
    return new Set<string>();
  }

  const aliasLookup = buildLocationAliasLookup(dictionary);
  const normalizedText = normalizeLocationText(text);
  const tokens = new Set<string>();

  normalizedText
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const canonical = aliasLookup.get(item);
      if (canonical) {
        tokens.add(canonical);
      }
    });

  dictionary.aliasEntries.forEach((entry) => {
    if (entry.aliases.some((alias) => normalizedText.includes(normalizeLocationKeyword(alias)))) {
      tokens.add(entry.canonical);
    }
  });

  return tokens;
}

export function buildLocationRecallClauses(preference: LocationPreferenceKeyword) {
  return {
    exactKeywords: Array.from(new Set(preference.aliases.length ? preference.aliases : [preference.canonical])),
    parentProvinceKeywords: Array.from(
      new Set(
        preference.parentProvince
          ? (preference.parentProvinceAliases.length ? preference.parentProvinceAliases : [preference.parentProvince])
          : [],
      ),
    ),
    siblingCityKeywords: Array.from(new Set(preference.siblingCityKeywords)),
  };
}

export function matchLocationPreferences(
  jobLocationText: string | null | undefined,
  preferences: LocationPreferenceKeyword[],
  dictionary: LocationDictionarySnapshot,
): LocationMatchResult {
  const tokens = extractLocationTokens(jobLocationText, dictionary);
  const exactMatches = new Set<string>();
  const parentMatches = new Set<string>();
  const excludedBySiblingCity = new Set<string>();

  preferences.forEach((preference) => {
    if (tokens.has(preference.canonical)) {
      exactMatches.add(preference.raw);
      return;
    }

    if (preference.kind !== 'city' || !preference.parentProvince || !tokens.has(preference.parentProvince)) {
      return;
    }

    const siblingCityMatched = Array.from(tokens).some(
      (token) => token !== preference.canonical && dictionary.cityParentProvinceMap[token] === preference.parentProvince,
    );

    if (siblingCityMatched) {
      excludedBySiblingCity.add(preference.raw);
      return;
    }

    parentMatches.add(preference.raw);
  });

  return {
    exactMatches: Array.from(exactMatches),
    parentMatches: Array.from(parentMatches),
    excludedBySiblingCity: Array.from(excludedBySiblingCity),
  };
}
