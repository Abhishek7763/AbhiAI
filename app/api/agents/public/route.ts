import { NextResponse } from 'next/server';
import { getStoredAgents } from '@/lib/data/admin-config';

export async function GET() {
  try {
    const publicAgents = (await getStoredAgents())
      .filter((agent) => agent.visibility === 'public')
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        icon: agent.icon,
        sampleStarters: agent.sampleStarters || [],
        // The public client receives an opaque agent route token instead of the
        // backing model alias. The server resolves the agent's current model,
        // persona and tool permissions on every request.
        preferredModelOrAlias: `agent:${agent.id}`,
      }));

    return NextResponse.json({ agents: publicAgents });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load agents' }, { status: 503 });
  }
}
