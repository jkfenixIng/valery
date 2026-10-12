import type { NextConfig } from 'next';

import { config } from './src/config/env';
import { createSecurityHeaders } from './src/config/security';

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: createSecurityHeaders(config.NODE_ENV),
      },
    ];
  },
};

export default nextConfig;
