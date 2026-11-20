import type { NextConfig } from 'next';
import { getSecurityHeaderRules } from './src/lib/security-headers';

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 60,
      static: 120,
    },
  },
  async headers() {
    return getSecurityHeaderRules();
  },
};

export default nextConfig;
