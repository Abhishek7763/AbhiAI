import { NextResponse } from 'next/server';
import { getStoredAgents } from '@/lib/data/admin-config';

export async function GET() {
  try {
    const publicAgents = (await getStoredAgents())
    .filter(a => a.visibility === 'public')
    .map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      icon: a.icon,
      sampleStarters: a.sampleStarters || [],
      preferredModelOrAlias: a.preferredModelOrAlias,
    }));

    return NextResponse.json({ agents: publicAgents });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load agents' }, { status: 503 });
  }
}
