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

function isImageGenerationIntent(value: string) {
  const text = value.trim().toLowerCase();
  if (!text) return false;

  const visualNoun = /(image|photo|picture|illustration|artwork|poster|wallpaper|logo|tasveer|tasvir|चित्र|तस्वीर|फोटो|इमेज)/i;
  const createVerb = /(generate|create|make|draw|design|render|banao|bana do|banado|banaao|बनाओ|बना दो|बनादो|बनाइए|बनाना)/i;

  return visualNoun.test(text) && createVerb.test(text);
}

function findImageStudioTrigger() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
    button.title === 'Open AI Image Studio' ||
    button.title === 'Image Studio' ||
    button.title === 'Generate AI Image from prompt',
  );
}

export default function MobileChatChrome() {
  const [moreOpen, setMoreOpen] = useState(false);
  // Phase 6 promotes Image Studio to a public first-class feature. Do not hide
  // mobile access behind the older rollout flag anymore.
  const imageStudioEnabled = true;
  const liveVoiceEnabled = process.env.NEXT_PUBLIC_ENABLE_LIVE_VOICE === 'true';

  useEffect(() => {
    if (!moreOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [moreOpen]);

  useEffect(() => {
    const handleChatSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      const textarea = form.querySelector<HTMLTextAreaElement>('textarea');
      if (!textarea || !isImageGenerationIntent(textarea.value)) return;

      const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]');
      if (fileInput?.files?.length) return;

      const imageTrigger = findImageStudioTrigger();
      if (!imageTrigger || imageTrigger.disabled) return;

      event.preventDefault();
      event.stopPropagation();
      window.requestAnimationFrame(() => imageTrigger.click());
    };

    document.addEventListener('submit', handleChatSubmit, true);
    return () => document.removeEventListener('submit', handleChatSubmit, true);
  }, []);

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
        fallback: 'Image Studio is currently unavailable.',
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

    if (action === 'voice' && !liveVoiceEnabled) {
      toast.info(definitions.voice.fallback);
      return;
    }

    const target = action === 'image'
      ? findImageStudioTrigger()
      : Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
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
          <button
            type="button"
            onClick={() => triggerHiddenAction('image')}
            className="h-9 px-2.5 rounded-xl inline-flex items-center gap-1.5 border border-violet-200/80 dark:border-violet-800/70 bg-violet-50/90 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 text-xs font-semibold shadow-xs active:scale-95 transition-all"
            aria-label="Open Image Studio"
            title="Create Image"
          >
            <ImageIcon className="w-4 h-4" />
            <span className="hidden min-[360px]:inline">Image</span>
          </button>
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
