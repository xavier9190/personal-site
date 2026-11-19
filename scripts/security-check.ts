import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSecurityAudit } from '../src/lib/security-audit';

export function runSecurityCheckCli(rootDir: string = process.cwd()): number {
  const report = runSecurityAudit(rootDir);

  if (report.ok) {
    console.log(
      `[security:check] PASS — scanned ${report.scannedFiles} files, verified ${report.checkedAuthFiles} auth-guarded modules and ${report.checkedTables} RLS-protected tables.`,
    );
    return 0;
  }

  console.error(
    `[security:check] FAIL — found ${report.violations.length} security violation(s):`,
  );
  for (const violation of report.violations) {
    const location = violation.line ? `${violation.file}:${violation.line}` : violation.file;
    console.error(`  - [${violation.rule}] ${location} — ${violation.message}`);
  }
  return 1;
}

const isCliEntrypoint =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCliEntrypoint) {
  process.exitCode = runSecurityCheckCli();
}
