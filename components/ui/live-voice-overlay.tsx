'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, X, PhoneOff, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LiveVoiceOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  error?: string | null;
}

export function LiveVoiceOverlay({ isOpen, onClose, error }: LiveVoiceOverlayProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-md"
        >
          {/* Top Bar */}
          <div className="absolute top-6 right-6">
            <button
              onClick={onClose}
              className="p-3 bg-zinc-900 text-zinc-400 hover:text-white rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex flex-col items-center justify-center gap-12">
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                boxShadow: [
                  "0 0 0 0 rgba(168, 85, 247, 0.4)",
                  "0 0 0 40px rgba(168, 85, 247, 0)",
                  "0 0 0 0 rgba(168, 85, 247, 0)"
                ]
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-32 h-32 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-600 flex items-center justify-center shadow-2xl"
            >
              <div className="absolute inset-0 rounded-full bg-black/20" />
              <Radio className="w-12 h-12 text-white relative z-10 animate-pulse" />
              
              {/* Outer rings */}
              <div className="absolute inset-0 -m-8 border border-purple-500/30 rounded-full animate-[spin_10s_linear_infinite]" />
              <div className="absolute inset-0 -m-16 border border-blue-500/20 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
            </motion.div>

            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-white tracking-tight">Gemini Live Voice</h2>
              {error ? (
                <p className="text-red-400 font-medium max-w-sm px-4">{error}</p>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-zinc-400">Speak naturally, I&apos;m listening...</p>
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(i => (
                      <motion.div
                        key={i}
                        animate={{ height: ["4px", "24px", "4px"] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                        className="w-1.5 bg-purple-500 rounded-full"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="mt-8 flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-medium transition-colors shadow-lg"
            >
              <PhoneOff className="w-5 h-5" />
              <span>End Call</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
