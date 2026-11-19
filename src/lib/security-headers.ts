export interface SecurityHeader {
  key: string;
  value: string;
}

export interface SecurityHeaderRule {
  source: string;
  headers: SecurityHeader[];
}

export const SECURITY_HEADERS: SecurityHeader[] = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), geolocation=(), payment=(), usb=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
];

export function getSecurityHeaderRules(): SecurityHeaderRule[] {
  return [
    {
      source: '/:path*',
      headers: SECURITY_HEADERS,
    },
  ];
}
