import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Valery',
    short_name: 'Valery',
    description: 'Valery business workspace',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      {
        src: '/icons/valery-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/valery-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/valery-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
