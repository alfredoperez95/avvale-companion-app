/**
 * Content-Security-Policy para mitigar inyecciones tipo ClearFake/ClickFix/EtherHiding:
 * - `script-src` con nonce + `strict-dynamic` → un `<script>` inline sin nonce (el loader BSC) no se ejecuta.
 * - Sin `'unsafe-eval'` en producción → bloquea `eval(atob(...))` del payload.
 * - `connect-src` en lista blanca → aunque algo se ejecutara, no podría llamar a RPC BSC / Yandex / C2.
 */

export type CspEnv = {
  isDev: boolean;
  /** Orígenes extra permitidos en connect-src (p. ej. NEXT_PUBLIC_API_URL). */
  connectOrigins?: Array<string | undefined>;
};

export type CspMode = 'report-only' | 'enforce';

const CSP_REPORT_ENDPOINT = '/api/csp-report';
const CSP_REPORT_GROUP = 'csp-endpoint';
const PERMISSIONS_POLICY =
  'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()';

function originFromUrl(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    return new URL(raw.trim()).origin;
  } catch {
    return null;
  }
}

/** Orígenes de API / front públicos conocidos + los de env. */
export function collectConnectOrigins(envUrls: Array<string | undefined> = []): string[] {
  const set = new Set<string>([
    "'self'",
    'https://www.avvalecompanion.app',
    'https://avvalecompanion.app',
    'https://t3.gstatic.com',
    'https://api.elevenlabs.io',
    'https://api.us.elevenlabs.io',
    'https://api.eu.residency.elevenlabs.io',
    'https://api.in.residency.elevenlabs.io',
    'wss://api.elevenlabs.io',
    'wss://api.us.elevenlabs.io',
    'wss://api.eu.residency.elevenlabs.io',
    'wss://api.in.residency.elevenlabs.io',
  ]);

  for (const raw of envUrls) {
    const o = originFromUrl(raw);
    if (o) set.add(o);
  }

  return [...set];
}

export function buildContentSecurityPolicy(nonce: string, env: CspEnv): string {
  const connect = collectConnectOrigins(env.connectOrigins ?? []);
  if (env.isDev) {
    connect.push('http://localhost:3000', 'http://localhost:4000', 'http://127.0.0.1:3000', 'http://127.0.0.1:4000');
    connect.push('ws://localhost:3000', 'ws://127.0.0.1:3000');
  }

  const scriptSrc = [
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(env.isDev ? ["'unsafe-eval'"] : []),
  ];

  const directives: string[] = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob: https://www.sap.com https://www.avvale.com https://t3.gstatic.com https://*.hubspot.com https://*.hsforms.com",
    "font-src 'self' data:",
    `connect-src ${[...new Set(connect)].join(' ')}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-src blob: https://*.elevenlabs.io",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    `report-uri ${CSP_REPORT_ENDPOINT}`,
    `report-to ${CSP_REPORT_GROUP}`,
  ];

  // Solo en prod: en http://localhost rompería el front al forzar HTTPS.
  if (!env.isDev) {
    directives.push('upgrade-insecure-requests');
  }

  return directives.join('; ').replace(/\s{2,}/g, ' ').trim();
}

/** Cabeceras de endurecimiento reutilizables para respuestas sin CSP nonce (assets, report endpoint, etc.). */
export function buildBaseSecurityHeaders(
  options: { isDev: boolean } = { isDev: false },
): Array<{ key: string; value: string }> {
  const headers: Array<{ key: string; value: string }> = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
    { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
    { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  ];

  if (!options.isDev) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains; preload',
    });
  }

  return headers;
}

/** Cabeceras de endurecimiento complementarias (además de CSP). */
export function buildSecurityHeaders(
  csp: string,
  options: { isDev: boolean; mode?: CspMode } = { isDev: false, mode: 'report-only' },
): Array<{ key: string; value: string }> {
  const cspHeaderName =
    options.mode === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
  const headers: Array<{ key: string; value: string }> = [
    { key: cspHeaderName, value: csp },
    {
      key: 'Report-To',
      value: JSON.stringify({
        group: CSP_REPORT_GROUP,
        max_age: 10886400,
        endpoints: [{ url: CSP_REPORT_ENDPOINT }],
      }),
    },
    ...buildBaseSecurityHeaders({ isDev: options.isDev }),
  ];

  return headers;
}
