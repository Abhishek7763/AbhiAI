'use client';

import React, { useEffect, useState } from 'react';
import {
  Bot,
  BookOpen,
  Brain,
  CheckCircle,
  Edit3,
  Globe,
  Image as ImageIcon,
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
    description: 'Lets this agent decide when current web information is needed and call search automatically.',
    icon: Globe,
  },
  {
    id: 'document_qa',
    label: 'Document Q&A',
    description: 'Lets this agent retrieve relevant passages from user-attached documents.',
    icon: BookOpen,
  },
  {
    id: 'image_generation',
    label: 'Image Generation',
    description: 'Lets this agent generate images through the configured AbhiAI image provider pipeline.',
    icon: ImageIcon,
  },
];

function normalizeAgent(agent: AIAgent): AIAgent {
  return {
    ...agent,
    allowedTools: Array.isArray(agent.allowedTools) ? agent.allowedTools : ['web_search', 'document_qa'],
    memoryEnabled: agent.memoryEnabled !== false,
    maxTokens: Number(agent.maxTokens) || 4096,
  };
}

function toolLabel(tool: AgentToolPermission) {
  if (tool === 'web_search') return 'Web Search';
  if (tool === 'document_qa') return 'Document Q&A';
  return 'Image Generation';
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
    let mounted = true;
    Promise.all([
      fetch('/api/admin/agents').then((response) => response.json()),
      fetch('/api/admin/connections').then((response) => response.json()),
    ])
      .then(([agentsData, connectionsData]) => {
        if (!mounted) return;
        if (Array.isArray(agentsData.agents)) setAgents(agentsData.agents.map((agent: AIAgent) => normalizeAgent(agent)));
        if (Array.isArray(connectionsData.connections)) setConnections(connectionsData.connections);
      })
      .catch((error) => console.error('Failed to load agents:', error))
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
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
      memoryEnabled: true,
      maxTokens: 4096,
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

  const persistAgents = async (nextAgents: AIAgent[]) => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agents: nextAgents }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to save agents');
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save agents to server');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveModal = () => {
    if (!editingAgent?.name || !editingAgent.systemPrompt) {
      alert('Please fill in the Agent Name and System Prompt.');
      return;
    }

    const slug = editingAgent.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
    const id = editingAgent.id || `agent-${slug}-${agents.length + 1}`;
    const next: AIAgent = {
      id,
      name: editingAgent.name,
      description: editingAgent.description || '',
      icon: editingAgent.icon || 'bot',
      systemPrompt: editingAgent.systemPrompt,
      preferredModelOrAlias: editingAgent.preferredModelOrAlias || 'abhiai-fast',
      fallbackModelOrAlias: editingAgent.fallbackModelOrAlias,
      requiredCapabilities: editingAgent.requiredCapabilities || ['text'],
      allowedTools: editingAgent.allowedTools ?? [],
      visibility: editingAgent.visibility || 'public',
      temperature: Math.max(0, Math.min(2, Number(editingAgent.temperature ?? 0.7))),
      memoryEnabled: editingAgent.memoryEnabled !== false,
      maxTokens: Math.max(256, Math.min(32768, Number(editingAgent.maxTokens) || 4096)),
      sampleStarters: (editingAgent.sampleStarters || []).filter((starter) => starter.trim().length > 0),
      createdAt: editingAgent.createdAt || new Date().toISOString(),
    };

    const updated = isEditingExisting
      ? agents.map((agent) => agent.id === next.id ? next : agent)
      : [...agents, next];
    setAgents(updated);
    setIsModalOpen(false);
    void persistAgents(updated);
  };

  const handleDeleteAgent = (id: string) => {
    if (!confirm('Are you sure you want to delete this AI Agent?')) return;
    const updated = agents.filter((agent) => agent.id !== id);
    setAgents(updated);
    void persistAgents(updated);
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
            <Bot className="w-6 h-6 text-emerald-500" /> Custom AI Agents
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
            Configure persona, model, memory, output limits, visibility, and callable tools per agent.
          </p>
        </div>
        <button onClick={openCreateModal} className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Create New Agent
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
          <CheckCircle className="w-4 h-4" /> Agent configuration synchronized successfully.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => (
          <div key={agent.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"><Bot className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{agent.name}</h3>
                  <div className="text-xs text-zinc-400 font-mono">{agent.preferredModelOrAlias}</div>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase text-zinc-500">{agent.visibility.replace('_', ' ')}</span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{agent.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {agent.allowedTools.map((tool) => (
                <span key={tool} className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-[10px] font-semibold">{toolLabel(tool)}</span>
              ))}
              {agent.allowedTools.length === 0 && <span className="text-[10px] text-zinc-400">No tools enabled</span>}
            </div>
            <div className="text-[11px] text-zinc-400 flex flex-wrap gap-3">
              <span>Temp {agent.temperature}</span><span>Max {agent.maxTokens} tokens</span><span>Memory {agent.memoryEnabled ? 'On' : 'Off'}</span>
            </div>
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
              <button onClick={() => openEditModal(agent)} className="p-2 rounded-xl text-xs font-semibold flex items-center gap-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
              <button onClick={() => handleDeleteAgent(agent.id)} className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && editingAgent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <h2 className="text-lg font-bold">{isEditingExisting ? 'Edit AI Agent' : 'Create Custom AI Agent'}</h2>
              <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1.5"><span className="font-bold uppercase tracking-wider">Agent Name</span><input value={editingAgent.name || ''} onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })} className="w-full bg-zinc-50 dark:bg-zinc-950 border rounded-xl px-3 py-2.5" /></label>
                <label className="space-y-1.5"><span className="font-bold uppercase tracking-wider">Description</span><input value={editingAgent.description || ''} onChange={(e) => setEditingAgent({ ...editingAgent, description: e.target.value })} className="w-full bg-zinc-50 dark:bg-zinc-950 border rounded-xl px-3 py-2.5" /></label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1.5"><span className="font-bold uppercase tracking-wider">Preferred Model</span><select value={editingAgent.preferredModelOrAlias || 'abhiai-fast'} onChange={(e) => setEditingAgent({ ...editingAgent, preferredModelOrAlias: e.target.value })} className="w-full bg-zinc-50 dark:bg-zinc-950 border rounded-xl px-3 py-2.5">{DEFAULT_PUBLIC_ALIASES.map((a) => <option key={a.id} value={a.id}>{a.displayName} (Alias)</option>)}{connections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <label className="space-y-1.5"><span className="font-bold uppercase tracking-wider">Visibility</span><select value={editingAgent.visibility || 'public'} onChange={(e) => setEditingAgent({ ...editingAgent, visibility: e.target.value as AIAgent['visibility'] })} className="w-full bg-zinc-50 dark:bg-zinc-950 border rounded-xl px-3 py-2.5"><option value="public">Public</option><option value="admin_only">Admin Only</option><option value="disabled">Disabled</option></select></label>
              </div>

              <label className="space-y-1.5 block"><span className="font-bold uppercase tracking-wider">System Instructions / Persona</span><textarea rows={5} value={editingAgent.systemPrompt || ''} onChange={(e) => setEditingAgent({ ...editingAgent, systemPrompt: e.target.value })} className="w-full bg-zinc-50 dark:bg-zinc-950 border rounded-xl p-3 font-mono" /></label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="space-y-1.5"><span className="font-bold uppercase tracking-wider">Temperature</span><input type="number" min="0" max="2" step="0.1" value={editingAgent.temperature ?? 0.7} onChange={(e) => setEditingAgent({ ...editingAgent, temperature: Number(e.target.value) })} className="w-full bg-zinc-50 dark:bg-zinc-950 border rounded-xl px-3 py-2.5" /></label>
                <label className="space-y-1.5"><span className="font-bold uppercase tracking-wider">Max Tokens</span><input type="number" min="256" max="32768" step="256" value={editingAgent.maxTokens ?? 4096} onChange={(e) => setEditingAgent({ ...editingAgent, maxTokens: Number(e.target.value) })} className="w-full bg-zinc-50 dark:bg-zinc-950 border rounded-xl px-3 py-2.5" /></label>
                <button type="button" onClick={() => setEditingAgent({ ...editingAgent, memoryEnabled: editingAgent.memoryEnabled === false })} className={`mt-5 rounded-xl border p-2.5 flex items-center justify-center gap-2 ${editingAgent.memoryEnabled !== false ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300' : 'bg-zinc-50 dark:bg-zinc-950'}`}><Brain className="w-4 h-4" /> Memory {editingAgent.memoryEnabled !== false ? 'On' : 'Off'}</button>
              </div>

              <div>
                <div className="font-bold uppercase tracking-wider mb-2">Allowed Tools</div>
                <div className="space-y-2">
                  {EDITABLE_TOOLS.map((tool) => {
                    const Icon = tool.icon;
                    const enabled = (editingAgent.allowedTools ?? []).includes(tool.id);
                    return <button key={tool.id} type="button" onClick={() => toggleTool(tool.id)} className={`w-full p-3 rounded-xl border text-left flex gap-3 ${enabled ? 'border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/25' : 'border-zinc-200 dark:border-zinc-800'}`}><Icon className="w-4 h-4 mt-0.5" /><div className="flex-1"><div className="font-semibold">{tool.label}</div><div className="text-[11px] text-zinc-500">{tool.description}</div></div>{enabled && <CheckCircle className="w-4 h-4 text-emerald-600" />}</button>;
                  })}
                </div>
              </div>

              <div>
                <div className="font-bold uppercase tracking-wider mb-2">Sample Prompt Starters</div>
                <div className="space-y-2">{(editingAgent.sampleStarters || ['', '']).map((starter, index) => <input key={index} value={starter} onChange={(e) => { const copy = [...(editingAgent.sampleStarters || [])]; copy[index] = e.target.value; setEditingAgent({ ...editingAgent, sampleStarters: copy }); }} className="w-full bg-zinc-50 dark:bg-zinc-950 border rounded-xl px-3 py-2" />)}</div>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-500">Cancel</button>
              <button onClick={handleSaveModal} disabled={saving} className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2 rounded-xl text-xs font-semibold disabled:opacity-50">{saving ? 'Saving…' : 'Save Agent'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
