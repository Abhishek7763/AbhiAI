import { NextRequest, NextResponse } from 'next/server';
import { editImageWithConfiguredProviders, ImageEditingInputError } from '@/lib/ai/image-editing-service';
import { protectPublicAiRequest } from '@/lib/security/public-api-guard';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const guard = await protectPublicAiRequest(req, 'image');
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json() as Record<string, unknown>;
    const prompt = typeof body.prompt === 'string' ? body.prompt : '';
    const sourceImage = typeof body.sourceImage === 'string' ? body.sourceImage : '';
    const maskImage = typeof body.maskImage === 'string' ? body.maskImage : undefined;
    const aspectRatio = typeof body.aspectRatio === 'string' ? body.aspectRatio : '1:1';
    const style = typeof body.style === 'string' ? body.style : 'photorealistic';
    const engine = typeof body.engine === 'string' ? body.engine : 'auto';

    const result = await editImageWithConfiguredProviders({
      prompt,
      sourceImage,
      maskImage,
      aspectRatio,
      style,
      engine,
      userId: guard.userId,
      freeOnlyMode: guard.settings.freeOnlyMode !== false,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ImageEditingInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error('Image editing API error.', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Image editing failed. Please try again.' },
      { status: 500 },
    );
  }
}
