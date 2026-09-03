import { useCallback, useEffect, useRef, useState } from 'react';
import type { Message } from '@/types/chat';
import {
  canUseIndexedDb,
  readIndexedDbSessions,
  replaceIndexedDbSessions,
  type StoredChatSession,
} from '@/lib/client/chat-storage';
import { createClient } from '@/lib/supabase/client';
import {
  clearCloudChatSessions,
  deleteCloudChatSession,
  persistCloudChatSession,
  persistCloudChatSessions,
  readCloudChatSessions,
} from '@/lib/client/cloud-chat-storage';

export type { Message } from '@/types/chat';

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  isPinned?: boolean;
}

interface ChatBackupPayload {
  app: 'AbhiAI';
  type: 'local-chat-backup';
  version: 1;
  exportedAt: string;
  sessions: ChatSession[];
}

const SESSIONS_KEY = 'abhiai_sessions';
const CURRENT_SESSION_KEY = 'abhiai_current_session';
const MODEL_CHANGED_EVENT = 'abhiai:model-changed';
const CLOUD_MERGE_KEY_PREFIX = 'abhiai_cloud_merged_';
export const CHAT_BACKUP_IMPORT_EVENT = 'abhiai:chat-backup-import';
const PERSIST_DELAY_MS = 180;
const STREAM_UPDATE_INTERVAL_MS = 60;
const CLOUD_SYNC_DELAY_MS = 700;

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
  if (typeof window === 'undefined') return [];
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
  if (typeof window === 'undefined') return null;
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
    if (id) localStorage.setItem(CURRENT_SESSION_KEY, id);
    else localStorage.removeItem(CURRENT_SESSION_KEY);
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

async function readGuestSessions(): Promise<ChatSession[]> {
  if (!canUseIndexedDb()) return sortSessions(readLegacySessions());
  try {
    const indexedSessions = (await readIndexedDbSessions()) as ChatSession[];
    if (indexedSessions.length > 0) return sortSessions(indexedSessions);
  } catch {
    // Fall through to the localStorage fallback.
  }
  return sortSessions(readLegacySessions());
}

function cloudMergeCompleted(userId: string) {
  try {
    return localStorage.getItem(`${CLOUD_MERGE_KEY_PREFIX}${userId}`) === '1';
  } catch {
    return false;
  }
}

function markCloudMergeCompleted(userId: string) {
  try {
    localStorage.setItem(`${CLOUD_MERGE_KEY_PREFIX}${userId}`, '1');
  } catch {
    // A blocked localStorage marker only means the safe merge may run again next login.
  }
}

export function createLocalChatBackup(items: ChatSession[]) {
  const payload: ChatBackupPayload = {
    app: 'AbhiAI',
    type: 'local-chat-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions: items,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseLocalChatBackup(raw: string): ChatSession[] {
  const parsed = JSON.parse(raw) as Partial<ChatBackupPayload>;
  if (
    parsed?.app !== 'AbhiAI' ||
    parsed?.type !== 'local-chat-backup' ||
    parsed?.version !== 1 ||
    !Array.isArray(parsed.sessions)
  ) {
    throw new Error('This is not a valid AbhiAI chat backup.');
  }

  const valid = parsed.sessions.filter((session): session is ChatSession => {
    return Boolean(
      session &&
      typeof session.id === 'string' &&
      session.id.length > 0 &&
      typeof session.title === 'string' &&
      Array.isArray(session.messages) &&
      typeof session.updatedAt === 'number' &&
      Number.isFinite(session.updatedAt),
    );
  });

  if (parsed.sessions.length > 0 && valid.length === 0) {
    throw new Error('The backup does not contain any readable chats.');
  }

  return valid;
}

export function useChatHistory() {
  const [supabase] = useState(() => createClient());
  const [sessions, setSessions] = useState<ChatSession[]>(readLegacySessions);
  const [currentSessionId, setCurrentSessionIdState] = useState<string | null>(readStoredCurrentSessionId);
  const [localReady, setLocalReady] = useState(false);
  const hydratedRef = useRef(false);
  const latestSessionsRef = useRef<ChatSession[]>(sessions);
  const guestSessionsRef = useRef<ChatSession[]>(sessions);
  const authUserIdRef = useRef<string | null>(null);
  const cloudHydratedRef = useRef(false);
  const authGenerationRef = useRef(0);
  const persistTimerRef = useRef<number | null>(null);
  const streamingTimerRef = useRef<number | null>(null);
  const cloudAllTimerRef = useRef<number | null>(null);
  const cloudSyncTimersRef = useRef<Map<string, number>>(new Map());
  const cloudWriteChainRef = useRef<Promise<void>>(Promise.resolve());
  const pendingStreamingUpdatesRef = useRef<Map<string, Message[]>>(new Map());

  const commitSessions = (updater: (previous: ChatSession[]) => ChatSession[]) => {
    setSessions((previous) => updater(previous));
  };

  const enqueueCloudWrite = useCallback((task: () => Promise<void>) => {
    cloudWriteChainRef.current = cloudWriteChainRef.current
      .then(task)
      .catch((error) => {
        console.warn('AbhiAI cloud chat sync failed.', error);
      });
  }, []);

  const scheduleCloudSessionSync = useCallback((sessionId: string) => {
    const userId = authUserIdRef.current;
    if (!userId || !cloudHydratedRef.current || typeof window === 'undefined') return;

    const existingTimer = cloudSyncTimersRef.current.get(sessionId);
    if (existingTimer !== undefined) window.clearTimeout(existingTimer);

    const timer = window.setTimeout(() => {
      cloudSyncTimersRef.current.delete(sessionId);
      if (authUserIdRef.current !== userId || !cloudHydratedRef.current) return;
      const session = latestSessionsRef.current.find((item) => item.id === sessionId);
      if (!session) return;
      enqueueCloudWrite(() => persistCloudChatSession(supabase, userId, session));
    }, CLOUD_SYNC_DELAY_MS);

    cloudSyncTimersRef.current.set(sessionId, timer);
  }, [enqueueCloudWrite, supabase]);

  const scheduleAllCloudSync = useCallback(() => {
    const userId = authUserIdRef.current;
    if (!userId || !cloudHydratedRef.current || typeof window === 'undefined') return;
    if (cloudAllTimerRef.current !== null) window.clearTimeout(cloudAllTimerRef.current);

    cloudAllTimerRef.current = window.setTimeout(() => {
      cloudAllTimerRef.current = null;
      if (authUserIdRef.current !== userId || !cloudHydratedRef.current) return;
      const snapshot = latestSessionsRef.current;
      enqueueCloudWrite(() => persistCloudChatSessions(supabase, userId, snapshot));
    }, CLOUD_SYNC_DELAY_MS);
  }, [enqueueCloudWrite, supabase]);

  const applyMessageUpdates = (updates: Map<string, Message[]>) => {
    if (updates.size === 0) return;
    const updatedAt = Date.now();

    commitSessions((previous) => {
      let changed = false;
      const updated = previous.map((session) => {
        const messages = updates.get(session.id);
        if (!messages) return session;
        changed = true;
        return { ...session, messages, updatedAt };
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
      let hydratedSessions = sortSessions(readLegacySessions());

      if (canUseIndexedDb()) {
        try {
          const indexedSessions = (await readIndexedDbSessions()) as ChatSession[];
          if (indexedSessions.length > 0) {
            hydratedSessions = sortSessions(indexedSessions);
          } else if (hydratedSessions.length > 0) {
            await replaceIndexedDbSessions(toStoredSessions(hydratedSessions));
            removeLegacySessions();
          }
        } catch {
          // If IndexedDB is blocked, keep using the existing localStorage fallback.
        }
      }

      if (cancelled) return;
      guestSessionsRef.current = hydratedSessions;
      latestSessionsRef.current = hydratedSessions;
      setSessions(hydratedSessions);
      hydratedRef.current = true;
      setLocalReady(true);
    };

    void hydrateLocalChats();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!localReady) return;
    let cancelled = false;

    const switchIdentity = async (userId: string | null) => {
      const generation = ++authGenerationRef.current;
      cloudHydratedRef.current = false;
      authUserIdRef.current = userId;

      for (const timer of cloudSyncTimersRef.current.values()) window.clearTimeout(timer);
      cloudSyncTimersRef.current.clear();
      if (cloudAllTimerRef.current !== null) {
        window.clearTimeout(cloudAllTimerRef.current);
        cloudAllTimerRef.current = null;
      }

      if (!userId) {
        const guestSessions = await readGuestSessions();
        if (cancelled || generation !== authGenerationRef.current) return;
        guestSessionsRef.current = guestSessions;
        latestSessionsRef.current = guestSessions;
        setSessions(guestSessions);
        setCurrentSessionIdState(null);
        persistCurrentSessionId(null);
        return;
      }

      try {
        const cloudSessions = (await readCloudChatSessions(supabase, userId)) as ChatSession[];
        if (cancelled || generation !== authGenerationRef.current) return;

        let nextSessions = sortSessions(cloudSessions);
        if (!cloudMergeCompleted(userId)) {
          nextSessions = mergeSessions(cloudSessions, guestSessionsRef.current);
          try {
            await persistCloudChatSessions(supabase, userId, nextSessions);
            markCloudMergeCompleted(userId);
          } catch (error) {
            console.warn('AbhiAI could not finish the first-login chat merge.', error);
          }
        }

        if (cancelled || generation !== authGenerationRef.current) return;
        latestSessionsRef.current = nextSessions;
        setSessions(nextSessions);
        setCurrentSessionIdState(null);
        persistCurrentSessionId(null);
        cloudHydratedRef.current = true;
      } catch (error) {
        if (cancelled || generation !== authGenerationRef.current) return;
        console.warn('AbhiAI cloud history could not be loaded.', error);
        latestSessionsRef.current = [];
        setSessions([]);
        setCurrentSessionIdState(null);
        persistCurrentSessionId(null);
        cloudHydratedRef.current = true;
      }
    };

    void supabase.auth.getUser().then(({ data }) => switchIdentity(data.user?.id ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void switchIdentity(session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [localReady, supabase]);

  useEffect(() => {
    latestSessionsRef.current = sessions;
    if (!hydratedRef.current || authUserIdRef.current) return;
    guestSessionsRef.current = sessions;

    if (!canUseIndexedDb()) {
      persistLegacySessions(sessions);
      return;
    }

    if (persistTimerRef.current !== null) window.clearTimeout(persistTimerRef.current);
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
      if (streamingTimerRef.current !== null) window.clearTimeout(streamingTimerRef.current);
      if (cloudAllTimerRef.current !== null) window.clearTimeout(cloudAllTimerRef.current);
      for (const timer of cloudSyncTimersRef.current.values()) window.clearTimeout(timer);
      cloudSyncTimersRef.current.clear();
      pendingStreamingUpdatesRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const persistLatestOnHide = () => {
      if (document.visibilityState !== 'hidden' || authUserIdRef.current) return;
      const latest = latestSessionsRef.current;
      if (canUseIndexedDb()) {
        void replaceIndexedDbSessions(toStoredSessions(latest)).catch(() => persistLegacySessions(latest));
      } else {
        persistLegacySessions(latest);
      }
    };

    document.addEventListener('visibilitychange', persistLatestOnHide);
    return () => document.removeEventListener('visibilitychange', persistLatestOnHide);
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
      scheduleAllCloudSync();
    };

    window.addEventListener(CHAT_BACKUP_IMPORT_EVENT, handleBackupImport);
    return () => window.removeEventListener(CHAT_BACKUP_IMPORT_EVENT, handleBackupImport);
  }, [scheduleAllCloudSync]);

  const createSession = (initialTitle?: string, initialMessages: Message[] = []) => {
    const titleMessage = initialMessages.find((message) => message.role === 'user');
    const derivedTitle = titleMessage
      ? titleMessage.content.slice(0, 30) + (titleMessage.content.length > 30 ? '...' : '')
      : 'New Chat';
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
    scheduleCloudSessionSync(newSession.id);
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
    scheduleCloudSessionSync(sessionId);
  };

  const renameSession = (sessionId: string, newTitle: string) => {
    commitSessions((previous) =>
      previous.map((session) =>
        session.id === sessionId
          ? { ...session, title: newTitle.trim() || session.title }
          : session,
      ),
    );
    scheduleCloudSessionSync(sessionId);
  };

  const togglePinSession = (sessionId: string) => {
    commitSessions((previous) =>
      sortSessions(
        previous.map((session) =>
          session.id === sessionId ? { ...session, isPinned: !session.isPinned } : session,
        ),
      ),
    );
    scheduleCloudSessionSync(sessionId);
  };

  const deleteSession = (sessionId: string) => {
    pendingStreamingUpdatesRef.current.delete(sessionId);
    const timer = cloudSyncTimersRef.current.get(sessionId);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      cloudSyncTimersRef.current.delete(sessionId);
    }

    const userId = authUserIdRef.current;
    if (userId && cloudHydratedRef.current) {
      enqueueCloudWrite(() => deleteCloudChatSession(supabase, userId, sessionId));
    }

    commitSessions((previous) => previous.filter((session) => session.id !== sessionId));
    if (currentSessionId === sessionId) setCurrentSessionId(null);
  };

  const clearAllSessions = () => {
    pendingStreamingUpdatesRef.current.clear();
    if (streamingTimerRef.current !== null) {
      window.clearTimeout(streamingTimerRef.current);
      streamingTimerRef.current = null;
    }
    for (const timer of cloudSyncTimersRef.current.values()) window.clearTimeout(timer);
    cloudSyncTimersRef.current.clear();
    if (cloudAllTimerRef.current !== null) {
      window.clearTimeout(cloudAllTimerRef.current);
      cloudAllTimerRef.current = null;
    }

    const userId = authUserIdRef.current;
    if (userId && cloudHydratedRef.current) {
      enqueueCloudWrite(() => clearCloudChatSessions(supabase, userId));
    }

    commitSessions(() => []);
    setCurrentSessionId(null);
  };

  const startNewChat = () => setCurrentSessionId(null);
  const exportBackup = () => createLocalChatBackup(sessions);

  const importBackup = (raw: string) => {
    const imported = parseLocalChatBackup(raw);
    commitSessions((previous) => mergeSessions(previous, imported));
    scheduleAllCloudSync();
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
