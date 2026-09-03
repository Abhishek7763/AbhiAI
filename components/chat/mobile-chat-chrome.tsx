'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  Ellipsis,
  Image as ImageIcon,
  Menu,
  Radio,
  Share2,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { AbhiLogo } from '@/components/brand/logo';
import { AccountMenu } from '@/components/auth/account-menu';
import ModelSelector from '@/components/chat/model-selector';
import { ThemeToggle } from '@/components/ui/theme-toggle';

type MobileAction = 'agent' | 'image' | 'export' | 'voice';

export default function MobileChatChrome() {
  const [moreOpen, setMoreOpen] = useState(false);
  const imageStudioEnabled = process.env.NEXT_PUBLIC_ENABLE_PUBLIC_IMAGE_STUDIO === 'true';
  const liveVoiceEnabled = process.env.NEXT_PUBLIC_ENABLE_LIVE_VOICE === 'true';

  useEffect(() => {
    if (!moreOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [moreOpen]);

  const openSidebar = () => {
    const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Open Navigation"]');
    trigger?.click();
  };

  const triggerHiddenAction = (action: MobileAction) => {
    const definitions: Record<MobileAction, { title: string; fallback: string }> = {
      agent: {
        title: 'Select Agent',
        fallback: 'Agents are not available right now.',
      },
      image: {
        title: 'Open AI Image Studio',
        fallback: 'Image Studio is currently disabled.',
      },
      export: {
        title: 'Export & Share Chat',
        fallback: 'Start a conversation before exporting it.',
      },
      voice: {
        title: 'Start Live Voice Conversation',
        fallback: 'Live Voice is currently disabled.',
      },
    };

    if (action === 'image' && !imageStudioEnabled) {
      toast.info(definitions.image.fallback);
      return;
    }
    if (action === 'voice' && !liveVoiceEnabled) {
      toast.info(definitions.voice.fallback);
      return;
    }

    const target = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.title === definitions[action].title,
    );

    if (!target || target.disabled) {
      toast.info(definitions[action].fallback);
      return;
    }

    setMoreOpen(false);
    window.requestAnimationFrame(() => target.click());
  };

  return (
    <>
      <div className="abhiai-mobile-topbar md:hidden" aria-label="AbhiAI mobile navigation">
        <button
          type="button"
          onClick={openSidebar}
          className="abhiai-mobile-menu-btn"
          aria-label="Open AbhiAI menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="abhiai-mobile-brand">
          <AbhiLogo variant="full" size="sm" href="/" priority />
        </div>

        <div className="abhiai-mobile-actions">
          <AccountMenu />
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="abhiai-mobile-menu-btn"
            aria-label="Open AbhiAI quick actions"
            title="Quick actions"
          >
            <Ellipsis className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="abhiai-mobile-model-dock md:hidden">
        <ModelSelector variant="dock" />
      </div>

      {moreOpen && (
        <div
          className="fixed inset-0 z-[190] md:hidden bg-black/35 dark:bg-black/60 backdrop-blur-[2px] flex items-end"
          role="presentation"
          onClick={() => setMoreOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="AbhiAI quick actions"
            className="w-full rounded-t-[28px] border-t border-zinc-200/80 dark:border-zinc-800 bg-white/98 dark:bg-zinc-950/98 shadow-2xl px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />

            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <AbhiLogo variant="icon" size="sm" href="" />
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Quick actions</h2>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Mobile access to desktop features
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="w-9 h-9 rounded-xl inline-flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                aria-label="Close quick actions"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => triggerHiddenAction('agent')}
                className="abhiai-mobile-action-card"
              >
                <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Agents</span>
              </button>

              <button
                type="button"
                onClick={() => triggerHiddenAction('image')}
                className="abhiai-mobile-action-card"
                aria-disabled={!imageStudioEnabled}
              >
                <ImageIcon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span>Image Studio</span>
                {!imageStudioEnabled && <span className="abhiai-mobile-action-badge">Off</span>}
              </button>

              <button
                type="button"
                onClick={() => triggerHiddenAction('export')}
                className="abhiai-mobile-action-card"
              >
                <Share2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Export Chat</span>
              </button>

              <button
                type="button"
                onClick={() => triggerHiddenAction('voice')}
                className="abhiai-mobile-action-card"
                aria-disabled={!liveVoiceEnabled}
              >
                <Radio className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Live Voice</span>
                {!liveVoiceEnabled && <span className="abhiai-mobile-action-badge">Off</span>}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href="/account"
                onClick={() => setMoreOpen(false)}
                className="abhiai-mobile-secondary-card"
              >
                <UserRound className="w-4 h-4" />
                <span>Account & Sync</span>
              </Link>

              <Link
                href="/admin"
                onClick={() => setMoreOpen(false)}
                className="abhiai-mobile-secondary-card"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin</span>
              </Link>
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-200/80 dark:border-zinc-800">
              <ThemeToggle variant="segmented" />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
