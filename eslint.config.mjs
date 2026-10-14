import eslint from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

const config = [
  {
    ignores: [
      '.next/**',
      'coverage/**',
      'node_modules/**',
      'public/sw.js',
      'public/sw.js.map',
      '.dependency-cruiser.cjs',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextVitals,
  prettier,
];

export default config;
