import { NextResponse, type NextRequest } from 'next/server';
import { buildContentSecurityPolicy, buildSecurityHeaders } from '@/lib/csp';

/**
 * CSP con nonce por request (patrón oficial Next.js).
 * Bloquea loaders ClearFake/ClickFix inyectados como `<script>` inline sin nonce.
 * @see https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';

  const csp = buildContentSecurityPolicy(nonce, {
    isDev,
    connectOrigins: [
      process.env.NEXT_PUBLIC_API_URL,
      process.env.BACKEND_PUBLIC_URL,
      // Mismo origen en prod suele bastar; si el API es otro host, va en NEXT_PUBLIC_API_URL.
    ],
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  // Next usa esta cabecera en el request para aplicar el nonce a sus propios scripts.
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  for (const { key, value } of buildSecurityHeaders(csp, { isDev })) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Excluir estáticos y prefetch; CSP aplica al documento HTML.
     */
    {
      source: '/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|zip|webmanifest)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
