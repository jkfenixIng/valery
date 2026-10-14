import { serwist } from '@serwist/next/config';

export default serwist({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  precachePrerendered: false,
  globPatterns: [
    'public/icons/*.{png}',
    'public/manifest.webmanifest',
    '.next/static/**/*.{js,css,ico,png,svg,webp,json,webmanifest}',
  ],
  // Navigations use NetworkOnly in src/app/sw.ts; this fallback remains precached.
  additionalPrecacheEntries: [{ url: '/~offline', revision: null }],
});
