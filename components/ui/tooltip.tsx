'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export function Tooltip({
  children,
  content,
  side = 'top',
  className,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}) {
  return (
    <span className={cn('group relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-[200] -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-950 px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-lg transition-all duration-150 group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-zinc-100 dark:text-zinc-950',
          side === 'top' ? 'bottom-full mb-2 translate-y-1 group-hover:translate-y-0' : 'top-full mt-2 -translate-y-1 group-hover:translate-y-0',
        )}
      >
        {content}
      </span>
    </span>
  );
}
