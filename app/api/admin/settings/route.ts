import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { getStoredSettings, saveStoredSettings } from '@/lib/data/admin-config';
import { isSupabaseAdminConfigured } from '@/lib/supabase/admin';

export async function GET() {
  try {
    let schemaSql = '';
    try {
      schemaSql = fs.readFileSync(path.join(process.cwd(), 'supabase', 'schema.sql'), 'utf8');
    } catch {
      schemaSql = '';
    }
    return NextResponse.json({
      settings: await getStoredSettings(),
      supabaseConnected: isSupabaseAdminConfigured(),
      schemaSql,
    });
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
