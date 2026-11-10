import { NextResponse } from 'next/server';
import { getInstructionManagerState, getInstructionRevisions, restoreInstructionRevision, saveInstruction, type InstructionScope } from '@/lib/data/instruction-manager';

const scopes = new Set<InstructionScope>(['global', 'public', 'admin', 'agent']);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const scope = url.searchParams.get('scope') as InstructionScope | null;
    if (!scope) return NextResponse.json(await getInstructionManagerState());
    if (!scopes.has(scope)) return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
    const targetId = url.searchParams.get('targetId') ?? '';
    return NextResponse.json({ revisions: await getInstructionRevisions(scope, targetId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load instructions' }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    if (data.action === 'restore') {
      const content = await restoreInstructionRevision(Number(data.revisionId));
      return NextResponse.json({ success: true, content });
    }
    const scope = (data.scope ?? 'global') as InstructionScope;
    if (!scopes.has(scope) || typeof data.content !== 'string') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    await saveInstruction(scope, data.content, typeof data.targetId === 'string' ? data.targetId : '');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request' }, { status: 400 });
  }
}
