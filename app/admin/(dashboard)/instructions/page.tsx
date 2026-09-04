'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, FileText, History, Loader2, RotateCcw, Save, Shield, Users } from 'lucide-react';

type Scope = 'global' | 'public' | 'admin' | 'agent';
type Agent = { id: string; name: string; icon: string; instructions: string };
type Revision = { id: number; content: string; createdAt: string };
type State = { global: string; public: string; admin: string; agents: Agent[] };

const tabs: { id: Scope; label: string; icon: typeof FileText; help: string }[] = [
  { id: 'global', label: 'Global identity', icon: FileText, help: 'Core AbhiAI identity and rules shared across experiences.' },
  { id: 'public', label: 'Public instructions', icon: Users, help: 'Behavior rules specifically for the public assistant.' },
  { id: 'admin', label: 'Admin instructions', icon: Shield, help: 'Private behavior rules for the admin AI workspace.' },
  { id: 'agent', label: 'Agent instructions', icon: Users, help: 'Edit the specialized instructions for any configured agent.' },
];

export default function InstructionsPage() {
  const [data, setData] = useState<State | null>(null);
  const [scope, setScope] = useState<Scope>('global');
  const [agentId, setAgentId] = useState('');
  const [content, setContent] = useState('');
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const selectedAgent = useMemo(() => data?.agents.find((agent) => agent.id === agentId), [data, agentId]);

  const loadRevisions = useCallback(async (nextScope: Scope, targetId = '') => {
    const res = await fetch(`/api/admin/instructions?scope=${nextScope}&targetId=${encodeURIComponent(targetId)}`);
    if (res.ok) setRevisions((await res.json()).revisions ?? []);
  }, []);

  useEffect(() => {
    fetch('/api/admin/instructions').then(async (res) => {
      if (!res.ok) throw new Error('Failed to load instructions');
      const next = await res.json() as State;
      setData(next);
      setAgentId(next.agents[0]?.id ?? '');
      setContent(next.global ?? '');
      await loadRevisions('global');
    }).catch(() => setStatus('Unable to load instructions.')).finally(() => setLoading(false));
  }, [loadRevisions]);

  function chooseScope(next: Scope) {
    if (!data) return;
    setScope(next);
    setStatus('');
    const target = next === 'agent' ? (agentId || data.agents[0]?.id || '') : '';
    if (next === 'agent') setAgentId(target);
    setContent(next === 'agent' ? (data.agents.find((a) => a.id === target)?.instructions ?? '') : data[next]);
    void loadRevisions(next, target);
  }

  function chooseAgent(id: string) {
    setAgentId(id);
    setContent(data?.agents.find((agent) => agent.id === id)?.instructions ?? '');
    setStatus('');
    void loadRevisions('agent', id);
  }

  async function save() {
    setSaving(true); setStatus('');
    try {
      const res = await fetch('/api/admin/instructions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope, targetId: scope === 'agent' ? agentId : '', content }) });
      if (!res.ok) throw new Error('Save failed');
      setData((current) => current ? scope === 'agent'
        ? { ...current, agents: current.agents.map((a) => a.id === agentId ? { ...a, instructions: content.trim() } : a) }
        : { ...current, [scope]: content.trim() } : current);
      setContent(content.trim()); setStatus('Saved successfully.');
      await loadRevisions(scope, scope === 'agent' ? agentId : '');
    } catch { setStatus('Unable to save instructions.'); } finally { setSaving(false); }
  }

  async function restore(revision: Revision) {
    if (!window.confirm('Restore this version? The current text will remain available in version history after the restore.')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/instructions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restore', revisionId: revision.id }) });
      if (!res.ok) throw new Error('Restore failed');
      const result = await res.json(); setContent(result.content); setStatus('Version restored.');
      setData((current) => current ? scope === 'agent' ? { ...current, agents: current.agents.map((a) => a.id === agentId ? { ...a, instructions: result.content } : a) } : { ...current, [scope]: result.content } : current);
      await loadRevisions(scope, scope === 'agent' ? agentId : '');
    } catch { setStatus('Unable to restore this version.'); } finally { setSaving(false); }
  }

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-zinc-400" /></div>;
  const active = tabs.find((tab) => tab.id === scope)!;

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Instructions Manager</h1><p className="mt-1 text-zinc-500 dark:text-zinc-400">Control AbhiAI behavior from one place, with safe version history and restore.</p></div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="space-y-4">
        <div className="flex flex-wrap gap-2">{tabs.map((tab) => <button key={tab.id} onClick={() => chooseScope(tab.id)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${scope === tab.id ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900' : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'}`}><tab.icon className="h-4 w-4" />{tab.label}</button>)}</div>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 p-5 dark:border-zinc-800"><h2 className="font-semibold text-zinc-900 dark:text-zinc-100">{active.label}</h2><p className="mt-1 text-sm text-zinc-500">{active.help}</p>{scope === 'agent' && <select value={agentId} onChange={(e) => chooseAgent(e.target.value)} className="mt-4 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950">{data?.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.icon} {agent.name}</option>)}</select>}</div>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={22} placeholder={scope === 'agent' && !selectedAgent ? 'Create an agent first.' : 'Write instructions here...'} disabled={scope === 'agent' && !selectedAgent} className="min-h-[480px] w-full resize-y bg-transparent p-6 font-mono text-sm leading-relaxed text-zinc-900 outline-none disabled:opacity-50 dark:text-zinc-100" />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950"><div className="text-sm text-zinc-500">{status && <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4" />{status}</span>}</div><button onClick={save} disabled={saving || (scope === 'agent' && !agentId)} className="flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save instructions</button></div>
        </div>
      </section>
      <aside className="h-fit rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><div className="mb-4 flex items-center gap-2"><History className="h-5 w-5 text-zinc-500" /><h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Version history</h2></div>{revisions.length === 0 ? <p className="text-sm text-zinc-500">No saved versions yet. Your first change will create one.</p> : <div className="space-y-3">{revisions.map((revision) => <div key={revision.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"><p className="line-clamp-3 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-300">{revision.content || '(empty instructions)'}</p><div className="mt-3 flex items-center justify-between gap-2"><time className="text-[11px] text-zinc-400">{new Date(revision.createdAt).toLocaleString()}</time><button onClick={() => restore(revision)} disabled={saving} className="flex items-center gap-1 text-xs font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"><RotateCcw className="h-3.5 w-3.5" />Restore</button></div></div>)}</div>}</aside>
    </div>
  </div>;
}
