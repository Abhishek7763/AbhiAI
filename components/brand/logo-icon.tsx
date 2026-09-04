'use client';

import Image from 'next/image';

interface LogoIconProps {
  size?: number | string;
  className?: string;
  variant?: 'metallic' | 'monochrome' | 'dark' | 'light';
  withGlow?: boolean;
  withGrid?: boolean;
}

export function AbhiLogoIcon({
  size = 40,
  className = '',
  withGlow = false,
  withGrid = false,
}: LogoIconProps) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center select-none ${withGrid ? 'rounded-2xl bg-[#071634] p-[12%]' : ''} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {withGlow && (
        <span className="pointer-events-none absolute inset-[8%] rounded-full bg-blue-500/25 blur-xl dark:bg-blue-400/20" />
      )}
      <Image
        src="/branding/abhiai-brand-mark.svg"
        alt=""
        width={512}
        height={512}
        className="relative z-10 h-full w-full object-contain transition-transform duration-200 hover:scale-[1.025]"
      />
    </span>
  );
}

export default AbhiLogoIcon;
