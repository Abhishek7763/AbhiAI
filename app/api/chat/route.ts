import { NextResponse } from "next/server";
import { getRuntimeInstructions } from "@/lib/ai/runtime-instructions";
import { resolveRoutePlan, RouteCandidate } from "@/lib/ai/router";
import { getProviderAdapter } from "@/lib/ai/providers/registry";
import { logUsageEvent } from "@/lib/usage-logger";
import { recordRuntimeModelFailure, recordRuntimeModelSuccess } from "@/lib/ai/runtime-health";
import { withTimeout } from "@/lib/ai/timeout";
import { sanitizeChatHistory, validateChatRequestSize, validateUserMessage } from "@/lib/ai/chat-input";
import {
  formatDocumentsForPrompt,
  isGeminiNativeAttachment,
  validateInlineAttachments,
  type AttachmentPayload,
} from "@/lib/files/document-extractor";

export const maxDuration = 180;

const PROVIDER_TIMEOUT_MS = 35_000;
const RUNTIME_HEALTH_WRITE_TIMEOUT_MS = 2_500;

function isClientAbort(error: unknown) {
  return error instanceof Error && error.message === 'CLIENT_ABORTED';
}

export async function POST(req: Request) {
  const startTime = Date.now();
  let requestedModel = 'default';

  const sizeError = validateChatRequestSize(req.headers.get('content-length'));
  if (sizeError) {
    return NextResponse.json({ error: sizeError }, { status: 413 });
  }

  try {
    const { message, history, modelId, attachments } = await req.json();
    const userMessage = typeof message === 'string' ? message : '';
    const messageError = validateUserMessage(message);
    if (messageError) {
      return NextResponse.json({ error: messageError }, { status: 400 });
    }

    const currentAttachments: AttachmentPayload[] = Array.isArray(attachments)
      ? attachments.filter((attachment: unknown): attachment is AttachmentPayload => Boolean(
          attachment &&
          typeof (attachment as AttachmentPayload).name === 'string' &&
          typeof (attachment as AttachmentPayload).type === 'string' &&
          typeof (attachment as AttachmentPayload).data === 'string',
        ))
      : [];
    const safeHistory = sanitizeChatHistory(history);
    requestedModel = typeof modelId === 'string' && modelId ? modelId : 'default';

    if (!userMessage && currentAttachments.length === 0) {
      return NextResponse.json({ error: "Message or attachment is required" }, { status: 400 });
    }

    const attachmentError = validateInlineAttachments(currentAttachments);
    if (attachmentError) {
      return NextResponse.json({ error: attachmentError }, { status: 413 });
    }

    const requiresNativeMultimodal = currentAttachments.some((attachment) => isGeminiNativeAttachment(attachment));
    const routePlan = await resolveRoutePlan(requestedModel, requiresNativeMultimodal, userMessage);

    if (!routePlan.primary) {
      return NextResponse.json(
        { error: "No usable AI model is configured for this request. Open Admin > Integrations and Smart Routing." },
        { status: 503 },
      );
    }

    const globalInstructions = await getRuntimeInstructions();
    const executionChain: RouteCandidate[] = [routePlan.primary, ...routePlan.fallbacks];

    let successfulReply: string | null = null;
    let executedCandidate: RouteCandidate | null = null;

    for (const candidate of executionChain) {
      if (req.signal.aborted) break;
      const candidateStartedAt = Date.now();

      try {
        const combinedPrompt = [globalInstructions, candidate.systemPrompt].filter(Boolean).join('\n\n');
        const documentTextAppendix = formatDocumentsForPrompt(currentAttachments, {
          skipNativePdf: candidate.providerId === 'google',
        });
        const userEffectiveContent = (userMessage || 'Please review the attached content.') + documentTextAppendix;

        const chatMessages: any[] = safeHistory.map((item) => ({
          role: item.role,
          content: item.content,
        }));

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
          adapter.chat(candidate.apiKey, candidate.modelId, chatMessages, combinedPrompt),
          PROVIDER_TIMEOUT_MS,
          candidate.name,
        );

        if (req.signal.aborted) throw new Error('CLIENT_ABORTED');

        if (reply) {
          await withTimeout(
            recordRuntimeModelSuccess(candidate.connectionId, Date.now() - candidateStartedAt),
            RUNTIME_HEALTH_WRITE_TIMEOUT_MS,
            'Runtime health update',
          ).catch(() => undefined);
          successfulReply = reply;
          executedCandidate = candidate;
          break;
        }
      } catch (error) {
        if (req.signal.aborted || isClientAbort(error)) break;

        await withTimeout(
          recordRuntimeModelFailure(candidate.connectionId, error),
          RUNTIME_HEALTH_WRITE_TIMEOUT_MS,
          'Runtime health update',
        ).catch(() => undefined);

        const message = error instanceof Error ? error.message : String(error || 'Unknown provider error');
        console.warn(`[Failover] Execution failed on ${candidate.name} (${candidate.modelId}):`, message);
      }
    }

    if (req.signal.aborted) {
      return new Response(null, { status: 499 });
    }

    if (successfulReply && executedCandidate) {
      const failoverUsed = executedCandidate.connectionId !== routePlan.primary.connectionId;
      logUsageEvent({
        modelOrAlias: requestedModel,
        executedModelName: executedCandidate.name,
        executedModelId: executedCandidate.modelId,
        connectionId: executedCandidate.connectionId,
        provider: executedCandidate.providerId,
        promptLength: userMessage.length,
        responseLength: successfulReply.length,
        durationMs: Date.now() - startTime,
        failoverUsed,
        isPublic: true,
        status: 'success',
      });

      return NextResponse.json({
        reply: successfulReply,
        model: executedCandidate.name,
        failoverUsed,
      });
    }

    logUsageEvent({
      modelOrAlias: requestedModel,
      provider: 'all-failed',
      promptLength: userMessage.length,
      responseLength: 0,
      durationMs: Date.now() - startTime,
      failoverUsed: true,
      isPublic: true,
      status: 'error',
      errorCode: 'ALL_CANDIDATES_FAILED',
    });

    return NextResponse.json(
      { error: "AbhiAI is temporarily unable to complete this request. Please try again shortly." },
      { status: 502 },
    );
  } catch (error) {
    if (req.signal.aborted || isClientAbort(error)) {
      return new Response(null, { status: 499 });
    }

    console.error("Chat Gateway Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error in AbhiAI Chat Gateway" },
      { status: 500 },
    );
  }
}
