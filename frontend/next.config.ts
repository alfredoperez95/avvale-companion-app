import type { NextConfig } from 'next';

const apiBaseUrl =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:4000'
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
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
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
