import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@napi-rs/canvas', 'unpdf'],
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
  async rewrites() {
    return [
      {
        source: '/midia/:path*',
        destination: '/api/midia/:path*',
      },
    ];
  },
};

export default nextConfig;
