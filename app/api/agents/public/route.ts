import { NextResponse } from 'next/server';
import { getAgents } from '@/lib/agents';

export async function GET() {
  const agents = getAgents();
  const publicAgents = agents
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
}
