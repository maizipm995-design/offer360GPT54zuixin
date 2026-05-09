import { JOBS_NORMALIZATION_DOMAINS } from '../jobs/jobs-normalization.types';

export const NORMALIZATION_RECORD_STATUSES = ['active', 'inactive'] as const;
export const NORMALIZATION_MATCH_MODES = ['exact', 'contains'] as const;
export const NORMALIZATION_LOCATION_LEVELS = ['province', 'city'] as const;

export const NORMALIZATION_IMPORT_MAX_FILE_SIZE = 20 * 1024 * 1024;
export const NORMALIZATION_IMPORT_ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);
export const NORMALIZATION_EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const NORMALIZATION_TERM_SHEET = 'terms';
export const NORMALIZATION_ALIAS_SHEET = 'aliases';
export const NORMALIZATION_LOCATION_SHEET = 'location_hierarchy';

export const NORMALIZATION_TERM_HEADERS = [
  'domain',
  'canonicalName',
  'canonicalCode',
  'level',
  'status',
  'sortOrder',
  'metadataJson',
] as const;

export const NORMALIZATION_ALIAS_HEADERS = [
  'domain',
  'canonicalName',
  'aliasName',
  'matchMode',
  'status',
  'source',
  'sortOrder',
] as const;

export const NORMALIZATION_LOCATION_HEADERS = [
  'provinceCanonicalName',
  'cityCanonicalName',
  'status',
] as const;

export const NORMALIZATION_TEMPLATE_SAMPLE_ROWS = {
  terms: [
    ['LOCATION', '山东', 'CN-SD', 'province', 'active', 10, ''],
    ['LOCATION', '济南', 'CN-SD-JN', 'city', 'active', 20, ''],
    ['JOB_TITLE', '开发', 'JOB-DEVELOPMENT', '', 'active', 10, ''],
    ['MAJOR', '计算机', 'MAJOR-COMPUTER', '', 'active', 10, ''],
    ['DEGREE', '本科', 'degree-undergraduate', '', 'active', 10, ''],
    ['COMPANY', '中国烟草', 'company-tobacco', '', 'active', 10, ''],
  ],
  aliases: [
    ['LOCATION', '山东', '山东省', 'exact', 'active', 'seed', 10],
    ['LOCATION', '济南', '济南市', 'exact', 'active', 'seed', 10],
    ['JOB_TITLE', '人事 / 行政', '行政', 'exact', 'active', 'seed', 10],
    ['JOB_TITLE', '前端', 'Web前端开发', 'contains', 'active', 'seed', 20],
    ['MAJOR', '计算机', '计算机科学与技术', 'contains', 'active', 'seed', 10],
    ['DEGREE', '本科', '大学本科', 'contains', 'active', 'seed', 10],
    ['COMPANY', '中国烟草', '中烟', 'contains', 'active', 'seed', 10],
  ],
  locationHierarchy: [['山东', '济南', 'active']],
} as const;

export const NORMALIZATION_DOMAIN_SET = new Set(JOBS_NORMALIZATION_DOMAINS);
export const NORMALIZATION_STATUS_SET = new Set(NORMALIZATION_RECORD_STATUSES);
export const NORMALIZATION_MATCH_MODE_SET = new Set(NORMALIZATION_MATCH_MODES);
export const NORMALIZATION_LOCATION_LEVEL_SET = new Set(NORMALIZATION_LOCATION_LEVELS);
