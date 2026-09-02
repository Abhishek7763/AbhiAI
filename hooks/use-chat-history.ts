import { useEffect, useState } from "react";
import type { Message } from "@/types/chat";

export type { Message } from "@/types/chat";

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  isPinned?: boolean;
}

const SESSIONS_KEY = "abhiai_sessions";
const CURRENT_SESSION_KEY = "abhiai_current_session";
const MODEL_CHANGED_EVENT = "abhiai:model-changed";

function sortSessions(items: ChatSession[]) {
  return [...items].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.updatedAt - a.updatedAt;
  });
}

function readStoredSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(SESSIONS_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readStoredCurrentSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CURRENT_SESSION_KEY);
  } catch {
    return null;
  }
}

function persistSessions(items: ChatSession[]) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(items));
  } catch {
    // Keep the in-memory chat usable even if browser storage is unavailable/full.
  }
}

function persistCurrentSessionId(id: string | null) {
  try {
    if (id) {
      localStorage.setItem(CURRENT_SESSION_KEY, id);
    } else {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    }
  } catch {
    // Ignore storage failures; the current tab can still use the selected session.
  }
}

export function useChatHistory() {
  const [sessions, setSessions] = useState<ChatSession[]>(readStoredSessions);
  const [currentSessionId, setCurrentSessionIdState] = useState<string | null>(readStoredCurrentSessionId);

  const commitSessions = (updater: (previous: ChatSession[]) => ChatSession[]) => {
    setSessions((previous) => {
      const next = updater(previous);
      persistSessions(next);
      return next;
    });
  };

  const setCurrentSessionId = (id: string | null) => {
    setCurrentSessionIdState(id);
    persistCurrentSessionId(id);
  };

  useEffect(() => {
    const handleModelChanged = () => {
      setCurrentSessionIdState(null);
      persistCurrentSessionId(null);
    };

    window.addEventListener(MODEL_CHANGED_EVENT, handleModelChanged);
    return () => window.removeEventListener(MODEL_CHANGED_EVENT, handleModelChanged);
  }, []);

  const createSession = (initialTitle?: string, initialMessages: Message[] = []) => {
    const titleMessage = initialMessages.find((message) => message.role === "user");
    const derivedTitle = titleMessage
      ? titleMessage.content.slice(0, 30) + (titleMessage.content.length > 30 ? "..." : "")
      : "New Chat";
    const title = initialTitle?.trim() || derivedTitle;
    const now = Date.now();
    const newSession: ChatSession = {
      id: `${now}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      messages: initialMessages,
      updatedAt: now,
      isPinned: false,
    };

    commitSessions((previous) => sortSessions([newSession, ...previous]));
    setCurrentSessionId(newSession.id);
    return newSession.id;
  };

  const updateSession = (sessionId: string, newMessages: Message[]) => {
    commitSessions((previous) => {
      let found = false;
      const updated = previous.map((session) => {
        if (session.id !== sessionId) return session;
        found = true;
        return {
          ...session,
          messages: newMessages,
          updatedAt: Date.now(),
        };
      });

      return found ? sortSessions(updated) : previous;
    });
  };

  const renameSession = (sessionId: string, newTitle: string) => {
    commitSessions((previous) =>
      previous.map((session) =>
        session.id === sessionId
          ? { ...session, title: newTitle.trim() || session.title }
          : session,
      ),
    );
  };

  const togglePinSession = (sessionId: string) => {
    commitSessions((previous) =>
      sortSessions(
        previous.map((session) =>
          session.id === sessionId
            ? { ...session, isPinned: !session.isPinned }
            : session,
        ),
      ),
    );
  };

  const deleteSession = (sessionId: string) => {
    commitSessions((previous) => previous.filter((session) => session.id !== sessionId));
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
    }
  };

  const clearAllSessions = () => {
    commitSessions(() => []);
    setCurrentSessionId(null);
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
  };

  const currentSession = sessions.find((session) => session.id === currentSessionId);
  const currentMessages = currentSession?.messages ?? [];

  return {
    sessions,
    currentSessionId,
    currentMessages,
    setCurrentSessionId,
    createSession,
    updateSession,
    renameSession,
    togglePinSession,
    deleteSession,
    clearAllSessions,
    startNewChat,
  };
}
