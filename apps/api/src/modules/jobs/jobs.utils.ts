import { parseJobTextDate } from '../../common/utils/job-text-date';

export function subDays(date: Date, days: number) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

export function isWithinHours(value: Date | string | null | undefined, hours: number) {
  const date = parseJobTextDate(value);
  if (!date) {
    return false;
  }
  return Date.now() - date.getTime() <= hours * 60 * 60 * 1000;
}

export function isWithinDays(value: Date | string | null | undefined, days: number) {
  const date = parseJobTextDate(value);
  if (!date) {
    return false;
  }
  const diff = date.getTime() - Date.now();
  return diff > 0 && diff <= days * 24 * 60 * 60 * 1000;
}

export function normalizeKeyword(value?: string) {
  return value?.trim() || undefined;
}

export function parseJsonArray<T = string>(input: unknown): T[] {
  if (Array.isArray(input)) {
    return input as T[];
  }
  return [];
}
