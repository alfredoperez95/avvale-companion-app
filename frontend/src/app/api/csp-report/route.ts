import { NextResponse } from 'next/server';

const MAX_REPORT_BYTES = 16 * 1024;
const LOG_PREVIEW_BYTES = 4 * 1024;

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
    return new NextResponse(null, { status: 204 });
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

  return new NextResponse(null, { status: 204 });
}
