import * as XLSX from 'xlsx';

const EXCEL_SERIAL_TEXT_REGEX = /^\d+(?:\.\d+)?$/;
const DATE_WITH_SEPARATOR_REGEX = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/;
const DATE_WITH_CHINESE_REGEX = /^(\d{4})年(\d{1,2})月(\d{1,2})日?(?:\s.*)?$/;
const DATE_COMPACT_REGEX = /^(\d{4})(\d{2})(\d{2})$/;
const ISO_PREFIX_REGEX = /^(\d{4})-(\d{2})-(\d{2})T.*$/;

function buildValidatedDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function parseExcelSerialDate(value: number) {
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) {
    return null;
  }
  return buildValidatedDate(parsed.y, parsed.m, parsed.d);
}

function parseDateLikeText(text: string) {
  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  if (EXCEL_SERIAL_TEXT_REGEX.test(normalized)) {
    const parsed = parseExcelSerialDate(Number(normalized));
    return parsed ?? 'invalid';
  }

  const withSeparator = normalized.match(DATE_WITH_SEPARATOR_REGEX);
  if (withSeparator) {
    const parsed = buildValidatedDate(Number(withSeparator[1]), Number(withSeparator[2]), Number(withSeparator[3]));
    return parsed ?? 'invalid';
  }

  const withChinese = normalized.match(DATE_WITH_CHINESE_REGEX);
  if (withChinese) {
    const parsed = buildValidatedDate(Number(withChinese[1]), Number(withChinese[2]), Number(withChinese[3]));
    return parsed ?? 'invalid';
  }

  const compact = normalized.match(DATE_COMPACT_REGEX);
  if (compact) {
    const parsed = buildValidatedDate(Number(compact[1]), Number(compact[2]), Number(compact[3]));
    return parsed ?? 'invalid';
  }

  const isoPrefix = normalized.match(ISO_PREFIX_REGEX);
  if (isoPrefix) {
    const parsed = buildValidatedDate(Number(isoPrefix[1]), Number(isoPrefix[2]), Number(isoPrefix[3]));
    return parsed ?? 'invalid';
  }

  return null;
}

export function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseJobTextDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    return parseExcelSerialDate(value);
  }

  const parsed = parseDateLikeText(String(value));
  return parsed instanceof Date ? parsed : null;
}

export function normalizeJobTextDate(
  value: unknown,
  options?: {
    emptyValue?: string | null | undefined;
    fieldLabel?: string;
  },
) {
  const emptyValue = options?.emptyValue;
  const fieldLabel = options?.fieldLabel ?? '日期';

  if (value === undefined || value === null || value === '') {
    return emptyValue;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`${fieldLabel}格式不正确`);
    }
    return formatDateOnly(value);
  }

  if (typeof value === 'number') {
    const parsed = parseExcelSerialDate(value);
    if (!parsed) {
      throw new Error(`${fieldLabel}格式不正确`);
    }
    return formatDateOnly(parsed);
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return emptyValue;
  }

  const parsed = parseDateLikeText(normalized);
  if (parsed === 'invalid') {
    throw new Error(`${fieldLabel}格式不正确`);
  }
  if (parsed instanceof Date) {
    return formatDateOnly(parsed);
  }

  return normalized;
}
