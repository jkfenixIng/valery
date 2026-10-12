import { execFileSync } from 'node:child_process';

const command = process.platform === 'win32' ? 'where.exe' : 'which';

try {
  execFileSync(command, ['gitleaks'], { stdio: 'ignore', windowsHide: true });
} catch {
  console.error(
    'gitleaks is required. Install the Gitleaks binary before running this opt-in check.',
  );
  process.exit(1);
}

execFileSync('gitleaks', ['git', '--config', 'gitleaks.toml', '--redact'], {
  stdio: 'inherit',
  windowsHide: true,
});
