'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

type DiscoveredModel = {
  id: string;
  name: string;
  capabilities: string[];
  billingClassification: 'FREE_VERIFIED' | 'FREE_LIMITED' | 'UNKNOWN' | 'PAID' | 'DISABLED';
  isFree: boolean;
};

type ProviderSummary = {
  slug: string;
  is_active: boolean;
  ai_api_keys?: Array<{ id: string; status: string }>;
};

const GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com';

export default function GoogleProviderPanel() {
  const [provider, setProvider] = useState<ProviderSummary | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [working, setWorking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [models, setModels] = useState<DiscoveredModel[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activeKeyCount = provider?.ai_api_keys?.filter((key) => key.status === 'active').length ?? 0;
  const freeModels = useMemo(() => models.filter((model) => model.isFree), [models]);

  async function loadProviderStatus() {
    setLoadingStatus(true);
    try {
      const response = await fetch('/api/admin/providers', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load provider status.');
      setProvider((data.providers ?? []).find((item: ProviderSummary) => item.slug === 'google') ?? null);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not load provider status.' });
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => {
    void loadProviderStatus();
  }, []);

  async function handleTestAndDiscover() {
    setWorking(true);
    setMessage(null);
    setModels([]);
    setSelected([]);

    try {
      const testResponse = await fetch('/api/admin/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: 'google' }),
      });
      const testData = await testResponse.json();
      if (!testResponse.ok || !testData.success) {
        throw new Error(testData.error || 'Google Gemini connection test failed.');
      }

      const discoverResponse = await fetch('/api/admin/providers/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: 'google' }),
      });
      const discoverData = await discoverResponse.json();
      if (!discoverResponse.ok) {
        throw new Error(discoverData.error || 'Could not discover Gemini models.');
      }

      const discovered = (discoverData.models ?? []) as DiscoveredModel[];
      const verified = discovered.filter((model) => model.isFree);
      setModels(discovered);
      setSelected(verified.slice(0, 3).map((model) => model.id));
      setMessage({
        type: 'success',
        text: `Connection verified. Found ${discovered.length} compatible Gemini model${discovered.length === 1 ? '' : 's'}; ${verified.length} currently pass AbhiAI Free Guard.`,
      });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Provider check failed.' });
    } finally {
      setWorking(false);
    }
  }

  function toggleModel(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((modelId) => modelId !== id) : [...current, id]);
  }

  async function handleImport() {
    if (selected.length === 0) {
      setMessage({ type: 'error', text: 'Select at least one Free Guard-approved model first.' });
      return;
    }

    setImporting(true);
    setMessage(null);

    try {
      for (const modelId of selected) {
        const model = models.find((item) => item.id === modelId);
        if (!model?.isFree) {
          throw new Error(`${modelId} is not Free Guard-approved and was not imported.`);
        }

        const response = await fetch('/api/admin/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Google Gemini - ${model.name}`,
            providerId: 'google',
            providerName: 'Google Gemini',
            scope: 'public',
            baseUrl: GOOGLE_BASE_URL,
            apiKey: '',
            modelId: model.id,
            systemPrompt: 'You are AbhiAI, a helpful, accurate, and precise assistant.',
            isActive: true,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `Could not import ${model.name}.`);
        }
      }

      setMessage({
        type: 'success',
        text: `${selected.length} selected Gemini model${selected.length === 1 ? '' : 's'} imported successfully.`,
      });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Model import failed.' });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-zinc-700 dark:text-zinc-200" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Google Gemini</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                  Phase 5 Primary
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Server-side encrypted credentials, live model discovery, and Free Guard filtering.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestAndDiscover}
            disabled={working || loadingStatus}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {working ? 'Checking…' : 'Test & Discover'}
          </button>
        </div>

        <div className="p-5 sm:p-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              <KeyRound className="w-4 h-4" /> Stored credential
            </div>
            <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {loadingStatus ? 'Checking…' : activeKeyCount > 0 ? `${activeKeyCount} active encrypted key${activeKeyCount === 1 ? '' : 's'} available.` : 'No active stored key found.'}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              <ShieldCheck className="w-4 h-4" /> Free Guard
            </div>
            <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Unknown or paid models are not selectable for import here.
            </div>
          </div>
        </div>

        {message && (
          <div className={`mx-5 sm:mx-6 mb-5 sm:mb-6 rounded-2xl border p-4 flex gap-3 text-sm ${message.type === 'success' ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300' : 'border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      {models.length > 0 && (
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Discovered models</h3>
              <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                Only models currently classified as free/free-limited can be selected.
              </p>
            </div>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || selected.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 disabled:opacity-50"
            >
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              Import selected ({selected.length})
            </button>
          </div>

          <div className="space-y-2">
            {models.map((model) => {
              const canSelect = model.isFree;
              const checked = selected.includes(model.id);
              return (
                <label
                  key={model.id}
                  className={`flex items-start gap-3 rounded-2xl border p-4 ${canSelect ? 'border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40' : 'border-zinc-100 dark:border-zinc-800/60 opacity-55 cursor-not-allowed'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!canSelect}
                    onChange={() => toggleModel(model.id)}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{model.name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${canSelect ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                        {model.billingClassification}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-mono text-zinc-500 break-all">{model.id}</div>
                    {model.capabilities?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {model.capabilities.map((capability) => (
                          <span key={capability} className="text-[10px] px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                            {capability}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-zinc-500 dark:text-zinc-400 px-1">
        Need to add or replace the Google API key? Use <Link href="/admin/connections" className="font-medium underline underline-offset-4">AI Connections</Link>. The raw key is never returned to this page.
      </p>
    </div>
  );
}
