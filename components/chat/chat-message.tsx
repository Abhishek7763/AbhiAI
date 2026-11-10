'use client';

import React from 'react';
import { Message } from '@/types/chat';
import { User } from 'lucide-react';
import { motion } from 'motion/react';
import { AbhiLogoIcon } from '@/components/brand/logo-icon';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-4 w-full px-4 py-6 ${isUser ? '' : 'bg-zinc-50/50 dark:bg-zinc-900/20'}`}
    >
      <div className="max-w-3xl mx-auto flex gap-4 w-full">
        <div className="shrink-0 mt-1">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
              <User className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center p-1 shadow-sm">
              <AbhiLogoIcon size={18} />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0 prose prose-zinc dark:prose-invert max-w-none">
          <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-1.5">
            {isUser ? 'You' : 'AbhiAI'}
          </div>
          <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
