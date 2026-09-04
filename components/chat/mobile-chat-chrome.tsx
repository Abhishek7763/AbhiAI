'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  Ellipsis,
  Globe,
  Image as ImageIcon,
  Menu,
  Mic,
  MicOff,
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
  return (
    document.querySelector<HTMLButtonElement>('.chat-composer-shell button[title="Generate AI Image from prompt"]') ||
    document.querySelector<HTMLButtonElement>('button[title="Open AI Image Studio"]') ||
    document.querySelector<HTMLButtonElement>('button[title="Image Studio"]')
  );
}

function findVoiceAgentTrigger() {
  return document.querySelector<HTMLButtonElement>('.chat-composer-shell button[title="Start Live Voice Conversation"]');
}

function findVoiceTypingTrigger() {
  return (
    document.querySelector<HTMLButtonElement>('.chat-composer-shell button[title="Stop Listening"]') ||
    document.querySelector<HTMLButtonElement>('.chat-composer-shell button[title="Voice Dictation"]')
  );
}

function findWebSearchTrigger() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.chat-composer-shell button')).find((button) =>
    button.textContent?.trim().startsWith('Web Search'),
  );
}

export default function MobileChatChrome() {
  const [moreOpen, setMoreOpen] = useState(false);
  const [webSearchActive, setWebSearchActive] = useState(false);
  const [voiceTypingActive, setVoiceTypingActive] = useState(false);

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
      imageTrigger.click();
    };

    document.addEventListener('submit', handleChatSubmit, true);
    return () => document.removeEventListener('submit', handleChatSubmit, true);
  }, []);

  useEffect(() => {
    const syncToolState = () => {
      const webTrigger = findWebSearchTrigger();
      setWebSearchActive(Boolean(webTrigger?.textContent?.includes('ON')));
      setVoiceTypingActive(Boolean(document.querySelector('.chat-composer-shell button[title="Stop Listening"]')));
    };

    syncToolState();
    const observer = new MutationObserver(syncToolState);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    return () => observer.disconnect();
  }, []);

  const openSidebar = () => {
    const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Open Navigation"]');
    trigger?.click();
  };

  const triggerHiddenAction = (action: MobileAction) => {
    let target: HTMLButtonElement | undefined | null;
    let fallback = 'This feature is currently unavailable.';

    if (action === 'image') {
      target = findImageStudioTrigger();
      fallback = 'Image Studio is currently unavailable.';
    } else if (action === 'voice') {
      target = findVoiceAgentTrigger();
      fallback = 'Voice Agent is currently unavailable.';
    } else {
      const title = action === 'agent' ? 'Select Agent' : 'Export & Share Chat';
      fallback = action === 'agent'
        ? 'Agents are not available right now.'
        : 'Start a conversation before exporting it.';
      target = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.title === title,
      );
    }

    if (!target || target.disabled) {
      toast.info(fallback);
      return;
    }

    setMoreOpen(false);
    target.click();
  };

  const toggleWebSearch = () => {
    const target = findWebSearchTrigger();
    if (!target || target.disabled) {
      toast.info('Web Search is currently unavailable.');
      return;
    }
    target.click();
    window.requestAnimationFrame(() => {
      setWebSearchActive(Boolean(findWebSearchTrigger()?.textContent?.includes('ON')));
    });
  };

  const toggleVoiceTyping = () => {
    const target = findVoiceTypingTrigger();
    if (!target || target.disabled) {
      toast.info('Voice typing is not supported on this browser.');
      return;
    }
    target.click();
    window.requestAnimationFrame(() => {
      setVoiceTypingActive(Boolean(document.querySelector('.chat-composer-shell button[title="Stop Listening"]')));
    });
  };

  return (
    <>
      <style jsx global>{`
        @media (max-width: 767px) {
          .abhiai-mobile-model-dock {
            left: 0.55rem !important;
            right: 0.55rem !important;
            bottom: 5.35rem !important;
            width: auto !important;
            max-width: none !important;
            z-index: 70 !important;
          }

          .abhiai-mobile-compact-tools {
            display: flex;
            align-items: center;
            gap: 0.32rem;
            width: 100%;
            max-width: 100%;
            overflow-x: auto;
            scrollbar-width: none;
            padding: 0.05rem 0;
          }

          .abhiai-mobile-compact-tools::-webkit-scrollbar {
            display: none;
          }

          .abhiai-mobile-compact-tools > :first-child {
            min-width: 0;
            max-width: 8.4rem;
            flex: 0 1 auto;
          }

          .abhiai-mobile-compact-tool {
            width: 2.08rem;
            height: 2.08rem;
            flex: 0 0 2.08rem;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 9999px;
            border: 1px solid rgb(228 228 231 / 0.9);
            background: rgb(255 255 255 / 0.94);
            color: rgb(82 82 91);
            box-shadow: 0 4px 14px rgb(24 24 27 / 0.07);
            backdrop-filter: blur(12px);
            transition: transform 160ms ease, background 160ms ease, color 160ms ease, border-color 160ms ease;
          }

          .dark .abhiai-mobile-compact-tool {
            border-color: rgb(63 63 70 / 0.9);
            background: rgb(24 24 27 / 0.92);
            color: rgb(212 212 216);
          }

          .abhiai-mobile-compact-tool:active {
            transform: scale(0.93);
          }

          .abhiai-mobile-compact-tool[data-tool="image"] {
            color: rgb(124 58 237);
          }

          .abhiai-mobile-compact-tool[data-tool="voice-agent"] {
            color: rgb(8 145 178);
          }

          .abhiai-mobile-compact-tool[data-tool="voice-typing"][data-active="true"] {
            color: rgb(220 38 38);
            border-color: rgb(252 165 165 / 0.8);
            background: rgb(254 242 242 / 0.95);
          }

          .dark .abhiai-mobile-compact-tool[data-tool="voice-typing"][data-active="true"] {
            color: rgb(248 113 113);
            border-color: rgb(127 29 29 / 0.8);
            background: rgb(69 10 10 / 0.72);
          }

          .abhiai-mobile-compact-tool[data-tool="web"][data-active="true"] {
            color: rgb(37 99 235);
            border-color: rgb(147 197 253 / 0.9);
            background: rgb(239 246 255 / 0.95);
          }

          .dark .abhiai-mobile-compact-tool[data-tool="web"][data-active="true"] {
            color: rgb(96 165 250);
            border-color: rgb(30 64 175 / 0.8);
            background: rgb(23 37 84 / 0.72);
          }

          .chat-composer-shell > div > div:first-child {
            display: none !important;
          }

          .chat-composer-shell button[title="Voice Dictation"],
          .chat-composer-shell button[title="Stop Listening"] {
            display: none !important;
          }

          .chat-composer-shell {
            padding: 0.25rem 0.55rem max(0.5rem, env(safe-area-inset-bottom)) !important;
          }

          .chat-composer-shell form {
            min-height: 3.35rem !important;
            padding: 0.34rem 0.38rem !important;
            border-radius: 1.55rem !important;
            border-color: rgb(212 212 216 / 0.9) !important;
            box-shadow: 0 10px 30px rgb(24 24 27 / 0.09) !important;
          }

          .dark .chat-composer-shell form {
            border-color: rgb(63 63 70 / 0.9) !important;
            box-shadow: 0 12px 34px rgb(0 0 0 / 0.28) !important;
          }

          .chat-composer-shell form > div:last-child {
            min-height: 2.6rem;
            align-items: center !important;
            gap: 0.2rem !important;
          }

          .chat-composer-shell textarea {
            min-height: 2.35rem !important;
            padding: 0.5rem 0.45rem !important;
            line-height: 1.35rem !important;
          }
        }
      `}</style>

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
        <div className="abhiai-mobile-compact-tools" aria-label="AbhiAI quick tools">
          <ModelSelector variant="dock" />
          <button
            type="button"
            onClick={() => triggerHiddenAction('image')}
            className="abhiai-mobile-compact-tool"
            aria-label="Create image"
            title="Create Image"
            data-tool="image"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleVoiceTyping}
            className="abhiai-mobile-compact-tool"
            aria-label={voiceTypingActive ? 'Stop voice typing' : 'Start voice typing'}
            title={voiceTypingActive ? 'Stop Voice Typing' : 'Voice Typing'}
            data-tool="voice-typing"
            data-active={voiceTypingActive}
          >
            {voiceTypingActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => triggerHiddenAction('voice')}
            className="abhiai-mobile-compact-tool"
            aria-label="Start Voice Agent"
            title="Voice Agent"
            data-tool="voice-agent"
          >
            <Radio className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleWebSearch}
            className="abhiai-mobile-compact-tool"
            aria-label={webSearchActive ? 'Turn Web Search off' : 'Turn Web Search on'}
            title={webSearchActive ? 'Web Search ON' : 'Web Search OFF'}
            data-tool="web"
            data-active={webSearchActive}
          >
            <Globe className="w-4 h-4" />
          </button>
        </div>
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
                      Full controls and settings
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
              >
                <Radio className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Voice Agent</span>
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
