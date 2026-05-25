import { randomUUID } from 'crypto';

type TempFileRecord = {
  id: string;
  fileName: string;
  contentType: string;
  buffer: Buffer;
  expiresAt: number;
};

const DEFAULT_TTL_MS = 15 * 60 * 1000;

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    __offer360InterviewTranscriptTempFiles?: Map<string, TempFileRecord>;
  };
  if (!globalStore.__offer360InterviewTranscriptTempFiles) {
    globalStore.__offer360InterviewTranscriptTempFiles = new Map<string, TempFileRecord>();
  }
  return globalStore.__offer360InterviewTranscriptTempFiles;
}

function cleanupExpiredTempFiles(now = Date.now()) {
  const store = getStore();
  for (const [id, record] of store.entries()) {
    if (record.expiresAt <= now) {
      store.delete(id);
    }
  }
}

export function createTempFile(input: {
  fileName: string;
  contentType: string;
  buffer: Buffer;
  ttlMs?: number;
}) {
  cleanupExpiredTempFiles();
  const id = randomUUID();
  const record: TempFileRecord = {
    id,
    fileName: input.fileName,
    contentType: input.contentType,
    buffer: input.buffer,
    expiresAt: Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS),
  };
  getStore().set(id, record);
  return record;
}

export function getTempFile(id: string) {
  cleanupExpiredTempFiles();
  const record = getStore().get(id) ?? null;
  if (!record) {
    return null;
  }
  if (record.expiresAt <= Date.now()) {
    getStore().delete(id);
    return null;
  }
  return record;
}

export function deleteTempFile(id: string) {
  getStore().delete(id);
}
