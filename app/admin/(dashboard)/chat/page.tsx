'use client';
import { Send, Bot, User, AlertCircle, Loader2, ChevronDown, Sparkles, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AIConnection } from '@/lib/connections';

export default function ChatPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [connections, setConnections] = useState<AIConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<AIConnection | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    fetch('/api/admin/connections')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.connections)) {
          setConnections(data.connections);
          const active = data.connections.find((c: AIConnection) => c.isActive);
          if (active) setSelectedConnection(active);
        }
      })
      .catch(console.error);
  }, []);

  const handleInputChange = (e: any) => setInput(e.target.value);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!input.trim() || !selectedConnection) return;
    
    const userMsg = { id: Date.now().toString(), role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    const sentInput = input;
    setInput('');
    setIsLoading(true);
    setError(null);
    
    const assistantMsgId = (Date.now() + 1).toString();

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           message: sentInput,
           history: newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
           modelId: selectedConnection.id
        })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to stream response from test provider');
      }

      if (!res.body) throw new Error('Response body is null');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      let modelUsed = selectedConnection.name;

      setMessages([...newMessages, { id: assistantMsgId, role: 'assistant', content: '', isStreaming: true }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.replace(/^data:\s*/, '');
          if (!dataStr) continue;

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.type === 'meta') {
              modelUsed = parsed.modelName || modelUsed;
            } else if (parsed.type === 'delta' && parsed.text) {
              accumulated += parsed.text;
              setMessages([
                ...newMessages,
                { id: assistantMsgId, role: 'assistant', content: accumulated, model: modelUsed, isStreaming: true }
              ]);
            } else if (parsed.type === 'error') {
              throw new Error(parsed.error);
            }
          } catch (e: any) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }

      setMessages([
        ...newMessages,
        { id: assistantMsgId, role: 'assistant', content: accumulated || 'No response generated.', model: modelUsed, isStreaming: false }
      ]);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-500" /> AI Streaming Test Lab
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
            Execute real-time streaming queries directly through your configured AI provider gateways.
          </p>
        </div>
        
        {connections.length > 0 && (
          <div className="relative min-w-[220px]">
             <select 
               value={selectedConnection?.id || ''} 
               onChange={e => setSelectedConnection(connections.find(c => c.id === e.target.value) || null)}
               className="w-full appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 shadow-sm"
             >
               {connections.map(c => (
                 <option key={c.id} value={c.id}>{c.name} ({c.scope || 'Custom'})</option>
               ))}
             </select>
             <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-3.5 pointer-events-none" />
          </div>
        )}
      </div>

      <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col shadow-sm">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                <Bot className="w-6 h-6 text-zinc-400" />
              </div>
              <p className="font-medium text-sm">Ready to test connection.</p>
              <p className="text-xs text-zinc-400 mt-1">Send a message to stream tokens from {selectedConnection?.name || 'the model'}.</p>
            </div>
          ) : (
            messages.map(m => (
              <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role !== 'user' && (
                  <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center shrink-0 shadow-sm mt-1">
                    <Bot className="w-4 h-4 text-white dark:text-zinc-900" />
                  </div>
                )}
                
                <div className={`max-w-[85%] px-4 py-3 shadow-sm ${
                  m.role === 'user' 
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl rounded-tr-sm' 
                    : 'bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-2xl rounded-tl-sm'
                }`}>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
                  {m.model && (
                    <div className="mt-2 pt-2 border-t border-zinc-200/50 dark:border-zinc-700/50 text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span>{m.model}</span>
                    </div>
                  )}
                </div>
                
                {m.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0 shadow-sm mt-1">
                    <User className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                  </div>
                )}
              </div>
            ))
          )}

          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center shrink-0 shadow-sm mt-1">
                <Bot className="w-4 h-4 text-white dark:text-zinc-900" />
              </div>
              <div className="max-w-[80%] px-4 py-3 shadow-sm bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-2xl rounded-tl-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                <span className="text-sm text-zinc-500">Streaming tokens...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl text-red-600 dark:text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Error connecting to provider</p>
                <p className="text-sm mt-1 opacity-90">{error.message}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder={selectedConnection ? `Type prompt to stream test via ${selectedConnection.name}...` : "Add an active connection first"}
              disabled={isLoading || !selectedConnection}
              className="flex-1 pl-4 pr-12 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all text-sm text-zinc-900 dark:text-zinc-100 shadow-sm disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || !selectedConnection}
              className="absolute right-2 w-8 h-8 flex items-center justify-center bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
