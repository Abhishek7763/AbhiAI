'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Save, Loader2, Globe, Lock, Shield, CheckCircle, Sparkles, 
  Cpu, Sliders, Zap, Smartphone, Mail, Download, Upload, RefreshCw
} from 'lucide-react';
import type { AppSettings } from '@/lib/app-settings';
import { DEFAULT_PUBLIC_ALIASES } from '@/lib/constants/aliases';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(data => {
        if (data.settings) setSettings(data.settings);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleExportBackup = async () => {
    try {
      const res = await fetch('/api/admin/backup');
      const data = await res.json();
      if (data.backup) {
        const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `abhiai-config-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setBackupMsg('Configuration backup downloaded successfully!');
        setTimeout(() => setBackupMsg(null), 4000);
      }
    } catch {
      alert('Failed to export backup JSON');
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup }),
      });
      const data = await res.json();
      if (res.ok) {
        setBackupMsg('Configuration restored successfully! Refreshing settings...');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        alert(data.error || 'Failed to restore configuration');
      }
    } catch {
      alert('Invalid backup JSON file');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (e) {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-emerald-500" /> Platform & Global Safety Settings
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
            Control platform branding, IP rate limiting, zero-cost budget guards, and mobile PWA toggles.
          </p>
        </div>

        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-sm disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Platform Settings
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          Settings successfully persisted and activated!
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Brand & Creator Identity */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-zinc-900 dark:text-zinc-100">
            <Globe className="w-4 h-4 text-emerald-500" /> Brand Details
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Platform Name
              </label>
              <input 
                type="text"
                value={settings.appName}
                onChange={(e) => setSettings({ ...settings, appName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Owner / Creator Name
              </label>
              <input 
                type="text"
                value={settings.creatorName}
                onChange={(e) => setSettings({ ...settings, creatorName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Support / Contact Email
              </label>
              <input 
                type="email"
                value={settings.supportEmail}
                onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none text-sm"
              />
            </div>
          </div>
        </div>

        {/* Rate Limiting & Safety Budget */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-zinc-900 dark:text-zinc-100">
            <Shield className="w-4 h-4 text-amber-500" /> Rate Limiting & Abuse Protection
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Max Requests Per Minute (RPM) per IP
              </label>
              <input 
                type="number"
                value={settings.rateLimitRPM}
                onChange={(e) => setSettings({ ...settings, rateLimitRPM: parseInt(e.target.value) || 30 })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none text-sm font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Daily Max Requests per Visitor
              </label>
              <input 
                type="number"
                value={settings.maxDailyRequestsPerIP}
                onChange={(e) => setSettings({ ...settings, maxDailyRequestsPerIP: parseInt(e.target.value) || 200 })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none text-sm font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Max Prompt Characters Length
              </label>
              <input 
                type="number"
                value={settings.maxPromptLength}
                onChange={(e) => setSettings({ ...settings, maxPromptLength: parseInt(e.target.value) || 4000 })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none text-sm font-mono"
              />
            </div>
          </div>
        </div>

        {/* Zero-Cost Enforcement & Feature Toggles */}
        <div className="md:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-zinc-900 dark:text-zinc-100">
            <Zap className="w-4 h-4 text-emerald-500" /> Platform Mode & Policy Enforcements
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
              <div>
                <div className="font-bold text-zinc-900 dark:text-zinc-100">100% Free-Tier Mode</div>
                <div className="text-zinc-500 mt-0.5">Strictly blocks accidental paid endpoint calls</div>
              </div>
              <input 
                type="checkbox"
                checked={settings.freeOnlyMode}
                onChange={(e) => setSettings({ ...settings, freeOnlyMode: e.target.checked })}
                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
              <div>
                <div className="font-bold text-zinc-900 dark:text-zinc-100">Public AI Gateway</div>
                <div className="text-zinc-500 mt-0.5">Allow public visitors to chat with AbhiAI</div>
              </div>
              <input 
                type="checkbox"
                checked={settings.enablePublicAI}
                onChange={(e) => setSettings({ ...settings, enablePublicAI: e.target.checked })}
                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Global API Key Secrets & Image Generation Engine Keys */}
        <div className="md:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-zinc-900 dark:text-zinc-100">
              <Lock className="w-4 h-4 text-purple-500" /> Dynamic API Keys & Image Generation Providers
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800">
              Admin Managed
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Aap directly yahan se apni API Keys save kar sakte hain. Ye keys Chat aur Image Generation Studio me directly active ho jayengi.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Google Gemini API Key (Imagen 3 & Chat)
              </label>
              <input 
                type="password"
                placeholder="AIzaSy..."
                value={settings.geminiApiKey || ''}
                onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none text-sm font-mono placeholder:text-zinc-400"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                OpenAI API Key (DALL-E 3 & GPT-4o)
              </label>
              <input 
                type="password"
                placeholder="sk-proj-..."
                value={settings.openaiApiKey || ''}
                onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none text-sm font-mono placeholder:text-zinc-400"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Stability AI API Key (Stable Diffusion)
              </label>
              <input 
                type="password"
                placeholder="sk-..."
                value={settings.stabilityApiKey || ''}
                onChange={(e) => setSettings({ ...settings, stabilityApiKey: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none text-sm font-mono placeholder:text-zinc-400"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                OpenRouter API Key (Claude / DeepSeek / Llama)
              </label>
              <input 
                type="password"
                placeholder="sk-or-v1-..."
                value={settings.openrouterApiKey || ''}
                onChange={(e) => setSettings({ ...settings, openrouterApiKey: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none text-sm font-mono placeholder:text-zinc-400"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Groq / Together AI API Key
              </label>
              <input 
                type="password"
                placeholder="gsk_... or together key"
                value={settings.groqApiKey || ''}
                onChange={(e) => setSettings({ ...settings, groqApiKey: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none text-sm font-mono placeholder:text-zinc-400"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Custom Image AI API Endpoint (URL)
              </label>
              <input 
                type="text"
                placeholder="https://your-custom-ai.com/api/generate"
                value={settings.customImageApiEndpoint || ''}
                onChange={(e) => setSettings({ ...settings, customImageApiEndpoint: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 outline-none text-sm font-mono placeholder:text-zinc-400"
              />
            </div>
          </div>
        </div>

        {/* Phase 22 - Backup & Restore Configuration Card */}
        <div className="md:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-zinc-900 dark:text-zinc-100">
              <Download className="w-4 h-4 text-blue-500" /> Platform Configuration Backup & Disaster Recovery (Phase 22)
            </div>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Export a full JSON snapshot of all AI agents, public model aliases, system instructions, and safety settings. No secret API keys are exported.
          </p>

          {backupMsg && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-xs text-blue-800 dark:text-blue-300 font-medium">
              {backupMsg}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleExportBackup}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Export Full Backup JSON</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-semibold transition-colors shadow-xs"
            >
              <Upload className="w-4 h-4" />
              <span>Restore from Backup JSON</span>
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportBackup}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
