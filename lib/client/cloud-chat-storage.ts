'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Message } from '@/types/chat';

export interface CloudChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  isPinned?: boolean;
}

type SessionRow = {
  id: string;
  title: string;
  is_pinned: boolean;
  updated_at: string;
};

type MessageRow = {
  session_id: string;
  id: string;
  position: number;
  payload: unknown;
};

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<Message>;
  return (
    typeof message.id === 'string' &&
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.content === 'string'
  );
}

function parseTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

export async function readCloudChatSessions(
  supabase: SupabaseClient,
  userId: string,
): Promise<CloudChatSession[]> {
  const { data: sessionData, error: sessionError } = await supabase
    .from('chat_sessions')
    .select('id,title,is_pinned,updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (sessionError) throw sessionError;
  const sessionRows = (sessionData ?? []) as SessionRow[];
  if (sessionRows.length === 0) return [];

  const { data: messageData, error: messageError } = await supabase
    .from('chat_messages')
    .select('session_id,id,position,payload')
    .eq('user_id', userId)
    .order('position', { ascending: true });

  if (messageError) throw messageError;

  const messagesBySession = new Map<string, Message[]>();
  for (const row of (messageData ?? []) as MessageRow[]) {
    if (!isMessage(row.payload)) continue;
    const messages = messagesBySession.get(row.session_id) ?? [];
    messages.push(row.payload);
    messagesBySession.set(row.session_id, messages);
  }

  return sessionRows.map((row) => ({
    id: row.id,
    title: row.title,
    messages: messagesBySession.get(row.id) ?? [],
    updatedAt: parseTimestamp(row.updated_at),
    isPinned: row.is_pinned,
  }));
}

export async function persistCloudChatSession(
  supabase: SupabaseClient,
  _userId: string,
  session: CloudChatSession,
) {
  const { error } = await supabase.rpc('sync_chat_session', {
    p_session_id: session.id,
    p_title: session.title,
    p_is_pinned: Boolean(session.isPinned),
    p_updated_at: new Date(session.updatedAt).toISOString(),
    p_messages: session.messages,
  });
  if (error) throw error;
}

export async function persistCloudChatSessions(
  supabase: SupabaseClient,
  userId: string,
  sessions: CloudChatSession[],
) {
  for (const session of sessions) {
    await persistCloudChatSession(supabase, userId, session);
  }
}

export async function deleteCloudChatSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
) {
  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('id', sessionId);
  if (error) throw error;
}

export async function clearCloudChatSessions(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase.from('chat_sessions').delete().eq('user_id', userId);
  if (error) throw error;
}
