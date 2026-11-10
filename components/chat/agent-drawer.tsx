'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bot, BookOpen, Code2, Search, PenTool, Brain, Sparkles, 
  X, Check, ChevronRight, MessageSquare 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PublicAgent {
  id: string;
  name: string;
  description: string;
  icon: string;
  sampleStarters: string[];
  preferredModelOrAlias: string;
}

const ICON_MAP: Record<string, any> = {
  'book-open': BookOpen,
  'code-2': Code2,
  'search': Search,
  'pen-tool': PenTool,
  'brain': Brain,
  'bot': Bot,
};

interface AgentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAgentId: string | null;
  onSelectAgent: (agent: PublicAgent | null) => void;
  onStarterClick: (starterText: string, agent: PublicAgent) => void;
}

export default function AgentDrawer({
  isOpen,
  onClose,
  selectedAgentId,
  onSelectAgent,
  onStarterClick,
}: AgentDrawerProps) {
  const [agents, setAgents] = useState<PublicAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/agents/public')
      .then(res => res.json())
      .then(data => {
        if (isMounted && Array.isArray(data.agents)) {
          setAgents(data.agents);
        }
      })
      .catch(err => console.error('Failed to load public agents:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs">
          {/* Backdrop click */}
          <div className="absolute inset-0" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                    AbhiAI Specialized Agents
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Switch personas tailored for study, software architecture, research, or copywriting.
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of Agents */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Default General Agent */}
              <div
                onClick={() => {
                  onSelectAgent(null);
                  onClose();
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  selectedAgentId === null
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-900 dark:text-zinc-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    selectedAgentId === null
                      ? 'bg-white/10 dark:bg-black/10'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                  }`}>
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">General AbhiAI Assistant</h4>
                    <p className={`text-xs ${selectedAgentId === null ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500'}`}>
                      Default multi-purpose conversational AI assistant
                    </p>
                  </div>
                </div>

                {selectedAgentId === null && <Check className="w-5 h-5 shrink-0" />}
              </div>

              {agents.map((agent) => {
                const IconComp = ICON_MAP[agent.icon] || Bot;
                const isSelected = selectedAgentId === agent.id;

                return (
                  <div
                    key={agent.id}
                    className={`rounded-2xl border transition-all p-4.5 space-y-3 ${
                      isSelected
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent shadow-sm'
                        : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-900 dark:text-zinc-100'
                    }`}
                  >
                    <div 
                      onClick={() => {
                        onSelectAgent(agent);
                        onClose();
                      }}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-white/10 dark:bg-black/10'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}>
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm">{agent.name}</h4>
                          <p className={`text-xs line-clamp-1 ${isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500'}`}>
                            {agent.description}
                          </p>
                        </div>
                      </div>

                      {isSelected ? (
                        <Check className="w-5 h-5 shrink-0" />
                      ) : (
                        <button className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:opacity-80">
                          Select
                        </button>
                      )}
                    </div>

                    {/* Quick Starters for this agent */}
                    {agent.sampleStarters && agent.sampleStarters.length > 0 && (
                      <div className="pt-2 border-t border-zinc-200/40 dark:border-zinc-800/40 space-y-1.5">
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${
                          isSelected ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-400'
                        }`}>
                          Quick Starters:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {agent.sampleStarters.map((starter, sIdx) => (
                            <button
                              key={sIdx}
                              onClick={() => {
                                onStarterClick(starter, agent);
                                onClose();
                              }}
                              className={`text-left text-[11px] px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-white/10 dark:bg-black/10 border-white/10 dark:border-black/10 hover:bg-white/20'
                                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300'
                              }`}
                            >
                              <MessageSquare className="w-3 h-3 shrink-0 opacity-60" />
                              <span className="truncate max-w-xs">{starter}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
              <span>Persona automatically adjusts reasoning tone & models</span>
              <button
                onClick={onClose}
                className="font-bold text-zinc-900 dark:text-zinc-100 hover:underline"
              >
                Done
              </button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
