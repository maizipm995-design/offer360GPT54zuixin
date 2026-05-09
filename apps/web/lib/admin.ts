export function buildQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  return search.toString();
}

export function splitInputTags(value: string) {
  return value
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toDateInputValue(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

export function downloadTextFile(filename: string, content: string, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string | number | boolean | null | undefined) {
  const normalized = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

export function downloadCsv(filename: string, rows: Array<Array<string | number | boolean | null | undefined>>) {
  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
  downloadTextFile(filename, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
}

function decodeBase64ToUint8Array(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function downloadFilePayload(payload: {
  filename: string;
  content?: string;
  downloadUrl?: string;
  mimeType?: string;
  encoding?: 'utf8' | 'base64';
}) {
  if (payload.downloadUrl) {
    const link = document.createElement('a');
    link.href = payload.downloadUrl;
    link.download = payload.filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  if (!payload.content) {
    throw new Error('文件内容为空，无法开始下载');
  }

  const blob = payload.encoding === 'base64'
    ? new Blob([decodeBase64ToUint8Array(payload.content)], { type: payload.mimeType ?? 'application/octet-stream' })
    : new Blob([payload.content], { type: payload.mimeType ?? 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = payload.filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
