import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const port = 3101;
const cachingStrategies = [
  'CacheFirst',
  'CacheOnly',
  'NetworkFirst',
  'StaleWhileRevalidate',
  'defaultCache',
];

// Minified names change between builds, so assert on the emitted shape: the
// only runtime route is navigations handled by a class that never reads or
// writes a cache (NetworkOnly).
const hasNetworkOnlyNavigationRoute = (body) => {
  const route = body.match(
    /runtimeCaching:\[\{matcher:\(\{request:(\w+)\}\)=>\1\.mode==="navigate",handler:new ([\w$]+)\}\]/,
  );
  if (!route) {
    return false;
  }
  const start = body.indexOf(`${route[2]}=class extends`);
  const end = body.indexOf(';var ', start);
  const handlerClass = body.slice(start, end);
  return (
    start !== -1 &&
    end !== -1 &&
    handlerClass.includes('Timed out the network response') &&
    !handlerClass.includes('cacheMatch') &&
    !handlerClass.includes('CachePut')
  );
};

const hasOfflineDocumentFallback = (body) =>
  /fallbacks:\{entries:\[\{url:"\/~offline",matcher\(\{request:(\w+)\}\)\{return \1\.destination==="document"\}\}\]\}/.test(
    body,
  );
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
        !hasNetworkOnlyNavigationRoute(serviceWorkerBody) ||
        !hasOfflineDocumentFallback(serviceWorkerBody) ||
        serviceWorkerBody.includes('/admin') ||
        serviceWorkerBody.includes('/auth') ||
        serviceWorkerBody.includes('/api') ||
        cachingStrategies.some((name) => serviceWorkerSource.includes(name)) ||
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
