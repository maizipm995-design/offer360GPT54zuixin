import { BadRequestException } from '@nestjs/common';
import { CAMPUS_EXAM_QUESTION_TYPE_CODE_MAP, CAMPUS_EXAM_QUESTION_TYPE_INPUT_MAP } from './campus-exam.types';

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

export function normalizeLooseText(value: unknown) {
  return normalizeText(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/[　\s]+/g, ' ')
    .trim();
}

export function normalizeComparableText(value: unknown) {
  return normalizeLooseText(value)
    .toLowerCase()
    .replace(/[，,。；;：:、.!?？！“”"'`~()（）\[\]【】<>《》]/g, '')
    .replace(/\s+/g, '');
}

export function slugifyCampusExamCategory(name: string) {
  const normalized = normalizeText(name)
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || `category-${Date.now()}`;
}

export function toInt(value: unknown, fallback?: number) {
  const normalized = Number(String(value ?? '').trim());
  if (Number.isFinite(normalized)) {
    return Math.trunc(normalized);
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new BadRequestException('数值字段格式不正确');
}

export function toOptionalInt(value: unknown) {
  const text = normalizeText(value);
  if (!text) return null;
  return toInt(text);
}

export function toBooleanFlag(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();
  return ['1', 'true', 'yes', 'y', '是', '高频', '高频错题'].includes(normalized);
}

export function parseQuestionType(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();
  const mapped = CAMPUS_EXAM_QUESTION_TYPE_INPUT_MAP[normalized];
  if (!mapped) {
    throw new BadRequestException(`题型不受支持：${normalizeText(value) || '空值'}`);
  }
  return mapped;
}

export function getQuestionAnswerType(questionType: number) {
  return CAMPUS_EXAM_QUESTION_TYPE_CODE_MAP[questionType] ?? 'single';
}

export function normalizeArrayValues(values: unknown) {
  if (!Array.isArray(values)) {
    return [] as string[];
  }
  return values.map((item) => normalizeText(item)).filter(Boolean);
}

export function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const IMAGE_URL_PATTERN = /https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|bmp|svg)(?:\?[^\s<>"']*)?/gi;

export function splitAnswerValues(raw: string) {
  return raw
    .split(/[\n；;，,、|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function splitSentences(raw: string) {
  return normalizeLooseText(raw)
    .split(/[。；;！!？?\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeRichTextContent(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }
  return normalized.replace(/(^|>|\s)(https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|bmp|svg)(?:\?[^\s<>"']*)?)(?=\s|<|$)/gi, (_match, prefix: string, url: string) => (
    `${prefix}<img src="${url}" alt="图片" />`
  ));
}

export function collectRichTextImageUrls(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [] as string[];
  }

  const urls = new Set<string>();
  const imgMatcher = /<img\b[^>]*\bsrc=(["'])([^"']+)\1/gi;
  for (const match of normalized.matchAll(imgMatcher)) {
    const url = normalizeText(match[2]);
    if (url) {
      urls.add(url);
    }
  }
  for (const match of normalized.matchAll(IMAGE_URL_PATTERN)) {
    const url = normalizeText(match[0]);
    if (url) {
      urls.add(url);
    }
  }
  return Array.from(urls);
}

export function parseOptionLines(raw: string) {
  const normalized = normalizeText(raw);
  if (!normalized) {
    return [] as Array<{ key: string; label: string; value: string }>;
  }
  if (normalized.startsWith('[') || normalized.startsWith('{')) {
    const payload = safeJsonParse<Array<{ key?: string; label?: string; value?: string }>>(normalized, []);
    return payload.map((item, index) => ({
      key: normalizeText(item.key || item.label || String.fromCharCode(65 + index)),
      label: normalizeText(item.label || item.key || String.fromCharCode(65 + index)),
      value: normalizeText(item.value),
    }));
  }

  const segments = normalized.includes('|||')
    ? normalized.split('|||')
    : /[；;]\s*</.test(normalized) || !/<[^>]+>/.test(normalized)
      ? normalized.split(/[；;]+/)
      : normalized.split(/\n+/);
  const lines = segments.map((item) => item.trim()).filter(Boolean);
  const options = lines.map((line, index) => {
    const matched = line.match(/^([A-Z])[\.、:：\)]\s*(.+)$/i);
    const label = matched?.[1]?.toUpperCase() || String.fromCharCode(65 + index);
    const value = matched?.[2]?.trim() || line;
    return { key: label, label, value };
  });
  return options;
}
