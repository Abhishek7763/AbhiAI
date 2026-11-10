'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { Cloud, LogIn, LogOut, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

export function AccountMenu() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setOpen(false);
      toast.success('Signed out of AbhiAI');
      router.push('/');
      router.refresh();
    } catch (signOutError) {
      toast.error(signOutError instanceof Error ? signOutError.message : 'Could not sign out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  if (loading) {
    return <Skeleton className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl" aria-label="Loading account" />;
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => router.push('/auth')}
        className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl border border-blue-200/80 dark:border-blue-900/70 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-blue-100 dark:hover:bg-blue-950/70 transition-colors"
        title="Sign in to sync chats across devices"
      >
        <LogIn className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Sign in</span>
      </button>
    );
  }

  const name =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
    user.email ||
    'AbhiAI User';
  const initial = name.trim().charAt(0).toUpperCase() || 'A';
  const avatarUrl = typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-xl shadow-xs hover:scale-[1.03] active:scale-[0.98] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35"
        title={user.email || 'AbhiAI account'}
      >
        <Avatar src={avatarUrl} alt={name} fallback={initial} className="w-8 h-8 sm:w-9 sm:h-9 border border-zinc-200 dark:border-zinc-800" />
      </button>

      {open && (
        <div
          role="menu"
          className="abhiai-dropdown-surface absolute right-0 top-11 w-64 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/98 dark:bg-zinc-900/98 shadow-2xl backdrop-blur-xl z-50"
        >
          <div className="p-3.5 border-b border-zinc-200/70 dark:border-zinc-800/70">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar src={avatarUrl} alt={name} fallback={initial} className="w-9 h-9" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{name}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{user.email}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <Cloud className="w-3.5 h-3.5" />
              <span>Cloud sync active</span>
            </div>
          </div>

          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                router.push('/account');
              }}
              className="w-full px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
            >
              <Settings className="w-4 h-4 text-zinc-500" />
              <div>
                <div className="font-medium">Settings & My Images</div>
                <div className="text-[10px] text-zinc-400">Account, sync and image history</div>
              </div>
            </button>

            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              className="w-full px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left disabled:opacity-60"
            >
              <LogOut className="w-4 h-4" />
              <span className="font-medium">{signingOut ? 'Signing out…' : 'Sign out'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AccountMenu;
