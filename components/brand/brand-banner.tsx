'use client';

import React from 'react';
import { AbhiLogoIcon } from './logo-icon';
import { AbhiWordmark } from './brand-wordmark';

interface BrandBannerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
}

/**
 * AbhiAI Brand Banner: Exact replica of the reference banner (Image 2)
 * Features:
 * - Technical dark carbon grid background (#0c0e15 with #1b2030 grid)
 * - 3D satin-white metallic infinity loop on the left
 * - Pure white geometric capsule wordmark "A B H I A I" on the right
 * - Subtle ambient depth lighting and corner border accents
 */
export function AbhiBrandBanner({ className = '', size = 'md' }: BrandBannerProps) {
  let iconSize = 72;
  let wordmarkHeight = 32;
  let paddingClass = 'px-8 py-6';
  let gapClass = 'gap-6';

  if (size === 'sm') {
    iconSize = 48;
    wordmarkHeight = 22;
    paddingClass = 'px-5 py-3.5';
    gapClass = 'gap-4';
  } else if (size === 'lg') {
    iconSize = 96;
    wordmarkHeight = 42;
    paddingClass = 'px-10 py-8';
    gapClass = 'gap-8';
  } else if (size === 'hero') {
    iconSize = 110;
    wordmarkHeight = 48;
    paddingClass = 'px-12 py-9';
    gapClass = 'gap-8 sm:gap-10';
  }

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-zinc-800/90 bg-[#0c0e15] shadow-2xl flex items-center justify-center select-none ${paddingClass} ${className}`}
    >
      {/* Background Technical Grid Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px'
        }}
      />

      {/* Ambient Radial Spotlight */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-80"
        style={{
          background: 'radial-gradient(ellipse at 35% 50%, rgba(255, 255, 255, 0.12) 0%, rgba(148, 163, 184, 0.04) 45%, transparent 75%)'
        }}
      />

      {/* Subtle Corner Highlights */}
      <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/20 rounded-tl-3xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/20 rounded-tr-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/20 rounded-bl-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/20 rounded-br-3xl pointer-events-none" />

      {/* Foreground Content: Icon on Left + "A B H I A I" on Right */}
      <div className={`relative z-10 flex flex-col sm:flex-row items-center ${gapClass}`}>
        <div className="shrink-0 transform transition-transform duration-300 hover:scale-105">
          <AbhiLogoIcon size={iconSize} withGlow={true} />
        </div>
        <div className="shrink-0 flex items-center justify-center pt-1">
          <AbhiWordmark height={wordmarkHeight} variant="white" />
        </div>
      </div>
    </div>
  );
}

export default AbhiBrandBanner;
