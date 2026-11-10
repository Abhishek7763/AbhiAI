import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

export type InstructionScope = 'global' | 'public' | 'admin' | 'agent';

export interface InstructionRevision {
  id: number;
  scope: InstructionScope;
  targetId: string;
  content: string;
  createdAt: string;
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function getInstructionManagerState() {
  const supabase = createAdminClient();
  const [{ data: rows, error }, { data: agents, error: agentError }] = await Promise.all([
    supabase.from('system_instructions').select('id, system_prompt, updated_at').in('id', ['global', 'public', 'admin']),
    supabase.from('ai_agents').select('id, name, icon, system_prompt').order('name'),
  ]);
  throwIfError(error);
  throwIfError(agentError);
  const byId = Object.fromEntries((rows ?? []).map((row: any) => [row.id, row]));
  return {
    global: byId.global?.system_prompt ?? '',
    public: byId.public?.system_prompt ?? '',
    admin: byId.admin?.system_prompt ?? '',
    agents: (agents ?? []).map((agent: any) => ({ id: agent.id, name: agent.name, icon: agent.icon, instructions: agent.system_prompt ?? '' })),
  };
}

export async function saveInstruction(scope: InstructionScope, content: string, targetId = '') {
  const supabase = createAdminClient();
  const normalized = content.trim();
  if (scope === 'agent') {
    if (!targetId) throw new Error('Agent is required.');
    const { data: current, error: readError } = await supabase.from('ai_agents').select('system_prompt').eq('id', targetId).single();
    throwIfError(readError);
    if ((current?.system_prompt ?? '') === normalized) return;
    const { error } = await supabase.from('ai_agents').update({ system_prompt: normalized }).eq('id', targetId);
    throwIfError(error);
  } else {
    const { data: current, error: readError } = await supabase.from('system_instructions').select('system_prompt').eq('id', scope).maybeSingle();
    throwIfError(readError);
    if ((current?.system_prompt ?? '') === normalized) return;
    const { error } = await supabase.from('system_instructions').upsert({ id: scope, system_prompt: normalized });
    throwIfError(error);
  }
  const { error: revisionError } = await supabase.from('instruction_revisions').insert({ scope, target_id: targetId, content: normalized });
  throwIfError(revisionError);
}

export async function getInstructionRevisions(scope: InstructionScope, targetId = ''): Promise<InstructionRevision[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('instruction_revisions').select('id, scope, target_id, content, created_at').eq('scope', scope).eq('target_id', targetId).order('created_at', { ascending: false }).limit(30);
  throwIfError(error);
  return (data ?? []).map((row: any) => ({ id: Number(row.id), scope: row.scope, targetId: row.target_id, content: row.content, createdAt: row.created_at }));
}

export async function restoreInstructionRevision(id: number) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('instruction_revisions').select('scope, target_id, content').eq('id', id).single();
  throwIfError(error);
  if (!data) throw new Error('Revision not found.');
  await saveInstruction(data.scope as InstructionScope, data.content, data.target_id);
  return data.content as string;
}
