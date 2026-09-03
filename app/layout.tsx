import type { Metadata } from 'next';
import { Geist, Space_Grotesk } from 'next/font/google';
import './globals.css';
import './mobile-chat-polish.css';
import './phase4-polish.css';
import './phase41-brand-mobile.css';
import { AppStructureFlowBackground } from '@/components/effects/structure-flow-background';
import { ServiceWorkerRegistration } from '@/components/pwa/service-worker-registration';
import { PublicAiTurnstile } from '@/components/security/public-ai-turnstile';
import { Toaster } from '@/components/ui/toaster';

const geist = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-abhiai-sans',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-abhiai-brand',
});

const publicImageStudioEnabled = process.env.NEXT_PUBLIC_ENABLE_PUBLIC_IMAGE_STUDIO === 'true';
const liveVoiceEnabled = process.env.NEXT_PUBLIC_ENABLE_LIVE_VOICE === 'true';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://abhiai.vercel.app'),
  title: {
    default: 'AbhiAI',
    template: '%s · AbhiAI',
  },
  description: 'AbhiAI — Intelligence. Clarity. Innovation.',
  icons: {
    icon: [{ url: '/branding/abhiai-favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
  },
  openGraph: {
    title: 'AbhiAI',
    description: 'Intelligence. Clarity. Innovation.',
    type: 'website',
    images: ['/branding/abhiai-brand-mark.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AbhiAI',
    description: 'Intelligence. Clarity. Innovation.',
    images: ['/branding/abhiai-brand-mark.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${spaceGrotesk.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('theme');
                if (t === 'dark' || ((!t || t === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch {
                document.documentElement.classList.remove('dark');
              }
            `,
          }}
        />
        {!liveVoiceEnabled && (
          <style>{`button[title="Start Live Voice Conversation"] { display: none !important; }`}</style>
        )}
        {!publicImageStudioEnabled && (
          <style>{`
            button[title="Open AI Image Studio"],
            button[title="Image Studio"],
            button[title="Generate AI Image from prompt"],
            .fixed.inset-y-0.left-0 button.bg-gradient-to-r { display: none !important; }
          `}</style>
        )}
      </head>
      <body
        className={`${geist.className} bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 selection:bg-zinc-200 dark:selection:bg-zinc-800 transition-colors duration-200 relative min-h-screen`}
        data-public-image-studio={publicImageStudioEnabled ? 'true' : 'false'}
        data-live-voice={liveVoiceEnabled ? 'true' : 'false'}
        suppressHydrationWarning
      >
        <AppStructureFlowBackground />
        <div className="relative z-10 min-h-screen">
          {children}
        </div>
        <Toaster />
        <PublicAiTurnstile />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
