'use client';

import React from 'react';

interface BrandWordmarkProps {
  height?: number;
  className?: string;
  variant?: 'white' | 'dark' | 'adaptive';
  letterSpacing?: 'normal' | 'wide' | 'ultra-wide';
}

/**
 * AbhiAI Exact Typographic Wordmark: "A B H I A I"
 * Recreated with exact geometric capsule and arch letterforms:
 * - A: Rounded arch with capsule legs and centered horizontal crossbar
 * - B: Vertical capsule spine with dual rounded square/pill bowls
 * - H: Dual vertical pill pillars with centered horizontal pill crossbar
 * - I: Monolithic vertical stadium/capsule pill
 * - A: Matching rounded arch
 * - I: Matching vertical stadium/capsule pill
 */
export function AbhiWordmark({
  height = 28,
  className = '',
  variant = 'adaptive',
}: BrandWordmarkProps) {
  // Height baseline: 36 units, total width: 360 units for optical letter tracking
  const textColorClass =
    variant === 'white'
      ? 'text-white'
      : variant === 'dark'
      ? 'text-zinc-900'
      : 'text-zinc-900 dark:text-white';

  return (
    <svg
      viewBox="0 0 360 40"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      style={{ height: `${height}px`, width: 'auto' }}
      className={`transition-colors duration-200 select-none ${textColorClass} ${className}`}
    >
      <defs>
        <filter id="text-subtle-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#ffffff" floodOpacity="0.2" />
        </filter>
      </defs>

      {/* ========================================================= */}
      {/* 1. Letter 'A' (Position: X = 0)                           */}
      {/* ========================================================= */}
      <g transform="translate(0, 3)">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M 5 34 C 2.238 34 0 31.762 0 29 V 14 C 0 6.268 6.268 0 14 0 H 22 C 29.732 0 36 6.268 36 14 V 29 C 36 31.762 33.762 34 31 34 C 28.238 34 26 31.762 26 29 V 24 H 10 V 29 C 10 31.762 7.762 34 5 34 Z M 10 16 H 26 V 14 C 26 9.582 22.418 6 18 6 C 13.582 6 10 9.582 10 14 V 16 Z"
        />
      </g>

      {/* ========================================================= */}
      {/* 2. Letter 'B' (Position: X = 65)                          */}
      {/* ========================================================= */}
      <g transform="translate(65, 3)">
        {/* Main combined B outline with precision rounded-corner counters */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M 0 5 C 0 2.238 2.238 0 5 0 H 22 C 28.627 0 34 5.373 34 12 C 34 15.2 32.7 18.1 30.5 20.2 C 33.2 22.4 35 25.7 35 29.5 C 35 36.403 29.403 42 22.5 42 H 5 C 2.238 42 0 39.762 0 37 V 5 Z M 9 8 V 16 H 21 C 23.209 16 25 14.209 25 12 C 25 9.791 23.209 8 21 8 H 9 Z M 9 24 V 34 H 22 C 24.761 34 27 31.761 27 29 C 27 26.239 24.761 24 22 24 H 9 Z"
          transform="scale(0.81)"
        />
      </g>

      {/* ========================================================= */}
      {/* 3. Letter 'H' (Position: X = 130)                         */}
      {/* ========================================================= */}
      <g transform="translate(130, 3)">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M 5 0 C 7.762 0 10 2.238 10 5 V 13 H 26 V 5 C 26 2.238 28.238 0 31 0 C 33.762 0 36 2.238 36 5 V 29 C 36 31.762 33.762 34 31 34 C 28.238 34 26 31.762 26 29 V 21 H 10 V 29 C 10 31.762 7.762 34 5 34 C 2.238 34 0 31.762 0 29 V 5 C 0 2.238 2.238 0 5 0 Z"
        />
      </g>

      {/* ========================================================= */}
      {/* 4. Letter 'I' (Position: X = 195)                         */}
      {/* ========================================================= */}
      <g transform="translate(195, 3)">
        <rect x="0" y="0" width="10" height="34" rx="5" />
      </g>

      {/* ========================================================= */}
      {/* 5. Letter 'A' (Position: X = 235)                         */}
      {/* ========================================================= */}
      <g transform="translate(235, 3)">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M 5 34 C 2.238 34 0 31.762 0 29 V 14 C 0 6.268 6.268 0 14 0 H 22 C 29.732 0 36 6.268 36 14 V 29 C 36 31.762 33.762 34 31 34 C 28.238 34 26 31.762 26 29 V 24 H 10 V 29 C 10 31.762 7.762 34 5 34 Z M 10 16 H 26 V 14 C 26 9.582 22.418 6 18 6 C 13.582 6 10 9.582 10 14 V 16 Z"
        />
      </g>

      {/* ========================================================= */}
      {/* 6. Letter 'I' (Position: X = 300)                         */}
      {/* ========================================================= */}
      <g transform="translate(300, 3)">
        <rect x="0" y="0" width="10" height="34" rx="5" />
      </g>
    </svg>
  );
}

export default AbhiWordmark;
