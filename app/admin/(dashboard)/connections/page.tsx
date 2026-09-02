'use client';
import { useState, useEffect } from 'react';
import { Save, X, Key, CheckCircle, AlertCircle, Loader2, Play, Search, Plus, Trash2, Cpu, Globe, Lock, Sparkles } from 'lucide-react';
import type { AIConnection } from '@/lib/connections';
import { AddProviderWizard } from '@/components/admin/add-provider-wizard';

export default function ConnectionsPage() {
  const [activeTab, setActiveTab] = useState<'public' | 'personal'>('public');
  const [connections, setConnections] = useState<AIConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Partial<AIConnection> | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success?: boolean, message?: string} | null>(null);

  const loadConnections = async () => {
    try {
      const res = await fetch('/api/admin/connections');
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/admin/connections')
      .then(res => res.json())
      .then(data => {
        if (data.connections) setConnections(data.connections);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!editingConnection?.name || (!editingConnection?.apiKey && !editingConnection?.hasApiKey) || !editingConnection?.modelId) {
      alert('Name, API Key, and Model ID are required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingConnection,
          scope: activeTab,
          isActive: editingConnection.isActive ?? true,
          systemPrompt: editingConnection.systemPrompt || '',
        })
      });
      if (res.ok) {
        await loadConnections();
        setIsModalOpen(false);
        setEditingConnection(null);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;
    try {
      await fetch(`/api/admin/connections?id=${id}`, { method: 'DELETE' });
      await loadConnections();
    } catch (e) {
      console.error(e);
    }
  };

  const handleTest = async () => {
    if (!editingConnection?.baseUrl || !editingConnection?.apiKey || !editingConnection?.modelId) {
      setTestResult({ success: false, message: 'Base URL, API Key, and Model ID are required to test' });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/connections/test', { // Reuse the test endpoint or we can adapt it
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           baseUrl: editingConnection.baseUrl,
           apiKey: editingConnection.apiKey,
           modelId: editingConnection.modelId
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ success: true, message: 'Connection successful!' });
      } else {
        setTestResult({ success: false, message: data.error || 'Connection failed' });
      }
    } catch (e) {
      setTestResult({ success: false, message: 'Network or server error during test' });
    } finally {
      setTesting(false);
    }
  };

  const filteredConnections = connections.filter(c => c.scope === activeTab);

  const openNewModal = () => {
    setEditingConnection({
      scope: activeTab,
      baseUrl: 'https://api.openai.com/v1',
      systemPrompt: 'You are a helpful assistant.'
    });
    setTestResult(null);
    setIsModalOpen(true);
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">AI Connections</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            Connect verified AI Providers (NVIDIA, OpenRouter, Groq, Google, Together) or custom APIs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsWizardOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 text-sm shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4" /> Quick Provider Wizard
          </button>
          <button 
            onClick={openNewModal}
            className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 rounded-xl font-medium hover:bg-zinc-800 dark:hover:bg-white/90 flex items-center gap-2 text-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Manual Setup
          </button>
        </div>
      </div>

      {isWizardOpen && (
        <AddProviderWizard
          onSuccess={() => {
            setIsWizardOpen(false);
            loadConnections();
          }}
          onCancel={() => setIsWizardOpen(false)}
        />
      )}

      <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('public')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'public'
              ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <Globe className="w-4 h-4" /> Public User AI
        </button>
        <button
          onClick={() => setActiveTab('personal')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'personal'
              ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <Lock className="w-4 h-4" /> Personal Admin AI
        </button>
      </div>

      <div className="grid gap-4">
        {filteredConnections.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 text-center">
            <Cpu className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No connections yet</h3>
            <p className="text-zinc-500 mt-1 mb-4">Add your first {activeTab} AI connection to get started.</p>
            <button onClick={openNewModal} className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
              + Add Connection
            </button>
          </div>
        ) : (
          filteredConnections.map(conn => (
            <div key={conn.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{conn.name}</h3>
                  {conn.isActive ? (
                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium">Active</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 text-xs font-medium">Disabled</span>
                  )}
                </div>
                <div className="text-sm text-zinc-500 mt-1 flex items-center gap-3">
                  <span>Model: {conn.modelId}</span>
                  {conn.assignedAlias && <span>• Alias: {conn.assignedAlias}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => { setEditingConnection(conn); setTestResult(null); setIsModalOpen(true); }}
                  className="px-3 py-1.5 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:text-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  Configure
                </button>
                <button 
                  onClick={() => handleDelete(conn.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center sticky top-0 bg-white dark:bg-zinc-950 z-10">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {editingConnection?.id ? 'Edit Connection' : 'New Connection'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Connection Name</label>
                <input 
                  type="text" 
                  value={editingConnection?.name || ''}
                  onChange={e => setEditingConnection({...editingConnection, name: e.target.value})}
                  placeholder="e.g. Nvidia Llama 3 70B"
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none"
                />
              </div>

              {activeTab === 'public' && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Public Alias (Dropdown Name)</label>
                  <input 
                    type="text" 
                    value={editingConnection?.assignedAlias || ''}
                    onChange={e => setEditingConnection({...editingConnection, assignedAlias: e.target.value})}
                    placeholder="e.g. AbhiAI Think, AbhiAI Code"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none"
                  />
                  <p className="text-xs text-zinc-500 mt-1">This is what regular users will see in the chat dropdown.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Base URL (OpenAI Compatible)</label>
                  <input 
                    type="text" 
                    value={editingConnection?.baseUrl || ''}
                    onChange={e => setEditingConnection({...editingConnection, baseUrl: e.target.value})}
                    placeholder="https://integrate.api.nvidia.com/v1"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Model ID</label>
                  <input 
                    type="text" 
                    value={editingConnection?.modelId || ''}
                    onChange={e => setEditingConnection({...editingConnection, modelId: e.target.value})}
                    placeholder="meta/llama-3.1-70b-instruct"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">API Key</label>
                <div className="relative">
                  <input 
                    type="password" 
                    value={editingConnection?.apiKey || ''}
                    onChange={e => setEditingConnection({...editingConnection, apiKey: e.target.value})}
                    placeholder={editingConnection?.maskedApiKey || 'nvapi-...'}
                    className="w-full px-3 py-2 pl-9 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none"
                  />
                  <Key className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                </div>
                {editingConnection?.hasApiKey && (
                  <p className="text-xs text-zinc-500 mt-1">
                    {editingConnection.apiKeyCount || 1} encrypted key(s) saved. Leave blank to keep them unchanged.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">System Instructions (Prompt)</label>
                <textarea 
                  value={editingConnection?.systemPrompt || ''}
                  onChange={e => setEditingConnection({...editingConnection, systemPrompt: e.target.value})}
                  rows={4}
                  placeholder="You are AbhiAI, created by Abhishek. You are an expert..."
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="isActive"
                  checked={editingConnection?.isActive ?? true}
                  onChange={e => setEditingConnection({...editingConnection, isActive: e.target.checked})}
                  className="rounded border-zinc-300"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Connection Active
                </label>
              </div>

              {testResult && (
                <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
                  testResult.success 
                    ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400' 
                    : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400'
                }`}>
                  {testResult.success ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <p>{testResult.message}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-between bg-zinc-50 dark:bg-zinc-900/50">
              <button 
                onClick={handleTest}
                disabled={testing}
                className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700 rounded-lg transition-colors flex items-center gap-2"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Test Connection
              </button>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white/90 rounded-lg transition-colors flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
