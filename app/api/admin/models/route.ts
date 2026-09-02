import { NextResponse } from 'next/server';
import { getModels, saveModels } from '@/lib/models';
import { FILE_STORE_UNAVAILABLE_MESSAGE } from '@/lib/config/file-store';

export async function GET() {
  return NextResponse.json({ models: Object.values(getModels()) });
}

export async function POST(req: Request) {
  try {
    const { id, updates } = await req.json();
    const models = getModels();
    
    if (!models[id]) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }
    
    // Only allow updating safe fields for now
    if (updates.alias !== undefined) models[id].alias = updates.alias;
    if (updates.isActive !== undefined) models[id].isActive = updates.isActive;
    if (updates.isPublic !== undefined) models[id].isPublic = updates.isPublic;
    
    if (!saveModels(models)) {
      return NextResponse.json(
        { error: FILE_STORE_UNAVAILABLE_MESSAGE },
        { status: 503 },
      );
    }
    return NextResponse.json({ success: true, model: models[id] });
  } catch {
    return NextResponse.json({ error: 'Failed to update model' }, { status: 500 });
  }
}
