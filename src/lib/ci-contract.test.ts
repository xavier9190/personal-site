import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkHardcodedSecrets } from './security-audit';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'AUTH_SECRET',
  'APP_ACCESS_PIN',
  'AUTH_SESSION_DAYS',
  'AUTH_MAX_SESSION_DAYS',
  'GEMINI_API_KEY',
] as const;

describe('CI/CD workflow contract (.github/workflows/ci-cd.yml)', () => {
  const workflowPath = path.join(REPO_ROOT, '.github', 'workflows', 'ci-cd.yml');

  it('defines PR and push triggers on main with least-privilege permissions', () => {
    expect(fs.existsSync(workflowPath)).toBe(true);
    const content = fs.readFileSync(workflowPath, 'utf8');

    expect(content).toMatch(/pull_request:\s*\r?\n\s+branches:\s*\[?\s*['"]?main['"]?\s*\]?/);
    expect(content).toMatch(/push:\s*\r?\n\s+branches:\s*\[?\s*['"]?main['"]?\s*\]?/);
    expect(content).toMatch(/permissions:\s*\r?\n\s+contents:\s*read/);
  });

  it('defines security-and-tests job executing all required validation gates', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    const securityJobIdx = content.indexOf('security-and-tests:');
    const deployJobIdx = content.indexOf('migrate-and-deploy:');

    expect(securityJobIdx).toBeGreaterThan(-1);
    expect(deployJobIdx).toBeGreaterThan(securityJobIdx);

    const securityJobSection = content.slice(securityJobIdx, deployJobIdx);
    expect(securityJobSection).toContain('actions/checkout@v4');
    expect(securityJobSection).toContain('actions/setup-node@v4');
    expect(securityJobSection).toMatch(/node-version:\s*['"]?22['"]?/);
    expect(securityJobSection).toContain('npm ci');
    expect(securityJobSection).toContain('npm run security:check');
    expect(securityJobSection).toContain('npm audit --omit=dev --audit-level=high');
    expect(securityJobSection).toContain('npm run typecheck');
    expect(securityJobSection).toContain('npm test');
    expect(securityJobSection).toContain('npm run build');
  });

  it('defines migrate-and-deploy job gated to push on main after security-and-tests without leaking secrets', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    const deployJobIdx = content.indexOf('migrate-and-deploy:');
    expect(deployJobIdx).toBeGreaterThan(-1);

    const deployJobSection = content.slice(deployJobIdx);
    expect(deployJobSection).toMatch(/needs:\s*security-and-tests/);
    expect(deployJobSection).toContain("github.event_name == 'push'");
    expect(deployJobSection).toContain("github.ref == 'refs/heads/main'");
    expect(deployJobSection).toContain('npm run db:migrate');
    expect(deployJobSection).toContain('secrets.DATABASE_URL');
    expect(deployJobSection).toContain('secrets.VERCEL_TOKEN');
    expect(deployJobSection).toContain('secrets.VERCEL_ORG_ID');
    expect(deployJobSection).toContain('secrets.VERCEL_PROJECT_ID');
    expect(deployJobSection).toContain('vercel pull --yes --environment=production');
    expect(deployJobSection).toContain('vercel build --prod');
    expect(deployJobSection).toContain('vercel deploy --prebuilt --prod');

    // Never echo or print secrets in run commands
    expect(content).not.toMatch(/\b(echo|printf|printenv)\b.*\$\{\{\s*secrets\./i);
  });
});

describe('Environment template contract (.env.example)', () => {
  const envExamplePath = path.join(REPO_ROOT, '.env.example');

  it('declares all 6 required environment variables without real secrets', () => {
    expect(fs.existsSync(envExamplePath)).toBe(true);
    const content = fs.readFileSync(envExamplePath, 'utf8');

    const declaredKeys = new Set(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'))
        .map((line) => line.split('=')[0]?.trim() ?? ''),
    );

    for (const key of REQUIRED_ENV_VARS) {
      expect(declaredKeys.has(key), `Missing ${key} in .env.example`).toBe(true);
    }

    const violations = checkHardcodedSecrets([{ path: '.env.example', content }]);
    expect(violations).toEqual([]);
  });
});

describe('Deploy & security documentation contract (docs/deploy-and-security.md)', () => {
  const docsPath = path.join(REPO_ROOT, 'docs', 'deploy-and-security.md');

  it('documents Supabase, AUTH_SECRET, Vercel, GitHub Secrets/Branch Protection, and post-deploy checklist', () => {
    expect(fs.existsSync(docsPath)).toBe(true);
    const content = fs.readFileSync(docsPath, 'utf8');

    expect(content).toContain('Supabase');
    expect(content).toContain('RLS');
    expect(content).toContain('pgbouncer=true');
    expect(content).toContain('AUTH_SECRET');
    expect(content).toContain('APP_ACCESS_PIN');
    expect(content).toContain('Vercel');
    expect(content).toContain('VERCEL_TOKEN');
    expect(content).toContain('VERCEL_ORG_ID');
    expect(content).toContain('VERCEL_PROJECT_ID');
    expect(content).toContain('security-and-tests');
    expect(content).toContain('/robots.txt');
    expect(content).toContain('/offline');
    expect(content).toContain('TRANCAR HUB');
  });
});
