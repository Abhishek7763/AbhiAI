'use client';

import React, { useId } from 'react';

interface LogoIconProps {
  size?: number | string;
  className?: string;
  variant?: 'metallic' | 'monochrome' | 'dark' | 'light';
  withGlow?: boolean;
  withGrid?: boolean;
}

/**
 * AbhiAI Exact 3D Satin-Metallic Infinity Ribbon Icon
 * Recreated with mathematical precision to match the reference image:
 * - 35° tilted 3D Mobius / infinity loop ribbon
 * - Volumetric multi-stop silver/white satin metallic gradient
 * - Specular crest highlights and soft ambient occlusion shadows
 * - True 3D crossover with realistic depth shadow
 * - Optional subtle technical carbon grid backdrop
 */
export function AbhiLogoIcon({
  size = 40,
  className = '',
  withGlow = false,
  withGrid = false,
}: LogoIconProps) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9-_]/g, '');

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Ambient background bloom glow */}
      {withGlow && (
        <div 
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500/20 via-white/20 to-blue-400/20 blur-xl pointer-events-none transform scale-125" 
        />
      )}

      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full transform transition-transform duration-300 hover:scale-[1.03]"
      >
        <defs>
          {/* Background Grid Pattern */}
          <pattern id={`grid-pattern-${id}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#25293a" strokeWidth="0.75" strokeOpacity="0.4" />
          </pattern>

          {/* Radial Ambient Glow Filter */}
          <radialGradient id={`glow-radial-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="50%" stopColor="#94a3b8" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>

          {/* Main 3D Metallic Ribbon Chrome Gradient - Dark Mode */}
          <linearGradient
            id={`ribbon-main-grad-${id}`}
            x1="30"
            y1="170"
            x2="170"
            y2="30"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#CBD5E1" />
            <stop offset="15%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#94A3B8" />
            <stop offset="55%" stopColor="#E2E8F0" />
            <stop offset="70%" stopColor="#64748B" />
            <stop offset="88%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>

          {/* Overlapping Top Strand Gradient - Crisp Specular White into Satin Silver */}
          <linearGradient
            id={`ribbon-front-grad-${id}`}
            x1="70"
            y1="50"
            x2="140"
            y2="130"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="25%" stopColor="#F8FAFC" />
            <stop offset="50%" stopColor="#E2E8F0" />
            <stop offset="75%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>

          {/* Underside / Inner Ambient Shadow Gradient */}
          <linearGradient
            id={`ribbon-under-grad-${id}`}
            x1="130"
            y1="60"
            x2="60"
            y2="140"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#334155" />
            <stop offset="30%" stopColor="#64748B" />
            <stop offset="60%" stopColor="#CBD5E1" />
            <stop offset="85%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>

          {/* Light Mode High-Contrast Titanium/Obsidian Gradient */}
          <linearGradient
            id={`ribbon-light-grad-${id}`}
            x1="30"
            y1="170"
            x2="170"
            y2="30"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="25%" stopColor="#334155" />
            <stop offset="50%" stopColor="#64748B" />
            <stop offset="75%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>

          {/* Realistic 3D Cast Shadow */}
          <filter id={`crossover-shadow-${id}`} x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="-2" dy="4" stdDeviation="3.5" floodColor="#090d16" floodOpacity="0.65" />
          </filter>

          {/* Soft outer glow */}
          <filter id={`soft-glow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Optional background grid container */}
        {withGrid && (
          <g>
            <rect width="200" height="200" rx="28" fill="#0c0d14" />
            <rect width="200" height="200" rx="28" fill={`url(#grid-pattern-${id})`} />
            <rect width="200" height="200" rx="28" fill={`url(#glow-radial-${id})`} />
          </g>
        )}

        {/* Ambient Radial Core Light */}
        <circle cx="100" cy="100" r="70" fill={`url(#glow-radial-${id})`} />

        {/* ========================================================================= */}
        {/* DARK MODE: 3D Satin-White / Chrome Infinity Ribbon (Matches User Image)  */}
        {/* ========================================================================= */}
        <g className="hidden dark:inline">
          {/* Under / Lower Loop Strand */}
          <path
            d="M 98 94
               C 112 76, 134 52, 154 58
               C 174 64, 180 88, 162 110
               C 144 132, 118 152, 98 120
               C 80 92, 58 82, 42 90
               C 24 100, 22 126, 40 144
               C 58 162, 86 160, 102 130
               C 106 122, 104 112, 98 94 Z"
            fill="none"
            stroke={`url(#ribbon-under-grad-${id})`}
            strokeWidth="19"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Main Full Ribbon Base */}
          <path
            d="M 98 94
               C 112 76, 134 52, 154 58
               C 174 64, 180 88, 162 110
               C 144 132, 118 152, 98 120
               C 80 92, 58 82, 42 90
               C 24 100, 22 126, 40 144
               C 58 162, 86 160, 102 130
               C 106 122, 104 112, 98 94 Z"
            fill="none"
            stroke={`url(#ribbon-main-grad-${id})`}
            strokeWidth="18"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Upper Overlapping Strand (3D Crossover from Top-Right to Bottom-Left) */}
          <path
            d="M 82 72
               C 96 82, 118 88, 136 78
               C 154 68, 162 58, 150 58
               C 132 54, 112 74, 98 92
               C 92 102, 90 114, 94 126"
            fill="none"
            stroke={`url(#ribbon-front-grad-${id})`}
            strokeWidth="18"
            strokeLinecap="round"
            filter={`url(#crossover-shadow-${id})`}
          />

          {/* Specular White Crest Highlights (Satin Gloss Finish) */}
          {/* Top-Right Loop Crest */}
          <path
            d="M 124 64
               C 142 54, 162 58, 166 76
               C 168 90, 156 110, 142 124"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeOpacity="0.9"
          />

          {/* Bottom-Left Loop Crest */}
          <path
            d="M 38 96
               C 28 106, 26 126, 42 142
               C 56 156, 80 154, 94 130"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeOpacity="0.9"
          />

          {/* Central Crossing Specular Glimmer */}
          <path
            d="M 94 86 C 98 94, 104 102, 110 110"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeOpacity="0.95"
          />
        </g>

        {/* ========================================================================= */}
        {/* LIGHT MODE: High-Contrast Obsidian Titanium (Clean, Crisp & Modern)       */}
        {/* ========================================================================= */}
        <g className="inline dark:hidden">
          {/* Main Full Ribbon Base */}
          <path
            d="M 98 94
               C 112 76, 134 52, 154 58
               C 174 64, 180 88, 162 110
               C 144 132, 118 152, 98 120
               C 80 92, 58 82, 42 90
               C 24 100, 22 126, 40 144
               C 58 162, 86 160, 102 130
               C 106 122, 104 112, 98 94 Z"
            fill="none"
            stroke={`url(#ribbon-light-grad-${id})`}
            strokeWidth="18"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Overlapping Strand */}
          <path
            d="M 82 72
               C 96 82, 118 88, 136 78
               C 154 68, 162 58, 150 58
               C 132 54, 112 74, 98 92
               C 92 102, 90 114, 94 126"
            fill="none"
            stroke="#0F172A"
            strokeWidth="18"
            strokeLinecap="round"
            filter={`url(#crossover-shadow-${id})`}
          />

          {/* Light Mode Highlights */}
          <path
            d="M 124 64
               C 142 54, 162 58, 166 76
               C 168 90, 156 110, 142 124"
            fill="none"
            stroke="#94A3B8"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeOpacity="0.75"
          />

          <path
            d="M 38 96
               C 28 106, 26 126, 42 142
               C 56 156, 80 154, 94 130"
            fill="none"
            stroke="#94A3B8"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeOpacity="0.75"
          />
        </g>
      </svg>
    </div>
  );
}

export default AbhiLogoIcon;
