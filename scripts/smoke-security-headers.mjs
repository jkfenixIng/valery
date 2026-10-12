import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const port = 3100;
const nextExecutable = fileURLToPath(
  new URL('../node_modules/next/dist/bin/next', import.meta.url),
);
const expectedHeaders = {
  'content-security-policy': "default-src 'self'",
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

const server = spawn(process.execPath, [nextExecutable, 'start', '--port', String(port)], {
  env: { ...process.env, NODE_ENV: 'production' },
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

      for (const [header, value] of Object.entries(expectedHeaders)) {
        if (!response.headers.get(header)?.includes(value)) {
          throw new Error(`Missing expected ${header} header.`);
        }
      }

      if (response.headers.has('strict-transport-security')) {
        throw new Error('HSTS must remain disabled during the local-only phase.');
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
