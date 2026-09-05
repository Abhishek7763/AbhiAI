import { NextRequest } from "next/server";
import { getRuntimeInstructions } from "@/lib/ai/runtime-instructions";
import { resolveRoutePlan, RouteCandidate } from "@/lib/ai/router";
import { streamOpenAICompatible } from "@/lib/ai/stream";
import { logUsageEvent } from "@/lib/usage-logger";
import { recordRuntimeModelFailure, recordRuntimeModelSuccess } from "@/lib/ai/runtime-health";
import { withStreamTimeout, withTimeout } from "@/lib/ai/timeout";
import {
  MAX_CHAT_REQUEST_BYTES,
  sanitizeChatHistory,
  validateChatRequestSize,
  validateUserMessage,
} from "@/lib/ai/chat-input";
import { fetchWebGroundingContext, type SearchResult } from "@/lib/ai/web-search";
import { logger } from "@/lib/logger";
import { acquirePublicAiConcurrency, protectPublicAiRequest } from "@/lib/security/public-api-guard";
import { RequestBodyTooLargeError, readJsonBodyWithLimit } from "@/lib/security/request-body";
import {
  formatDocumentsForPrompt,
  isGeminiNativeAttachment,
  isImageAttachment,
  isPdfAttachment,
  normalizeAttachmentBase64,
  validateInlineAttachments,
  type AttachmentPayload,
} from "@/lib/files/document-extractor";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 180;

const PROVIDER_FIRST_RESPONSE_TIMEOUT_MS = 25_000;
const PROVIDER_IDLE_TIMEOUT_MS = 30_000;
const PROVIDER_TOTAL_TIMEOUT_MS = 90_000;
const RUNTIME_HEALTH_WRITE_TIMEOUT_MS = 2_500;

function cleanSourceTitle(value: string | undefined, fallback: string) {
  const cleaned = (value || '').replace(/[\[\]\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
}

function formatSourceAppendix(sources: SearchResult[]) {
  const unique = new Map<string, SearchResult>();
  for (const source of sources) {
    if (!source.url || unique.has(source.url)) continue;
    unique.set(source.url, source);
  }

  const visible = Array.from(unique.values()).slice(0, 8);
  if (visible.length === 0) return '';

  const lines = visible.map((source, index) => {
    const title = cleanSourceTitle(source.title, `Source ${index + 1}`);
    return `${index + 1}. [${title}](${source.url})`;
  });

  return `\n\n---\n**Web sources**\n${lines.join('\n')}`;
}

function isClientAbort(error: unknown) {
  return error instanceof Error && error.message === 'CLIENT_ABORTED';
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let requestedModel = 'default';
  let releaseConcurrency: (() => Promise<void>) | null = null;
  let concurrencyHandedToStream = false;

  const sizeError = validateChatRequestSize(req.headers.get('content-length'));
  if (sizeError) {
    return new Response(JSON.stringify({ error: sizeError }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  const guard = await protectPublicAiRequest(req, 'chat');
  if (!guard.ok) return guard.response;

  try {
    const body = await readJsonBodyWithLimit<Record<string, unknown>>(req, MAX_CHAT_REQUEST_BYTES);
    const message = body.message;
    const history = body.history;
    const modelId = body.modelId;
    const attachments = body.attachments;
    const webSearch = body.webSearch;
    const userMessage = typeof message === 'string' ? message : '';
    const messageError = validateUserMessage(message, guard.settings.maxPromptLength);
    if (messageError) {
      return new Response(JSON.stringify({ error: messageError }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
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
    const webSearchEnabled = webSearch === true;
    requestedModel = typeof modelId === 'string' && modelId ? modelId : 'default';

    if (!userMessage && currentAttachments.length === 0) {
      return new Response(JSON.stringify({ error: "Message or attachment is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const attachmentError = validateInlineAttachments(currentAttachments);
    if (attachmentError) {
      return new Response(JSON.stringify({ error: attachmentError }), {
        status: 413,
        headers: { "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "No usable AI model is configured for this request. Open Admin > Integrations and Smart Routing." }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const executionChain: RouteCandidate[] = [routePlan.primary, ...routePlan.fallbacks];

    let fallbackWebContext = '';
    let fallbackWebSources: SearchResult[] = [];
    if (webSearchEnabled && userMessage && executionChain.some((candidate) => candidate.providerId !== 'google')) {
      const searchRes = await fetchWebGroundingContext(userMessage);
      fallbackWebContext = searchRes.contextText || '';
      fallbackWebSources = searchRes.sources || [];
    }

    const globalInstructions = await getRuntimeInstructions();
    const encoder = new TextEncoder();
    let streamCancelled = false;
    const releaseLease = releaseConcurrency;
    let leaseReleased = false;
    concurrencyHandedToStream = true;

    const releaseOnce = async () => {
      if (leaseReleased) return;
      leaseReleased = true;
      await releaseLease();
    };

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let executionSucceeded = false;
          let failoverHappened = false;
          let totalOutputChars = 0;

          const isCancelled = () => streamCancelled || req.signal.aborted;
          const emit = (payload: unknown) => {
            if (isCancelled()) return false;
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
              return true;
            } catch (error) {
              logger.debug('Streaming client disconnected while data was being emitted.', error);
              streamCancelled = true;
              return false;
            }
          };

          for (const candidate of executionChain) {
            if (isCancelled()) break;

            const candidateStartedAt = Date.now();
            let firstTokenAt: number | null = null;
            let candidateOutputChars = 0;

            try {
              failoverHappened = candidate.connectionId !== routePlan.primary?.connectionId;

              if (!candidate.apiKey) {
                throw new Error(`No runtime API key is available for ${candidate.name}`);
              }

              const combinedPrompt = [
                globalInstructions,
                candidate.systemPrompt,
                candidate.providerId === 'google' ? '' : fallbackWebContext,
              ].filter(Boolean).join('\n\n');

              const documentTextAppendix = formatDocumentsForPrompt(currentAttachments, {
                skipNativePdf: candidate.providerId === 'google',
              });
              const userEffectiveContent = (userMessage || 'Please review the attached content.') + documentTextAppendix;

              const chatMessages: any[] = safeHistory.map((item) => ({
                role: item.role,
                content: item.content,
              }));
              chatMessages.push({
                role: 'user',
                content: userEffectiveContent,
                attachments: candidate.providerId === 'google'
                  ? []
                  : currentAttachments.filter((attachment) => isImageAttachment(attachment)),
              });

              if (!emit({
                type: 'meta',
                modelName: candidate.name,
                failoverUsed: failoverHappened,
                webSearchActive: webSearchEnabled,
              })) {
                break;
              }

              let responseSources: SearchResult[] = candidate.providerId === 'google' ? [] : fallbackWebSources;

              if (candidate.providerId === 'google') {
                const ai = new GoogleGenAI({ apiKey: candidate.apiKey });
                const geminiConfig: any = { systemInstruction: combinedPrompt };
                if (webSearchEnabled) geminiConfig.tools = [{ googleSearch: {} }];

                const geminiContents: any[] = safeHistory.map((item) => ({
                  role: item.role === 'assistant' ? 'model' : 'user',
                  parts: [{ text: item.content }],
                }));

                const userParts: any[] = [];
                for (const attachment of currentAttachments) {
                  if (!isGeminiNativeAttachment(attachment)) continue;
                  if (attachment.name) userParts.push({ text: `Attached file: ${attachment.name}` });
                  userParts.push({
                    inlineData: {
                      mimeType: attachment.type || (isPdfAttachment(attachment) ? 'application/pdf' : 'application/octet-stream'),
                      data: normalizeAttachmentBase64(attachment.data),
                    },
                  });
                }
                userParts.push({ text: userEffectiveContent });
                geminiContents.push({ role: 'user', parts: userParts });

                const geminiRes = await withTimeout(
                  ai.models.generateContentStream({
                    model: candidate.modelId,
                    contents: geminiContents,
                    config: geminiConfig,
                  }),
                  PROVIDER_FIRST_RESPONSE_TIMEOUT_MS,
                  `${candidate.name} stream start`,
                );

                const groundedSources = new Map<string, SearchResult>();
                for await (const chunk of withStreamTimeout(geminiRes, {
                  firstChunkMs: PROVIDER_FIRST_RESPONSE_TIMEOUT_MS,
                  idleChunkMs: PROVIDER_IDLE_TIMEOUT_MS,
                  totalMs: PROVIDER_TOTAL_TIMEOUT_MS,
                  label: candidate.name,
                })) {
                  if (isCancelled()) throw new Error('CLIENT_ABORTED');

                  const text = chunk.text;
                  if (text) {
                    if (firstTokenAt === null) firstTokenAt = Date.now();
                    totalOutputChars += text.length;
                    candidateOutputChars += text.length;
                    if (!emit({ type: 'delta', text })) throw new Error('CLIENT_ABORTED');
                  }

                  if (webSearchEnabled) {
                    const groundingChunks = (chunk as any).candidates?.[0]?.groundingMetadata?.groundingChunks;
                    if (Array.isArray(groundingChunks)) {
                      for (const groundingChunk of groundingChunks) {
                        const webSource = groundingChunk?.web;
                        if (!webSource?.uri || groundedSources.has(webSource.uri)) continue;
                        groundedSources.set(webSource.uri, {
                          title: cleanSourceTitle(webSource.title, 'Web source'),
                          url: webSource.uri,
                          snippet: '',
                        });
                      }
                    }
                  }
                }

                responseSources = Array.from(groundedSources.values());
              } else {
                const streamGen = streamOpenAICompatible(
                  candidate.baseUrl,
                  candidate.apiKey,
                  candidate.modelId,
                  chatMessages,
                  combinedPrompt,
                  undefined,
                  req.signal,
                );

                for await (const deltaText of withStreamTimeout(streamGen, {
                  firstChunkMs: PROVIDER_FIRST_RESPONSE_TIMEOUT_MS,
                  idleChunkMs: PROVIDER_IDLE_TIMEOUT_MS,
                  totalMs: PROVIDER_TOTAL_TIMEOUT_MS,
                  label: candidate.name,
                })) {
                  if (isCancelled()) throw new Error('CLIENT_ABORTED');
                  if (firstTokenAt === null) firstTokenAt = Date.now();
                  totalOutputChars += deltaText.length;
                  candidateOutputChars += deltaText.length;
                  if (!emit({ type: 'delta', text: deltaText })) throw new Error('CLIENT_ABORTED');
                }
              }

              if (webSearchEnabled && !isCancelled()) {
                const sourceAppendix = formatSourceAppendix(responseSources);
                if (sourceAppendix) {
                  totalOutputChars += sourceAppendix.length;
                  candidateOutputChars += sourceAppendix.length;
                  if (!emit({ type: 'delta', text: sourceAppendix })) throw new Error('CLIENT_ABORTED');
                }
              }

              const learnedLatencyMs = (firstTokenAt ?? Date.now()) - candidateStartedAt;
              await withTimeout(
                recordRuntimeModelSuccess(candidate.connectionId, learnedLatencyMs),
                RUNTIME_HEALTH_WRITE_TIMEOUT_MS,
                'Runtime health update',
              ).catch((healthError) => {
                logger.warn('Could not record successful stream runtime health state.', healthError);
              });

              if (!isCancelled()) emit({ type: 'done' });
              executionSucceeded = true;

              if (!isCancelled()) {
                logUsageEvent({
                  modelOrAlias: requestedModel,
                  executedModelName: candidate.name,
                  executedModelId: candidate.modelId,
                  connectionId: candidate.connectionId,
                  provider: candidate.providerId,
                  promptLength: userMessage.length,
                  responseLength: totalOutputChars,
                  durationMs: Date.now() - startTime,
                  failoverUsed: failoverHappened,
                  isPublic: true,
                  status: 'success',
                });
              }
              break;
            } catch (error) {
              if (isCancelled() || isClientAbort(error)) {
                streamCancelled = true;
                break;
              }

              await withTimeout(
                recordRuntimeModelFailure(candidate.connectionId, error),
                RUNTIME_HEALTH_WRITE_TIMEOUT_MS,
                'Runtime health update',
              ).catch((healthError) => {
                logger.warn('Could not record failed stream runtime health state.', healthError);
              });

              const message = error instanceof Error ? error.message : String(error || 'Unknown stream error');
              logger.warn(`Stream failover on ${candidate.name} (${candidate.modelId}).`, message);

              if (candidateOutputChars > 0) {
                emit({
                  type: 'error',
                  error: 'The active model stopped mid-response. Please retry so AbhiAI can choose another healthy model.',
                });
                executionSucceeded = true;
                break;
              }
            }
          }

          if (!executionSucceeded && !isCancelled()) {
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

            emit({
              type: 'error',
              error: 'AbhiAI is temporarily unable to complete this request. Please try again shortly.',
            });
          }

          try {
            controller.close();
          } catch (error) {
            logger.debug('Streaming controller was already closed by the client.', error);
          }
        } finally {
          await releaseOnce();
        }
      },
      cancel() {
        streamCancelled = true;
        void releaseOnce();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return new Response(JSON.stringify({
        error: `Chat request is too large. Keep the total request under about ${Math.floor(MAX_CHAT_REQUEST_BYTES / 1_000_000)} MB.`,
      }), {
        status: 413,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (error instanceof SyntaxError) {
      return new Response(JSON.stringify({ error: 'Chat request contains invalid JSON.' }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (req.signal.aborted || isClientAbort(error)) {
      return new Response(null, { status: 499 });
    }

    logger.error('Stream gateway error.', error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    if (!concurrencyHandedToStream && releaseConcurrency) {
      await releaseConcurrency();
    }
  }
}
