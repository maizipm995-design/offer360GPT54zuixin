import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

type PersistedResumeFileInput = {
  taskId: string;
  fileName: string;
  contentType: string;
  buffer: Buffer;
};

type PersistedResumeFileRecord = {
  absolutePath: string;
  fileName: string;
  contentType: string;
  size: number;
};

function getStorageRoot() {
  return join(process.cwd(), '.runtime', 'interview-transcript-files');
}

function sanitizeFileName(fileName: string) {
  const normalized = fileName.trim().replace(/[/\\?%*:|"<>]/g, '-');
  return normalized || 'resume';
}

export function persistResumeFile(input: PersistedResumeFileInput) {
  const dirPath = join(getStorageRoot(), input.taskId);
  mkdirSync(dirPath, { recursive: true });
  const absolutePath = join(dirPath, sanitizeFileName(input.fileName));
  writeFileSync(absolutePath, input.buffer);
  return {
    absolutePath,
    fileName: sanitizeFileName(input.fileName),
    contentType: input.contentType || 'application/octet-stream',
    size: input.buffer.length,
  };
}

export function readPersistedResumeFile(absolutePath: string, fileName: string, contentType: string): PersistedResumeFileRecord | null {
  try {
    const buffer = readFileSync(absolutePath);
    return {
      absolutePath,
      fileName,
      contentType: contentType || 'application/octet-stream',
      size: buffer.length,
    };
  } catch {
    return null;
  }
}

export function readPersistedResumeFileBuffer(absolutePath: string) {
  return readFileSync(absolutePath);
}

export function getPersistedResumeFileSize(absolutePath: string) {
  return statSync(absolutePath).size;
}

export function deletePersistedResumeFile(absolutePath?: string | null) {
  if (!absolutePath) {
    return;
  }
  try {
    rmSync(absolutePath, { force: true });
  } catch {}

  try {
    rmSync(dirname(absolutePath), { recursive: true, force: true });
  } catch {}
}
