'use client';

import { useState } from 'react';
import { Share2, Link as LinkIcon, ExternalLink, Copy, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function PublicAIPage() {
  const [isEnabled, setIsEnabled] = useState(true);
  const [copied, setCopied] = useState(false);

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/chat/public` : 'https://abhiai.com/chat/public';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Public AI Interface</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            Configure the public-facing chat interface for your users.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Enable Public Chat</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Allow anyone with the link to use the AI chat interface without logging in.
            </p>
          </div>
          <div 
            onClick={() => setIsEnabled(!isEnabled)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full cursor-pointer transition-colors ${isEnabled ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-200 dark:bg-zinc-700'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white dark:bg-zinc-900 transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </div>
        </div>

        <div className={`p-6 transition-opacity ${isEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Shareable Link</h3>
          <div className="flex items-center gap-2 max-w-2xl">
            <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg">
              <LinkIcon className="w-5 h-5 text-zinc-400" />
              <span className="text-sm text-zinc-700 dark:text-zinc-300 font-mono truncate">
                {publicUrl}
              </span>
            </div>
            <button 
              onClick={copyToClipboard}
              className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg transition-colors flex items-center justify-center shrink-0"
              title="Copy to clipboard"
            >
              {copied ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
            </button>
            <Link 
              href="/" 
              target="_blank"
              className="p-3 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 rounded-lg transition-colors flex items-center justify-center shrink-0"
              title="Open in new tab"
            >
              <ExternalLink className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
      
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-5">
        <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Cost Warning</h3>
        <p className="text-sm text-blue-600 dark:text-blue-400">
          Enabling public access can lead to high token usage. Make sure you have set proper rate limits and billing alerts in your API provider dashboard (Google AI Studio, OpenAI, etc.).
        </p>
      </div>
    </div>
  );
}
