'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export interface AbhiLogoProps {
  variant?: 'full' | 'icon' | 'responsive';
  href?: string;
  className?: string;
  priority?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'hero';
}

export function AbhiLogo({
  variant = 'responsive',
  href = '/',
  className = '',
  size = 'md',
}: AbhiLogoProps) {
  // Size mappings
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    hero: 'w-14 h-14 sm:w-16 sm:h-16',
  };

  const sparkleSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    hero: 'w-7 h-7 sm:w-8 sm:h-8',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    hero: 'text-2xl sm:text-3xl',
  };

  const aiBadgeSizes = {
    sm: 'text-[10px] px-1 py-0.2',
    md: 'text-xs px-1.5 py-0.5',
    lg: 'text-sm px-2 py-0.5',
    hero: 'text-base sm:text-lg px-2.5 py-1',
  };

  const emblem = (
    <div className={`relative ${iconSizes[size]} rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 p-[1.5px] shadow-sm flex items-center justify-center shrink-0`}>
      <div className="w-full h-full bg-white dark:bg-zinc-950 rounded-[10px] flex items-center justify-center">
        <Sparkles className={`${sparkleSizes[size]} text-blue-600 dark:text-blue-400 animate-pulse`} />
      </div>
    </div>
  );

  const wordmark = (
    <div className="flex items-center gap-1.5 select-none">
      <span className={`font-bold tracking-tight text-zinc-900 dark:text-zinc-50 ${textSizes[size]}`}>
        Abhi
      </span>
      <span className={`font-extrabold bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-md tracking-wider ${aiBadgeSizes[size]} shadow-2xs`}>
        AI
      </span>
    </div>
  );

  const content = (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {variant === 'icon' && emblem}
      {variant === 'full' && (
        <>
          {emblem}
          {wordmark}
        </>
      )}
      {variant === 'responsive' && (
        <>
          {emblem}
          <div className="hidden sm:flex items-center gap-1.5">
            {wordmark}
          </div>
        </>
      )}
    </div>
  );

  if (href) {
    return (
      <Link 
        href={href} 
        aria-label="AbhiAI Home" 
        className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl transition-transform hover:scale-[1.02]"
      >
        {content}
      </Link>
    );
  }

  return content;
}

export default AbhiLogo;
