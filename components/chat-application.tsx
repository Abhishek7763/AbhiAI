'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Menu, BookOpen, Edit3, Code, User, Send, Sparkles, 
  Paperclip, X, File, Image as ImageIcon, Bot, ChevronRight, Check, Square,
  Mic, MicOff, Volume2, VolumeX, Globe, Share2, Radio, ArrowDown
} from 'lucide-react';
import Sidebar from './layout/sidebar';
import ModelSelector from './chat/model-selector';
import AgentDrawer from './chat/agent-drawer';
import MarkdownRenderer from './chat/markdown-renderer';
import ChatExportModal from './chat/chat-export-modal';
import ImageGeneratorModal, { GeneratedImageItem } from './image-gen/image-generator-modal';
import AITextLoading from './ui/ai-text-loading';
import { LiveVoiceOverlay } from './ui/live-voice-overlay';
import { useChatHistory, Message } from '@/hooks/use-chat-history';
import { useSpeechToText, useTextToSpeech } from '@/hooks/use-speech';
import { useLiveVoice } from '@/hooks/use-live-voice';
import { AbhiLogo } from './brand/logo';
import { ThemeToggle } from './ui/theme-toggle';
import { Wand2 } from 'lucide-react';

const SUGGESTIONS = [
  { icon: BookOpen, text: 'Explain quantum computing in simple terms' },
  { icon: Edit3, text: 'Write a professional email to my boss' },
  { icon: Sparkles, text: 'Brainstorm creative ideas for a startup' },
  { icon: Code, text: 'Help me debug a React useEffect issue' },
];

const THINKING_TEXTS = [
  'Thinking...',
  'Understanding your request...',
  'Building the answer...',
  'Structuring the response...',
];

function MessageActions({ 
  messageId, 
  content, 
  isSpeaking, 
  onSpeak 
}: { 
  messageId: string; 
  content: string; 
  isSpeaking: boolean;
  onSpeak: (id: string, text: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-zinc-200/50 dark:border-zinc-700/50">
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/80 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/70 transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>}
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>

      <button
        onClick={() => onSpeak(messageId, content)}
        className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs transition-colors ${
          isSpeaking 
            ? 'text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50/70 dark:bg-emerald-950/30' 
            : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/80 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/70'
        }`}
      >
        {isSpeaking ? (
          <>
            <VolumeX className="w-3.5 h-3.5 animate-pulse text-emerald-500" />
            <span>Stop Audio</span>
          </>
        ) : (
          <>
            <Volume2 className="w-3.5 h-3.5" />
            <span>Listen</span>
          </>
        )}
      </button>
    </div>
  );
}

export default function ChatApplication() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [agentDrawerOpen, setAgentDrawerOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalPrompt, setImageModalPrompt] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  
  const {
    sessions,
    currentSessionId,
    currentMessages: messages,
    setCurrentSessionId,
    createSession,
    updateSession,
    renameSession,
    togglePinSession,
    deleteSession,
    startNewChat
  } = useChatHistory();

  const [isLoading, setIsLoading] = useState(false);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior });
    isNearBottomRef.current = true;
    setShowScrollToBottom(false);
  };

  const handleChatScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    const isNearBottom = distanceFromBottom < 120;
    isNearBottomRef.current = isNearBottom;
    setShowScrollToBottom(!isNearBottom && messages.length > 0);
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  };

  const handleInsertImageToChat = (image: GeneratedImageItem) => {
    let targetSessionId = currentSessionId;
    if (!targetSessionId) {
      targetSessionId = createSession(image.prompt.slice(0, 30));
    }
    
    const userMsg: Message = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: `Generate an image: ${image.prompt}`,
      timestamp: Date.now(),
    };

    const assistantMsg: Message = {
      id: `msg_${Date.now()}_a`,
      role: 'assistant',
      content: `Here is your generated image for **"${image.prompt}"**:\n\n![${image.prompt}](${image.imageUrl})\n\n*Rendered with ${image.provider} (${image.style}, ${image.aspectRatio})*`,
      timestamp: Date.now() + 10,
    };

    const updated = [...(messages || []), userMsg, assistantMsg];
    updateSession(targetSessionId, updated);
  };

  const { speakingMessageId, speak } = useTextToSpeech();
  const { isListening, isSupported: isSpeechSupported, toggleListening } = useSpeechToText((transcript) => {
    setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    requestAnimationFrame(adjustTextareaHeight);
  });
  
  const { isLive, error: liveError, startLiveMode, stopLiveMode } = useLiveVoice();

  useEffect(() => {
    if (!isNearBottomRef.current) return;
    const frame = requestAnimationFrame(() => scrollToBottom('auto'));
    return () => cancelAnimationFrame(frame);
  }, [messages, isLoading]);

  useEffect(() => {
    isNearBottomRef.current = true;
    setShowScrollToBottom(false);
    const frame = requestAnimationFrame(() => scrollToBottom('auto'));
    return () => cancelAnimationFrame(frame);
  }, [currentSessionId]);

  useEffect(() => {
    requestAnimationFrame(adjustTextareaHeight);
  }, [input]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        resolve(base64String.split(',')[1]);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSuggestionClick = (text: string) => {
    setInput(text);
  };

  const handleStarterSubmit = (starterText: string, agent: any) => {
    setSelectedAgent(agent);
    setInput(starterText);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments([...attachments, ...Array.from(e.target.files)]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    requestAnimationFrame(adjustTextareaHeight);
  };

  const handleStop = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    
    setIsLoading(true);
    isNearBottomRef.current = true;
    setShowScrollToBottom(false);
    const controller = new AbortController();
    setAbortController(controller);
    
    const processedAttachments = await Promise.all(
      attachments.map(async (file) => ({
        name: file.name,
        type: file.type,
        data: await fileToBase64(file)
      }))
    );

    const userMessage: Message = {
      id: Date.now().toString(), 
      role: 'user', 
      content: input,
      attachments: processedAttachments 
    };
    
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      activeSessionId = createSession(input.slice(0, 30) || 'New Conversation');
    }
    
    const newMessages = [...messages, userMessage];
    updateSession(activeSessionId, newMessages);
    
    const sentInput = input;
    setInput('');
    setAttachments([]);
    requestAnimationFrame(adjustTextareaHeight);

    const assistantMsgId = (Date.now() + 1).toString();
    let accumulatedContent = '';
    let responseModelName = '';
    let failoverTriggered = false;

    updateSession(activeSessionId, [
      ...newMessages,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        isStreaming: true,
      }
    ]);

    const modelToUse = selectedAgent?.preferredModelOrAlias || selectedModel || 'default';

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ 
          message: sentInput,
          // Keep prior attachments local. Re-sending their base64 on every turn makes
          // long local chats unnecessarily large; the current files are sent below.
          history: newMessages.slice(0, -1).map(m => ({ 
            role: m.role, 
            content: m.content
          })),
          modelId: modelToUse,
          attachments: processedAttachments,
          webSearch: webSearchEnabled
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to connect to AbhiAI Gateway');
      }

      if (!res.body) {
        throw new Error('Streaming response body is null');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.replace(/^data:\s*/, '');
          if (!dataStr) continue;

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.type === 'meta') {
              responseModelName = parsed.modelName;
              failoverTriggered = parsed.failoverUsed;
            } else if (parsed.type === 'delta' && parsed.text) {
              accumulatedContent += parsed.text;
              updateSession(activeSessionId, [
                ...newMessages,
                {
                  id: assistantMsgId,
                  role: 'assistant',
                  content: accumulatedContent,
                  model: responseModelName,
                  failoverUsed: failoverTriggered,
                  isStreaming: true,
                }
              ]);
            } else if (parsed.type === 'error') {
              throw new Error(parsed.error || 'Error streaming response');
            }
          } catch (error: any) {
            if (error.message && !error.message.includes('JSON')) {
              throw error;
            }
          }
        }
      }

      updateSession(activeSessionId, [
        ...newMessages,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: accumulatedContent || 'No response generated.',
          model: responseModelName,
          failoverUsed: failoverTriggered,
          isStreaming: false,
        }
      ]);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        updateSession(activeSessionId, [
          ...newMessages,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: accumulatedContent ? `${accumulatedContent}\n\n*(Generation stopped)*` : '*(Generation stopped)*',
            model: responseModelName,
            failoverUsed: failoverTriggered,
            isStreaming: false,
          }
        ]);
        return;
      }
      
      console.error(error);
      const errorMessage: Message = { 
        id: assistantMsgId, 
        role: 'assistant', 
        content: error.message || 'AbhiAI is temporarily unable to complete this request.' 
      };
      updateSession(activeSessionId, [...newMessages, errorMessage]);
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const currentChatTitle = sessions.find(s => s.id === currentSessionId)?.title || 'New Conversation';

  return (
    <div className="flex h-screen bg-transparent overflow-hidden">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewChat={startNewChat}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
        onTogglePinSession={togglePinSession}
        onOpenImageStudio={() => {
          setImageModalPrompt(input);
          setImageModalOpen(true);
        }}
      />
      
      <div className="relative flex-1 flex flex-col md:ml-72 min-w-0 transition-all duration-300">
        <header className="h-16 flex items-center justify-between px-4 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white/75 dark:bg-zinc-950/75 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 md:hidden text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg transition-colors"
              aria-label="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="md:hidden flex items-center">
              <AbhiLogo variant="icon" size="sm" href="/" />
            </div>

            <ModelSelector onModelSelect={setSelectedModel} />

            <button
              onClick={() => setAgentDrawerOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xs text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 transition-all shadow-xs"
            >
              <Bot className="w-3.5 h-3.5 text-emerald-500" />
              <span>{selectedAgent ? selectedAgent.name : 'Agents'}</span>
              <ChevronRight className="w-3 h-3 text-zinc-400" />
            </button>

            <button
              onClick={() => {
                setImageModalPrompt(input);
                setImageModalOpen(true);
              }}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-purple-200/80 dark:border-purple-800/80 bg-purple-50/60 dark:bg-purple-950/40 backdrop-blur-xs text-xs font-semibold text-purple-900 dark:text-purple-200 hover:bg-purple-100/80 dark:hover:bg-purple-900/60 transition-all shadow-xs group"
              title="Open AI Image Studio"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 group-hover:rotate-12 transition-transform" />
              <span>Image Studio</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setImageModalPrompt(input);
                setImageModalOpen(true);
              }}
              className="md:hidden p-2 rounded-xl text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40"
              title="Image Studio"
            >
              <Sparkles className="w-4 h-4" />
            </button>

            {messages.length > 0 && (
              <button
                onClick={() => setExportModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xs text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 transition-colors shadow-xs"
                title="Export & Share Chat"
              >
                <Share2 className="w-3.5 h-3.5 text-zinc-500" />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}

            <button
              onClick={() => setAgentDrawerOpen(true)}
              className="sm:hidden p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Select Agent"
            >
              <Bot className="w-4 h-4 text-emerald-500" />
            </button>

            <ThemeToggle variant="compact" />

            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/60 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 backdrop-blur-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>AbhiAI Online</span>
            </div>
          </div>
        </header>

        {selectedAgent && (
          <div className="px-4 py-2 bg-emerald-50/80 dark:bg-emerald-950/40 backdrop-blur-xs border-b border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300 min-w-0">
              <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">Active Agent: <strong>{selectedAgent.name}</strong></span>
              <span className="text-zinc-400 hidden sm:inline truncate">— {selectedAgent.description}</span>
            </div>
            <button
              onClick={() => setSelectedAgent(null)}
              className="ml-3 shrink-0 text-emerald-700 dark:text-emerald-400 hover:underline font-semibold text-[11px]"
            >
              Reset
            </button>
          </div>
        )}

        <div ref={scrollRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto scroll-smooth overscroll-contain">
          {messages.length === 0 ? (
            <div className="min-h-full flex flex-col items-center justify-start sm:justify-center px-4 py-4 sm:py-8 max-w-2xl mx-auto w-full">
              <div className="mt-2 sm:mt-0 mb-3 sm:mb-6 flex flex-col items-center select-none scale-90 sm:scale-100 origin-center">
                <AbhiLogo variant="full" size="hero" href="/" />
              </div>
              
              <div className="mb-5 sm:mb-7 flex flex-col items-center text-center px-2">
                <h2 className="text-xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-1.5 sm:mb-2 tracking-tight">
                  {selectedAgent ? `How can ${selectedAgent.name} assist you?` : 'How can I help you today?'}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md">
                  {selectedAgent ? selectedAgent.description : 'Ask, reason, code, create, or explore with AbhiAI.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full px-1 sm:px-2">
                {(selectedAgent?.sampleStarters && selectedAgent.sampleStarters.length > 0
                  ? selectedAgent.sampleStarters.map((text: string) => ({ icon: Sparkles, text }))
                  : SUGGESTIONS
                ).map((suggestion: any, idx: number) => (
                  <button 
                    key={idx}
                    onClick={() => handleSuggestionClick(suggestion.text)}
                    className="flex items-center gap-3 p-2.5 sm:p-3.5 bg-white/75 dark:bg-zinc-900/60 hover:bg-white dark:hover:bg-zinc-800/90 border border-zinc-200/80 dark:border-zinc-800/80 backdrop-blur-xs rounded-xl sm:rounded-2xl transition-all text-left group hover:shadow-xs active:scale-[0.98]"
                  >
                    <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
                      <suggestion.icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors line-clamp-2">
                      {suggestion.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="pb-8 max-w-3xl mx-auto w-full p-4 space-y-6 mt-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex gap-3.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role !== 'user' && (
                    <div className="mt-1 shrink-0">
                      <AbhiLogo variant="icon" size="sm" />
                    </div>
                  )}
                  
                  <div className={`max-w-[85%] px-5 py-3.5 shadow-xs ${
                    message.role === 'user' 
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-3xl rounded-tr-sm' 
                      : 'bg-white/85 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 backdrop-blur-xs text-zinc-900 dark:text-zinc-100 rounded-3xl rounded-tl-sm'
                  }`}>
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2 mt-1">
                        {message.attachments.map((attachment: any, idx: number) => (
                          attachment.type.startsWith('image/') ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img key={idx} src={`data:${attachment.type};base64,${attachment.data}`} alt={attachment.name} className="h-32 w-auto max-w-full object-cover rounded-xl border border-zinc-200 dark:border-zinc-700" />
                          ) : (
                            <div key={idx} className="flex items-center gap-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs max-w-full">
                              <File className="w-4 h-4 text-zinc-500 shrink-0" />
                              <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate">{attachment.name}</span>
                            </div>
                          )
                        ))}
                      </div>
                    )}

                    {message.role === 'user' ? (
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>
                    ) : message.isStreaming && !message.content ? (
                      <div className="min-h-8 flex items-center py-0.5">
                        <AITextLoading texts={THINKING_TEXTS} interval={1100} />
                      </div>
                    ) : (
                      <>
                        <MarkdownRenderer content={message.content} />
                        {message.isStreaming && (
                          <span className="mt-1 inline-block h-4 w-1.5 rounded-full bg-blue-500/80 dark:bg-blue-400/80 align-middle animate-pulse" aria-label="Generating" />
                        )}
                        {!message.isStreaming && message.content && (
                          <MessageActions 
                            messageId={message.id} 
                            content={message.content} 
                            isSpeaking={speakingMessageId === message.id}
                            onSpeak={speak}
                          />
                        )}
                      </>
                    )}
                  </div>
                  
                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0 shadow-xs mt-1">
                      <User className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {showScrollToBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={() => scrollToBottom('smooth')}
            className="absolute z-20 bottom-[7.25rem] sm:bottom-[7.75rem] left-1/2 -translate-x-1/2 flex items-center justify-center w-9 h-9 rounded-full border border-zinc-200/90 dark:border-zinc-700/90 bg-white/95 dark:bg-zinc-900/95 text-zinc-700 dark:text-zinc-200 shadow-lg backdrop-blur-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95"
            title="Jump to latest message"
            aria-label="Jump to latest message"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        )}

        <div className="chat-composer-shell p-4 bg-gradient-to-t from-white dark:from-zinc-950 via-white dark:via-zinc-950 to-transparent">
          <div className="max-w-3xl mx-auto space-y-2">
            <div className="flex items-center gap-2 px-1 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  webSearchEnabled
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-800'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Web Search {webSearchEnabled ? 'ON' : 'OFF'}</span>
              </button>

              {isListening && (
                <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 text-xs animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span>Listening...</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="relative flex flex-col bg-white/88 dark:bg-zinc-900/88 backdrop-blur-xl border border-zinc-200/90 dark:border-zinc-800/90 rounded-[1.65rem] shadow-sm p-1.5 focus-within:ring-2 focus-within:ring-blue-500/35 focus-within:border-blue-400/40 dark:focus-within:border-blue-500/40 transition-all">
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 border-b border-zinc-200 dark:border-zinc-800">
                  {attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs max-w-full">
                      {file.type.startsWith('image/') ? <ImageIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" /> : <File className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                      <span className="max-w-[140px] truncate text-zinc-700 dark:text-zinc-300 font-medium">{file.name}</span>
                      <button type="button" onClick={() => removeAttachment(idx)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex items-end gap-0.5 sm:gap-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mb-1 ml-0.5 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 rounded-full transition-colors shrink-0"
                  title="Attach File / Image"
                >
                  <Paperclip className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  className="hidden" 
                  accept="image/*,.pdf,.doc,.docx,.txt,.md,.csv,.json,.ts,.tsx,.js,.py,.sql,.html,.css,.yaml,.yml,.xml"
                />

                {isSpeechSupported && (
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`mb-1 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-colors shrink-0 ${
                      isListening 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-800'
                    }`}
                    title={isListening ? 'Stop Listening' : 'Voice Dictation'}
                  >
                    {isListening ? <MicOff className="w-4 h-4 sm:w-4.5 sm:h-4.5" /> : <Mic className="w-4 h-4 sm:w-4.5 sm:h-4.5" />}
                  </button>
                )}

                <button
                  type="button"
                  onClick={startLiveMode}
                  className="mb-1 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors shrink-0"
                  title="Start Live Voice Conversation"
                >
                  <Radio className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setImageModalPrompt(input);
                    setImageModalOpen(true);
                  }}
                  className="mb-1 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors shrink-0"
                  title="Generate AI Image from prompt"
                >
                  <Wand2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={onKeyDown}
                  placeholder={selectedAgent ? `Ask ${selectedAgent.name}...` : 'Ask AbhiAI anything...'}
                  disabled={isLoading}
                  className="flex-1 max-h-32 min-h-[40px] px-2 py-2.5 bg-transparent resize-none overflow-y-auto focus:outline-none text-sm sm:text-[15px] text-zinc-900 dark:text-zinc-100 leading-relaxed disabled:opacity-60 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                  rows={1}
                />

                {isLoading ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="mb-1 mr-0.5 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 rounded-full transition-transform active:scale-95 shadow-xs shrink-0"
                    title="Stop Generating"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim() && attachments.length === 0}
                    className="mb-1 mr-0.5 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 rounded-full transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs shrink-0"
                    title="Send message"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                )}
              </div>
            </form>
            <p className="text-center text-[10px] sm:text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5 font-medium">
              AbhiAI can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>

      <ImageGeneratorModal
        isOpen={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        initialPrompt={imageModalPrompt}
        onInsertToChat={handleInsertImageToChat}
      />

      <AgentDrawer
        isOpen={agentDrawerOpen}
        onClose={() => setAgentDrawerOpen(false)}
        selectedAgentId={selectedAgent?.id || null}
        onSelectAgent={setSelectedAgent}
        onStarterClick={handleStarterSubmit}
      />

      <ChatExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title={currentChatTitle}
        messages={messages}
      />

      <LiveVoiceOverlay
        isOpen={isLive}
        onClose={stopLiveMode}
        error={liveError}
      />
    </div>
  );
}
