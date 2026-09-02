import { useState } from "react";

export interface Attachment {
  name: string;
  type: string;
  data: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  isPinned?: boolean;
}

export function useChatHistory() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("abhiai_sessions");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const saveSessions = (newSessions: ChatSession[]) => {
    setSessions(newSessions);
    try {
      localStorage.setItem("abhiai_sessions", JSON.stringify(newSessions));
    } catch {
      // ignore
    }
  };

  const createSession = (initialMessages: Message[]) => {
    const titleMessage = initialMessages.find(m => m.role === "user");
    const title = titleMessage 
      ? titleMessage.content.slice(0, 30) + (titleMessage.content.length > 30 ? "..." : "") 
      : "New Chat";
    
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title,
      messages: initialMessages,
      updatedAt: Date.now(),
      isPinned: false,
    };
    
    saveSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
    return newSession.id;
  };

  const updateSession = (sessionId: string, newMessages: Message[]) => {
    const updated = sessions.map(s => {
      if (s.id === sessionId) {
        return {
          ...s,
          messages: newMessages,
          updatedAt: Date.now(),
        };
      }
      return s;
    });
    saveSessions(updated.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt - a.updatedAt;
    }));
  };

  const renameSession = (sessionId: string, newTitle: string) => {
    const updated = sessions.map(s => {
      if (s.id === sessionId) {
        return { ...s, title: newTitle.trim() || s.title };
      }
      return s;
    });
    saveSessions(updated);
  };

  const togglePinSession = (sessionId: string) => {
    const updated = sessions.map(s => {
      if (s.id === sessionId) {
        return { ...s, isPinned: !s.isPinned };
      }
      return s;
    });
    saveSessions(updated.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt - a.updatedAt;
    }));
  };

  const deleteSession = (sessionId: string) => {
    saveSessions(sessions.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
    }
  };

  const clearAllSessions = () => {
    saveSessions([]);
    setCurrentSessionId(null);
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const currentMessages = currentSession ? currentSession.messages : [];

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
    startNewChat
  };
}
