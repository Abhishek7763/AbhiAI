import { NextResponse } from 'next/server';
import { resolveRoutePlan } from '@/lib/ai/router';
import { getProviderAdapter } from '@/lib/ai/providers/registry';

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const plan = await resolveRoutePlan('default', false);
    if (!plan.primary) {
      return NextResponse.json({ ok: false, error: 'No runtime model available.' }, { status: 503 });
    }

    const adapter = getProviderAdapter(plan.primary.providerId, plan.primary.baseUrl);
    if (!adapter) {
      return NextResponse.json({ ok: false, error: 'Provider adapter unavailable.' }, { status: 503 });
    }

    const reply = await adapter.chat(
      plan.primary.apiKey,
      plan.primary.modelId,
      [{ role: 'user', content: 'Reply with exactly OK.' }],
      'This is an internal AbhiAI runtime smoke test.',
    );

    return NextResponse.json({
      ok: reply.trim().toUpperCase().includes('OK'),
      model: plan.primary.modelId,
      provider: plan.primary.providerId,
      response: reply.trim().slice(0, 40),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'AI smoke test failed.' },
      { status: 502 },
    );
  }
}
