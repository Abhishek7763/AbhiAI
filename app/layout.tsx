import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { AppStructureFlowBackground } from '@/components/effects/structure-flow-background';

export const metadata: Metadata = {
  title: 'AbhiAI',
  description: 'A modern, premium, mobile-first AI platform.',
  icons: {
    icon: '/branding/abhiai-icon.png',
    apple: '/branding/abhiai-icon.png',
  },
  openGraph: {
    title: 'AbhiAI',
    description: 'A modern, premium, mobile-first AI platform.',
    type: 'website',
    images: ['/branding/abhiai-logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AbhiAI',
    description: 'A modern, premium, mobile-first AI platform.',
    images: ['/branding/abhiai-logo.png'],
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('theme');
                if (t === 'dark' || (!t || t === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 selection:bg-zinc-200 dark:selection:bg-zinc-800 transition-colors duration-200 relative min-h-screen" suppressHydrationWarning>
        <AppStructureFlowBackground />
        <div className="relative z-10 min-h-screen">
          {children}
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('ServiceWorker registration successful');
                  }, function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
