import { NextResponse } from "next/server";
import { getInstructions } from "@/lib/instructions";
import { resolveRoutePlan, RouteCandidate } from "@/lib/ai/router";
import { getProviderAdapter } from "@/lib/ai/providers/registry";
import { isModelAllowedUnderFreeGuard } from "@/lib/ai/free-guard";
import { formatDocumentsForPrompt } from "@/lib/files/document-extractor";

export async function POST(req: Request) {
  try {
    const { message, history, modelId, attachments } = await req.json();

    if (!message && (!attachments || attachments.length === 0)) {
      return NextResponse.json({ error: "Message or attachment is required" }, { status: 400 });
    }

    const hasImages = Array.isArray(attachments) && attachments.some((a: any) => a.type?.startsWith('image/'));
    const routePlan = resolveRoutePlan(modelId || 'default', hasImages);

    if (!routePlan.primary) {
      return NextResponse.json(
        { error: "No active AI providers configured. Please add a provider in Admin Connections." },
        { status: 503 }
      );
    }

    const globalInstructions = getInstructions().systemPrompt || 'You are AbhiAI, an intelligent assistant created by Abhishek.';
    const documentTextAppendix = formatDocumentsForPrompt(attachments);
    const userEffectiveContent = (message || 'Please review the attached content.') + documentTextAppendix;

    // Ordered sequence: Primary -> Fallback 1 -> Fallback 2 -> Fallback 3
    const executionChain: RouteCandidate[] = [
      routePlan.primary,
      ...routePlan.fallbacks
    ];

    let lastError: string | null = null;
    let successfulReply: string | null = null;
    let executedModelName: string = routePlan.primary.name;

    for (const candidate of executionChain) {
      try {
        // 1. Free-Only Safety Check
        const freeCheck = isModelAllowedUnderFreeGuard(candidate.providerId, candidate.modelId, false);
        // (Free check can be switched to true if Free-Only mode is enforced globally)

        // 2. Prepare System Prompt
        const combinedPrompt = [
          globalInstructions,
          candidate.systemPrompt
        ].filter(Boolean).join('\n\n');

        // 3. Prepare Chat Messages
        const chatMessages: any[] = [];
        if (Array.isArray(history)) {
          for (const h of history) {
            chatMessages.push({
              role: h.role === 'assistant' ? 'assistant' : 'user',
              content: h.content || '',
              attachments: h.attachments,
            });
          }
        }
        chatMessages.push({
          role: 'user',
          content: userEffectiveContent,
          attachments,
        });

        // 4. Execute via Provider Adapter
        const adapter = getProviderAdapter(candidate.providerId, candidate.baseUrl);
        if (!adapter) {
          throw new Error(`Adapter for provider ${candidate.providerId} could not be resolved`);
        }

        const reply = await adapter.chat(
          candidate.apiKey,
          candidate.modelId,
          chatMessages,
          combinedPrompt
        );

        if (reply) {
          successfulReply = reply;
          executedModelName = candidate.name;
          break; // Succeeded! Break out of fallback chain.
        }
      } catch (err: any) {
        console.warn(`[Failover] Execution failed on ${candidate.name} (${candidate.modelId}):`, err.message);
        lastError = err.message;
        // Continue loop to attempt next fallback in sequence
      }
    }

    if (successfulReply) {
      return NextResponse.json({
        reply: successfulReply,
        model: executedModelName,
        failoverUsed: executedModelName !== routePlan.primary.name
      });
    }

    // Friendly AbhiAI error message if all candidates failed
    return NextResponse.json({
      error: "AbhiAI is temporarily unable to complete this request. Please try again shortly.",
      debug: lastError
    }, { status: 502 });

  } catch (error: any) {
    console.error("Chat Gateway Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error in AbhiAI Chat Gateway" },
      { status: 500 }
    );
  }
}
