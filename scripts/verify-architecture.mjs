import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const nodeExecutable = process.execPath;
const dependencyCruiser = fileURLToPath(
  new URL(
    '../node_modules/dependency-cruiser/bin/dependency-cruiser.mjs',
    import.meta.url,
  ),
);

const negativeFixtures = [
  [
    'domain framework import',
    'domain-does-not-import-zod',
    'tests/architecture/fixtures/invalid-domain',
  ],
  [
    'presentation shared-domain import',
    'presentation-does-not-bypass-composition',
    'tests/architecture/fixtures/invalid-presentation',
  ],
  [
    'presentation module domain import',
    'presentation-does-not-bypass-composition',
    'tests/architecture/fixtures/invalid-presentation-module-domain',
  ],
  [
    'presentation non-container composition import',
    'presentation-imports-only-composition-container',
    'tests/architecture/fixtures/invalid-composition',
  ],
];

const runDependencyCruiser = (fixture) =>
  execFileSync(
    nodeExecutable,
    [dependencyCruiser, '--validate', '.dependency-cruiser.cjs', fixture],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );

for (const [scenario, rule, fixture] of negativeFixtures) {
  try {
    runDependencyCruiser(fixture);
  } catch (error) {
    const output = [
      error.stdout,
      error.stderr,
      error.output?.[1],
      error.output?.[2],
    ]
      .filter(Boolean)
      .join('');
    const message = `${error.message ?? ''}${output}`;

    if (message.includes(`error ${rule}:`)) {
      continue;
    }

    console.error(
      `Architecture fixture failed without the expected rule: ${scenario} (${fixture})`,
    );
    console.error(`Expected rule: ${rule}`);
    console.error(message);
    process.exit(1);
  }

  console.error(
    `Architecture fixture unexpectedly passed: ${scenario} (${fixture})`,
  );
  process.exit(1);
}

const validContainerFixture = 'tests/architecture/fixtures/valid-container';

try {
  runDependencyCruiser(validContainerFixture);
} catch (error) {
  console.error(
    `Allowed container fixture unexpectedly failed: ${validContainerFixture}`,
  );
  console.error(
    `${error.message ?? ''}${[
      error.stdout,
      error.stderr,
      error.output?.[1],
      error.output?.[2],
    ]
      .filter(Boolean)
      .join('')}`,
  );
  process.exit(1);
}
