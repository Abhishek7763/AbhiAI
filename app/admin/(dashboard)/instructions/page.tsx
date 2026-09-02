'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle, FileText, AlertCircle } from 'lucide-react';

export default function InstructionsPage() {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/instructions');
        if (res.ok) {
          const data = await res.json();
          setSystemPrompt(data.systemPrompt || '');
        }
      } catch (err) {
        console.error('Failed to load instructions', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus('idle');
    
    try {
      const res = await fetch('/api/admin/instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt })
      });
      
      if (res.ok) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch (err) {
      setStatus('error');
    } finally {
      setSaving(false);
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">System Instructions</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Define the core personality, rules, and behavior for your AI agents.
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-[600px]">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex items-center gap-2">
          <FileText className="w-5 h-5 text-zinc-500" />
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Global System Prompt</h3>
        </div>
        
        <div className="flex-1 p-0 relative">
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="e.g., You are AbhiAI, a highly intelligent and strictly professional corporate assistant. Never use emojis..."
            className="w-full h-full p-6 resize-none bg-transparent focus:outline-none text-zinc-900 dark:text-zinc-100 leading-relaxed font-mono text-sm"
          />
        </div>

        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div>
            {status === 'success' && (
              <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2 font-medium">
                <CheckCircle className="w-4 h-4" /> Instructions updated
              </p>
            )}
            {status === 'error' && (
              <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4" /> Error saving
              </p>
            )}
          </div>
          
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 rounded-lg font-medium transition-colors disabled:opacity-50 shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Prompt
          </button>
        </div>
      </form>
    </div>
  );
}
