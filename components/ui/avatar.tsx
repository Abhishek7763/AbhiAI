import * as React from 'react';
import { cn } from '@/lib/utils';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback: React.ReactNode;
  imageClassName?: string;
}

export function Avatar({ src, alt = '', fallback, className, imageClassName, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        'relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-900 text-sm font-bold text-white dark:bg-zinc-100 dark:text-zinc-900',
        className,
      )}
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className={cn('size-full object-cover', imageClassName)} />
      ) : fallback}
    </div>
  );
}
