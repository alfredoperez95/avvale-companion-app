import { NextResponse } from 'next/server';
import { buildBaseSecurityHeaders } from '@/lib/csp';

const MAX_REPORT_BYTES = 16 * 1024;
const LOG_PREVIEW_BYTES = 4 * 1024;
const IS_DEV = process.env.NODE_ENV === 'development';

function noContentResponse(): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  for (const { key, value } of buildBaseSecurityHeaders({ isDev: IS_DEV })) {
    response.headers.set(key, value);
  }
  return response;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') ?? 'unknown';
  const body = await request.text();

  if (body.length > MAX_REPORT_BYTES) {
    console.warn('[csp-report] rejected oversized report', {
      contentType,
      bytes: body.length,
    });
    return noContentResponse();
  }

  let report: unknown = body;
  try {
    report = JSON.parse(body);
  } catch {
    report = truncate(body, LOG_PREVIEW_BYTES);
  }

  console.warn('[csp-report]', {
    contentType,
    report,
  });

  return noContentResponse();
}
