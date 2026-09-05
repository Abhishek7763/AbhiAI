import { NextResponse } from "next/server";
import { getRuntimeInstructions } from "@/lib/ai/runtime-instructions";
import { resolveRoutePlan, RouteCandidate } from "@/lib/ai/router";
import { getProviderAdapter } from "@/lib/ai/providers/registry";
import { logUsageEvent } from "@/lib/usage-logger";
import { recordRuntimeModelFailure, recordRuntimeModelSuccess } from "@/lib/ai/runtime-health";
import { withTimeout } from "@/lib/ai/timeout";
import {
  MAX_CHAT_REQUEST_BYTES,
  sanitizeChatHistory,
  validateChatRequestSize,
  validateUserMessage,
} from "@/lib/ai/chat-input";
import { logger } from "@/lib/logger";
import { acquirePublicAiConcurrency, protectPublicAiRequest } from "@/lib/security/public-api-guard";
import { RequestBodyTooLargeError, readJsonBodyWithLimit } from "@/lib/security/request-body";
import {
  formatDocumentsForPrompt,
  isGeminiNativeAttachment,
  isImageAttachment,
  isPdfAttachment,
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
  let releaseConcurrency: (() => Promise<void>) | null = null;

  const sizeError = validateChatRequestSize(req.headers.get('content-length'));
  if (sizeError) {
    return NextResponse.json({ error: sizeError }, { status: 413 });
  }

  const guard = await protectPublicAiRequest(req, 'chat');
  if (!guard.ok) return guard.response;

  try {
    const body = await readJsonBodyWithLimit<Record<string, unknown>>(req, MAX_CHAT_REQUEST_BYTES);
    const message = body.message;
    const history = body.history;
    const modelId = body.modelId;
    const attachments = body.attachments;
    const userMessage = typeof message === 'string' ? message : '';
    const messageError = validateUserMessage(message, guard.settings.maxPromptLength);
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

    const concurrency = await acquirePublicAiConcurrency(req, 'chat', guard.userId);
    if (!concurrency.ok) return concurrency.response;
    releaseConcurrency = concurrency.release;

    const requiresVision = currentAttachments.some((attachment) => isImageAttachment(attachment));
    const requiresNativeDocument = currentAttachments.some((attachment) => isPdfAttachment(attachment));
    const routePlan = await resolveRoutePlan(
      requestedModel,
      requiresVision || requiresNativeDocument,
      userMessage,
      requiresNativeDocument,
    );

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
          : currentAttachments.filter((attachment) => isImageAttachment(attachment));

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
          ).catch((healthError) => {
            logger.warn('Could not record successful runtime health state.', healthError);
          });
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
        ).catch((healthError) => {
          logger.warn('Could not record failed runtime health state.', healthError);
        });

        const message = error instanceof Error ? error.message : String(error || 'Unknown provider error');
        logger.warn(`Failover execution failed on ${candidate.name} (${candidate.modelId}).`, message);
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
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { error: `Chat request is too large. Keep the total request under about ${Math.floor(MAX_CHAT_REQUEST_BYTES / 1_000_000)} MB.` },
        { status: 413 },
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Chat request contains invalid JSON.' }, { status: 400 });
    }
    if (req.signal.aborted || isClientAbort(error)) {
      return new Response(null, { status: 499 });
    }

    logger.error('Chat gateway error.', error);
    return NextResponse.json(
      { error: "Internal Server Error in AbhiAI Chat Gateway" },
      { status: 500 },
    );
  } finally {
    if (releaseConcurrency) await releaseConcurrency();
  }
}
