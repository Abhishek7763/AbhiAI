'use client';

import { Menu } from 'lucide-react';
import { AbhiLogo } from '@/components/brand/logo';
import ModelSelector from '@/components/chat/model-selector';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export default function MobileChatChrome() {
  const openSidebar = () => {
    const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Open Navigation"]');
    trigger?.click();
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
          <AbhiLogo variant="full" size="sm" href="/" />
        </div>

        <div className="abhiai-mobile-theme">
          <ThemeToggle variant="compact" />
        </div>
      </div>

      <div className="abhiai-mobile-model-dock md:hidden">
        <ModelSelector variant="dock" />
      </div>
    </>
  );
}
