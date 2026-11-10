'use client';

import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import AdminSidebar from '@/components/admin/admin-sidebar';
import { AbhiLogo } from '@/components/brand/logo';

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-dvh bg-zinc-50/70 dark:bg-zinc-950/70 backdrop-blur-xs">
      <div className="hidden lg:block h-dvh sticky top-0">
        <AdminSidebar />
      </div>

      <div className="min-w-0 flex-1 flex flex-col">
        <header className="lg:hidden sticky top-0 z-30 h-14 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl px-3 sm:px-4 flex items-center justify-between">
          <AbhiLogo variant="full" size="sm" href="/" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
              Admin
            </span>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open admin menu"
              aria-expanded={mobileOpen}
              className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-700 dark:text-zinc-200 shadow-sm"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 min-w-0">
          <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close admin menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
          />
          <div className="relative z-10 h-dvh w-[min(84vw,320px)] shadow-2xl">
            <AdminSidebar className="w-full" onNavigate={() => setMobileOpen(false)} />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close admin menu"
              className="absolute top-2 right-2 w-10 h-10 rounded-xl bg-zinc-100/90 dark:bg-zinc-800/90 flex items-center justify-center text-zinc-700 dark:text-zinc-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
