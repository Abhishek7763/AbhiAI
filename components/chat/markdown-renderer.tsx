'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Check, Copy, Eye, Code as CodeIcon, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="abhiai-markdown prose prose-zinc dark:prose-invert max-w-none text-[15px] sm:text-base leading-7 prose-headings:tracking-tight prose-strong:font-semibold prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-none prose-code:before:content-none prose-code:after:content-none prose-a:text-blue-600 dark:prose-a:text-blue-400 hover:prose-a:text-blue-500">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1({ children, ...props }) {
            return <h1 className="mt-6 mb-3 text-2xl sm:text-3xl font-bold leading-tight" {...props}>{children}</h1>;
          },
          h2({ children, ...props }) {
            return <h2 className="mt-6 mb-2.5 text-xl sm:text-2xl font-bold leading-tight" {...props}>{children}</h2>;
          },
          h3({ children, ...props }) {
            return <h3 className="mt-5 mb-2 text-lg sm:text-xl font-semibold leading-snug" {...props}>{children}</h3>;
          },
          p({ children, ...props }) {
            return <p className="my-3 leading-7 text-zinc-800 dark:text-zinc-200" {...props}>{children}</p>;
          },
          ul({ children, ...props }) {
            return <ul className="my-3 pl-5 space-y-1.5 list-disc marker:text-zinc-400 dark:marker:text-zinc-500" {...props}>{children}</ul>;
          },
          ol({ children, ...props }) {
            return <ol className="my-3 pl-5 space-y-1.5 list-decimal marker:font-medium marker:text-zinc-500 dark:marker:text-zinc-400" {...props}>{children}</ol>;
          },
          li({ children, ...props }) {
            return <li className="pl-1 leading-7 text-zinc-800 dark:text-zinc-200" {...props}>{children}</li>;
          },
          blockquote({ children, ...props }) {
            return (
              <blockquote
                className="my-4 border-l-2 border-blue-400/70 dark:border-blue-500/70 bg-blue-50/50 dark:bg-blue-950/20 rounded-r-xl px-4 py-1 text-zinc-700 dark:text-zinc-300 not-italic"
                {...props}
              >
                {children}
              </blockquote>
            );
          },
          a({ children, ...props }) {
            return <a className="font-medium underline underline-offset-2 decoration-current/30 hover:decoration-current transition-colors" target="_blank" rel="noreferrer" {...props}>{children}</a>;
          },
          hr(props) {
            return <hr className="my-6 border-zinc-200/80 dark:border-zinc-800" {...props} />;
          },
          code({ inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = inline || !match;

            if (isInline) {
              return (
                <code
                  className="bg-zinc-200/65 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 px-1.5 py-0.5 rounded-md text-[0.88em] font-mono break-words"
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
              />
            );
          },
          table({ children, ...props }) {
            return (
              <div className="overflow-x-auto my-5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white/60 dark:bg-zinc-950/30 shadow-xs">
                <table className="w-full min-w-[520px] text-sm text-left m-0" {...props}>
                  {children}
                </table>
              </div>
            );
          },
          th({ children, ...props }) {
            return (
              <th className="bg-zinc-100/80 dark:bg-zinc-900 px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 whitespace-nowrap" {...props}>
                {children}
              </th>
            );
          },
          td({ children, ...props }) {
            return (
              <td className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/70 text-zinc-700 dark:text-zinc-300 align-top" {...props}>
                {children}
              </td>
            );
          },
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

  const normalizedLanguage = language.toLowerCase();
  const isPreviewable = ['html', 'htm', 'svg', 'xml'].includes(normalizedLanguage);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      toast.success('Code copied to clipboard');
      setTimeout(() => setIsCopied(false), 1800);
    } catch {
      setIsCopied(false);
      toast.error('Could not copy code. Please copy it manually.');
    }
  };

  const getPreviewSrcDoc = () => {
    if (normalizedLanguage === 'svg') {
      return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fafafa;padding:1rem;box-sizing:border-box;}svg{max-width:100%;height:auto;}</style></head><body>${value}</body></html>`;
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><script src="https://cdn.tailwindcss.com"></script><style>body{margin:0;padding:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#18181b;}</style></head><body>${value}</body></html>`;
  };

  return (
    <div className="relative my-5 rounded-xl sm:rounded-2xl overflow-hidden border border-zinc-300/70 dark:border-zinc-800 bg-[#1e1e1e] shadow-sm">
      <div className="flex min-h-11 items-center justify-between gap-2 px-2.5 sm:px-3 py-2 bg-zinc-100/95 dark:bg-[#282828] border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[11px] font-mono text-zinc-600 dark:text-zinc-300 font-semibold px-2 py-1 rounded-md bg-zinc-200/80 dark:bg-zinc-700/70 lowercase">
            {normalizedLanguage || 'code'}
          </span>
          {isPreviewable && (
            <div className="flex min-w-0 items-center bg-zinc-200/80 dark:bg-zinc-800 rounded-lg p-0.5 text-xs">
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
                <span className="hidden min-[360px]:inline">Code</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 font-medium shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden min-[360px]:inline">Preview</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isPreviewable && activeTab === 'preview' && (
            <button
              type="button"
              onClick={() => setPreviewKey((key) => key + 1)}
              className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors rounded-lg hover:bg-zinc-200/70 dark:hover:bg-zinc-700/60"
              title="Refresh preview"
              aria-label="Refresh preview"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors px-2 py-1.5 rounded-lg hover:bg-zinc-200/70 dark:hover:bg-zinc-700/60"
            aria-label="Copy code"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {isPreviewable && activeTab === 'preview' ? (
        <div className="bg-white min-h-[220px] max-h-[520px] p-2 overflow-auto">
          <iframe
            key={previewKey}
            title="Code preview"
            srcDoc={getPreviewSrcDoc()}
            className="w-full min-h-[220px] h-72 border-0 rounded-lg bg-white"
            sandbox="allow-scripts"
          />
        </div>
      ) : (
        <div className="text-[13px] sm:text-sm w-full overflow-x-auto overscroll-x-contain">
          <SyntaxHighlighter
            language={normalizedLanguage}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: '1rem',
              background: 'transparent',
              fontSize: 'inherit',
              lineHeight: 1.65,
              minWidth: 'max-content',
            }}
            wrapLines
            wrapLongLines={false}
          >
            {value}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
};
