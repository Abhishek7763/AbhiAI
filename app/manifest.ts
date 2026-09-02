import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AbhiAI — Intelligent AI Assistant',
    short_name: 'AbhiAI',
    description: 'Ultra-fast multi-model AI assistant by Abhishek with zero-downtime routing, agents, and vision.',
    start_url: '/',
    display: 'standalone',
    background_color: '#090a0f',
    theme_color: '#090a0f',
    icons: [
      {
        src: '/branding/abhiai-icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/branding/abhiai-icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
