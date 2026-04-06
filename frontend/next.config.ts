import type { NextConfig } from 'next';

const apiBaseUrl =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:4000'
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
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
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
