'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface AITextLoadingProps {
  texts?: string[];
  className?: string;
  interval?: number;
  compact?: boolean;
}

export function AITextLoading({
  texts = ['Thinking...', 'Understanding context...', 'Building response...', 'Almost ready...'],
  className,
  interval = 1500,
  compact = false,
}: AITextLoadingProps) {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTextIndex((index) => (index + 1) % texts.length);
    }, interval);
    return () => window.clearInterval(timer);
  }, [interval, texts.length]);

  return (
    <div className={cn('flex min-w-0 items-center', compact ? 'gap-2' : 'gap-3', className)}>
      <div className={cn('relative flex shrink-0 items-center justify-center', compact ? 'h-5 w-5' : 'h-7 w-7')}>
        <motion.div
          className="absolute inset-0 rounded-full border border-blue-500/20 dark:border-blue-400/20"
          animate={{ scale: [0.82, 1.08, 0.82], opacity: [0.35, 0.9, 0.35] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-[3px] rounded-full bg-blue-500/10 dark:bg-blue-400/10"
          animate={{ scale: [1, 0.78, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <Sparkles className={cn('relative text-blue-600 dark:text-blue-300', compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5')} />
      </div>

      <div className="relative min-w-0 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={currentTextIndex}
            initial={{ opacity: 0, y: 5, filter: 'blur(3px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -5, filter: 'blur(3px)' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'block truncate font-medium text-zinc-600 dark:text-zinc-300',
              compact ? 'text-xs' : 'text-sm',
            )}
          >
            {texts[currentTextIndex]}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="flex shrink-0 items-center gap-1" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500"
            animate={{ y: [0, -3, 0], opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 0.85, repeat: Infinity, delay: index * 0.12, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  );
}

export default AITextLoading;
