import { NextRequest, NextResponse } from 'next/server';
import { getAppSettings, saveAppSettings } from '@/lib/app-settings';
import { FILE_STORE_UNAVAILABLE_MESSAGE } from '@/lib/config/file-store';

export async function GET() {
  const settings = getAppSettings();
  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = saveAppSettings(body);
    if (!updated) {
      return NextResponse.json(
        { error: FILE_STORE_UNAVAILABLE_MESSAGE },
        { status: 503 },
      );
    }
    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save settings' }, { status: 500 });
  }
}
