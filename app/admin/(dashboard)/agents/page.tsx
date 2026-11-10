'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  BookOpen,
  Brain,
  CheckCircle,
  Code2,
  Edit3,
  Globe,
  Image as ImageIcon,
  Loader2,
  PenTool,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { AIAgent, AgentCapability, AgentToolPermission } from '@/lib/agents';
import type { AIConnection } from '@/lib/connections';
import { DEFAULT_PUBLIC_ALIASES } from '@/lib/constants/aliases';

const CAPABILITIES: Array<{ id: AgentCapability; label: string }> = [
  { id: 'text', label: 'Text' },
  { id: 'reasoning', label: 'Reasoning' },
  { id: 'coding', label: 'Coding' },
  { id: 'vision', label: 'Vision' },
  { id: 'fast', label: 'Fast' },
];

const TOOLS: Array<{ id: AgentToolPermission; label: string; description: string; icon: typeof Globe }> = [
  { id: 'web_search', label: 'Live Web Search', description: 'Search current web information when needed.', icon: Globe },
  { id: 'document_qa', label: 'Document Q&A', description: 'Work with relevant passages from attached documents.', icon: BookOpen },
  { id: 'image_generation', label: 'Image Generation', description: 'Generate images through the configured AbhiAI image pipeline.', icon: ImageIcon },
];

const ICONS = [
  { id: 'bot', label: 'Assistant', icon: Bot },
  { id: 'book-open', label: 'Study', icon: BookOpen },
  { id: 'code-2', label: 'Coding', icon: Code2 },
  { id: 'search', label: 'Research', icon: Search },
  { id: 'pen-tool', label: 'Writing', icon: PenTool },
  { id: 'brain', label: 'Reasoning', icon: Brain },
  { id: 'sparkles', label: 'Creative', icon: Sparkles },
];

function normalizeAgent(agent: AIAgent): AIAgent {
  return {
    ...agent,
    modelPool: Array.isArray(agent.modelPool) && agent.modelPool.length > 0
      ? agent.modelPool
      : agent.preferredModelOrAlias ? [agent.preferredModelOrAlias] : [],
    requiredCapabilities: Array.isArray(agent.requiredCapabilities) && agent.requiredCapabilities.length > 0
      ? agent.requiredCapabilities
      : ['text'],
    allowedTools: Array.isArray(agent.allowedTools) ? agent.allowedTools : [],
    memoryEnabled: agent.memoryEnabled !== false,
    maxTokens: Number(agent.maxTokens) || 4096,
  };
}

function AgentIcon({ name, className = 'w-5 h-5' }: { name: string; className?: string }) {
  const Icon = ICONS.find((item) => item.id === name)?.icon ?? Bot;
  return <Icon className={className} />;
}

function toolLabel(tool: AgentToolPermission) {
  return TOOLS.find((item) => item.id === tool)?.label ?? tool;
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
        if (Array.isArray(connectionsData.connections)) setConnections(connectionsData.connections.filter((item: AIConnection) => item.isActive));
      })
      .catch((error) => console.error('Failed to load agent builder:', error))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const modelChoices = useMemo(() => {
    const choices = [
      ...DEFAULT_PUBLIC_ALIASES.map((alias) => ({ value: alias.id, label: `${alias.displayName} (Alias)` })),
      ...connections.map((connection) => ({ value: connection.id, label: connection.name })),
    ];
    const seen = new Set<string>();
    return choices.filter((choice) => {
      if (seen.has(choice.value)) return false;
      seen.add(choice.value);
      return true;
    });
  }, [connections]);

  const openCreateModal = () => {
    setEditingAgent({
      id: '',
      name: '',
      description: '',
      icon: 'bot',
      systemPrompt: 'You are a specialized AbhiAI assistant created by Abhishek.',
      preferredModelOrAlias: 'abhiai-fast',
      modelPool: ['abhiai-fast'],
      fallbackModelOrAlias: undefined,
      requiredCapabilities: ['text'],
      allowedTools: [],
      visibility: 'admin_only',
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

  function toggleCapability(capability: AgentCapability) {
    if (!editingAgent) return;
    const next = new Set(editingAgent.requiredCapabilities ?? []);
    if (next.has(capability)) next.delete(capability); else next.add(capability);
    if (next.size === 0) next.add('text');
    setEditingAgent({ ...editingAgent, requiredCapabilities: Array.from(next) });
  }

  function toggleTool(tool: AgentToolPermission) {
    if (!editingAgent) return;
    const next = new Set(editingAgent.allowedTools ?? []);
    if (next.has(tool)) next.delete(tool); else next.add(tool);
    setEditingAgent({ ...editingAgent, allowedTools: Array.from(next) });
  }

  function togglePoolModel(model: string) {
    if (!editingAgent) return;
    const current = editingAgent.modelPool ?? [];
    const exists = current.includes(model);
    const next = exists ? current.filter((item) => item !== model) : [...current, model];
    setEditingAgent({ ...editingAgent, modelPool: next });
  }

  async function persistAgents(nextAgents: AIAgent[]) {
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
      window.setTimeout(() => setSavedSuccess(false), 3000);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save agents to server');
    } finally {
      setSaving(false);
    }
  }

  function handleSaveModal() {
    if (!editingAgent?.name?.trim() || !editingAgent.systemPrompt?.trim()) {
      alert('Agent Name and Instructions are required.');
      return;
    }

    const slug = editingAgent.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'custom';
    const id = editingAgent.id || `agent-${slug}-${Date.now().toString(36)}`;
    const preferred = editingAgent.preferredModelOrAlias || modelChoices[0]?.value || '';
    const modelPool = Array.from(new Set([preferred, ...(editingAgent.modelPool ?? [])].filter(Boolean)));
    const next: AIAgent = {
      id,
      name: editingAgent.name.trim(),
      description: editingAgent.description?.trim() || '',
      icon: editingAgent.icon || 'bot',
      systemPrompt: editingAgent.systemPrompt.trim(),
      preferredModelOrAlias: preferred,
      modelPool,
      fallbackModelOrAlias: editingAgent.fallbackModelOrAlias || undefined,
      requiredCapabilities: editingAgent.requiredCapabilities?.length ? editingAgent.requiredCapabilities : ['text'],
      allowedTools: editingAgent.allowedTools ?? [],
      visibility: editingAgent.visibility || 'admin_only',
      temperature: Math.max(0, Math.min(2, Number(editingAgent.temperature ?? 0.7))),
      memoryEnabled: editingAgent.memoryEnabled !== false,
      maxTokens: Math.max(256, Math.min(32768, Number(editingAgent.maxTokens) || 4096)),
      sampleStarters: (editingAgent.sampleStarters || []).map((item) => item.trim()).filter(Boolean),
      createdAt: editingAgent.createdAt || new Date().toISOString(),
    };

    const updated = isEditingExisting ? agents.map((agent) => agent.id === next.id ? next : agent) : [...agents, next];
    setAgents(updated);
    setIsModalOpen(false);
    void persistAgents(updated);
  }

  function handleDeleteAgent(id: string) {
    if (!confirm('Delete this AI Agent? This cannot be undone.')) return;
    const updated = agents.filter((agent) => agent.id !== id);
    setAgents(updated);
    void persistAgents(updated);
  }

  if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-zinc-900 dark:text-zinc-100"><Bot className="w-6 h-6 text-emerald-500" /> Agent System</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Create specialized AbhiAI assistants without editing code.</p>
        </div>
        <button onClick={openCreateModal} className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"><Plus className="w-4 h-4" /> Create Agent</button>
      </div>

      {savedSuccess && <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"><CheckCircle className="w-4 h-4" /> Agent configuration saved.</div>}

      {agents.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700"><Bot className="mx-auto mb-3 w-9 h-9 text-zinc-400" /><p className="font-semibold">No agents yet</p><p className="mt-1 text-sm text-zinc-500">Create your first specialized AbhiAI assistant.</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <div key={agent.id} className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800"><AgentIcon name={agent.icon} /></div><div className="min-w-0"><h3 className="truncate font-bold">{agent.name}</h3><p className="truncate text-[11px] text-zinc-400">{agent.preferredModelOrAlias}</p></div></div>
                <span className="rounded-full bg-zinc-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{agent.visibility.replace('_', ' ')}</span>
              </div>
              <p className="min-h-8 text-xs text-zinc-600 dark:text-zinc-400">{agent.description || 'No description'}</p>
              <div className="flex flex-wrap gap-1.5">{agent.requiredCapabilities.map((capability) => <span key={capability} className="rounded-lg bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">{capability}</span>)}</div>
              <div className="rounded-xl bg-zinc-50 p-3 text-[11px] dark:bg-zinc-950"><div className="font-semibold">Model pool · {(agent.modelPool ?? []).length}</div><div className="mt-1 truncate text-zinc-500">{(agent.modelPool ?? []).join(' → ') || 'No pool configured'}</div>{agent.fallbackModelOrAlias && <div className="mt-1 text-zinc-500">Fallback: {agent.fallbackModelOrAlias}</div>}</div>
              <div className="flex flex-wrap gap-1.5">{agent.allowedTools.map((tool) => <span key={tool} className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">{toolLabel(tool)}</span>)}{agent.allowedTools.length === 0 && <span className="text-[10px] text-zinc-400">No tools enabled</span>}</div>
              <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800"><button onClick={() => openEditModal(agent)} className="flex items-center gap-1 rounded-xl p-2 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800"><Edit3 className="w-3.5 h-3.5" /> Edit</button><button onClick={() => handleDeleteAgent(agent.id)} className="rounded-xl p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30" aria-label={`Delete ${agent.name}`}><Trash2 className="w-3.5 h-3.5" /></button></div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-4">
          <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800 sm:px-6"><div><h2 className="text-lg font-bold">{isEditingExisting ? 'Edit Agent' : 'Create Agent'}</h2><p className="text-xs text-zinc-500">Identity, routing, capabilities and visibility.</p></div><button onClick={() => setIsModalOpen(false)} className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="w-5 h-5" /></button></div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5 text-xs sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5"><span className="font-bold uppercase tracking-wider">Name *</span><input value={editingAgent.name || ''} onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })} className="w-full rounded-xl border bg-zinc-50 px-3 py-2.5 dark:bg-zinc-950" /></label>
                <label className="space-y-1.5"><span className="font-bold uppercase tracking-wider">Description</span><input value={editingAgent.description || ''} onChange={(e) => setEditingAgent({ ...editingAgent, description: e.target.value })} className="w-full rounded-xl border bg-zinc-50 px-3 py-2.5 dark:bg-zinc-950" /></label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5"><span className="font-bold uppercase tracking-wider">Icon</span><select value={editingAgent.icon || 'bot'} onChange={(e) => setEditingAgent({ ...editingAgent, icon: e.target.value })} className="w-full rounded-xl border bg-zinc-50 px-3 py-2.5 dark:bg-zinc-950">{ICONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
                <label className="space-y-1.5"><span className="font-bold uppercase tracking-wider">Visibility</span><select value={editingAgent.visibility || 'admin_only'} onChange={(e) => setEditingAgent({ ...editingAgent, visibility: e.target.value as AIAgent['visibility'] })} className="w-full rounded-xl border bg-zinc-50 px-3 py-2.5 dark:bg-zinc-950"><option value="public">Public</option><option value="admin_only">Private / Admin Only</option><option value="disabled">Disabled</option></select></label>
              </div>

              <label className="block space-y-1.5"><span className="font-bold uppercase tracking-wider">Instructions *</span><textarea rows={6} value={editingAgent.systemPrompt || ''} onChange={(e) => setEditingAgent({ ...editingAgent, systemPrompt: e.target.value })} className="w-full rounded-xl border bg-zinc-50 p-3 font-mono text-xs dark:bg-zinc-950" /></label>

              <div>
                <div className="mb-2 font-bold uppercase tracking-wider">Capabilities</div>
                <div className="flex flex-wrap gap-2">{CAPABILITIES.map((capability) => { const enabled = (editingAgent.requiredCapabilities ?? []).includes(capability.id); return <button key={capability.id} type="button" onClick={() => toggleCapability(capability.id)} className={`rounded-xl border px-3 py-2 font-semibold ${enabled ? 'border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300' : 'border-zinc-200 dark:border-zinc-800'}`}>{enabled && '✓ '}{capability.label}</button>; })}</div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5"><span className="font-bold uppercase tracking-wider">Preferred Model</span><select value={editingAgent.preferredModelOrAlias || ''} onChange={(e) => setEditingAgent({ ...editingAgent, preferredModelOrAlias: e.target.value })} className="w-full rounded-xl border bg-zinc-50 px-3 py-2.5 dark:bg-zinc-950">{modelChoices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label>
                <label className="space-y-1.5"><span className="font-bold uppercase tracking-wider">Fallback</span><select value={editingAgent.fallbackModelOrAlias || ''} onChange={(e) => setEditingAgent({ ...editingAgent, fallbackModelOrAlias: e.target.value || undefined })} className="w-full rounded-xl border bg-zinc-50 px-3 py-2.5 dark:bg-zinc-950"><option value="">Automatic / none</option>{modelChoices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between"><span className="font-bold uppercase tracking-wider">Model Pool</span><span className="text-[10px] text-zinc-400">Click to add/remove; order follows selection.</span></div>
                {(editingAgent.modelPool ?? []).length > 0 && <div className="mb-2 flex flex-wrap gap-1.5">{(editingAgent.modelPool ?? []).map((model, index) => <button key={model} type="button" onClick={() => togglePoolModel(model)} className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{index + 1}. {model} ×</button>)}</div>}
                <div className="grid gap-2 sm:grid-cols-2">{modelChoices.map((choice) => { const enabled = (editingAgent.modelPool ?? []).includes(choice.value); return <button key={choice.value} type="button" onClick={() => togglePoolModel(choice.value)} className={`rounded-xl border p-2.5 text-left ${enabled ? 'border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/25' : 'border-zinc-200 dark:border-zinc-800'}`}><div className="font-semibold">{enabled ? '✓ ' : ''}{choice.label}</div><div className="truncate text-[10px] text-zinc-400">{choice.value}</div></button>; })}</div>
              </div>

              <div>
                <div className="mb-2 font-bold uppercase tracking-wider">Allowed Tools</div>
                <div className="space-y-2">{TOOLS.map((tool) => { const Icon = tool.icon; const enabled = (editingAgent.allowedTools ?? []).includes(tool.id); return <button key={tool.id} type="button" onClick={() => toggleTool(tool.id)} className={`flex w-full gap-3 rounded-xl border p-3 text-left ${enabled ? 'border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/25' : 'border-zinc-200 dark:border-zinc-800'}`}><Icon className="mt-0.5 w-4 h-4" /><div className="flex-1"><div className="font-semibold">{tool.label}</div><div className="text-[11px] text-zinc-500">{tool.description}</div></div>{enabled && <CheckCircle className="w-4 h-4 text-emerald-600" />}</button>; })}</div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1.5"><span className="font-bold uppercase tracking-wider">Temperature</span><input type="number" min="0" max="2" step="0.1" value={editingAgent.temperature ?? 0.7} onChange={(e) => setEditingAgent({ ...editingAgent, temperature: Number(e.target.value) })} className="w-full rounded-xl border bg-zinc-50 px-3 py-2.5 dark:bg-zinc-950" /></label>
                <label className="space-y-1.5"><span className="font-bold uppercase tracking-wider">Max Tokens</span><input type="number" min="256" max="32768" step="256" value={editingAgent.maxTokens ?? 4096} onChange={(e) => setEditingAgent({ ...editingAgent, maxTokens: Number(e.target.value) })} className="w-full rounded-xl border bg-zinc-50 px-3 py-2.5 dark:bg-zinc-950" /></label>
                <button type="button" onClick={() => setEditingAgent({ ...editingAgent, memoryEnabled: editingAgent.memoryEnabled === false })} className={`mt-5 flex items-center justify-center gap-2 rounded-xl border p-2.5 ${editingAgent.memoryEnabled !== false ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'bg-zinc-50 dark:bg-zinc-950'}`}><Brain className="w-4 h-4" /> Memory {editingAgent.memoryEnabled !== false ? 'On' : 'Off'}</button>
              </div>

              <div><div className="mb-2 font-bold uppercase tracking-wider">Sample Starters</div><div className="space-y-2">{(editingAgent.sampleStarters || ['', '']).map((starter, index) => <input key={index} value={starter} onChange={(e) => { const copy = [...(editingAgent.sampleStarters || ['', ''])]; copy[index] = e.target.value; setEditingAgent({ ...editingAgent, sampleStarters: copy }); }} placeholder={`Starter ${index + 1}`} className="w-full rounded-xl border bg-zinc-50 px-3 py-2 dark:bg-zinc-950" />)}</div></div>
            </div>

            <div className="flex justify-end gap-3 border-t px-5 py-4 dark:border-zinc-800 sm:px-6"><button onClick={() => setIsModalOpen(false)} className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-500">Cancel</button><button onClick={handleSaveModal} disabled={saving} className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">{saving ? 'Saving…' : 'Save Agent'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
