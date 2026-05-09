import { NextRequest } from 'next/server';
import { ADMIN_TOKEN_COOKIE } from '@/lib/admin-auth';

const serverApiBase = process.env.INTERNAL_API_BASE_URL ?? '';
if (!serverApiBase) {
  throw new Error('Missing INTERNAL_API_BASE_URL in root .env');
}

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
    const response = await fetch(targetUrl, init);
    console.log(`[Proxy] Response: ${response.status} from ${targetUrl}`);

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('content-length');
    responseHeaders.delete('content-encoding');

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[Proxy] Error fetching ${targetUrl}:`, error);
    return new Response(JSON.stringify({ success: false, message: 'Proxy connection error' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const dynamic = 'force-dynamic';

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as OPTIONS };
