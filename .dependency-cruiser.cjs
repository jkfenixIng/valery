/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-unresolved',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'domain-is-framework-free',
      severity: 'error',
      from: { path: '^src/(modules/[^/]+/|shared/)domain/' },
      to: {
        path: '(^src/(app|composition|config|modules/[^/]+/(application|infrastructure|presentation)|shared/infrastructure)|(^next|^react|^zod|^drizzle-orm))',
      },
    },
    {
      name: 'application-depends-inward',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/application/' },
      to: {
        path: '(^src/(app|composition|config|modules/[^/]+/(infrastructure|presentation)|shared/infrastructure)|(^next|^react|^zod|^drizzle-orm))',
      },
    },
    {
      name: 'infrastructure-does-not-import-presentation',
      severity: 'error',
      from: { path: '^src/(modules/[^/]+/|shared/)infrastructure/' },
      to: { path: '^src/(app|modules/[^/]+/presentation)/' },
    },
    {
      name: 'presentation-does-not-import-infrastructure',
      severity: 'error',
      from: { path: '^src/(app|modules/[^/]+/presentation)/' },
      to: { path: '^src/(modules/[^/]+/|shared/)infrastructure/' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(node_modules|\.next|coverage)(/|$)' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      mainFields: ['module', 'main', 'types'],
    },
  },
};
