import { NextResponse } from 'next/server';
import { getInstructions, saveInstructions } from '@/lib/instructions';

export async function GET() {
  return NextResponse.json(getInstructions());
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const success = saveInstructions({ systemPrompt: data.systemPrompt });
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to save instructions' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
