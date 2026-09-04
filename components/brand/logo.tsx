'use client';

import Image from 'next/image';
import Link from 'next/link';

export interface AbhiLogoProps {
  variant?: 'full' | 'icon' | 'responsive';
  href?: string;
  className?: string;
  priority?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'hero';
}

const MARK_SIZES = {
  sm: 'w-7 h-7',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
  hero: 'w-14 h-14 sm:w-16 sm:h-16',
} as const;

const TEXT_SIZES = {
  sm: 'text-[17px]',
  md: 'text-[20px]',
  lg: 'text-[26px]',
  hero: 'text-[32px] sm:text-[40px]',
} as const;

export function AbhiLogo({
  variant = 'responsive',
  href = '/',
  className = '',
  priority = false,
  size = 'md',
}: AbhiLogoProps) {
  const mark = (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${MARK_SIZES[size]}`}
      aria-hidden="true"
    >
      <Image
        src="/branding/abhiai-brand-mark.svg"
        alt=""
        width={512}
        height={512}
        priority={priority}
        className="h-full w-full object-contain"
      />
    </span>
  );

  const wordmark = (
    <span
      data-abhiai-wordmark
      className={`inline-flex items-baseline whitespace-nowrap font-bold leading-none tracking-[-0.045em] ${TEXT_SIZES[size]}`}
      style={{ fontFamily: 'var(--font-abhiai-brand), var(--font-abhiai-sans), sans-serif' }}
      aria-label="AbhiAI"
    >
      <span className="text-[#071634] dark:text-zinc-50">Abhi</span>
      <span className="text-[#146BFF]">AI</span>
    </span>
  );

  const content = (
    <span
      className={`inline-flex min-w-0 items-center gap-1.5 sm:gap-2 select-none ${className}`}
      data-abhiai-brand-lockup
    >
      {mark}
      {variant === 'full' && wordmark}
      {variant === 'responsive' && <span className="hidden sm:inline-flex">{wordmark}</span>}
    </span>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      aria-label="AbhiAI Home"
      className="inline-flex min-w-0 items-center rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80 transition-transform hover:scale-[1.015] active:scale-[0.99]"
    >
      {content}
    </Link>
  );
}

export default AbhiLogo;
