'use client';

import React, { useRef, useState } from 'react';
import { Send, Paperclip, Image as ImageIcon, Mic } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-6">
      <div className="relative bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-zinc-200 dark:focus-within:ring-zinc-800 transition-all">
        
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Message AbhiAI..."
          disabled={disabled}
          className="w-full max-h-[200px] bg-transparent border-none outline-none resize-none py-2 px-4 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 overflow-y-auto"
          rows={1}
        />

        <div className="flex items-center justify-between px-2 pt-2">
          <div className="flex items-center gap-1 text-zinc-500">
            <button className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors" title="Attach file">
              <Paperclip className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors md:hidden" title="Camera/Image">
              <ImageIcon className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            {!input.trim() ? (
              <button className="p-2 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors" title="Voice input">
                <Mic className="w-5 h-5" />
              </button>
            ) : (
              <button 
                onClick={handleSubmit}
                disabled={disabled}
                className="p-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100" 
                title="Send message"
              >
                <Send className="w-4 h-4 translate-x-[-1px] translate-y-[1px]" />
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="text-center mt-3 text-xs text-zinc-400">
        AbhiAI can make mistakes. Consider verifying important information.
      </div>
    </div>
  );
}
