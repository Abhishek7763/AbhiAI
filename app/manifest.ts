import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AbhiAI — Intelligence. Clarity. Innovation.',
    short_name: 'AbhiAI',
    description: 'A modern multi-model AI assistant for reasoning, coding, creating, and exploring.',
    start_url: '/',
    display: 'standalone',
    background_color: '#071634',
    theme_color: '#071634',
    icons: [
      {
        src: '/branding/abhiai-app-icon-dark-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/branding/abhiai-app-icon-light-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
