'use client';

import React, { useEffect, useState } from 'react';
import {
  Bot,
  BookOpen,
  CheckCircle,
  Edit3,
  Globe,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { AIAgent, AgentToolPermission } from '@/lib/agents';
import type { AIConnection } from '@/lib/connections';
import { DEFAULT_PUBLIC_ALIASES } from '@/lib/constants/aliases';

const EDITABLE_TOOLS: Array<{
  id: AgentToolPermission;
  label: string;
  description: string;
  icon: typeof Globe;
}> = [
  {
    id: 'web_search',
    label: 'Live Web Search',
    description: 'Lets this agent search current information when Web Search is enabled in chat.',
    icon: Globe,
  },
  {
    id: 'document_qa',
    label: 'Document Q&A',
    description: 'Lets this agent retrieve relevant passages from user-attached documents.',
    icon: BookOpen,
  },
];

function normalizeAgent(agent: AIAgent): AIAgent {
  return {
    ...agent,
    allowedTools: Array.isArray(agent.allowedTools)
      ? agent.allowedTools
      : ['web_search', 'document_qa'],
  };
}

export default function AgentsManagementPage() {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [connections, setConnections] = useState<AIConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Partial<AIAgent> | null>(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetch('/api/admin/agents').then((response) => response.json()),
      fetch('/api/admin/connections').then((response) => response.json()),
    ])
      .then(([agentsData, connectionsData]) => {
        if (!isMounted) return;
        if (Array.isArray(agentsData.agents)) {
          setAgents(agentsData.agents.map((agent: AIAgent) => normalizeAgent(agent)));
        }
        if (Array.isArray(connectionsData.connections)) {
          setConnections(connectionsData.connections);
        }
      })
      .catch((error) => {
        console.error('Failed to load agents:', error);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
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
      allowedTools: ['web_search', 'document_qa'],
      visibility: 'public',
      temperature: 0.7,
      sampleStarters: ['', ''],
      createdAt: '',
    });
    setIsEditingExisting(false);
    setIsModalOpen(true);
  };

  const openEditModal = (agent: AIAgent) => {
    setEditingAgent(normalizeAgent(agent));
    setIsEditingExisting(true);
    setIsModalOpen(true);
  };

  const toggleTool = (tool: AgentToolPermission) => {
    if (!editingAgent) return;
    const current = new Set(editingAgent.allowedTools ?? []);
    if (current.has(tool)) current.delete(tool);
    else current.add(tool);
    setEditingAgent({ ...editingAgent, allowedTools: Array.from(current) });
  };

  const handleSaveModal = () => {
    if (!editingAgent?.name || !editingAgent.systemPrompt) {
      alert('Please fill in the Agent Name and System Prompt.');
      return;
    }

    const agentSlug = editingAgent.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
    const agentId = editingAgent.id || `agent-${agentSlug}-${agents.length + 1}`;
    const cleanedStarters = (editingAgent.sampleStarters || []).filter((starter) => starter.trim().length > 0);
    const completeAgent: AIAgent = {
      id: agentId,
      name: editingAgent.name,
      description: editingAgent.description || '',
      icon: editingAgent.icon || 'bot',
      systemPrompt: editingAgent.systemPrompt,
      preferredModelOrAlias: editingAgent.preferredModelOrAlias || 'abhiai-fast',
      fallbackModelOrAlias: editingAgent.fallbackModelOrAlias,
      requiredCapabilities: editingAgent.requiredCapabilities || ['text'],
      allowedTools: editingAgent.allowedTools ?? [],
      visibility: editingAgent.visibility || 'public',
      temperature: editingAgent.temperature ?? 0.7,
      sampleStarters: cleanedStarters,
      createdAt: editingAgent.createdAt || new Date().toISOString(),
    };

    const updatedList = isEditingExisting
      ? agents.map((agent) => (agent.id === completeAgent.id ? completeAgent : agent))
      : [...agents, completeAgent];

    setAgents(updatedList);
    setIsModalOpen(false);
    void persistAgents(updatedList);
  };

  const handleDeleteAgent = (id: string) => {
    if (!confirm('Are you sure you want to delete this AI Agent?')) return;
    const updatedList = agents.filter((agent) => agent.id !== id);
    setAgents(updatedList);
    void persistAgents(updatedList);
  };

  const persistAgents = async (newList: AIAgent[]) => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agents: newList }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to save agents');
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save agents to server';
      alert(message);
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
            Create specialized AbhiAI agents with custom personas, preferred models, and controlled tool access.
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
          Agents and tool permissions synchronized successfully.
        </div>
      )}

      {saving && (
        <div className="text-xs text-zinc-500 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving agent configuration…
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => (
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
                    <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">{agent.name}</h3>
                    <span className="text-xs text-zinc-400 font-mono">Model: {agent.preferredModelOrAlias}</span>
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

              <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-3">{agent.description}</p>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-500 font-mono line-clamp-3">
                {agent.systemPrompt}
              </div>

              <div className="flex flex-wrap gap-1.5 mt-3">
                {(agent.allowedTools ?? []).filter((tool) => tool !== 'image_generation').map((tool) => (
                  <span
                    key={tool}
                    className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-[10px] font-semibold"
                  >
                    {tool === 'web_search' ? 'Web Search' : 'Document Q&A'}
                  </span>
                ))}
                {(agent.allowedTools ?? []).length === 0 && (
                  <span className="text-[10px] text-zinc-400">No tools enabled</span>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="text-[11px] text-zinc-400">Temp: {agent.temperature}</div>
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
        ))}
      </div>

      {isModalOpen && editingAgent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {isEditingExisting ? 'Edit AI Agent' : 'Create Custom AI Agent'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">Agent Name</label>
                <input
                  type="text"
                  value={editingAgent.name || ''}
                  onChange={(event) => setEditingAgent({ ...editingAgent, name: event.target.value })}
                  placeholder="e.g. AbhiAI Medical Analyst"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">Description</label>
                <input
                  type="text"
                  value={editingAgent.description || ''}
                  onChange={(event) => setEditingAgent({ ...editingAgent, description: event.target.value })}
                  placeholder="What does this agent specialize in?"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">Preferred AI Model</label>
                  <select
                    value={editingAgent.preferredModelOrAlias || 'abhiai-fast'}
                    onChange={(event) => setEditingAgent({ ...editingAgent, preferredModelOrAlias: event.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-900 dark:text-zinc-100 outline-none"
                  >
                    {DEFAULT_PUBLIC_ALIASES.map((alias) => (
                      <option key={alias.id} value={alias.id}>{alias.displayName} (Alias)</option>
                    ))}
                    {connections.map((connection) => (
                      <option key={connection.id} value={connection.id}>{connection.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">Visibility</label>
                  <select
                    value={editingAgent.visibility || 'public'}
                    onChange={(event) => setEditingAgent({ ...editingAgent, visibility: event.target.value as AIAgent['visibility'] })}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-900 dark:text-zinc-100 outline-none"
                  >
                    <option value="public">Public (Visible to Visitors)</option>
                    <option value="admin_only">Admin Only (Private Workspace)</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">System Instructions / Persona</label>
                <textarea
                  rows={4}
                  value={editingAgent.systemPrompt || ''}
                  onChange={(event) => setEditingAgent({ ...editingAgent, systemPrompt: event.target.value })}
                  placeholder="Define role, tone, knowledge boundaries..."
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-zinc-900 dark:text-zinc-100 outline-none font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Allowed Tools</label>
                  <span className="text-[10px] text-zinc-400">Least-privilege per agent</span>
                </div>
                <div className="space-y-2">
                  {EDITABLE_TOOLS.map((tool) => {
                    const Icon = tool.icon;
                    const enabled = (editingAgent.allowedTools ?? []).includes(tool.id);
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => toggleTool(tool.id)}
                        className={`w-full p-3 rounded-xl border text-left flex items-start gap-3 transition-colors ${
                          enabled
                            ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/25'
                            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950'
                        }`}
                      >
                        <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center ${
                          enabled ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                        }`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{tool.label}</div>
                          <div className="text-[11px] text-zinc-500 mt-0.5">{tool.description}</div>
                        </div>
                        <div className={`w-4 h-4 mt-1 rounded border flex items-center justify-center ${
                          enabled ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-zinc-300 dark:border-zinc-700'
                        }`}>
                          {enabled && <CheckCircle className="w-3 h-3" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-dashed border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-500">
                  Image generation permission is reserved in the schema and will become selectable when the chat image tool executor is enabled.
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">Sample Prompt Starters</label>
                <div className="space-y-2">
                  {(editingAgent.sampleStarters || ['', '']).map((starter, index) => (
                    <input
                      key={index}
                      type="text"
                      value={starter}
                      onChange={(event) => {
                        const copy = [...(editingAgent.sampleStarters || [])];
                        copy[index] = event.target.value;
                        setEditingAgent({ ...editingAgent, sampleStarters: copy });
                      }}
                      placeholder={`Prompt starter #${index + 1}`}
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
                disabled={saving}
                className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2 rounded-xl text-xs font-semibold hover:opacity-90 shadow-sm disabled:opacity-50"
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
