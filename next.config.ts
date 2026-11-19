import type { NextConfig } from 'next';
import { getSecurityHeaderRules } from './src/lib/security-headers';

const nextConfig: NextConfig = {
  async headers() {
    return getSecurityHeaderRules();
  },
};

export default nextConfig;
