import { execFileSync } from 'node:child_process';

const fixture = 'tests/architecture/fixtures/invalid-domain';

try {
  execFileSync('depcruise', ['--validate', '.dependency-cruiser.cjs', fixture], {
    stdio: 'pipe',
  });
} catch {
  process.exit(0);
}

console.error('Architecture fixture unexpectedly passed.');
process.exit(1);
