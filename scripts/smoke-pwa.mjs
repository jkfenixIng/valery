import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const port = 3101;
const standaloneServer = fileURLToPath(
  new URL('../.next/standalone/server.js', import.meta.url),
);
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
      const [manifest, serviceWorker, offline] = await Promise.all([
        fetch(`http://127.0.0.1:${port}/manifest.webmanifest`),
        fetch(`http://127.0.0.1:${port}/sw.js`),
        fetch(`http://127.0.0.1:${port}/~offline`),
      ]);

      if (
        !manifest.ok ||
        !serviceWorker.ok ||
        !offline.ok ||
        !manifest.headers
          .get('content-type')
          ?.includes('application/manifest+json')
      ) {
        throw new Error(
          'PWA manifest, service worker, or offline page is unavailable.',
        );
      }

      const manifestBody = await manifest.json();
      const serviceWorkerBody = await serviceWorker.text();
      const serviceWorkerSource = await readFile(
        new URL('../src/app/sw.ts', import.meta.url),
        'utf8',
      );
      const serwistConfig = await readFile(
        new URL('../serwist.config.mjs', import.meta.url),
        'utf8',
      );

      if (
        manifestBody.icons?.length !== 3 ||
        !serviceWorkerBody.includes('skipWaiting') ||
        !serviceWorkerBody.includes('clientsClaim') ||
        serviceWorkerBody.includes('/admin') ||
        serviceWorkerBody.includes('/auth') ||
        serviceWorkerBody.includes('/api') ||
        serviceWorkerSource.includes('runtimeCaching') ||
        serwistConfig.includes('public/**/*') ||
        serwistConfig.includes('precachePrerendered: true')
      ) {
        throw new Error(
          'PWA service worker or cache policy contract is incomplete.',
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
