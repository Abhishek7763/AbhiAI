import { NextResponse } from 'next/server';
import { getStoredModels } from '@/lib/data/admin-config';

export async function GET() {
  try {
    const publicModels = (await getStoredModels())
      .filter((model) => model.isActive && model.isPublic)
      .map((model) => ({
      id: model.id,
      name: model.alias || model.name,
      originalName: model.name,
    }));
    return NextResponse.json({ models: publicModels });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load models' }, { status: 503 });
  }
}
