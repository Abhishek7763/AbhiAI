import { NextRequest, NextResponse } from 'next/server';
import {
  generateImageWithConfiguredProviders,
  ImageGenerationInputError,
  type ImageEngine,
} from '@/lib/ai/image-generation-service';
import { logger } from '@/lib/logger';
import { protectPublicAiRequest } from '@/lib/security/public-api-guard';

export async function POST(req: NextRequest) {
  const guard = await protectPublicAiRequest(req, 'image');
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json() as Record<string, unknown>;
    const prompt = typeof body.prompt === 'string' ? body.prompt : '';
    const style = typeof body.style === 'string' ? body.style : 'photorealistic';
    const aspectRatio = typeof body.aspectRatio === 'string' ? body.aspectRatio : '1:1';
    const negativePrompt = typeof body.negativePrompt === 'string' ? body.negativePrompt : undefined;
    const rawEngine = typeof body.engine === 'string' ? body.engine : 'auto';
    const engine: ImageEngine = ['auto', 'imagen', 'openai', 'dalle', 'stability', 'flux'].includes(rawEngine)
      ? rawEngine as ImageEngine
      : 'auto';

    const result = await generateImageWithConfiguredProviders({
      prompt,
      style,
      aspectRatio,
      negativePrompt,
      engine,
      userId: guard.userId,
      settings: guard.settings,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ImageGenerationInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    logger.error('Image generation API error.', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image. Please try again.' },
      { status: 500 },
    );
  }
}
