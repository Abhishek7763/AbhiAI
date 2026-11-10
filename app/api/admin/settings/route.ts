import { NextRequest, NextResponse } from 'next/server';
import { getStoredSettings, saveStoredSettings } from '@/lib/data/admin-config';

export async function GET() {
  try {
    return NextResponse.json({ settings: await getStoredSettings() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load settings' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = await saveStoredSettings(body);
    return NextResponse.json({ success: true, settings: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save settings' }, { status: 500 });
  }
}
