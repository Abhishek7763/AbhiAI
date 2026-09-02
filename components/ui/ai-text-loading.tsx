'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Sparkles, Brain } from 'lucide-react';

interface AITextLoadingProps {
  texts?: string[];
  className?: string;
  interval?: number;
  compact?: boolean;
}

export function AITextLoading({
  texts = [
    'Thinking...',
    'Analyzing context...',
    'Synthesizing knowledge...',
    'Structuring response...',
    'Generating thoughts...',
    'Almost ready...',
  ],
  className,
  interval = 1400,
  compact = false,
}: AITextLoadingProps) {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTextIndex((prevIndex) => (prevIndex + 1) % texts.length);
    }, interval);

    return () => clearInterval(timer);
  }, [interval, texts.length]);

  if (compact) {
    return (
      <div className="flex items-center gap-2.5 py-0.5">
        <div className="relative flex items-center justify-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="w-4 h-4 rounded-full border-2 border-purple-500/20 border-t-purple-500 dark:border-purple-400/20 dark:border-t-purple-400"
          />
          <Brain className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400 absolute inset-0 m-auto animate-pulse" />
        </div>
        <div className="relative overflow-hidden h-5 flex items-center">
          <AnimatePresence mode="wait">
            <motion.span
              key={currentTextIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className={cn(
                "text-xs font-medium tracking-wide bg-gradient-to-r from-purple-600 via-blue-500 to-indigo-600 bg-clip-text text-transparent dark:from-purple-300 dark:via-blue-300 dark:to-indigo-300",
                className
              )}
            >
              {texts[currentTextIndex]}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3.5">
      {/* Animated Glowing Orb / Core */}
      <div className="relative flex items-center justify-center w-8 h-8 rounded-2xl bg-gradient-to-tr from-purple-500/15 via-blue-500/15 to-indigo-500/15 border border-purple-500/30 dark:border-purple-400/30 shadow-xs">
        <motion.div
          animate={{ scale: [1, 1.15, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 blur-xs"
        />
        <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 relative z-10 animate-pulse" />
      </div>

      {/* Shimmering Text Transition */}
      <div className="relative overflow-hidden min-h-[22px] flex items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTextIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{
              opacity: 1,
              y: 0,
              backgroundPosition: ['200% center', '-200% center'],
            }}
            exit={{ opacity: 0, y: -10 }}
            transition={{
              opacity: { duration: 0.25 },
              y: { duration: 0.25 },
              backgroundPosition: {
                duration: 2.5,
                ease: 'linear',
                repeat: Infinity,
              },
            }}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap bg-[length:200%_100%] bg-gradient-to-r from-purple-600 via-indigo-400 to-blue-600 bg-clip-text font-semibold text-sm text-transparent dark:from-purple-300 dark:via-blue-200 dark:to-indigo-300',
              className
            )}
          >
            <span>{texts[currentTextIndex]}</span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Waveform / Thinking dots */}
      <div className="flex items-center gap-1 ml-auto opacity-70">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{
              scaleY: [0.3, 1, 0.3],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut"
            }}
            className="w-1 h-3 rounded-full bg-gradient-to-b from-purple-500 to-blue-500 inline-block"
          />
        ))}
      </div>
    </div>
  );
}

export default AITextLoading;
