import type { NextConfig } from 'next';

import { createSecurityHeaders } from './src/config/security';

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: createSecurityHeaders(),
      },
    ];
  },
};

export default nextConfig;
