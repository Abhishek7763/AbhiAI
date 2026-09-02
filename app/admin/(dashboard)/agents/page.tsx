'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bot, Plus, Trash2, Edit3, Save, X, Sparkles, CheckCircle, 
  Loader2, Globe, Lock, BookOpen, Code2, Search, PenTool, Brain
} from 'lucide-react';
import type { AIAgent } from '@/lib/agents';
import type { AIConnection } from '@/lib/connections';
import { DEFAULT_PUBLIC_ALIASES } from '@/lib/constants/aliases';

export default function AgentsManagementPage() {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [connections, setConnections] = useState<AIConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Modal State for Agent Creation/Editing
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Partial<AIAgent> | null>(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetch('/api/admin/agents').then(r => r.json()),
      fetch('/api/admin/connections').then(r => r.json())
    ])
      .then(([agentsData, connsData]) => {
        if (isMounted) {
          if (Array.isArray(agentsData.agents)) setAgents(agentsData.agents);
          if (Array.isArray(connsData.connections)) setConnections(connsData.connections);
        }
      })
      .catch(e => console.error('Failed to load agents:', e))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  const openCreateModal = () => {
    setEditingAgent({
      id: '',
      name: '',
      description: '',
      icon: 'bot',
      systemPrompt: 'You are a specialized AbhiAI assistant created by Abhishek.',
      preferredModelOrAlias: 'abhiai-fast',
      requiredCapabilities: ['text'],
      visibility: 'public',
      temperature: 0.7,
      sampleStarters: ['', ''],
      createdAt: '',
    });
    setIsEditingExisting(false);
    setIsModalOpen(true);
  };

  const openEditModal = (agent: AIAgent) => {
    setEditingAgent({ ...agent });
    setIsEditingExisting(true);
    setIsModalOpen(true);
  };

  const handleSaveModal = () => {
    if (!editingAgent?.name || !editingAgent.systemPrompt) {
      alert('Please fill in the Agent Name and System Prompt.');
      return;
    }

    const agentSlug = editingAgent.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
    const agentId = editingAgent.id || `agent-${agentSlug}-${agents.length + 1}`;
    const cleanedStarters = (editingAgent.sampleStarters || []).filter(s => s.trim().length > 0);
    const completeAgent: AIAgent = {
      id: agentId,
      name: editingAgent.name,
      description: editingAgent.description || '',
      icon: editingAgent.icon || 'bot',
      systemPrompt: editingAgent.systemPrompt,
      preferredModelOrAlias: editingAgent.preferredModelOrAlias || 'abhiai-fast',
      fallbackModelOrAlias: editingAgent.fallbackModelOrAlias,
      requiredCapabilities: editingAgent.requiredCapabilities || ['text'],
      visibility: editingAgent.visibility || 'public',
      temperature: editingAgent.temperature ?? 0.7,
      sampleStarters: cleanedStarters,
      createdAt: editingAgent.createdAt || '2026-09-01T00:00:00.000Z',
    };

    let updatedList: AIAgent[];
    if (isEditingExisting) {
      updatedList = agents.map(a => a.id === completeAgent.id ? completeAgent : a);
    } else {
      updatedList = [...agents, completeAgent];
    }

    setAgents(updatedList);
    setIsModalOpen(false);
    persistAgents(updatedList);
  };

  const handleDeleteAgent = (id: string) => {
    if (confirm('Are you sure you want to delete this AI Agent?')) {
      const updatedList = agents.filter(a => a.id !== id);
      setAgents(updatedList);
      persistAgents(updatedList);
    }
  };

  const persistAgents = async (newList: AIAgent[]) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agents: newList }),
      });
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (e) {
      alert('Failed to save agents to server');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
            <Bot className="w-6 h-6 text-emerald-500" /> Custom AI Agents
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
            Create specialized AbhiAI agents with custom personas, instructions, and preferred AI models.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-all flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Create New Agent
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          Agents list updated and synchronized successfully!
        </div>
      )}

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => {
          return (
            <div
              key={agent.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 shadow-inner">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                        {agent.name}
                      </h3>
                      <span className="text-xs text-zinc-400 font-mono">
                        Model: {agent.preferredModelOrAlias}
                      </span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    agent.visibility === 'public'
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                      : agent.visibility === 'admin_only'
                      ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                  }`}>
                    {agent.visibility === 'public' ? 'Public' : agent.visibility === 'admin_only' ? 'Admin Only' : 'Disabled'}
                  </span>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-3">
                  {agent.description}
                </p>

                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-500 font-mono line-clamp-3">
                  {agent.systemPrompt}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="text-[11px] text-zinc-400">
                  Temp: {agent.temperature}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(agent)}
                    className="p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-xs font-semibold flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleDeleteAgent(agent.id)}
                    className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-xs font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Create Modal */}
      {isModalOpen && editingAgent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {isEditingExisting ? 'Edit AI Agent' : 'Create Custom AI Agent'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={editingAgent.name || ''}
                  onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                  placeholder="e.g. AbhiAI Medical Analyst"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={editingAgent.description || ''}
                  onChange={(e) => setEditingAgent({ ...editingAgent, description: e.target.value })}
                  placeholder="What does this agent specialize in?"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                    Preferred AI Model
                  </label>
                  <select
                    value={editingAgent.preferredModelOrAlias || 'abhiai-fast'}
                    onChange={(e) => setEditingAgent({ ...editingAgent, preferredModelOrAlias: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-900 dark:text-zinc-100 outline-none"
                  >
                    {DEFAULT_PUBLIC_ALIASES.map(a => (
                      <option key={a.id} value={a.id}>{a.displayName} (Alias)</option>
                    ))}
                    {connections.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                    Visibility
                  </label>
                  <select
                    value={editingAgent.visibility || 'public'}
                    onChange={(e) => setEditingAgent({ ...editingAgent, visibility: e.target.value as any })}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-900 dark:text-zinc-100 outline-none"
                  >
                    <option value="public">Public (Visible to Visitors)</option>
                    <option value="admin_only">Admin Only (Private Workspace)</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  System Instructions / Persona
                </label>
                <textarea
                  rows={4}
                  value={editingAgent.systemPrompt || ''}
                  onChange={(e) => setEditingAgent({ ...editingAgent, systemPrompt: e.target.value })}
                  placeholder="Define role, tone, knowledge boundaries..."
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-zinc-900 dark:text-zinc-100 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Sample Prompt Starters
                </label>
                <div className="space-y-2">
                  {(editingAgent.sampleStarters || ['', '']).map((starter, sIdx) => (
                    <input
                      key={sIdx}
                      type="text"
                      value={starter}
                      onChange={(e) => {
                        const copy = [...(editingAgent.sampleStarters || [])];
                        copy[sIdx] = e.target.value;
                        setEditingAgent({ ...editingAgent, sampleStarters: copy });
                      }}
                      placeholder={`Prompt starter #${sIdx + 1}`}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-zinc-100 outline-none text-xs"
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-3 bg-zinc-50/50 dark:bg-zinc-950/50">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModal}
                className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2 rounded-xl text-xs font-semibold hover:opacity-90 shadow-sm"
              >
                Save Agent
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
