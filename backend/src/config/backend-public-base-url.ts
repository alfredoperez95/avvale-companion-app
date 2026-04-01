import type { ConfigService } from '@nestjs/config';

/**
 * Nest expone rutas en la raíz (`/public/attachments`, `/activations/...`).
 * El Next del frontend reescribe `/api/*` → backend, así que las URLs que deben resolverse
 * en el dominio del cliente deben incluir `/api` antes del path: `/api/public/attachments/…`.
 *
 * Si Make llama al API Nest **directamente** (p. ej. `localhost:4000` o ngrok al Nest),
 * no debe usarse el prefijo `/api`.
 */
export function isNestDirectOrigin(baseUrl: string): boolean {
  const clean = baseUrl.trim().replace(/\/+$/, '');
  try {
    const u = new URL(clean.includes('://') ? clean : `http://${clean}`);
    const host = u.hostname.toLowerCase();
    const port = u.port;
    if ((host === 'localhost' || host === '127.0.0.1') && port === '4000') {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Base URL para prefijar rutas públicas (adjuntos) en webhooks y enlaces.
 * - Despliegue con Next: suele ser `https://host/api` → URLs `https://host/api/public/attachments/…`
 * - Nest directo: `http://localhost:4000` → `http://localhost:4000/public/attachments/…`
 */
export async function resolveBackendPublicBaseUrl(config: ConfigService): Promise<string> {
  const raw =
    config.get<string>('BACKEND_PUBLIC_URL') ??
    config.get<string>('NEXT_PUBLIC_API_URL') ??
    'http://localhost:4000';
  const clean = raw.trim().replace(/\/+$/, '');
  const withoutApiSuffix = clean.replace(/\/api$/i, '');

  if (isNestDirectOrigin(withoutApiSuffix)) {
    return withoutApiSuffix;
  }

  let resolved = `${withoutApiSuffix}/api`;

  const looksLocalhost =
    /^https?:\/\/localhost(?::\d+)?(\/|$)/i.test(withoutApiSuffix) ||
    /^https?:\/\/127\.0\.0\.1(?::\d+)?(\/|$)/i.test(withoutApiSuffix);
  if (looksLocalhost) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1200);
      const res = await fetch('http://127.0.0.1:4040/api/tunnels', { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = (await res.json()) as {
          tunnels?: { public_url?: string; proto?: string }[];
        };
        const tunnel = data.tunnels?.find((t) => t.public_url?.startsWith('https://'));
        if (tunnel?.public_url) {
          return tunnel.public_url.replace(/\/+$/, '');
        }
      }
    } catch {
      // sin ngrok: se mantiene resolved con /api para Next local en 3000, etc.
    }
  }
  return resolved;
}
