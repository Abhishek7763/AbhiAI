'use client';

export interface StoredChatSession {
  id: string;
  title: string;
  messages: unknown[];
  updatedAt: number;
  isPinned?: boolean;
}

const DB_NAME = 'abhiai-local';
const DB_VERSION = 1;
const SESSION_STORE = 'chat-sessions';

export function canUseIndexedDb() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open local chat storage.'));
  });
}

export async function readIndexedDbSessions(): Promise<StoredChatSession[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSION_STORE, 'readonly');
      const request = transaction.objectStore(SESSION_STORE).getAll();
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => reject(request.error ?? new Error('Failed to read local chats.'));
    });
  } finally {
    db.close();
  }
}

export async function replaceIndexedDbSessions(items: StoredChatSession[]): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(SESSION_STORE, 'readwrite');
      const store = transaction.objectStore(SESSION_STORE);
      store.clear();
      for (const item of items) store.put(item);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to save local chats.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Local chat save was aborted.'));
    });
  } finally {
    db.close();
  }
}
