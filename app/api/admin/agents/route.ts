import { NextRequest, NextResponse } from 'next/server';
import type { AIAgent } from '@/lib/agents';
import { getAgentConfigs, saveAgentConfigs } from '@/lib/data/agent-config';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    return NextResponse.json({ agents: await getAgentConfigs() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load agents' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!Array.isArray(body.agents)) {
      return NextResponse.json({ error: 'Expected agents array' }, { status: 400 });
    }

    await saveAgentConfigs(body.agents as AIAgent[]);
    return NextResponse.json({ success: true, agents: body.agents });
  } catch (error) {
    logger.error('Error saving agents.', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save agents' }, { status: 500 });
  }
}
