import type { NextConfig } from 'next';
import { getSecurityHeaderRules } from './src/lib/security-headers';

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  async headers() {
    return getSecurityHeaderRules();
  },
};

export default nextConfig;
