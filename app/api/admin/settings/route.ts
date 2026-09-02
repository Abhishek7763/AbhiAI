import { NextRequest, NextResponse } from 'next/server';
import { getStoredSettings, saveStoredSettings } from '@/lib/data/admin-config';
import { upsertProvider } from '@/lib/data/ai-config';

export async function GET() {
  try {
    return NextResponse.json({ settings: await getStoredSettings() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load settings' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const secretFields: Array<[string, string, string, string]> = [
      ['google', 'Google Gemini', 'https://generativelanguage.googleapis.com', body.geminiApiKey],
      ['openai', 'OpenAI', 'https://api.openai.com/v1', body.openaiApiKey],
      ['stability', 'Stability AI', 'https://api.stability.ai/v2beta', body.stabilityApiKey],
      ['openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1', body.openrouterApiKey],
      ['groq', 'Groq Cloud', 'https://api.groq.com/openai/v1', body.groqApiKey],
      ['together', 'Together AI', 'https://api.together.xyz/v1', body.togetherApiKey],
    ];
    for (const [slug, name, baseUrl, apiKey] of secretFields) {
      if (!apiKey?.trim()) continue;
      await upsertProvider({ slug, name, baseUrl, apiKey });
    }
    const updated = await saveStoredSettings(body);
    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save settings' }, { status: 500 });
  }
}
