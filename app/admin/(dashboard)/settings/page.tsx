'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Boxes, CheckCircle, Globe, Loader2, Save, Shield, Sliders, Zap } from 'lucide-react';
import type { AppSettings } from '@/lib/app-settings';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch('/api/admin/settings')
      .then((response) => response.json())
      .then((data) => {
        if (mounted && data.settings) setSettings(data.settings);
      })
      .catch(console.error)
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSavedSuccess(false);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error('Failed to save settings');
      setSavedSuccess(true);
      window.setTimeout(() => setSavedSuccess(false), 2500);
    } catch {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-emerald-500" /> Settings
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
            Platform identity, public access, rate limits and zero-cost safety controls.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-sm disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          Settings saved and activated.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-zinc-900 dark:text-zinc-100">
            <Globe className="w-4 h-4 text-emerald-500" /> Brand Details
          </div>

          <div className="space-y-3 text-xs">
            <label className="block">
              <span className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">Platform Name</span>
              <input
                type="text"
                value={settings.appName}
                onChange={(event) => setSettings({ ...settings, appName: event.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none text-sm font-semibold"
              />
            </label>

            <label className="block">
              <span className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">Owner / Creator Name</span>
              <input
                type="text"
                value={settings.creatorName}
                onChange={(event) => setSettings({ ...settings, creatorName: event.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none text-sm font-semibold"
              />
            </label>

            <label className="block">
              <span className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">Support / Contact Email</span>
              <input
                type="email"
                value={settings.supportEmail}
                onChange={(event) => setSettings({ ...settings, supportEmail: event.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none text-sm"
              />
            </label>
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-zinc-900 dark:text-zinc-100">
            <Shield className="w-4 h-4 text-amber-500" /> Rate Limits & Abuse Protection
          </div>

          <div className="space-y-3 text-xs">
            <label className="block">
              <span className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">Max Requests Per Minute per IP</span>
              <input
                type="number"
                min={1}
                value={settings.rateLimitRPM}
                onChange={(event) => setSettings({ ...settings, rateLimitRPM: Number.parseInt(event.target.value, 10) || 30 })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none text-sm font-mono"
              />
            </label>

            <label className="block">
              <span className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">Daily Max Requests per Visitor</span>
              <input
                type="number"
                min={1}
                value={settings.maxDailyRequestsPerIP}
                onChange={(event) => setSettings({ ...settings, maxDailyRequestsPerIP: Number.parseInt(event.target.value, 10) || 200 })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none text-sm font-mono"
              />
            </label>

            <label className="block">
              <span className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">Max Prompt Character Length</span>
              <input
                type="number"
                min={100}
                value={settings.maxPromptLength}
                onChange={(event) => setSettings({ ...settings, maxPromptLength: Number.parseInt(event.target.value, 10) || 4000 })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none text-sm font-mono"
              />
            </label>
          </div>
        </section>

        <section className="md:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-zinc-900 dark:text-zinc-100">
            <Zap className="w-4 h-4 text-emerald-500" /> Platform Mode & Policy
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <label className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
              <span>
                <span className="block font-bold text-zinc-900 dark:text-zinc-100">100% Free-Tier Mode</span>
                <span className="block text-zinc-500 mt-0.5">Blocks models that are not Free Guard approved.</span>
              </span>
              <input
                type="checkbox"
                checked={settings.freeOnlyMode}
                onChange={(event) => setSettings({ ...settings, freeOnlyMode: event.target.checked })}
                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer shrink-0"
              />
            </label>

            <label className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
              <span>
                <span className="block font-bold text-zinc-900 dark:text-zinc-100">Public AI Gateway</span>
                <span className="block text-zinc-500 mt-0.5">Allow public visitors to use the AbhiAI chat.</span>
              </span>
              <input
                type="checkbox"
                checked={settings.enablePublicAI}
                onChange={(event) => setSettings({ ...settings, enablePublicAI: event.target.checked })}
                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer shrink-0"
              />
            </label>
          </div>
        </section>

        <section className="md:col-span-2 rounded-3xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900/60 dark:bg-blue-950/25">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Boxes className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div>
                <div className="text-sm font-semibold text-blue-900 dark:text-blue-200">AI provider credentials live in Integrations</div>
                <p className="mt-1 text-xs leading-5 text-blue-700 dark:text-blue-300/80">
                  API keys, provider URLs, connection testing and model discovery are managed in one place to avoid duplicate controls.
                </p>
              </div>
            </div>
            <Link
              href="/admin/providers"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Open Integrations <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
