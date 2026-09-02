import { NextResponse } from 'next/server';
import { getInstructions, saveInstructions } from '@/lib/instructions';
import { FILE_STORE_UNAVAILABLE_MESSAGE } from '@/lib/config/file-store';

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
      return NextResponse.json({ error: FILE_STORE_UNAVAILABLE_MESSAGE }, { status: 503 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
