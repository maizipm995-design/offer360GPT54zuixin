export type ResumeRichTextPreset = 'paragraph' | 'list';

const htmlTagPattern = /<\/?[a-z][^>]*>/i;

export function escapeRichTextHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getRichTextPlainText(value: string) {
  if (!value) {
    return '';
  }

  return decodeRichTextEntities(
    value
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<li\b[^>]*>/gi, '• ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function hasMeaningfulRichText(value: string) {
  return Boolean(getRichTextPlainText(value));
}

export function normalizeRichTextValue(value: string, preset: ResumeRichTextPreset = 'paragraph') {
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    return '';
  }

  if (!htmlTagPattern.test(normalized)) {
    return convertPlainTextToHtml(normalized, preset);
  }

  let sanitized = normalized
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(\/?)(div|section|article|header|footer)\b/gi, '<$1p')
    .replace(/<(\/?)(b)\b/gi, '<$1strong')
    .replace(/<(\/?)(i)\b/gi, '<$1em')
    .replace(/<br\s*\/?>/gi, '<br />')
    .replace(/\s(?:class|style|id|data-[\w-]+|aria-[\w-]+|role|dir|lang|on\w+)=('([^']*)'|"([^"]*)"|[^\s>]+)/gi, '')
    .replace(/<(?!\/?(p|br|strong|em|ul|ol|li)\b)[^>]+>/gi, '')
    .replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '')
    .replace(/<(ul|ol)>(?:\s|&nbsp;|<br\s*\/?>)*<\/\1>/gi, '')
    .trim();

  if (!sanitized) {
    return '';
  }

  if (!/<(p|ul|ol|li)\b/i.test(sanitized)) {
    sanitized = `<p>${sanitized}</p>`;
  }

  return hasMeaningfulRichText(sanitized) ? sanitized : '';
}

function convertPlainTextToHtml(value: string, preset: ResumeRichTextPreset) {
  const lines = value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!lines.length) {
    return '';
  }

  if (preset === 'list') {
    return `<ul>${lines.map((line) => `<li>${escapeRichTextHtml(line)}</li>`).join('')}</ul>`;
  }

  return lines.map((line) => `<p>${escapeRichTextHtml(line)}</p>`).join('');
}

function decodeRichTextEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
