'use client';

import React, { useState } from 'react';
import { X, Download, Copy, Check, FileText, Code2, Printer } from 'lucide-react';
import { Message } from '@/hooks/use-chat-history';

interface ChatExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  messages: Message[];
}

export default function ChatExportModal({
  isOpen,
  onClose,
  title,
  messages,
}: ChatExportModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const generateMarkdown = () => {
    let md = `# ${title || 'AbhiAI Conversation'}\n*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;
    messages.forEach((msg) => {
      const sender = msg.role === 'assistant' ? '🤖 **AbhiAI**' : '👤 **You**';
      md += `${sender}:\n\n${msg.content}\n\n---\n\n`;
    });
    return md;
  };

  const generatePlainText = () => {
    let txt = `${title || 'AbhiAI Conversation'}\nExported on ${new Date().toLocaleString()}\n\n`;
    messages.forEach((msg) => {
      const sender = msg.role === 'assistant' ? 'AbhiAI' : 'User';
      txt += `[${sender}]\n${msg.content}\n\n-------------------------\n\n`;
    });
    return txt;
  };

  const handleDownload = (format: 'md' | 'txt' | 'json') => {
    let content = '';
    let mimeType = 'text/plain';
    let extension = format;

    if (format === 'md') {
      content = generateMarkdown();
      mimeType = 'text/markdown';
    } else if (format === 'txt') {
      content = generatePlainText();
      mimeType = 'text/plain';
    } else if (format === 'json') {
      content = JSON.stringify({ title, exportedAt: new Date().toISOString(), messages }, null, 2);
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'chat').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(generateMarkdown());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">
              Export & Share Conversation
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Save or share the current transcript ({messages.length} messages) in your preferred format:
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleDownload('md')}
              className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 text-left transition-all group"
            >
              <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">Markdown</div>
                <div className="text-xs text-zinc-500">.md with formatting</div>
              </div>
            </button>

            <button
              onClick={() => handleDownload('txt')}
              className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 text-left transition-all group"
            >
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">Plain Text</div>
                <div className="text-xs text-zinc-500">.txt clean transcript</div>
              </div>
            </button>

            <button
              onClick={() => handleDownload('json')}
              className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 text-left transition-all group"
            >
              <Code2 className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
              <div>
                <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">JSON Data</div>
                <div className="text-xs text-zinc-500">.json for developers</div>
              </div>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 text-left transition-all group"
            >
              <Printer className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">Print / PDF</div>
                <div className="text-xs text-zinc-500">Browser print dialog</div>
              </div>
            </button>
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={handleCopyMarkdown}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-medium text-sm transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                  <span>Transcript Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Formatted Markdown</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
