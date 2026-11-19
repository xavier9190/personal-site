import fs from 'node:fs';
import path from 'node:path';

export interface AuditFile {
  path: string;
  content: string;
}

export type SecurityRule =
  | 'no-hardcoded-secrets'
  | 'require-session-auth'
  | 'migration-rls-required';

export interface SecurityViolation {
  rule: SecurityRule;
  file: string;
  line?: number;
  message: string;
}

interface SecretPattern {
  label: string;
  regex: RegExp;
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    label: 'Google/Gemini API key',
    regex: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    label: 'API secret key (sk-*)',
    regex: /\bsk-(?:proj-|live-|test-)?[0-9A-Za-z_-]{20,}\b/g,
  },
  {
    label: 'GitHub token',
    regex: /\b(?:(?:ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{36,}|github_pat_[0-9A-Za-z_]{22,})\b/g,
  },
  {
    label: 'AWS Access Key ID',
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    label: 'Private key block',
    regex: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,
  },
];

const POSTGRES_URL_REGEX =
  /\bpostgres(?:ql)?:\/\/([^:\s'"`]+):([^\s'"`]+)@([^\s'"`/]+)/gi;

const PLACEHOLDER_TOKENS = [
  'password',
  'your_password',
  'your-password',
  '[password]',
  '[your-password]',
  '<password>',
  'pass',
  'placeholder',
  'changeme',
  'example',
  'postgres',
  'secret',
  'xxx',
];

const PLACEHOLDER_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', 'host', 'db.example.supabase.co'];

function isPlaceholderPostgresUrl(password: string, hostWithPort: string): boolean {
  const normalizedPass = password.trim().toLowerCase();
  const host = hostWithPort.split(':')[0]?.trim().toLowerCase() ?? '';

  if (
    normalizedPass.includes('${') ||
    normalizedPass.startsWith('<') ||
    normalizedPass.startsWith('[') ||
    PLACEHOLDER_TOKENS.includes(normalizedPass)
  ) {
    return true;
  }

  if (
    host.includes('${') ||
    host.includes('example.') ||
    host.startsWith('<') ||
    host.startsWith('[') ||
    PLACEHOLDER_HOSTS.includes(host)
  ) {
    return true;
  }

  return false;
}

function lineNumberAt(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

export function checkHardcodedSecrets(files: AuditFile[]): SecurityViolation[] {
  const violations: SecurityViolation[] = [];

  for (const file of files) {
    for (const pattern of SECRET_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(file.content)) !== null) {
        violations.push({
          rule: 'no-hardcoded-secrets',
          file: file.path,
          line: lineNumberAt(file.content, match.index),
          message: `Hardcoded ${pattern.label} detected.`,
        });
      }
    }

    POSTGRES_URL_REGEX.lastIndex = 0;
    let pgMatch: RegExpExecArray | null;
    while ((pgMatch = POSTGRES_URL_REGEX.exec(file.content)) !== null) {
      const password = pgMatch[2] ?? '';
      const hostWithPort = pgMatch[3] ?? '';
      if (!isPlaceholderPostgresUrl(password, hostWithPort)) {
        violations.push({
          rule: 'no-hardcoded-secrets',
          file: file.path,
          line: lineNumberAt(file.content, pgMatch.index),
          message: 'Hardcoded PostgreSQL connection string with non-placeholder credentials detected.',
        });
      }
    }
  }

  return violations;
}

const PUBLIC_API_ROUTES = new Set(['src/app/api/pin/route.ts']);

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

function isServerActionFile(filePath: string, content: string): boolean {
  const normalized = normalizePath(filePath);
  if (!normalized.startsWith('src/features/') || !/\.(ts|tsx)$/.test(normalized)) {
    return false;
  }
  if (/\.test\.(ts|tsx)$/.test(normalized)) {
    return false;
  }
  return /^\s*['"]use server['"]\s*;?/m.test(content);
}

function isPrivateApiRoute(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  if (!/^src\/app\/api\/.+\/route\.(ts|tsx)$/.test(normalized)) {
    return false;
  }
  return !PUBLIC_API_ROUTES.has(normalized);
}

function skipWhitespaceAndComments(code: string, start: number): number {
  let i = start;
  while (i < code.length) {
    const ch = code[i];
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      i += 1;
    } else if (ch === '/' && code[i + 1] === '/') {
      i += 2;
      while (i < code.length && code[i] !== '\n') i += 1;
    } else if (ch === '/' && code[i + 1] === '*') {
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i += 1;
      i += 2;
    } else {
      break;
    }
  }
  return i;
}

function skipString(code: string, start: number): number {
  const quote = code[start];
  let i = start + 1;
  while (i < code.length) {
    if (code[i] === '\\') {
      i += 2;
      continue;
    }
    if (code[i] === quote) {
      return i + 1;
    }
    i += 1;
  }
  return code.length;
}

function findMatchingDelimiter(
  code: string,
  openIdx: number,
  openChar: string,
  closeChar: string,
): number {
  let depth = 0;
  let i = openIdx;
  while (i < code.length) {
    const ch = code[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipString(code, i);
      continue;
    }
    if (ch === '/' && code[i + 1] === '/') {
      i += 2;
      while (i < code.length && code[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (ch === openChar) {
      depth += 1;
    } else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return -1;
}

function findFunctionBodyStart(code: string, afterParamsIdx: number): number {
  let i = skipWhitespaceAndComments(code, afterParamsIdx);

  // Skip optional return type annotation `: ...`
  if (code[i] === ':') {
    i += 1;
    let angleDepth = 0;
    let parenDepth = 0;
    let bracketDepth = 0;
    while (i < code.length) {
      i = skipWhitespaceAndComments(code, i);
      const ch = code[i];
      if (!ch) break;
      if (ch === "'" || ch === '"' || ch === '`') {
        i = skipString(code, i);
        continue;
      }
      if (ch === '<') {
        angleDepth += 1;
        i += 1;
      } else if (ch === '>') {
        if (angleDepth > 0) angleDepth -= 1;
        i += 1;
      } else if (ch === '(') {
        parenDepth += 1;
        i += 1;
      } else if (ch === ')') {
        if (parenDepth > 0) parenDepth -= 1;
        i += 1;
      } else if (ch === '[') {
        bracketDepth += 1;
        i += 1;
      } else if (ch === ']') {
        if (bracketDepth > 0) bracketDepth -= 1;
        i += 1;
      } else if (ch === '=' && code[i + 1] === '>' && angleDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
        // Arrow function body follows `=>`
        i = skipWhitespaceAndComments(code, i + 2);
        return code[i] === '{' ? i : -1;
      } else if (ch === '{' && angleDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
        // Could be an inline object return type `{ ok: boolean } {` or the function body `{`
        const closeBrace = findMatchingDelimiter(code, i, '{', '}');
        if (closeBrace === -1) return i;
        const nextAfterBrace = skipWhitespaceAndComments(code, closeBrace + 1);
        if (code[nextAfterBrace] === '{' || (code[nextAfterBrace] === '=' && code[nextAfterBrace + 1] === '>')) {
          i = closeBrace + 1;
          continue;
        }
        return i;
      } else {
        i += 1;
      }
    }
    return -1;
  }

  if (code[i] === '=' && code[i + 1] === '>') {
    i = skipWhitespaceAndComments(code, i + 2);
  }
  return code[i] === '{' ? i : -1;
}

function stripCommentsAndStrings(code: string): string {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipString(code, i);
      out += ' ';
      continue;
    }
    if (ch === '/' && code[i + 1] === '/') {
      i += 2;
      while (i < code.length && code[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i += 1;
      i += 2;
      out += ' ';
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

interface ExportedAsyncHandler {
  name: string;
  body: string;
  index: number;
}

function extractExportedAsyncHandlers(content: string): ExportedAsyncHandler[] {
  const handlers: ExportedAsyncHandler[] = [];
  const fnRegex =
    /\bexport\s+(?:async\s+function\s+([A-Za-z_$][A-Za-z0-9_$]*)|const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*async(?:\s+function)?)\s*(?:<[^>]*>)?\s*\(/g;

  let match: RegExpExecArray | null;
  while ((match = fnRegex.exec(content)) !== null) {
    const name = match[1] ?? match[2] ?? '<anonymous>';
    const openParenIdx = match.index + match[0].length - 1;
    const closeParenIdx = findMatchingDelimiter(content, openParenIdx, '(', ')');
    if (closeParenIdx === -1) continue;

    const bodyStart = findFunctionBodyStart(content, closeParenIdx + 1);
    if (bodyStart === -1) continue;

    const bodyEnd = findMatchingDelimiter(content, bodyStart, '{', '}');
    if (bodyEnd === -1) continue;

    handlers.push({
      name,
      body: content.slice(bodyStart + 1, bodyEnd),
      index: match.index,
    });
  }

  return handlers;
}

export function checkAuthGuards(files: AuditFile[]): SecurityViolation[] {
  const violations: SecurityViolation[] = [];

  for (const file of files) {
    const normalized = normalizePath(file.path);
    const serverAction = isServerActionFile(normalized, file.content);
    const privateApi = isPrivateApiRoute(normalized);

    if (!serverAction && !privateApi) {
      continue;
    }

    const handlers = extractExportedAsyncHandlers(file.content);

    for (const handler of handlers) {
      const sanitizedBody = stripCommentsAndStrings(handler.body);
      if (!/\brequireSessionAuth\s*\(/.test(sanitizedBody)) {
        violations.push({
          rule: 'require-session-auth',
          file: normalized,
          line: lineNumberAt(file.content, handler.index),
          message: `Exported ${serverAction ? 'Server Action' : 'private API handler'} "${handler.name}" is missing requireSessionAuth().`,
        });
      }
    }
  }

  return violations;
}

export const REQUIRED_DOMAIN_TABLES = [
  'calendar_events',
  'credit_cards',
  'installment_plans',
  'payable_bills',
  'transactions',
  'finance_preferences',
  'academic_projects',
  'project_milestones',
  'project_links',
  'shopping_items',
  'chat_threads',
  'chat_messages',
  'pending_tool_actions',
] as const;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function checkMigrationRls(
  sqlFiles: AuditFile[],
  requiredTables: readonly string[] = REQUIRED_DOMAIN_TABLES,
): SecurityViolation[] {
  const violations: SecurityViolation[] = [];
  const combinedSql = sqlFiles.map((file) => file.content).join('\n');
  const migrationTarget = sqlFiles[0]?.path ?? 'src/db/migrations-pg';

  for (const table of requiredTables) {
    const escaped = escapeRegex(table);
    const tableRef = `(?:(?:"?public"?\\.)?"?${escaped}"?)`;

    const rlsRegex = new RegExp(
      `ALTER\\s+TABLE\\s+${tableRef}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY\\s*;`,
      'i',
    );
    if (!rlsRegex.test(combinedSql)) {
      violations.push({
        rule: 'migration-rls-required',
        file: migrationTarget,
        message: `Table "${table}" is missing ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY in PostgreSQL migrations.`,
      });
    }

    const revokeRegex = new RegExp(
      `REVOKE\\s+ALL\\s+ON\\s+TABLE\\s+${tableRef}\\s+FROM\\s+(?:anon\\s*,\\s*authenticated|authenticated\\s*,\\s*anon)\\s*;`,
      'i',
    );
    if (!revokeRegex.test(combinedSql)) {
      violations.push({
        rule: 'migration-rls-required',
        file: migrationTarget,
        message: `Table "${table}" is missing REVOKE ALL ON TABLE "${table}" FROM anon, authenticated in PostgreSQL migrations.`,
      });
    }
  }

  return violations;
}

export interface SecurityAuditReport {
  ok: boolean;
  violations: SecurityViolation[];
  scannedFiles: number;
  checkedAuthFiles: number;
  checkedTables: number;
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  'data',
  'graphify-out',
  '.scratch',
]);

const IGNORED_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  '.env',
  '.env.local',
  '.env.development.local',
  '.env.production.local',
  '.env.test.local',
]);

const SCANNABLE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.sql',
  '.md',
  '.yml',
  '.yaml',
  '.env',
  '.example',
  '.sh',
  '.css',
]);

function shouldScanFile(relativePath: string): boolean {
  const baseName = path.basename(relativePath);
  if (IGNORED_FILES.has(baseName)) {
    return false;
  }
  if (baseName.startsWith('.env') && baseName !== '.env.example') {
    return false;
  }
  const ext = path.extname(baseName).toLowerCase();
  return SCANNABLE_EXTENSIONS.has(ext) || baseName === '.env.example';
}

function collectAuditFiles(rootDir: string, currentDir: string = rootDir): AuditFile[] {
  const results: AuditFile[] = [];
  if (!fs.existsSync(currentDir)) {
    return results;
  }

  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      results.push(...collectAuditFiles(rootDir, path.join(currentDir, entry.name)));
    } else if (entry.isFile()) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = normalizePath(path.relative(rootDir, fullPath));
      if (!shouldScanFile(relativePath)) {
        continue;
      }
      const content = fs.readFileSync(fullPath, 'utf8');
      results.push({ path: relativePath, content });
    }
  }

  return results;
}

export function runSecurityAudit(rootDir: string): SecurityAuditReport {
  const allFiles = collectAuditFiles(rootDir);

  const authFiles = allFiles.filter(
    (file) => isServerActionFile(file.path, file.content) || isPrivateApiRoute(file.path),
  );
  const sqlMigrationFiles = allFiles.filter((file) =>
    /^src\/db\/migrations-pg\/.+\.sql$/i.test(file.path),
  );

  const violations: SecurityViolation[] = [
    ...checkHardcodedSecrets(allFiles),
    ...checkAuthGuards(authFiles),
    ...checkMigrationRls(sqlMigrationFiles, REQUIRED_DOMAIN_TABLES),
  ];

  return {
    ok: violations.length === 0,
    violations,
    scannedFiles: allFiles.length,
    checkedAuthFiles: authFiles.length,
    checkedTables: REQUIRED_DOMAIN_TABLES.length,
  };
}
