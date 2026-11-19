import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import {
  checkAuthGuards,
  checkHardcodedSecrets,
  checkMigrationRls,
  runSecurityAudit,
} from './security-audit';

describe('HTTP security headers (next.config.ts)', () => {
  it('configures all required security and anti-indexing headers for every route', async () => {
    expect(typeof nextConfig.headers).toBe('function');

    const rules = await nextConfig.headers!();
    const catchAllRule = rules.find((rule) => rule.source === '/:path*');
    expect(catchAllRule).toBeDefined();

    const headerMap = new Map(
      (catchAllRule?.headers ?? []).map((header) => [header.key.toLowerCase(), header.value]),
    );

    expect(headerMap.get('x-frame-options')).toBe('DENY');
    expect(headerMap.get('x-content-type-options')).toBe('nosniff');
    expect(headerMap.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(headerMap.get('strict-transport-security')).toBe(
      'max-age=63072000; includeSubDomains; preload',
    );
    expect(headerMap.get('x-robots-tag')).toBe('noindex, nofollow, noarchive');

    const permissionsPolicy = headerMap.get('permissions-policy');
    expect(permissionsPolicy).toBeDefined();
    expect(permissionsPolicy).toContain('camera=()');
    expect(permissionsPolicy).toContain('geolocation=()');
  });
});

describe('checkHardcodedSecrets', () => {
  it('flags hardcoded API keys, real postgres URLs, and private keys', () => {
    const fakeGeminiKey = 'AIza' + 'SyD9x8k2m4n6p8q0r2s4t6u8v0w2x4y6z8A';
    const fakeSkKey = 'sk-' + 'live_1234567890abcdefghijklmnop';
    const fakePgUrl = 'postgres://' + 'prod_admin:S3cur3P@ss99@db.abcdefgh.supabase.co:5432/postgres';
    const fakePem = '-----BEGIN ' + 'RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA';

    const violations = checkHardcodedSecrets([
      { path: 'src/lib/bad-gemini.ts', content: `const key = "${fakeGeminiKey}";` },
      { path: 'src/lib/bad-sk.ts', content: `const key = "${fakeSkKey}";` },
      { path: 'src/lib/bad-db.ts', content: `const url = "${fakePgUrl}";` },
      { path: 'src/lib/bad-pem.ts', content: `const pem = \`${fakePem}\`;` },
    ]);

    expect(violations).toHaveLength(4);
    expect(violations.every((v) => v.rule === 'no-hardcoded-secrets')).toBe(true);
    expect(violations.map((v) => v.file).sort()).toEqual([
      'src/lib/bad-db.ts',
      'src/lib/bad-gemini.ts',
      'src/lib/bad-pem.ts',
      'src/lib/bad-sk.ts',
    ]);
  });

  it('allows placeholder connection strings and empty env templates', () => {
    const violations = checkHardcodedSecrets([
      {
        path: '.env.example',
        content: [
          'GEMINI_API_KEY=',
          'DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.example.supabase.co:5432/postgres',
          'LOCAL_DB=postgres://postgres:postgres@localhost:5432/personal_site',
        ].join('\n'),
      },
    ]);

    expect(violations).toEqual([]);
  });
});

describe('checkAuthGuards', () => {
  it('flags exported Server Actions and private API route handlers missing requireSessionAuth', () => {
    const violations = checkAuthGuards([
      {
        path: 'src/features/calendar/actions.ts',
        content: `'use server';
import { requireSessionAuth } from '@/lib/session-auth';

export async function safeAction() {
  await requireSessionAuth();
  return { ok: true };
}

export async function unprotectedAction() {
  return { ok: true };
}
`,
      },
      {
        path: 'src/app/api/private/route.ts',
        content: `import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  return new Response('ok');
}
`,
      },
      {
        path: 'src/app/api/pin/route.ts',
        content: `export async function POST() {
  return new Response('login');
}
`,
      },
    ]);

    expect(violations).toHaveLength(2);
    expect(violations.every((v) => v.rule === 'require-session-auth')).toBe(true);
    expect(violations.map((v) => v.file).sort()).toEqual([
      'src/app/api/private/route.ts',
      'src/features/calendar/actions.ts',
    ]);
    expect(violations.some((v) => v.message.includes('unprotectedAction'))).toBe(true);
    expect(violations.some((v) => v.message.includes('POST'))).toBe(true);
  });

  it('passes when all Server Actions and private API routes invoke requireSessionAuth', () => {
    const violations = checkAuthGuards([
      {
        path: 'src/features/shopping/actions.ts',
        content: `'use server';
import { requireSessionAuth } from '@/lib/session-auth';

export async function addItemAction(name: string) {
  await requireSessionAuth();
  return { ok: true, name };
}
`,
      },
      {
        path: 'src/app/api/chat/stream/route.ts',
        content: `import { NextRequest } from 'next/server';
import { requireSessionAuth } from '@/lib/session-auth';

export async function POST(req: NextRequest) {
  await requireSessionAuth(req);
  return new Response('ok');
}
`,
      },
    ]);

    expect(violations).toEqual([]);
  });
});

describe('checkMigrationRls', () => {
  it('flags tables missing ENABLE ROW LEVEL SECURITY or REVOKE ALL FROM anon, authenticated', () => {
    const violations = checkMigrationRls(
      [
        {
          path: 'src/db/migrations-pg/0000_initial.sql',
          content: `
            ALTER TABLE "calendar_events" ENABLE ROW LEVEL SECURITY;
            REVOKE ALL ON TABLE "calendar_events" FROM anon, authenticated;
            ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
          `,
        },
      ],
      ['calendar_events', 'transactions', 'shopping_items'],
    );

    expect(violations.every((v) => v.rule === 'migration-rls-required')).toBe(true);
    expect(violations.some((v) => v.message.includes('transactions') && v.message.includes('REVOKE'))).toBe(true);
    expect(violations.some((v) => v.message.includes('shopping_items') && v.message.includes('ENABLE ROW LEVEL SECURITY'))).toBe(true);
    expect(violations.some((v) => v.message.includes('shopping_items') && v.message.includes('REVOKE'))).toBe(true);
    expect(violations).toHaveLength(3);
  });

  it('passes when every table has RLS enabled and anon/authenticated revoked', () => {
    const violations = checkMigrationRls(
      [
        {
          path: 'src/db/migrations-pg/0000_initial.sql',
          content: `
            ALTER TABLE "calendar_events" ENABLE ROW LEVEL SECURITY;
            REVOKE ALL ON TABLE "calendar_events" FROM anon, authenticated;
          `,
        },
      ],
      ['calendar_events'],
    );

    expect(violations).toEqual([]);
  });
});

describe('runSecurityAudit', () => {
  it('passes cleanly on the real repository with all 13 tables and auth-guarded endpoints', () => {
    const repoRoot = path.resolve(__dirname, '../..');
    const report = runSecurityAudit(repoRoot);

    expect(report.violations).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.checkedTables).toBe(13);
    expect(report.checkedAuthFiles).toBeGreaterThanOrEqual(7);
  });

  it('fails when run against a workspace with a missing RLS table, unguarded action, or secret', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'security-audit-test-'));
    try {
      fs.mkdirSync(path.join(tmpDir, 'src/features/demo'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, 'src/db/migrations-pg'), { recursive: true });

      const fakeKey = 'AIza' + 'SyD9x8k2m4n6p8q0r2s4t6u8v0w2x4y6z8A';
      fs.writeFileSync(
        path.join(tmpDir, 'src/features/demo/actions.ts'),
        `'use server';\nconst leak = "${fakeKey}";\nexport async function badAction() { return leak; }\n`,
        'utf8',
      );
      fs.writeFileSync(
        path.join(tmpDir, 'src/db/migrations-pg/0000_initial.sql'),
        'CREATE TABLE "calendar_events" ("id" text PRIMARY KEY);\n',
        'utf8',
      );

      const report = runSecurityAudit(tmpDir);
      expect(report.ok).toBe(false);
      expect(report.violations.some((v) => v.rule === 'no-hardcoded-secrets')).toBe(true);
      expect(report.violations.some((v) => v.rule === 'require-session-auth')).toBe(true);
      expect(report.violations.some((v) => v.rule === 'migration-rls-required')).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
