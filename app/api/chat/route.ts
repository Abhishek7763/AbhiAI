import { NextResponse } from "next/server";
import { getInstructions } from "@/lib/instructions";
import { resolveRoutePlan, RouteCandidate } from "@/lib/ai/router";
import { getProviderAdapter } from "@/lib/ai/providers/registry";
import { logUsageEvent } from "@/lib/usage-logger";
import { recordRuntimeModelFailure, recordRuntimeModelSuccess } from "@/lib/ai/runtime-health";
import { withTimeout } from "@/lib/ai/timeout";
import {
  formatDocumentsForPrompt,
  isGeminiNativeAttachment,
  validateInlineAttachments,
  type AttachmentPayload,
} from "@/lib/files/document-extractor";

const PROVIDER_TIMEOUT_MS = 45_000;

export async function POST(req: Request) {
  const startTime = Date.now();
  let requestedModel = 'default';

  try {
    const { message, history, modelId, attachments } = await req.json();
    const currentAttachments: AttachmentPayload[] = Array.isArray(attachments) ? attachments : [];
    requestedModel = modelId || 'default';

    if (!message && currentAttachments.length === 0) {
      return NextResponse.json({ error: "Message or attachment is required" }, { status: 400 });
    }

    const attachmentError = validateInlineAttachments(currentAttachments);
    if (attachmentError) {
      return NextResponse.json({ error: attachmentError }, { status: 413 });
    }

    const requiresNativeMultimodal = currentAttachments.some((attachment) => isGeminiNativeAttachment(attachment));
    const routePlan = await resolveRoutePlan(requestedModel, requiresNativeMultimodal, message || '');

    if (!routePlan.primary) {
      return NextResponse.json(
        { error: "No usable AI model is configured for this request. Open Admin > Providers and Smart Routing." },
        { status: 503 }
      );
    }

    const globalInstructions = getInstructions().systemPrompt || 'You are AbhiAI, an intelligent assistant created by Abhishek.';
    const executionChain: RouteCandidate[] = [routePlan.primary, ...routePlan.fallbacks];

    let lastError: string | null = null;
    let successfulReply: string | null = null;
    let executedCandidate: RouteCandidate | null = null;

    for (const candidate of executionChain) {
      const candidateStartedAt = Date.now();
      try {
        const combinedPrompt = [globalInstructions, candidate.systemPrompt].filter(Boolean).join('\n\n');
        const documentTextAppendix = formatDocumentsForPrompt(currentAttachments, {
          skipNativePdf: candidate.providerId === 'google',
        });
        const userEffectiveContent = (message || 'Please review the attached content.') + documentTextAppendix;

        const chatMessages: any[] = [];
        if (Array.isArray(history)) {
          for (const h of history) {
            chatMessages.push({
              role: h.role === 'assistant' ? 'assistant' : 'user',
              content: h.content || '',
            });
          }
        }

        const candidateAttachments = candidate.providerId === 'google'
          ? currentAttachments.filter((attachment) => isGeminiNativeAttachment(attachment))
          : [];

        chatMessages.push({
          role: 'user',
          content: userEffectiveContent,
          attachments: candidateAttachments,
        });

        const adapter = getProviderAdapter(candidate.providerId, candidate.baseUrl);
        if (!adapter) {
          throw new Error(`Adapter for provider ${candidate.providerId} could not be resolved`);
        }
        if (!candidate.apiKey) {
          throw new Error(`No runtime API key is available for ${candidate.name}`);
        }

        const reply = await withTimeout(
          adapter.chat(
            candidate.apiKey,
            candidate.modelId,
            chatMessages,
            combinedPrompt
          ),
          PROVIDER_TIMEOUT_MS,
          candidate.name,
        );

        if (reply) {
          await recordRuntimeModelSuccess(candidate.connectionId, Date.now() - candidateStartedAt);
          successfulReply = reply;
          executedCandidate = candidate;
          break;
        }
      } catch (err: any) {
        await recordRuntimeModelFailure(candidate.connectionId, err);
        console.warn(`[Failover] Execution failed on ${candidate.name} (${candidate.modelId}):`, err.message);
        lastError = err.message;
      }
    }

    if (successfulReply && executedCandidate) {
      const failoverUsed = executedCandidate.connectionId !== routePlan.primary.connectionId;
      logUsageEvent({
        modelOrAlias: requestedModel,
        executedModelName: executedCandidate.name,
        executedModelId: executedCandidate.modelId,
        connectionId: executedCandidate.connectionId,
        provider: executedCandidate.providerId,
        promptLength: (message || '').length,
        responseLength: successfulReply.length,
        durationMs: Date.now() - startTime,
        failoverUsed,
        isPublic: true,
        status: 'success',
      });

      return NextResponse.json({
        reply: successfulReply,
        model: executedCandidate.name,
        failoverUsed
      });
    }

    logUsageEvent({
      modelOrAlias: requestedModel,
      provider: 'all-failed',
      promptLength: (message || '').length,
      responseLength: 0,
      durationMs: Date.now() - startTime,
      failoverUsed: true,
      isPublic: true,
      status: 'error',
      errorCode: 'ALL_CANDIDATES_FAILED',
    });

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
