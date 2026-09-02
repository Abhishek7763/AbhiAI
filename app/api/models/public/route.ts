import { NextResponse } from 'next/server';
import { classifyModelBilling } from '@/lib/ai/free-guard';
import { getBrandedModelName, isBrandedRuntimeModel } from '@/lib/ai/model-branding';
import { getStoredModels } from '@/lib/data/admin-config';

export async function GET() {
  try {
    const brandedModels = (await getStoredModels())
      .filter((model) => {
        if (!model.isActive || !model.isPublic || !isBrandedRuntimeModel(model.id)) return false;
        const billing = classifyModelBilling(model.providerId, model.id);
        return billing === 'FREE_VERIFIED' || billing === 'FREE_LIMITED';
      })
      .map((model) => ({
        id: model.id,
        name: getBrandedModelName(model.id, model.alias),
      }));

    return NextResponse.json({
      models: [
        { id: 'auto', name: 'AbhiAI Auto' },
        ...brandedModels,
      ],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load models' }, { status: 503 });
  }
}
