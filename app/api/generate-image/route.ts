import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getStoredProviderApiKey, listProviders } from '@/lib/data/ai-config';
import { logUsageEvent } from '@/lib/usage-logger';
import { logger } from '@/lib/logger';
import { moderateImagePrompt } from '@/lib/security/image-moderation';
import { protectPublicAiRequest } from '@/lib/security/public-api-guard';

type ImageEngine = 'auto' | 'imagen' | 'openai' | 'dalle' | 'stability' | 'flux';

type ImageSuccess = {
  imageUrl: string;
  provider: string;
  providerSlug: string;
  model: string;
  seed?: number;
};

const OPENAI_IMAGE_MODEL = 'gpt-image-2';
const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';
const STABILITY_IMAGE_MODEL = 'stable-image-core';

function enhancePrompt(prompt: string, style: string) {
  switch (style) {
    case 'photorealistic':
      return `${prompt}, highly detailed photorealistic professional photography, natural lighting, sharp focus, realistic materials and textures`;
    case '3d_render':
      return `${prompt}, polished 3D digital art, ray-traced lighting, volumetric shading, detailed materials, cinematic render`;
    case 'anime':
      return `${prompt}, polished Japanese anime aesthetic, vibrant colors, clean line art, expressive lighting, high quality illustration`;
    case 'cyberpunk':
      return `${prompt}, cyberpunk futuristic aesthetic, neon glow, reflective surfaces, atmospheric dark sci-fi environment`;
    case 'cinematic':
      return `${prompt}, cinematic film still, dramatic composition, atmospheric lighting, shallow depth of field, premium color grading`;
    case 'digital_art':
      return `${prompt}, premium digital painting, concept art, dynamic composition, intricate details, vivid palette`;
    case 'minimalist':
      return `${prompt}, minimalist graphic design, clean modern forms, elegant negative space, balanced composition`;
    case 'fantasy':
      return `${prompt}, high fantasy concept art, mystical atmosphere, magical particles, ethereal glow, ultra detailed`;
    case 'oil_painting':
      return `${prompt}, classical oil painting on textured canvas, rich brushwork, dramatic light and shadow`;
    default:
      return prompt;
  }
}

function pollinationsDimensions(aspectRatio: string) {
  switch (aspectRatio) {
    case '16:9': return { width: 1280, height: 720 };
    case '9:16': return { width: 720, height: 1280 };
    case '4:3': return { width: 1024, height: 768 };
    case '3:4': return { width: 768, height: 1024 };
    default: return { width: 1024, height: 1024 };
  }
}

function openAiSize(aspectRatio: string): '1024x1024' | '1536x1024' | '1024x1536' {
  if (aspectRatio === '16:9' || aspectRatio === '4:3') return '1536x1024';
  if (aspectRatio === '9:16' || aspectRatio === '3:4') return '1024x1536';
  return '1024x1024';
}

async function recordImageUsage(args: {
  provider: string;
  model: string;
  promptLength: number;
  responseLength: number;
  startedAt: number;
  failoverUsed: boolean;
  status: 'success' | 'error';
  errorCode?: string;
}) {
  await logUsageEvent({
    modelOrAlias: 'image-generation',
    executedModelName: args.model,
    executedModelId: args.model,
    provider: args.provider,
    promptLength: args.promptLength,
    responseLength: args.responseLength,
    durationMs: Date.now() - args.startedAt,
    failoverUsed: args.failoverUsed,
    isPublic: true,
    status: args.status,
    errorCode: args.errorCode,
  });
}

async function generateWithGemini(apiKey: string, enhancedPrompt: string, aspectRatio: string): Promise<ImageSuccess | null> {
  const ai = new GoogleGenAI({ apiKey });
  let geminiAspect: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '1:1';
  if (aspectRatio === '16:9' || aspectRatio === '9:16' || aspectRatio === '4:3' || aspectRatio === '3:4') {
    geminiAspect = aspectRatio;
  }

  const response = await ai.models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: { parts: [{ text: enhancedPrompt }] },
    config: {
      imageConfig: {
        aspectRatio: geminiAspect,
        imageSize: '1K',
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      const mimeType = part.inlineData.mimeType || 'image/png';
      return {
        imageUrl: `data:${mimeType};base64,${part.inlineData.data}`,
        provider: 'Google Gemini Image',
        providerSlug: 'google',
        model: GEMINI_IMAGE_MODEL,
      };
    }
  }
  return null;
}

async function generateWithOpenAI(apiKey: string, enhancedPrompt: string, aspectRatio: string): Promise<ImageSuccess | null> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt: enhancedPrompt,
      n: 1,
      size: openAiSize(aspectRatio),
      quality: 'medium',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI image request failed (${response.status}): ${body.slice(0, 240)}`);
  }

  const data = await response.json();
  const first = data?.data?.[0];
  const imageUrl = first?.b64_json
    ? `data:image/png;base64,${first.b64_json}`
    : first?.url;
  if (!imageUrl) return null;

  return {
    imageUrl,
    provider: 'OpenAI GPT Image',
    providerSlug: 'openai',
    model: OPENAI_IMAGE_MODEL,
  };
}

async function generateWithStability(
  apiKey: string,
  enhancedPrompt: string,
  aspectRatio: string,
  negativePrompt?: string,
): Promise<ImageSuccess | null> {
  const form = new FormData();
  form.set('prompt', enhancedPrompt);
  form.set('output_format', 'png');
  if (['1:1', '16:9', '9:16', '4:3', '3:4'].includes(aspectRatio)) {
    form.set('aspect_ratio', aspectRatio);
  }
  if (negativePrompt?.trim()) form.set('negative_prompt', negativePrompt.trim());

  const response = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Stability image request failed (${response.status}): ${body.slice(0, 240)}`);
  }

  const data = await response.json();
  if (!data?.image) return null;
  return {
    imageUrl: `data:image/png;base64,${data.image}`,
    provider: 'Stability AI Core',
    providerSlug: 'stability',
    model: STABILITY_IMAGE_MODEL,
    seed: typeof data.seed === 'number' ? data.seed : undefined,
  };
}

async function generateWithCustomEndpoint(
  endpoint: string,
  enhancedPrompt: string,
  style: string,
  aspectRatio: string,
  negativePrompt?: string,
): Promise<ImageSuccess | null> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: enhancedPrompt, style, aspectRatio, negativePrompt }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const imageUrl = data.imageUrl || data.url;
  if (!imageUrl) return null;
  return {
    imageUrl,
    provider: 'Custom Image Server',
    providerSlug: 'unknown',
    model: 'custom-image-endpoint',
  };
}

function generateWithPollinations(enhancedPrompt: string, aspectRatio: string): ImageSuccess {
  const { width, height } = pollinationsDimensions(aspectRatio);
  const seed = Math.floor(Math.random() * 10_000_000);
  const encodedPrompt = encodeURIComponent(enhancedPrompt);
  return {
    imageUrl: `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=false&model=flux`,
    provider: 'Pollinations Flux',
    providerSlug: 'pollinations',
    model: 'flux',
    seed,
  };
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let cleanPrompt = '';
  let attempts = 0;

  const guard = await protectPublicAiRequest(req, 'image');
  if (!guard.ok) return guard.response;
  const settings = guard.settings;

  try {
    const body = await req.json() as Record<string, unknown>;
    const prompt = body.prompt;
    const style = typeof body.style === 'string' ? body.style : 'photorealistic';
    const aspectRatio = typeof body.aspectRatio === 'string' ? body.aspectRatio : '1:1';
    const negativePrompt = typeof body.negativePrompt === 'string' ? body.negativePrompt : undefined;
    const rawEngine = typeof body.engine === 'string' ? body.engine : 'auto';

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Prompt is required to generate an image.' }, { status: 400 });
    }

    cleanPrompt = prompt.trim();
    if (cleanPrompt.length > settings.maxPromptLength) {
      return NextResponse.json(
        { error: `Prompt is too long. Maximum ${settings.maxPromptLength} characters.` },
        { status: 400 },
      );
    }

    const moderation = moderateImagePrompt(cleanPrompt);
    if (!moderation.allowed) {
      await recordImageUsage({
        provider: 'blocked',
        model: 'image-prompt-moderation',
        promptLength: cleanPrompt.length,
        responseLength: 0,
        startedAt,
        failoverUsed: false,
        status: 'error',
        errorCode: `IMAGE_PROMPT_BLOCKED_${moderation.category || 'POLICY'}`.toUpperCase().replace(/-/g, '_'),
      });
      return NextResponse.json(
        { error: 'This image request cannot be generated safely. Please revise the prompt.' },
        { status: 400 },
      );
    }

    const requestedEngine: ImageEngine = ['auto', 'imagen', 'openai', 'dalle', 'stability', 'flux'].includes(rawEngine)
      ? (rawEngine as ImageEngine)
      : 'auto';
    const enhancedPrompt = enhancePrompt(cleanPrompt, style);
    const freeOnlyMode = settings.freeOnlyMode !== false;
    const providers = await listProviders();
    const activeProviderSlugs = new Set(providers.filter((provider: any) => provider.is_active).map((provider: any) => provider.slug));

    const finish = async (result: ImageSuccess) => {
      await recordImageUsage({
        provider: result.providerSlug,
        model: result.model,
        promptLength: cleanPrompt.length,
        responseLength: result.imageUrl.length,
        startedAt,
        failoverUsed: attempts > 1,
        status: 'success',
      });
      return NextResponse.json({
        success: true,
        imageUrl: result.imageUrl,
        prompt: cleanPrompt,
        enhancedPrompt,
        provider: result.provider,
        providerSlug: result.providerSlug,
        model: result.model,
        style,
        aspectRatio,
        timestamp: Date.now(),
        seed: result.seed,
        freeOnlyMode,
      });
    };

    // Unknown custom endpoints may have billing implications, so Free Guard blocks
    // them unless the admin intentionally turns free-only mode off.
    if (!freeOnlyMode && requestedEngine === 'auto' && settings.customImageApiEndpoint?.trim()) {
      attempts += 1;
      try {
        const result = await generateWithCustomEndpoint(
          settings.customImageApiEndpoint.trim(),
          enhancedPrompt,
          style,
          aspectRatio,
          negativePrompt,
        );
        if (result) return await finish(result);
      } catch (error) {
        logger.warn('Custom image endpoint failed; continuing to configured providers.', error);
      }
    }

    // Paid image APIs are intentionally never called while Free Guard is enabled.
    // Provider credentials remain stored in Supabase and are ready when an admin
    // explicitly disables free-only mode.
    if (!freeOnlyMode && (requestedEngine === 'auto' || requestedEngine === 'imagen') && activeProviderSlugs.has('google')) {
      const apiKey = await getStoredProviderApiKey('google');
      if (apiKey) {
        attempts += 1;
        try {
          const result = await generateWithGemini(apiKey, enhancedPrompt, aspectRatio);
          if (result) return await finish(result);
        } catch (error) {
          logger.warn('Gemini image generation failed; continuing to configured fallbacks.', error);
        }
      }
    }

    if (!freeOnlyMode && (requestedEngine === 'auto' || requestedEngine === 'openai' || requestedEngine === 'dalle') && activeProviderSlugs.has('openai')) {
      const apiKey = await getStoredProviderApiKey('openai');
      if (apiKey) {
        attempts += 1;
        try {
          const result = await generateWithOpenAI(apiKey, enhancedPrompt, aspectRatio);
          if (result) return await finish(result);
        } catch (error) {
          logger.warn('OpenAI image generation failed; continuing to configured fallbacks.', error);
        }
      }
    }

    if (!freeOnlyMode && (requestedEngine === 'auto' || requestedEngine === 'stability') && activeProviderSlugs.has('stability')) {
      const apiKey = await getStoredProviderApiKey('stability');
      if (apiKey) {
        attempts += 1;
        try {
          const result = await generateWithStability(apiKey, enhancedPrompt, aspectRatio, negativePrompt);
          if (result) return await finish(result);
        } catch (error) {
          logger.warn('Stability image generation failed; continuing to free fallback.', error);
        }
      }
    }

    // Pollinations remains the final free fallback. It is not attempted until all
    // configured, billing-safe provider paths above have been considered.
    attempts += 1;
    return await finish(generateWithPollinations(enhancedPrompt, aspectRatio));
  } catch (error) {
    logger.error('Image generation API error.', error);
    await recordImageUsage({
      provider: 'unknown',
      model: 'image-generation',
      promptLength: cleanPrompt.length,
      responseLength: 0,
      startedAt,
      failoverUsed: attempts > 1,
      status: 'error',
      errorCode: error instanceof Error ? error.name : 'IMAGE_GENERATION_ERROR',
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image. Please try again.' },
      { status: 500 },
    );
  }
}
