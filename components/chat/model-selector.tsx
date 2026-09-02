'use client';
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Zap, Sparkles, Eye, Code, Palette, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULT_MODELS = [
  { id: 'auto', name: 'AbhiAI Auto' },
  { id: 'gemini-3.7-flash', name: 'AbhiAI Think' },
  { id: 'gemini-3.6-flash', name: 'AbhiAI Code' },
  { id: 'gemini-3.5-flash-lite', name: 'AbhiAI Fast' },
  { id: 'gemini-3.1-flash-lite', name: 'AbhiAI Lite' },
];

const SELECTED_MODEL_KEY = 'abhiai_selected_model';
const MODEL_CHANGED_EVENT = 'abhiai:model-changed';

type ModelSelectorProps = {
  onModelSelect?: (modelAlias: string) => void;
  variant?: 'header' | 'dock';
};

function ModelIcon({ name, className }: { name: string; className?: string }) {
  const n = (name || '').toLowerCase();
  if (n.includes('fast') || n.includes('lite')) return <Zap className={className} />;
  if (n.includes('think') || n.includes('reason') || n.includes('auto')) return <Sparkles className={className} />;
  if (n.includes('vision')) return <Eye className={className} />;
  if (n.includes('code')) return <Code className={className} />;
  if (n.includes('creative')) return <Palette className={className} />;
  return <Sparkles className={className} />;
}

export default function ModelSelector({ onModelSelect, variant = 'header' }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [models, setModels] = useState<any[]>(DEFAULT_MODELS);
  const [selected, setSelected] = useState<any>(DEFAULT_MODELS[0]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadModels() {
      try {
        const storedModelId = typeof window !== 'undefined' ? localStorage.getItem(SELECTED_MODEL_KEY) : null;
        const res = await fetch('/api/models/public');
        if (res.ok) {
          const data = await res.json();
          if (data.models && Array.isArray(data.models) && data.models.length > 0) {
            setModels(data.models);
            setSelected((current: any) =>
              data.models.find((model: any) => model.id === storedModelId) ||
              data.models.find((model: any) => model.id === current?.id) ||
              data.models[0]
            );
            return;
          }
        }

        if (storedModelId) {
          const storedDefault = DEFAULT_MODELS.find((model) => model.id === storedModelId);
          if (storedDefault) setSelected(storedDefault);
        }
      } catch (e) {
        console.error('Failed to load models, using branded defaults', e);
      }
    }
    loadModels();
  }, []);

  useEffect(() => {
    if (selected && onModelSelect) {
      onModelSelect(selected.id);
    }
  }, [selected, onModelSelect]);

  useEffect(() => {
    const handleExternalModelChange = (event: Event) => {
      const detail = (event as CustomEvent<{ modelId?: string }>).detail;
      if (!detail?.modelId) return;
      setSelected((current: any) => {
        if (current?.id === detail.modelId) return current;
        return models.find((model: any) => model.id === detail.modelId) || current;
      });
      setIsOpen(false);
    };

    window.addEventListener(MODEL_CHANGED_EVENT, handleExternalModelChange as EventListener);
    return () => window.removeEventListener(MODEL_CHANGED_EVENT, handleExternalModelChange as EventListener);
  }, [models]);

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
    const modelChanged = model.id !== selected?.id;
    setIsOpen(false);
    if (!modelChanged) return;

    setSelected(model);

    try {
      localStorage.setItem(SELECTED_MODEL_KEY, model.id);
    } catch {
      // The selector still works even if browser storage is unavailable.
    }

    window.dispatchEvent(new CustomEvent(MODEL_CHANGED_EVENT, {
      detail: { modelId: model.id, modelName: model.name },
    }));
  };

  const activeModel = selected || DEFAULT_MODELS[0];
  const isDock = variant === 'dock';

  return (
    <div
      className={`relative min-w-0 ${isDock ? 'pointer-events-auto' : ''}`}
      ref={dropdownRef}
      data-abhiai-model-selector={variant}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={isDock
          ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-200/80 dark:border-zinc-700/80 bg-white/92 dark:bg-zinc-900/92 backdrop-blur-xl shadow-md text-xs font-semibold text-zinc-700 dark:text-zinc-200 max-w-[155px] min-w-0 active:scale-[0.98] transition-all'
          : 'flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xs transition-colors text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 max-w-[140px] sm:max-w-none min-w-0'}
        title={activeModel.name}
      >
        <ModelIcon name={activeModel.name} className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
        <span className="truncate">{activeModel.name}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: isDock ? 6 : -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isDock ? 6 : -5, scale: 0.98 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className={`${isDock ? 'absolute bottom-full left-0 mb-2' : 'absolute top-full left-0 mt-1.5'} w-60 max-w-[calc(100vw-24px)] bg-white/96 dark:bg-zinc-900/96 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden z-[120] p-1.5`}
          >
            <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
              AbhiAI Models
            </div>
            <div className="px-3 pb-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
              Switching model starts a new chat
            </div>
            {models.map((model) => {
              const isCurr = activeModel.id === model.id;
              return (
                <button
                  type="button"
                  key={model.id}
                  onClick={() => handleSelect(model)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                    isCurr
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
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
