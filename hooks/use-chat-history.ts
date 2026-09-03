import { useEffect, useRef, useState } from "react";
import type { Message } from "@/types/chat";
import {
  canUseIndexedDb,
  readIndexedDbSessions,
  replaceIndexedDbSessions,
  type StoredChatSession,
} from "@/lib/client/chat-storage";

export type { Message } from "@/types/chat";

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  isPinned?: boolean;
}

interface ChatBackupPayload {
  app: "AbhiAI";
  type: "local-chat-backup";
  version: 1;
  exportedAt: string;
  sessions: ChatSession[];
}

const SESSIONS_KEY = "abhiai_sessions";
const CURRENT_SESSION_KEY = "abhiai_current_session";
const MODEL_CHANGED_EVENT = "abhiai:model-changed";
export const CHAT_BACKUP_IMPORT_EVENT = "abhiai:chat-backup-import";
const PERSIST_DELAY_MS = 180;
const STREAM_UPDATE_INTERVAL_MS = 60;

function sortSessions(items: ChatSession[]) {
  return [...items].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.updatedAt - a.updatedAt;
  });
}

function mergeSessions(previous: ChatSession[], imported: ChatSession[]) {
  const merged = new Map(previous.map((session) => [session.id, session]));
  for (const session of imported) {
    const existing = merged.get(session.id);
    if (!existing || session.updatedAt >= existing.updatedAt) {
      merged.set(session.id, session);
    }
  }
  return sortSessions(Array.from(merged.values()));
}

function readLegacySessions(): ChatSession[] {
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

function persistLegacySessions(items: ChatSession[]) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(items));
  } catch {
    // Keep the in-memory chat usable even if browser storage is unavailable/full.
  }
}

function removeLegacySessions() {
  try {
    localStorage.removeItem(SESSIONS_KEY);
  } catch {
    // Migration can still continue if localStorage cleanup is blocked.
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

function toStoredSessions(items: ChatSession[]): StoredChatSession[] {
  return items.map((session) => ({
    id: session.id,
    title: session.title,
    messages: session.messages,
    updatedAt: session.updatedAt,
    isPinned: session.isPinned,
  }));
}

export function createLocalChatBackup(items: ChatSession[]) {
  const payload: ChatBackupPayload = {
    app: "AbhiAI",
    type: "local-chat-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions: items,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseLocalChatBackup(raw: string): ChatSession[] {
  const parsed = JSON.parse(raw) as Partial<ChatBackupPayload>;
  if (
    parsed?.app !== "AbhiAI" ||
    parsed?.type !== "local-chat-backup" ||
    parsed?.version !== 1 ||
    !Array.isArray(parsed.sessions)
  ) {
    throw new Error("This is not a valid AbhiAI chat backup.");
  }

  const valid = parsed.sessions.filter((session): session is ChatSession => {
    return Boolean(
      session &&
      typeof session.id === "string" &&
      session.id.length > 0 &&
      typeof session.title === "string" &&
      Array.isArray(session.messages) &&
      typeof session.updatedAt === "number" &&
      Number.isFinite(session.updatedAt),
    );
  });

  if (parsed.sessions.length > 0 && valid.length === 0) {
    throw new Error("The backup does not contain any readable chats.");
  }

  return valid;
}

export function useChatHistory() {
  const [sessions, setSessions] = useState<ChatSession[]>(readLegacySessions);
  const [currentSessionId, setCurrentSessionIdState] = useState<string | null>(readStoredCurrentSessionId);
  const hydratedRef = useRef(false);
  const latestSessionsRef = useRef<ChatSession[]>(sessions);
  const persistTimerRef = useRef<number | null>(null);
  const streamingTimerRef = useRef<number | null>(null);
  const pendingStreamingUpdatesRef = useRef<Map<string, Message[]>>(new Map());

  const commitSessions = (updater: (previous: ChatSession[]) => ChatSession[]) => {
    setSessions((previous) => updater(previous));
  };

  const applyMessageUpdates = (updates: Map<string, Message[]>) => {
    if (updates.size === 0) return;
    const updatedAt = Date.now();

    commitSessions((previous) => {
      let changed = false;
      const updated = previous.map((session) => {
        const messages = updates.get(session.id);
        if (!messages) return session;
        changed = true;
        return {
          ...session,
          messages,
          updatedAt,
        };
      });

      return changed ? sortSessions(updated) : previous;
    });
  };

  const flushStreamingUpdates = () => {
    streamingTimerRef.current = null;
    const updates = pendingStreamingUpdatesRef.current;
    if (updates.size === 0) return;
    pendingStreamingUpdatesRef.current = new Map();
    applyMessageUpdates(updates);
  };

  const setCurrentSessionId = (id: string | null) => {
    setCurrentSessionIdState(id);
    persistCurrentSessionId(id);
  };

  useEffect(() => {
    let cancelled = false;

    const hydrateLocalChats = async () => {
      if (!canUseIndexedDb()) {
        hydratedRef.current = true;
        return;
      }

      try {
        const indexedSessions = (await readIndexedDbSessions()) as ChatSession[];
        if (cancelled) return;

        if (indexedSessions.length > 0) {
          hydratedRef.current = true;
          setSessions(sortSessions(indexedSessions));
          return;
        }

        const legacySessions = readLegacySessions();
        if (legacySessions.length > 0) {
          await replaceIndexedDbSessions(toStoredSessions(legacySessions));
          if (!cancelled) removeLegacySessions();
        }
      } catch {
        // If IndexedDB is blocked, keep using the existing localStorage fallback.
      } finally {
        hydratedRef.current = true;
      }
    };

    void hydrateLocalChats();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    latestSessionsRef.current = sessions;
    if (!hydratedRef.current) return;

    if (!canUseIndexedDb()) {
      persistLegacySessions(sessions);
      return;
    }

    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = window.setTimeout(() => {
      void replaceIndexedDbSessions(toStoredSessions(latestSessionsRef.current))
        .then(removeLegacySessions)
        .catch(() => persistLegacySessions(latestSessionsRef.current));
      persistTimerRef.current = null;
    }, PERSIST_DELAY_MS);

    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [sessions]);

  useEffect(() => {
    return () => {
      if (streamingTimerRef.current !== null) {
        window.clearTimeout(streamingTimerRef.current);
        streamingTimerRef.current = null;
      }
      pendingStreamingUpdatesRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const persistLatestOnHide = () => {
      if (document.visibilityState !== "hidden") return;
      const latest = latestSessionsRef.current;
      if (canUseIndexedDb()) {
        void replaceIndexedDbSessions(toStoredSessions(latest)).catch(() => persistLegacySessions(latest));
      } else {
        persistLegacySessions(latest);
      }
    };

    document.addEventListener("visibilitychange", persistLatestOnHide);
    return () => document.removeEventListener("visibilitychange", persistLatestOnHide);
  }, []);

  useEffect(() => {
    const handleModelChanged = () => {
      setCurrentSessionIdState(null);
      persistCurrentSessionId(null);
    };

    window.addEventListener(MODEL_CHANGED_EVENT, handleModelChanged);
    return () => window.removeEventListener(MODEL_CHANGED_EVENT, handleModelChanged);
  }, []);

  useEffect(() => {
    const handleBackupImport = (event: Event) => {
      const imported = (event as CustomEvent<ChatSession[]>).detail;
      if (!Array.isArray(imported)) return;
      setSessions((previous) => mergeSessions(previous, imported));
    };

    window.addEventListener(CHAT_BACKUP_IMPORT_EVENT, handleBackupImport);
    return () => window.removeEventListener(CHAT_BACKUP_IMPORT_EVENT, handleBackupImport);
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
    const isStreamingUpdate = newMessages[newMessages.length - 1]?.isStreaming === true;

    if (isStreamingUpdate) {
      pendingStreamingUpdatesRef.current.set(sessionId, newMessages);
      if (streamingTimerRef.current === null) {
        streamingTimerRef.current = window.setTimeout(flushStreamingUpdates, STREAM_UPDATE_INTERVAL_MS);
      }
      return;
    }

    pendingStreamingUpdatesRef.current.delete(sessionId);
    if (pendingStreamingUpdatesRef.current.size === 0 && streamingTimerRef.current !== null) {
      window.clearTimeout(streamingTimerRef.current);
      streamingTimerRef.current = null;
    }

    applyMessageUpdates(new Map([[sessionId, newMessages]]));
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
    pendingStreamingUpdatesRef.current.delete(sessionId);
    commitSessions((previous) => previous.filter((session) => session.id !== sessionId));
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
    }
  };

  const clearAllSessions = () => {
    pendingStreamingUpdatesRef.current.clear();
    if (streamingTimerRef.current !== null) {
      window.clearTimeout(streamingTimerRef.current);
      streamingTimerRef.current = null;
    }
    commitSessions(() => []);
    setCurrentSessionId(null);
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
  };

  const exportBackup = () => createLocalChatBackup(sessions);

  const importBackup = (raw: string) => {
    const imported = parseLocalChatBackup(raw);
    commitSessions((previous) => mergeSessions(previous, imported));
    return imported.length;
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
    exportBackup,
    importBackup,
  };
}
