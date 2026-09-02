'use client';
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Zap, Sparkles, Eye, Code, Palette, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULT_MODELS = [
  { id: 'gemini-flash', name: 'AbhiAI Fast', originalName: 'Gemini 2.5 Flash' },
  { id: 'gemini-pro', name: 'AbhiAI Reasoning', originalName: 'Gemini 2.5 Pro' },
  { id: 'gemini-thinking', name: 'AbhiAI Thinking', originalName: 'Gemini 2.5 Flash Thinking' },
];

// Map alias names or keywords to icons
function ModelIcon({ name, className }: { name: string; className?: string }) {
  const n = (name || '').toLowerCase();
  if (n.includes('fast')) return <Zap className={className} />;
  if (n.includes('think') || n.includes('pro') || n.includes('reason')) return <Sparkles className={className} />;
  if (n.includes('vision')) return <Eye className={className} />;
  if (n.includes('code')) return <Code className={className} />;
  if (n.includes('creative')) return <Palette className={className} />;
  return <Sparkles className={className} />;
}

export default function ModelSelector({ onModelSelect }: { onModelSelect?: (modelAlias: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [models, setModels] = useState<any[]>(DEFAULT_MODELS);
  const [selected, setSelected] = useState<any>(DEFAULT_MODELS[0]);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadModels() {
      try {
        const res = await fetch('/api/models/public');
        if (res.ok) {
          const data = await res.json();
          if (data.models && Array.isArray(data.models) && data.models.length > 0) {
            setModels(data.models);
            setSelected(data.models[0]);
          }
        }
      } catch (e) {
        console.error("Failed to load models, using defaults", e);
      }
    }
    loadModels();
  }, []);

  // Separate effect to trigger the callback when selected changes
  useEffect(() => {
    if (selected && onModelSelect) {
      onModelSelect(selected.id);
    }
  }, [selected, onModelSelect]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (model: any) => {
    setSelected(model);
    setIsOpen(false);
  };

  const activeModel = selected || DEFAULT_MODELS[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xs transition-colors text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 max-w-[140px] sm:max-w-none"
        title={activeModel.name}
      >
        <ModelIcon name={activeModel.name} className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
        <span className="truncate">{activeModel.name}</span>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1.5 w-60 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden z-50 p-1.5"
          >
            {models.map((model) => {
              const isCurr = activeModel.id === model.id;
              return (
                <button
                  key={model.id}
                  onClick={() => handleSelect(model)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                    isCurr ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <ModelIcon name={model.name} className={`w-4 h-4 shrink-0 ${isCurr ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400'}`} />
                    <span className="truncate">{model.name}</span>
                  </div>
                  {isCurr && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 ml-2" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
