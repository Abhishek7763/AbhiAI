import { NextResponse } from 'next/server';
import { getStoredModels, updateStoredModel } from '@/lib/data/admin-config';

export async function GET() {
  try {
    return NextResponse.json({ models: await getStoredModels() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load models' }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    const { id, updates } = await req.json();
    const model = await updateStoredModel(id, updates);
    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, model });
  } catch {
    return NextResponse.json({ error: 'Failed to update model' }, { status: 500 });
  }
}
