import { execFileSync } from 'node:child_process';

const output = execFileSync(
  'git',
  ['grep', '-n', 'process\\.env', '--', '*.ts', '*.tsx', '*.mts', '*.cts'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true },
);

const violations = output
  .trim()
  .split('\n')
  .filter(Boolean)
  .filter((line) => !line.startsWith('src/config/'));

if (violations.length > 0) {
  console.error('Environment access is only allowed under src/config.');
  console.error(violations.join('\n'));
  process.exit(1);
}
