import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'AbhiAI — Intelligence. Clarity. Innovation.',
    short_name: 'AbhiAI',
    description: 'A modern multi-model AI assistant for reasoning, coding, creating, and exploring.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#071634',
    icons: [
      {
        src: '/branding/abhiai-app-icon-light-512.png?v=20260904b',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/branding/abhiai-app-icon-light-512.png?v=20260904b',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
