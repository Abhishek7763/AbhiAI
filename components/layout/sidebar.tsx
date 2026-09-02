'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus, MessageSquare, Settings, Search, Clock, Trash2, X, Pin, Edit2, Check, Sparkles } from 'lucide-react';
import { ChatSession } from '@/hooks/use-chat-history';
import { AbhiLogo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession?: (id: string, newTitle: string) => void;
  onTogglePinSession?: (id: string) => void;
  onOpenImageStudio?: () => void;
}

export default function Sidebar({ 
  isOpen, 
  onClose, 
  sessions, 
  currentSessionId, 
  onSelectSession, 
  onNewChat,
  onDeleteSession,
  onRenameSession,
  onTogglePinSession,
  onOpenImageStudio
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedSessions = filteredSessions.filter(s => s.isPinned);
  const recentSessions = filteredSessions.filter(s => !s.isPinned);

  const startEditing = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setDeleteConfirmId(null);
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveRename = (e: React.MouseEvent | React.FormEvent, id: string) => {
    e.stopPropagation();
    if (onRenameSession && editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleOpenSession = (sessionId: string) => {
    setDeleteConfirmId(null);
    setEditingId(null);
    onSelectSession(sessionId);
    onClose();
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    onDeleteSession(sessionId);
    setDeleteConfirmId(null);
  };

  const renderSessionItem = (session: ChatSession) => {
    const isEditing = editingId === session.id;
    const isCurrent = currentSessionId === session.id;
    const isConfirmingDelete = deleteConfirmId === session.id;

    return (
      <div 
        key={session.id} 
        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-xl transition-all group ${
          isCurrent 
            ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium shadow-xs' 
            : 'hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'
        }`}
      >
        {isEditing ? (
          <form 
            onSubmit={(e) => handleSaveRename(e, session.id)} 
            className="flex-1 flex items-center gap-1.5 min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="flex-1 min-w-0 bg-white dark:bg-zinc-950 px-2 py-1 rounded text-xs border border-zinc-300 dark:border-zinc-700 outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={(e) => handleSaveRename(e, session.id)}
              className="p-1 text-emerald-600 hover:text-emerald-700"
              aria-label="Save chat name"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="p-1 text-zinc-400 hover:text-zinc-600"
              aria-label="Cancel rename"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : isConfirmingDelete ? (
          <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
            <span className="text-xs font-medium text-red-600 dark:text-red-400 truncate">Delete this chat?</span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => handleDeleteSession(e, session.id)}
                className="px-2 py-1 rounded-lg bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-300/60 dark:hover:bg-zinc-700/60"
                aria-label="Cancel delete"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <button 
              type="button"
              onClick={() => handleOpenSession(session.id)}
              className="flex-1 min-w-0 flex items-center gap-2.5 text-left py-0.5"
              title={`Open ${session.title}`}
            >
              <MessageSquare className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-blue-500 dark:text-blue-400' : 'text-zinc-400'}`} />
              <span className="truncate">{session.title}</span>
            </button>

            <div className="flex items-center gap-0.5 shrink-0 ml-1">
              {onTogglePinSession && (
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onTogglePinSession(session.id); }}
                  className={`hidden md:inline-flex p-1.5 rounded-lg hover:bg-zinc-300/50 dark:hover:bg-zinc-700/50 transition-colors ${
                    session.isPinned ? 'text-amber-500' : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                  }`}
                  title={session.isPinned ? 'Unpin chat' : 'Pin chat'}
                  aria-label={session.isPinned ? 'Unpin chat' : 'Pin chat'}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
              )}
              {onRenameSession && (
                <button 
                  type="button"
                  onClick={(e) => startEditing(e, session)}
                  className="hidden md:inline-flex p-1.5 rounded-lg hover:bg-zinc-300/50 dark:hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all"
                  title="Rename chat"
                  aria-label="Rename chat"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); setEditingId(null); setDeleteConfirmId(session.id); }}
                className="inline-flex p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                title="Delete chat"
                aria-label={`Delete ${session.title}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-xs md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-zinc-50/90 dark:bg-zinc-900/90 backdrop-blur-md border-r border-zinc-200/80 dark:border-zinc-800/80
        transform transition-transform duration-300 ease-in-out flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Brand Header */}
        <div className="p-4 pb-2 flex items-center justify-between border-b border-zinc-200/50 dark:border-zinc-800/50">
          <AbhiLogo variant="full" size="md" href="/" className="cursor-pointer" />
          <button 
            onClick={onClose} 
            className="p-1.5 md:hidden text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action button */}
        <div className="p-4 pt-3 space-y-2">
          <button 
            onClick={() => { onNewChat(); onClose(); }}
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white transition-colors px-3 py-2.5 rounded-xl text-sm font-medium shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>

          {onOpenImageStudio && (
            <button
              onClick={() => { onOpenImageStudio(); onClose(); }}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600/10 via-indigo-600/10 to-blue-600/10 hover:from-purple-600/20 hover:via-indigo-600/20 hover:to-blue-600/20 border border-purple-200/80 dark:border-purple-800/60 text-purple-900 dark:text-purple-200 px-3 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs group"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 group-hover:rotate-12 transition-transform" />
              <span>AI Image Studio</span>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search chats..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-200/60 dark:bg-zinc-800/60 border-none rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-all text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto px-3 space-y-4">
          {/* Pinned Section */}
          {pinnedSessions.length > 0 && (
            <div>
              <div className="px-2 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-500 mb-1.5 flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5" /> Pinned
              </div>
              <div className="space-y-1">
                {pinnedSessions.map(renderSessionItem)}
              </div>
            </div>
          )}

          {/* Recent Section */}
          <div>
            <div className="px-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Recent
            </div>
            {filteredSessions.length === 0 ? (
              <div className="px-2 py-3 text-xs text-zinc-400 italic">No conversations yet</div>
            ) : recentSessions.length === 0 && pinnedSessions.length > 0 ? (
              <div className="px-2 py-3 text-xs text-zinc-400 italic">All visible chats are pinned</div>
            ) : (
              <div className="space-y-1">
                {recentSessions.map(renderSessionItem)}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
          <ThemeToggle />
          <Link 
            href="/admin" 
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-xl hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Admin Settings</span>
          </Link>
        </div>
      </div>
    </>
  );
}
