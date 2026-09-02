'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Check, Copy, Eye, Code as CodeIcon, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-none prose-a:text-emerald-600 dark:prose-a:text-emerald-400 hover:prose-a:text-emerald-500">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = inline || !match;
          
          if (isInline) {
            return (
              <code
                className="bg-zinc-200/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-200 px-1.5 py-0.5 rounded-md text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            );
          }

          return (
            <CodeBlock
              language={match[1]}
              value={String(children).replace(/\n$/, '')}
              {...props}
            />
          );
        },
        table({ children, ...props }) {
          return (
            <div className="overflow-x-auto my-4 border border-zinc-200 dark:border-zinc-800 rounded-xl">
              <table className="w-full text-sm text-left m-0" {...props}>
                {children}
              </table>
            </div>
          );
        },
        th({ children, ...props }) {
          return (
            <th className="bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800" {...props}>
              {children}
            </th>
          );
        },
        td({ children, ...props }) {
          return (
            <td className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/50 text-zinc-700 dark:text-zinc-300 last:border-0" {...props}>
              {children}
            </td>
          );
        }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

const CodeBlock = ({ language, value }: { language: string; value: string }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
  const [previewKey, setPreviewKey] = useState(0);

  const isPreviewable = ['html', 'htm', 'svg', 'xml'].includes(language.toLowerCase());

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const getPreviewSrcDoc = () => {
    if (language.toLowerCase() === 'svg') {
      return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fafafa;padding:1rem;box-sizing:border-box;}svg{max-width:100%;height:auto;}</style></head><body>${value}</body></html>`;
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><script src="https://cdn.tailwindcss.com"></script><style>body{margin:0;padding:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#18181b;}</style></head><body>${value}</body></html>`;
  };

  return (
    <div className="relative my-4 rounded-xl overflow-hidden border border-zinc-200/60 dark:border-zinc-800 bg-[#1E1E1E]">
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-100 dark:bg-[#282828] border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-600 dark:text-zinc-300 font-semibold px-2 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-700/60 lowercase">
            {language}
          </span>
          {isPreviewable && (
            <div className="flex items-center bg-zinc-200/80 dark:bg-zinc-800 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('code')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                  activeTab === 'code'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <CodeIcon className="w-3.5 h-3.5" />
                <span>Code</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 font-medium shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isPreviewable && activeTab === 'preview' && (
            <button
              onClick={() => setPreviewKey(k => k + 1)}
              className="p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors rounded"
              title="Refresh Preview"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors px-2 py-1 rounded hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {isPreviewable && activeTab === 'preview' ? (
        <div className="bg-white min-h-[220px] max-h-[480px] p-2 overflow-auto">
          <iframe
            key={previewKey}
            title="Artifact Preview"
            srcDoc={getPreviewSrcDoc()}
            className="w-full min-h-[200px] h-64 border-0 rounded-lg bg-white"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      ) : (
        <div className="text-sm w-full overflow-x-auto">
          <SyntaxHighlighter
            language={language}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: '1rem',
              background: 'transparent',
              fontSize: '0.875rem',
            }}
            wrapLines={true}
          >
            {value}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
};
