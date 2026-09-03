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
        src: '/branding/abhiai-brand-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
