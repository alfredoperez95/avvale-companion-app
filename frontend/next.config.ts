import type { NextConfig } from 'next';

/**
 * Destino del proxy **server-side** para `/api/*` (solo el proceso Node de Next).
 * En producción dentro de Docker/Coolify, `localhost:4000` suele ser incorrecto (el Nest va en otro contenedor).
 * Define `INTERNAL_API_URL` en el **build del frontend**, p. ej. `http://nombre-servicio-nest:4000`.
 * No confundir con `NEXT_PUBLIC_API_URL` (navegador): si el cliente usa URLs relativas `/api`, este valor solo afecta al rewrite interno de Next.
 */
const apiRewriteTarget =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:4000'
    : (process.env.INTERNAL_API_URL?.trim() || 'http://localhost:4000');

if (process.env.NODE_ENV === 'production' && !process.env.INTERNAL_API_URL?.trim()) {
  console.warn(
    '[next.config] INTERNAL_API_URL no está definido: los rewrites /api→Nest usan http://localhost:4000. En Coolify/Docker, define INTERNAL_API_URL con la URL interna del backend (p. ej. http://backend:4000).',
  );
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/extension/avvale-companion-extension.zip',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ];
  },
  /**
   * Rewrites a `http://localhost:4000` en dev usan un proxy con timeout por defecto (~30s).
   * El chat RFQ y otras rutas que esperan al LLM pueden superarlo → ECONNRESET / "socket hang up".
   * @see https://github.com/vercel/next.js/issues/36251
   */
  experimental: {
    proxyTimeout: 180_000,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.avvale.com',
        pathname: '/hubfs/**',
      },
      /** Logo Avvale en flujo de invitación / login (mismo asset que plantillas de correo). */
      {
        protocol: 'https',
        hostname: 'www.sap.com',
        pathname: '/dam/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiRewriteTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
