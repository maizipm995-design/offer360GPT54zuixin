import { NextRequest } from 'next/server';
import { ADMIN_TOKEN_COOKIE } from '@/lib/admin-auth';

const serverApiBase = process.env.INTERNAL_API_BASE_URL ?? '';
if (!serverApiBase) {
  throw new Error('Missing INTERNAL_API_BASE_URL in root .env');
}

// #region debug-point A:debug-reporter
async function reportResumeUploadDebugEvent(input: {
  hypothesisId: 'A' | 'B' | 'C' | 'D';
  location: string;
  msg: string;
  data?: Record<string, unknown>;
}) {
  const debugServerUrl = 'http://127.0.0.1:7777/event';
  const debugSessionId = 'resume-upload-fail';
  await fetch(debugServerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: debugSessionId,
      runId: 'pre-fix',
      hypothesisId: input.hypothesisId,
      location: input.location,
      msg: `[DEBUG] ${input.msg}`,
      data: input.data ?? {},
      ts: Date.now(),
    }),
  }).catch(() => undefined);
}
// #endregion

async function proxy(request: NextRequest, { params }: { params: { path: string[] } }) {
  const pathname = params.path.join('/');
  const search = request.nextUrl.search;
  const targetUrl = `${serverApiBase}/${pathname}${search}`;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');
  headers.delete('expect');

  if (pathname.startsWith('admin') && !headers.has('authorization')) {
    const adminToken = request.cookies.get(ADMIN_TOKEN_COOKIE)?.value;
    if (adminToken) {
      headers.set('authorization', `Bearer ${adminToken}`);
    }
  }

  const method = request.method.toUpperCase();
  console.log(`[Proxy] ${method} ${targetUrl}`);
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers,
    cache: 'no-store',
  };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = request.body;
    init.duplex = 'half';
  }

  try {
    // #region debug-point A:proxy-entry
    await reportResumeUploadDebugEvent({
      hypothesisId: 'A',
      location: 'apps/web/app/api/proxy/[...path]/route.ts:proxy',
      msg: 'proxy request start',
      data: {
        method,
        pathname,
        targetUrl,
        contentType: headers.get('content-type'),
        contentLength: request.headers.get('content-length'),
        hasAuthorization: headers.has('authorization'),
        isMultipart: (headers.get('content-type') || '').includes('multipart/form-data'),
        hasBodyStream: method !== 'GET' && method !== 'HEAD' ? request.body !== null : false,
      },
    });
    // #endregion
    const response = await fetch(targetUrl, init);
    console.log(`[Proxy] Response: ${response.status} from ${targetUrl}`);

    // #region debug-point A:proxy-response
    await reportResumeUploadDebugEvent({
      hypothesisId: 'A',
      location: 'apps/web/app/api/proxy/[...path]/route.ts:proxy',
      msg: 'proxy response received',
      data: {
        method,
        pathname,
        targetUrl,
        status: response.status,
        ok: response.ok,
        responseContentType: response.headers.get('content-type'),
      },
    });
    // #endregion

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('content-length');
    responseHeaders.delete('content-encoding');

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[Proxy] Error fetching ${targetUrl}:`, error);
    // #region debug-point A:proxy-error
    await reportResumeUploadDebugEvent({
      hypothesisId: 'A',
      location: 'apps/web/app/api/proxy/[...path]/route.ts:proxy',
      msg: 'proxy fetch failed',
      data: {
        method,
        pathname,
        targetUrl,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    // #endregion
    return new Response(JSON.stringify({ success: false, message: 'Proxy connection error' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const dynamic = 'force-dynamic';

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as OPTIONS };
