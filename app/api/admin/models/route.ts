import { NextResponse } from 'next/server';
import { getModels, saveModels } from '@/lib/models';

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
    
    saveModels(models);
    return NextResponse.json({ success: true, model: models[id] });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update model' }, { status: 500 });
  }
}
