'use client';

import {
  AlertCircle,
  Bot,
  Check,
  ChevronDown,
  Loader2,
  MessageSquare,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { AIConnection } from '@/lib/connections';
import type { AIAgent } from '@/lib/agents';

type WorkspaceMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  isStreaming?: boolean;
};

type WorkspaceConversation = {
  id: string;
  title: string;
  messages: WorkspaceMessage[];
  connectionId: string | null;
  agentId: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = 'abhiai-admin-workspace-v1';

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeConversation(): WorkspaceConversation {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    title: 'New conversation',
    messages: [],
    connectionId: null,
    agentId: null,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<WorkspaceConversation[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [connections, setConnections] = useState<AIConnection[]>([]);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((item) => item.id === activeId) ?? conversations[0] ?? null;
  const activeConnection = connections.find((item) => item.id === active?.connectionId) ?? null;
  const activeAgent = agents.find((item) => item.id === active?.agentId) ?? null;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as WorkspaceConversation[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConversations(parsed);
          setActiveId(parsed[0].id);
          setHydrated(true);
          return;
        }
      }
    } catch {
      // Corrupt local workspace data should never block the admin page.
    }

    const first = makeConversation();
    setConversations([first]);
    setActiveId(first.id);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations, hydrated]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.messages, isLoading]);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/connections').then((res) => res.json()),
      fetch('/api/admin/agents').then((res) => res.json()),
    ])
      .then(([connectionData, agentData]) => {
        const enabledConnections = Array.isArray(connectionData.connections)
          ? connectionData.connections.filter((item: AIConnection) => item.isActive)
          : [];
        const enabledAgents = Array.isArray(agentData.agents)
          ? agentData.agents.filter((item: AIAgent) => item.visibility !== 'disabled')
          : [];

        setConnections(enabledConnections);
        setAgents(enabledAgents);

        setConversations((current) => current.map((conversation, index) => ({
          ...conversation,
          connectionId: conversation.connectionId || (index === 0 ? enabledConnections[0]?.id || null : conversation.connectionId),
        })));
      })
      .catch(() => setError('Workspace configuration could not be loaded.'));
  }, []);

  const visibleConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return conversations
      .filter((conversation) => {
        if (!query) return true;
        return conversation.title.toLowerCase().includes(query)
          || conversation.messages.some((message) => message.content.toLowerCase().includes(query));
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [conversations, search]);

  function updateConversation(id: string, patch: Partial<WorkspaceConversation>) {
    setConversations((current) => current.map((conversation) => (
      conversation.id === id
        ? { ...conversation, ...patch, updatedAt: new Date().toISOString() }
        : conversation
    )));
  }

  function newConversation() {
    const next = makeConversation();
    next.connectionId = connections[0]?.id || null;
    setConversations((current) => [next, ...current]);
    setActiveId(next.id);
    setInput('');
    setError(null);
  }

  function renameConversation(conversation: WorkspaceConversation) {
    const nextTitle = window.prompt('Rename conversation', conversation.title)?.trim();
    if (nextTitle) updateConversation(conversation.id, { title: nextTitle.slice(0, 80) });
  }

  function deleteConversation(conversation: WorkspaceConversation) {
    if (!window.confirm(`Delete “${conversation.title}”?`)) return;
    setConversations((current) => {
      const remaining = current.filter((item) => item.id !== conversation.id);
      if (remaining.length > 0) {
        if (activeId === conversation.id) setActiveId(remaining[0].id);
        return remaining;
      }
      const replacement = makeConversation();
      replacement.connectionId = connections[0]?.id || null;
      setActiveId(replacement.id);
      return [replacement];
    });
  }

  function selectAgent(agentId: string) {
    if (!active) return;
    const agent = agents.find((item) => item.id === agentId) ?? null;
    let nextConnectionId = active.connectionId;
    if (agent) {
      const preferred = connections.find((connection) => (
        connection.id === agent.preferredModelOrAlias
        || connection.assignedAlias === agent.preferredModelOrAlias
        || connection.name === agent.preferredModelOrAlias
        || connection.modelId === agent.preferredModelOrAlias
      ));
      if (preferred) nextConnectionId = preferred.id;
    }
    updateConversation(active.id, { agentId: agent?.id || null, connectionId: nextConnectionId });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!active || !input.trim() || !activeConnection || isLoading) return;

    const sentInput = input.trim();
    const userMessage: WorkspaceMessage = { id: makeId(), role: 'user', content: sentInput };
    const baseMessages = [...active.messages, userMessage];
    const title = active.messages.length === 0 && active.title === 'New conversation'
      ? sentInput.replace(/\s+/g, ' ').slice(0, 52)
      : active.title;

    updateConversation(active.id, { messages: baseMessages, title });
    setInput('');
    setIsLoading(true);
    setError(null);

    const assistantId = makeId();
    const effectiveMessage = activeAgent
      ? `[Selected admin agent: ${activeAgent.name}]\n${activeAgent.systemPrompt}\n\nUser request:\n${sentInput}`
      : sentInput;

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: effectiveMessage,
          history: active.messages.map((message) => ({ role: message.role, content: message.content })),
          modelId: activeConnection.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to start streaming response.');
      }
      if (!response.body) throw new Error('Streaming response was empty.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      let modelUsed = activeConnection.name;

      updateConversation(active.id, {
        messages: [...baseMessages, { id: assistantId, role: 'assistant', content: '', model: modelUsed, isStreaming: true }],
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.replace(/^data:\s*/, '');
          if (!payload) continue;
          const parsed = JSON.parse(payload) as { type?: string; text?: string; modelName?: string; error?: string };
          if (parsed.type === 'meta') modelUsed = parsed.modelName || modelUsed;
          if (parsed.type === 'error') throw new Error(parsed.error || 'Streaming failed.');
          if (parsed.type === 'delta' && parsed.text) {
            accumulated += parsed.text;
            updateConversation(active.id, {
              messages: [...baseMessages, {
                id: assistantId,
                role: 'assistant',
                content: accumulated,
                model: modelUsed,
                isStreaming: true,
              }],
            });
          }
        }
      }

      updateConversation(active.id, {
        messages: [...baseMessages, {
          id: assistantId,
          role: 'assistant',
          content: accumulated || 'No response generated.',
          model: modelUsed,
          isStreaming: false,
        }],
      });
    } catch (streamError) {
      setError(streamError instanceof Error ? streamError.message : 'Workspace request failed.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[620px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <aside className="hidden w-72 shrink-0 border-r border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950 lg:flex lg:flex-col">
        <button onClick={newConversation} className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
          <Plus className="h-4 w-4" /> New chat
        </button>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:ring-zinc-700" />
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto pr-1">
          {visibleConversations.map((conversation) => (
            <div key={conversation.id} className={`group rounded-xl border px-3 py-2.5 ${active?.id === conversation.id ? 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900' : 'border-transparent hover:bg-white dark:hover:bg-zinc-900'}`}>
              <button onClick={() => setActiveId(conversation.id)} className="w-full text-left">
                <div className="flex items-center gap-2">
                  {conversation.pinned ? <Pin className="h-3.5 w-3.5 shrink-0" /> : <MessageSquare className="h-3.5 w-3.5 shrink-0 text-zinc-400" />}
                  <span className="truncate text-sm font-medium">{conversation.title}</span>
                </div>
                <p className="mt-1 truncate pl-5 text-xs text-zinc-400">{conversation.messages.at(-1)?.content || 'Private admin conversation'}</p>
              </button>
              <div className="mt-2 hidden items-center gap-1 pl-5 group-hover:flex">
                <button onClick={() => updateConversation(conversation.id, { pinned: !conversation.pinned })} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800" aria-label="Pin conversation">
                  {conversation.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => renameConversation(conversation)} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800" aria-label="Rename conversation"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => deleteConversation(conversation)} className="rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" aria-label="Delete conversation"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          <ShieldCheck className="h-4 w-4 shrink-0" /> Stored only in this admin browser.
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5 text-violet-500" /> Admin AI Workspace</h1>
              <p className="text-xs text-zinc-500">Private multi-model workspace with persistent local history.</p>
            </div>
            <button onClick={newConversation} className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium lg:hidden dark:border-zinc-800"><Plus className="h-4 w-4" /> New</button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="relative">
              <span className="sr-only">Model</span>
              <select value={active?.connectionId || ''} onChange={(event) => active && updateConversation(active.id, { connectionId: event.target.value })} className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-3 py-2.5 pr-9 text-sm font-medium outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:ring-zinc-700">
                {connections.length === 0 && <option value="">No enabled model</option>}
                {connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-zinc-400" />
            </label>
            <label className="relative">
              <span className="sr-only">Agent</span>
              <select value={active?.agentId || ''} onChange={(event) => selectAgent(event.target.value)} className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-3 py-2.5 pr-9 text-sm font-medium outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:ring-zinc-700">
                <option value="">No agent · direct model</option>
                {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-zinc-400" />
            </label>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {active?.messages.length ? (
            <div className="mx-auto max-w-3xl space-y-5">
              {active.messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'assistant' && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"><Bot className="h-4 w-4" /></div>}
                  <div className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${message.role === 'user' ? 'rounded-tr-sm bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'rounded-tl-sm border border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100'}`}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.model && <div className="mt-2 flex items-center gap-1 border-t border-zinc-200/60 pt-2 text-[10px] text-zinc-400 dark:border-zinc-700"><Check className="h-3 w-3 text-emerald-500" /> {message.model}{message.isStreaming ? ' · streaming' : ''}</div>}
                  </div>
                  {message.role === 'user' && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"><User className="h-4 w-4" /></div>}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300"><Bot className="h-7 w-7" /></div>
                <h2 className="text-xl font-semibold">Your private AbhiAI workspace</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">Choose any enabled model, optionally select an agent, and keep separate searchable conversations for admin-only work.</p>
                {activeAgent?.sampleStarters?.[0] && <button onClick={() => setInput(activeAgent.sampleStarters[0])} className="mt-4 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">Try: {activeAgent.sampleStarters[0]}</button>}
              </div>
            </div>
          )}

          {error && <div className="mx-auto mt-4 flex max-w-3xl items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</div>}
        </div>

        <div className="border-t border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950 sm:p-4">
          <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={1} placeholder={activeConnection ? `Message ${activeAgent?.name || activeConnection.name}...` : 'Enable an AI model first'} disabled={isLoading || !activeConnection} className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-zinc-400 disabled:opacity-50" />
            <button type="submit" disabled={isLoading || !input.trim() || !activeConnection} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-zinc-400">Enter to send · Shift+Enter for new line · conversations remain private to this browser</p>
        </div>
      </main>
    </div>
  );
}
