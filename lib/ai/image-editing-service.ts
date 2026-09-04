import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { getStoredProviderApiKey, listProviders } from '@/lib/data/ai-config';
import { logger } from '@/lib/logger';
import { moderateImagePrompt } from '@/lib/security/image-moderation';
import { logUsageEvent } from '@/lib/usage-logger';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';

const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';
const OPENAI_IMAGE_MODEL = 'gpt-image-2';
const BUCKET = 'generated-images';
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

export class ImageEditingInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageEditingInputError';
  }
}

type ParsedDataImage = { mimeType: string; bytes: Buffer; base64: string; extension: string };

function parseDataImage(value: string): ParsedDataImage | null {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[2], 'base64');
  const extension = match[1] === 'image/jpeg' ? 'jpg' : match[1].split('/')[1];
  return { mimeType: match[1], bytes, base64: match[2], extension };
}

function openAiSize(aspectRatio: string): '1024x1024' | '1536x1024' | '1024x1536' {
  if (aspectRatio === '16:9' || aspectRatio === '4:3') return '1536x1024';
  if (aspectRatio === '9:16' || aspectRatio === '3:4') return '1024x1536';
  return '1024x1024';
}

async function persistEditedImage(args: {
  userId: string | null;
  imageUrl: string;
  prompt: string;
  provider: string;
  style: string;
  aspectRatio: string;
}) {
  if (!args.userId) return { id: null as string | null, storagePath: null as string | null };
  const parsed = parseDataImage(args.imageUrl);
  if (!parsed || parsed.bytes.byteLength > MAX_SOURCE_BYTES) return { id: null, storagePath: null };

  try {
    const supabase = await createSupabaseServerClient();
    const storagePath = `${args.userId}/${Date.now()}-edit.${parsed.extension}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, parsed.bytes, {
      contentType: parsed.mimeType,
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from('generated_images')
      .insert({
        user_id: args.userId,
        prompt: args.prompt,
        enhanced_prompt: `Image edit: ${args.prompt}`,
        url: `storage://${storagePath}`,
        storage_path: storagePath,
        provider: args.provider,
        style: args.style,
        aspect_ratio: args.aspectRatio,
      })
      .select('id')
      .single();

    if (error) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      throw error;
    }

    return { id: data.id as string, storagePath };
  } catch (error) {
    logger.warn('Edited image cloud persistence failed.', error);
    return { id: null, storagePath: null };
  }
}

async function editWithGemini(apiKey: string, source: ParsedDataImage, prompt: string, aspectRatio: string) {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: {
      parts: [
        { inlineData: { mimeType: source.mimeType, data: source.base64 } },
        { text: `Edit the supplied image according to this instruction: ${prompt}. Preserve unrelated visual details and composition unless the instruction requires changing them.` },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: ['1:1', '16:9', '9:16', '4:3', '3:4'].includes(aspectRatio)
          ? aspectRatio as '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
          : '1:1',
        imageSize: '1K',
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      return {
        imageUrl: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`,
        provider: 'Google Gemini Image Edit',
        providerSlug: 'google',
        model: GEMINI_IMAGE_MODEL,
      };
    }
  }
  return null;
}

async function editWithOpenAI(apiKey: string, source: ParsedDataImage, prompt: string, aspectRatio: string, mask?: ParsedDataImage | null) {
  const form = new FormData();
  form.set('model', OPENAI_IMAGE_MODEL);
  form.set('prompt', prompt);
  form.set('size', openAiSize(aspectRatio));
  form.set('image', new Blob([source.bytes], { type: source.mimeType }), `source.${source.extension}`);
  if (mask) form.set('mask', new Blob([mask.bytes], { type: mask.mimeType }), `mask.${mask.extension}`);

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI image edit failed (${response.status}): ${body.slice(0, 240)}`);
  }

  const data = await response.json();
  const first = data?.data?.[0];
  const imageUrl = first?.b64_json ? `data:image/png;base64,${first.b64_json}` : first?.url;
  if (!imageUrl) return null;
  return { imageUrl, provider: 'OpenAI GPT Image Edit', providerSlug: 'openai', model: OPENAI_IMAGE_MODEL };
}

export async function editImageWithConfiguredProviders(args: {
  prompt: string;
  sourceImage: string;
  maskImage?: string;
  aspectRatio?: string;
  style?: string;
  engine?: string;
  userId?: string | null;
  freeOnlyMode: boolean;
}) {
  const startedAt = Date.now();
  const prompt = args.prompt.trim();
  if (!prompt) throw new ImageEditingInputError('Describe the edit you want to make.');

  const moderation = moderateImagePrompt(prompt);
  if (!moderation.allowed) throw new ImageEditingInputError('This image edit request cannot be generated safely. Please revise the instruction.');

  const source = parseDataImage(args.sourceImage);
  if (!source) throw new ImageEditingInputError('Upload a PNG, JPEG, or WebP image before editing.');
  if (source.bytes.byteLength > MAX_SOURCE_BYTES) throw new ImageEditingInputError('Source image is too large. Maximum size is 10 MB.');
  const mask = args.maskImage ? parseDataImage(args.maskImage) : null;
  if (args.maskImage && !mask) throw new ImageEditingInputError('Mask must be a PNG, JPEG, or WebP image.');
  if (mask && mask.bytes.byteLength > MAX_SOURCE_BYTES) throw new ImageEditingInputError('Mask image is too large. Maximum size is 10 MB.');

  if (args.freeOnlyMode) {
    throw new ImageEditingInputError('Image editing needs a configured Gemini or OpenAI image provider. Free-only mode currently supports text-to-image generation only.');
  }

  const providers = await listProviders();
  const active = new Set(providers.filter((provider: any) => provider.is_active).map((provider: any) => provider.slug));
  const requested = args.engine || 'auto';
  const failures: string[] = [];

  const tryProvider = async (slug: 'google' | 'openai') => {
    if (!active.has(slug)) return null;
    const apiKey = await getStoredProviderApiKey(slug);
    if (!apiKey) return null;
    try {
      if (slug === 'google') return await editWithGemini(apiKey, source, prompt, args.aspectRatio || '1:1');
      return await editWithOpenAI(apiKey, source, prompt, args.aspectRatio || '1:1', mask);
    } catch (error) {
      logger.warn(`${slug} image editing failed.`, error);
      failures.push(error instanceof Error ? error.message : `${slug} image editing failed`);
      return null;
    }
  };

  let result = null as Awaited<ReturnType<typeof tryProvider>>;
  if (requested === 'auto' || requested === 'imagen') result = await tryProvider('google');
  if (!result && (requested === 'auto' || requested === 'openai' || requested === 'dalle')) result = await tryProvider('openai');

  if (!result) {
    const detail = failures[0] ? ` ${failures[0]}` : '';
    throw new Error(`No configured image-editing provider could complete this request.${detail}`);
  }

  await logUsageEvent({
    modelOrAlias: 'image-editing',
    executedModelName: result.model,
    executedModelId: result.model,
    provider: result.providerSlug,
    promptLength: prompt.length,
    responseLength: result.imageUrl.length,
    durationMs: Date.now() - startedAt,
    failoverUsed: failures.length > 0,
    isPublic: true,
    status: 'success',
  });

  const persisted = await persistEditedImage({
    userId: args.userId ?? null,
    imageUrl: result.imageUrl,
    prompt,
    provider: result.provider,
    style: args.style || 'photorealistic',
    aspectRatio: args.aspectRatio || '1:1',
  });

  return {
    success: true as const,
    imageUrl: result.imageUrl,
    prompt,
    enhancedPrompt: `Image edit: ${prompt}`,
    provider: result.provider,
    providerSlug: result.providerSlug,
    model: result.model,
    style: args.style || 'photorealistic',
    aspectRatio: args.aspectRatio || '1:1',
    timestamp: Date.now(),
    generatedImageId: persisted.id,
    storagePath: persisted.storagePath,
    mode: 'edit' as const,
  };
}
