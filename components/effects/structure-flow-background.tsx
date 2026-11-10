'use client';

import React, { useSyncExternalStore } from 'react';
import { StructureFlowCollection } from '@/src/shaders/structure-flow/StructureFlowCollection';
import '@/src/shaders/threeui.css';

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener('themechange', callback);

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemChange = () => callback();
  mediaQuery.addEventListener('change', handleSystemChange);

  const observer = new MutationObserver(() => callback());
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('themechange', callback);
    mediaQuery.removeEventListener('change', handleSystemChange);
    observer.disconnect();
  };
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined') return true;
  return document.documentElement.classList.contains('dark');
}

function getServerSnapshot(): boolean {
  return true;
}

export function AppStructureFlowBackground() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div 
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none opacity-90 transition-opacity duration-700"
      aria-hidden="true"
    >
      <div className="absolute inset-0 w-full h-full">
        <StructureFlowCollection
          variant="structure-flow"
          speed={0.85}
          pointSize={isDark ? 0.08 : 0.095}
          opacity={isDark ? 0.42 : 0.38}
          maskStart={0.12}
          maskSolid={0.48}
          color={isDark ? 0xffffff : '#4f46e5'}
        />
      </div>
      {/* Subtle radial ambient glow matching theme */}
      <div 
        className={`absolute inset-0 transition-all duration-700 ${
          isDark 
            ? 'bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(59,130,246,0.08),transparent)]' 
            : 'bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(99,102,241,0.05),transparent)]'
        }`} 
      />
    </div>
  );
}

export default AppStructureFlowBackground;
