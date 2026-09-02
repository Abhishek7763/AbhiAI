'use client';

import React, { useState } from 'react';
import { 
  Sparkles, Key, CheckCircle, AlertCircle, Loader2, ArrowRight, ArrowLeft, 
  Search, Shield, Check, RefreshCw, Cpu, Layers, HelpCircle
} from 'lucide-react';
import { PROVIDER_TEMPLATES } from '@/lib/ai/providers/registry';

interface AddProviderWizardProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function AddProviderWizard({ onSuccess, onCancel }: AddProviderWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(PROVIDER_TEMPLATES[0]);
  const [apiKey, setApiKey] = useState('');
  const [customName, setCustomName] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [scope, setScope] = useState<'public' | 'personal'>('public');

  // Step 2: Testing & Discovery State
  const [testing, setTesting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [discoveredModels, setDiscoveredModels] = useState<any[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [freeOnlyFilter, setFreeOnlyFilter] = useState(false);

  const [saving, setSaving] = useState(false);

  // Step 1 -> 2: Select Provider Template
  const handleSelectTemplate = (template: any) => {
    setSelectedTemplate(template);
    setCustomName(template.name);
    setCustomBaseUrl(template.baseUrl);
    setTestResult(null);
    setDiscoveredModels([]);
    setSelectedModelIds([]);
    setStep(2);
  };

  // Test Connection
  const handleTestConnection = async () => {
    if (!apiKey) {
      setTestResult({ success: false, message: 'Please enter your API Key' });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: selectedTemplate.id,
          apiKey,
          baseUrl: customBaseUrl || selectedTemplate.baseUrl,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ success: true, message: 'Connection successful and API key verified!' });
        // Automatically start discovery on successful test
        handleDiscoverModels();
      } else {
        setTestResult({ success: false, message: data.error || 'Connection failed' });
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Network error testing provider' });
    } finally {
      setTesting(false);
    }
  };

  // Discover Models Automatically
  const handleDiscoverModels = async () => {
    if (!apiKey) return;
    setDiscovering(true);
    try {
      const res = await fetch('/api/admin/providers/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: selectedTemplate.id,
          apiKey,
          baseUrl: customBaseUrl || selectedTemplate.baseUrl,
        }),
      });
      const data = await res.json();
      if (res.ok && data.models) {
        setDiscoveredModels(data.models);
        // Default select top 2 models or all if fewer
        const defaultSelected = data.models.slice(0, 3).map((m: any) => m.id);
        setSelectedModelIds(defaultSelected);
        setStep(3);
      } else {
        // Fallback to template defaults
        setDiscoveredModels(selectedTemplate.defaultModels || []);
        setSelectedModelIds(selectedTemplate.defaultModels?.map((m: any) => m.id) || []);
        setStep(3);
      }
    } catch (e) {
      setDiscoveredModels(selectedTemplate.defaultModels || []);
      setSelectedModelIds(selectedTemplate.defaultModels?.map((m: any) => m.id) || []);
      setStep(3);
    } finally {
      setDiscovering(false);
    }
  };

  const toggleModelSelection = (id: string) => {
    setSelectedModelIds(prev => 
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  };

  // Step 3 -> Final Save
  const handleFinalSave = async () => {
    if (selectedModelIds.length === 0) {
      alert('Please select at least one model to import.');
      return;
    }

    setSaving(true);
    try {
      // 1. Save Provider Configuration
      await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTemplate.id,
          apiKey,
          isActive: true,
        }),
      });

      // 2. Save Selected Connection and Models
      for (const modelId of selectedModelIds) {
        const modelInfo = discoveredModels.find(m => m.id === modelId) || {
          id: modelId,
          name: modelId,
          capabilities: ['text'],
        };

        await fetch('/api/admin/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${selectedTemplate.name} - ${modelInfo.name || modelId}`,
            providerId: selectedTemplate.id,
            providerName: selectedTemplate.name,
            scope,
            baseUrl: customBaseUrl || selectedTemplate.baseUrl,
            apiKey: '',
            modelId,
            systemPrompt: 'You are AbhiAI, a helpful and precise assistant.',
            isActive: true,
          }),
        });
      }

      onSuccess();
    } catch (e) {
      console.error(e);
      alert('Failed to save provider and models.');
    } finally {
      setSaving(false);
    }
  };

  const filteredDiscoveredModels = discoveredModels.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchFilter.toLowerCase()) || m.id.toLowerCase().includes(searchFilter.toLowerCase());
    if (freeOnlyFilter) {
      return matchesSearch && (m.isFree || m.billingClassification === 'FREE_VERIFIED' || m.billingClassification === 'FREE_LIMITED');
    }
    return matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Wizard Header */}
        <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold text-sm shadow-sm">
              {step}
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {step === 1 && 'Step 1: Choose AI Provider'}
                {step === 2 && `Step 2: Connect ${selectedTemplate?.name}`}
                {step === 3 && 'Step 3: Auto-Discovered Models'}
              </h2>
              <p className="text-xs text-zinc-500">
                {step === 1 && 'Select a verified zero-billing or custom provider preset.'}
                {step === 2 && 'Paste your API key to automatically verify the connection.'}
                {step === 3 && 'Pick which AI models you want to activate for AbhiAI.'}
              </p>
            </div>
          </div>
          <button 
            onClick={onCancel}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-medium"
          >
            Cancel
          </button>
        </div>

        {/* Wizard Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: Choose Provider */}
          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {PROVIDER_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => handleSelectTemplate(tmpl)}
                  className="text-left p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-900 dark:hover:border-zinc-100 transition-all bg-zinc-50/50 dark:bg-zinc-950/40 hover:scale-[1.01] flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                        {tmpl.name}
                      </span>
                      {tmpl.isPreset && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                          Verified Free Tier
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 line-clamp-2">
                      {tmpl.description}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center text-xs font-medium text-zinc-900 dark:text-zinc-100 gap-1">
                    Select Provider <ArrowRight className="w-3 h-3" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* STEP 2: Paste API Key & Test Connection */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 flex items-start gap-3">
                <Shield className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 block mb-0.5">Zero-Leakage Security Guarantee</span>
                  API keys are strictly verified and stored server-side. Keys are never bundled with frontend assets.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="nvapi-xxxx, gsk_xxxx, or sk-or-v1-xxxx"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none font-mono"
                  />
                  <Key className="w-4 h-4 text-zinc-400 absolute right-3.5 top-3.5" />
                </div>
              </div>

              {/* Advanced / Custom Base URL (shown for custom or upon expansion) */}
              {!selectedTemplate.isPreset && (
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                    Base URL
                  </label>
                  <input
                    type="text"
                    value={customBaseUrl}
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  Target AI Scope
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setScope('public')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      scope === 'public'
                        ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100/50 dark:bg-zinc-800/50 font-semibold'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-500'
                    }`}
                  >
                    <span className="text-xs block text-zinc-900 dark:text-zinc-100">Public AbhiAI</span>
                    <span className="text-[11px] text-zinc-500">Available to all web visitors</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope('personal')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      scope === 'personal'
                        ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100/50 dark:bg-zinc-800/50 font-semibold'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-500'
                    }`}
                  >
                    <span className="text-xs block text-zinc-900 dark:text-zinc-100">Personal / Admin Only</span>
                    <span className="text-[11px] text-zinc-500">Only accessible by you</span>
                  </button>
                </div>
              </div>

              {testResult && (
                <div className={`p-4 rounded-xl flex items-start gap-3 text-xs ${
                  testResult.success 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-900/50'
                }`}>
                  {testResult.success ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <div>
                    <span className="font-semibold block">{testResult.success ? 'Verification Succeeded' : 'Verification Failed'}</span>
                    <span>{testResult.message}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Auto Discovered Models */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search discovered models..."
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                  />
                </div>
                <button
                  onClick={() => setFreeOnlyFilter(!freeOnlyFilter)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    freeOnlyFilter
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  Free-Only Guard
                </button>
              </div>

              <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[300px] overflow-y-auto">
                {filteredDiscoveredModels.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-500">
                    No models found matching criteria.
                  </div>
                ) : (
                  filteredDiscoveredModels.map((m: any) => {
                    const isSelected = selectedModelIds.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleModelSelection(m.id)}
                        className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-zinc-100/70 dark:bg-zinc-800/60' 
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-950/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                            isSelected 
                              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent' 
                              : 'border-zinc-300 dark:border-zinc-700'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 block">
                              {m.name}
                            </span>
                            <span className="text-[11px] text-zinc-500 font-mono">
                              {m.id}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {m.isFree && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                              Free
                            </span>
                          )}
                          <div className="flex gap-1">
                            {m.capabilities?.map((cap: string) => (
                              <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                {cap}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/50">
          {step > 1 ? (
            <button
              onClick={() => setStep((step - 1) as any)}
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          ) : <div />}

          <div className="flex items-center gap-3">
            {step === 2 && (
              <button
                onClick={handleTestConnection}
                disabled={testing || discovering || !apiKey}
                className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {testing || discovering ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {testing ? 'Verifying Key...' : 'Discovering Models...'}
                  </>
                ) : (
                  <>
                    Connect & Discover Models <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}

            {step === 3 && (
              <button
                onClick={handleFinalSave}
                disabled={saving || selectedModelIds.length === 0}
                className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 shadow-md"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Importing {selectedModelIds.length} Models...
                  </>
                ) : (
                  <>
                    Activate {selectedModelIds.length} Models <Check className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
