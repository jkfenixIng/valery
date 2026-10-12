import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const port = 3100;
const standaloneServer = fileURLToPath(
  new URL('../.next/standalone/server.js', import.meta.url),
);
const expectedHeaders = {
  'content-security-policy': [
    "default-src 'self'",
    "script-src 'self'",
    "'strict-dynamic'",
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ],
  'permissions-policy': ['camera=(), microphone=(), geolocation=()'],
  'referrer-policy': ['strict-origin-when-cross-origin'],
  'x-content-type-options': ['nosniff'],
  'x-frame-options': ['DENY'],
};

const server = spawn(process.execPath, [standaloneServer], {
  env: { PORT: String(port) },
  stdio: 'ignore',
  windowsHide: true,
});
const serverExit = once(server, 'exit');

const stopServer = () => {
  if (!server.killed) {
    server.kill();
  }
};

try {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}`);

      for (const [header, directives] of Object.entries(expectedHeaders)) {
        const emittedValue = response.headers.get(header);

        if (!emittedValue) {
          throw new Error(`Missing expected ${header} header.`);
        }

        for (const directive of directives) {
          if (!emittedValue.includes(directive)) {
            throw new Error(`Missing ${directive} in ${header} header.`);
          }
        }
      }

      const contentSecurityPolicy = response.headers.get(
        'content-security-policy',
      );
      const secondResponse = await fetch(`http://127.0.0.1:${port}/design`);
      const secondContentSecurityPolicy = secondResponse.headers.get(
        'content-security-policy',
      );
      const noncePattern = /'nonce-([^']+)'/;
      const firstNonce = contentSecurityPolicy?.match(noncePattern)?.[1];
      const secondNonce = secondContentSecurityPolicy?.match(noncePattern)?.[1];

      if (!firstNonce || !secondNonce || firstNonce === secondNonce) {
        throw new Error('Each response must emit a unique CSP nonce.');
      }

      if (
        contentSecurityPolicy?.includes("'unsafe-inline'") ||
        contentSecurityPolicy?.includes("'unsafe-eval'")
      ) {
        throw new Error(
          'Production CSP must not include unsafe-inline or unsafe-eval.',
        );
      }

      if (response.headers.has('strict-transport-security')) {
        throw new Error(
          'HSTS must remain disabled during the local-only phase.',
        );
      }

      process.exitCode = 0;
      break;
    } catch (error) {
      if (attempt === 29) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
} finally {
  stopServer();
  await serverExit;
}
