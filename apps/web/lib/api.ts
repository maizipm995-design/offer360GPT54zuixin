const browserApiBase = '/api/proxy';
const serverApiBase = process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
const DEVICE_ID_STORAGE_KEY = 'offer360:device-id';
const SESSION_ID_STORAGE_KEY = 'offer360:session-id';

if (!serverApiBase) {
  throw new Error('Missing INTERNAL_API_BASE_URL or NEXT_PUBLIC_API_BASE_URL in root .env');
}

type ApiEnvelope<T> = {
  message?: string;
  data?: T;
};

export interface ClientUploadProgress {
  phase: 'uploading' | 'processing' | 'completed';
  loaded: number;
  total: number;
  percent: number;
}

function parseJsonSafely(text: string) {
  try {
    return JSON.parse(text) as ApiEnvelope<unknown>;
  } catch {
    return null;
  }
}

function buildRequestErrorMessage(status: number, payload: ApiEnvelope<unknown> | null, fallbackText = '') {
  const message = typeof payload?.message === 'string' && payload.message.trim()
    ? payload.message.trim()
    : fallbackText.trim();
  return message || `请求失败（${status}）`;
}

function getBrowserRiskId(storage: Storage, key: string, prefix: string) {
  const current = storage.getItem(key);
  if (current?.trim()) {
    return current.trim();
  }
  const next = `${prefix}-${crypto.randomUUID()}`;
  storage.setItem(key, next);
  return next;
}

function attachClientRiskHeaders(headers: Headers) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (!headers.has('x-device-id')) {
      headers.set('x-device-id', getBrowserRiskId(window.localStorage, DEVICE_ID_STORAGE_KEY, 'device'));
    }
    if (!headers.has('x-session-id')) {
      headers.set('x-session-id', getBrowserRiskId(window.sessionStorage, SESSION_ID_STORAGE_KEY, 'session'));
    }
  } catch {
    // 忽略浏览器存储不可用场景，避免影响主流程请求
  }
}

async function unwrapResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const result = text ? parseJsonSafely(text) : null;
  if (!response.ok) {
    throw new Error(buildRequestErrorMessage(response.status, result, text));
  }
  return (result?.data ?? result) as T;
}

export async function serverGet<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${serverApiBase}${path}`, {
    ...init,
  });
  return unwrapResponse<T>(response);
}

export async function clientFetch<T>(path: string, options?: RequestInit, token?: string) {
  const headers = new Headers(options?.headers || {});
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  if (!isFormData && options?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  attachClientRiskHeaders(headers);

  const response = await fetch(`${browserApiBase}${path}`, {
    ...options,
    headers,
  });

  return unwrapResponse<T>(response);
}

export function clientUpload<T>(
  path: string,
  body: FormData,
  options?: {
    onProgress?: (progress: ClientUploadProgress) => void;
    token?: string;
    timeoutMs?: number;
  },
) {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${browserApiBase}${path}`);
    xhr.withCredentials = true;
    xhr.timeout = options?.timeoutMs ?? 10 * 60 * 1000;
    if (options?.token) {
      xhr.setRequestHeader('Authorization', `Bearer ${options.token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        options?.onProgress?.({
          phase: 'uploading',
          loaded: event.loaded,
          total: event.total,
          percent: 10,
        });
        return;
      }
      options?.onProgress?.({
        phase: 'uploading',
        loaded: event.loaded,
        total: event.total,
        percent: Math.min(90, Math.round((event.loaded / event.total) * 90)),
      });
    };

    xhr.upload.onload = () => {
      options?.onProgress?.({
        phase: 'processing',
        loaded: 1,
        total: 1,
        percent: 92,
      });
    };

    xhr.onerror = () => {
      reject(new Error('上传请求失败，请检查网络连接后重试'));
    };

    xhr.ontimeout = () => {
      reject(new Error('上传超时，请稍后重试或拆分文件后再次导入'));
    };

    xhr.onload = () => {
      const text = xhr.responseText || '';
      const payload = text ? parseJsonSafely(text) : null;
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(buildRequestErrorMessage(xhr.status, payload, text)));
        return;
      }
      options?.onProgress?.({
        phase: 'completed',
        loaded: 1,
        total: 1,
        percent: 100,
      });
      resolve((payload?.data ?? payload) as T);
    };

    xhr.send(body);
  });
}

export function getBrowserApiBase() {
  return browserApiBase;
}
