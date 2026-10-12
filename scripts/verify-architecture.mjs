import { execFileSync } from 'node:child_process';

const fixtures = [
  'tests/architecture/fixtures/invalid-domain',
  'tests/architecture/fixtures/invalid-presentation',
];

for (const fixture of fixtures) {
  try {
    execFileSync('depcruise', ['--validate', '.dependency-cruiser.cjs', fixture], {
      stdio: 'pipe',
    });
  } catch {
    continue;
  }

  console.error(`Architecture fixture unexpectedly passed: ${fixture}`);
  process.exit(1);
}
