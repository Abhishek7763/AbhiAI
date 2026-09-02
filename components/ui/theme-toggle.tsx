'use client';

import React, { useSyncExternalStore } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

export type ThemeMode = 'light' | 'dark' | 'system';

function applyTheme(mode: ThemeMode) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else if (mode === 'light') {
    root.classList.remove('dark');
  } else {
    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isSystemDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
}

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener('themechange', callback);

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemChange = () => {
    const current = (localStorage.getItem('theme') as ThemeMode) || 'system';
    if (current === 'system') {
      applyTheme('system');
      callback();
    }
  };
  mediaQuery.addEventListener('change', handleSystemChange);

  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('themechange', callback);
    mediaQuery.removeEventListener('change', handleSystemChange);
  };
}

function getSnapshot(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem('theme') as ThemeMode) || 'system';
}

function getServerSnapshot(): ThemeMode {
  return 'system';
}

interface ThemeToggleProps {
  variant?: 'segmented' | 'compact' | 'dropdown';
  className?: string;
}

export function ThemeToggle({ variant = 'segmented', className = '' }: ThemeToggleProps) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  React.useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleSelect = (mode: ThemeMode) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('theme', mode);
    applyTheme(mode);
    window.dispatchEvent(new Event('themechange'));
  };

  const handleToggleNext = () => {
    if (typeof window === 'undefined') return;
    const isCurrentlyDark = document.documentElement.classList.contains('dark');
    const nextMode: ThemeMode = isCurrentlyDark ? 'light' : 'dark';
    handleSelect(nextMode);
  };

  if (variant === 'compact') {
    const isDark =
      theme === 'dark' ||
      (theme === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    return (
      <button
        id="theme-toggle-compact-btn"
        type="button"
        onClick={handleToggleNext}
        title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode (Current: ${theme})`}
        className={`relative flex shrink-0 items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/90 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shadow-2xs overflow-visible ${className}`}
      >
        {isDark ? (
          <Sun className="block w-4 h-4 shrink-0 text-amber-500 hover:rotate-45 transition-transform" />
        ) : (
          <Moon className="block w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400 hover:-rotate-12 transition-transform" />
        )}
      </button>
    );
  }

  const options: Array<{ mode: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { mode: 'light', label: 'Light', icon: Sun },
    { mode: 'system', label: 'Auto', icon: Monitor },
    { mode: 'dark', label: 'Dark', icon: Moon },
  ];

  return (
    <div className={`space-y-1.5 ${className}`} id="theme-toggle-segmented">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
          Appearance
        </span>
        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 capitalize">
          {theme}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60">
        {options.map(({ mode, label, icon: Icon }) => {
          const isActive = theme === mode;
          return (
            <button
              key={mode}
              id={`theme-btn-${mode}`}
              type="button"
              onClick={() => handleSelect(mode)}
              title={`${label} theme`}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/40 dark:hover:bg-zinc-700/40'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
              <span className="text-[11px]">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
