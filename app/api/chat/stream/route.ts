import { NextRequest } from "next/server";
import { getRuntimeInstructions } from "@/lib/ai/runtime-instructions";
import { resolveRoutePlan, RouteCandidate } from "@/lib/ai/router";
import { getProviderAdapter } from "@/lib/ai/providers/registry";
import { getAvailableAgentTools } from "@/lib/ai/tools";
import { executeAgentTool } from "@/lib/ai/tool-executor";
import { streamOpenAICompatible } from "@/lib/ai/stream";
import { logUsageEvent } from "@/lib/usage-logger";
import { recordRuntimeModelFailure, recordRuntimeModelSuccess } from "@/lib/ai/runtime-health";
import { withStreamTimeout, withTimeout } from "@/lib/ai/timeout";
import { sanitizeChatHistory, validateChatRequestSize, validateUserMessage } from "@/lib/ai/chat-input";
import { fetchWebGroundingContext, type SearchResult } from "@/lib/ai/web-search";
import { getStoredAgents } from "@/lib/data/admin-config";
import { logger } from "@/lib/logger";
import { protectPublicAiRequest } from "@/lib/security/public-api-guard";
import {
  formatDocumentsForPrompt,
  isGeminiNativeAttachment,
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
    const { message, history, modelId, attachments, webSearch } = await req.json();
    const userMessage = typeof message === 'string' ? message : '';
    const messageError = validateUserMessage(message);
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
    const requestedRoute = typeof modelId === 'string' && modelId ? modelId : 'default';

    let activeAgent: Awaited<ReturnType<typeof getStoredAgents>>[number] | null = null;
    if (requestedRoute.startsWith('agent:')) {
      const agentId = requestedRoute.slice('agent:'.length).trim();
      if (!agentId) {
        return new Response(JSON.stringify({ error: 'Invalid agent selection.' }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      activeAgent = (await getStoredAgents()).find(
        (agent) => agent.id === agentId && agent.visibility === 'public',
      ) ?? null;

      if (!activeAgent) {
        return new Response(JSON.stringify({ error: 'This AI agent is unavailable.' }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    requestedModel = activeAgent?.preferredModelOrAlias || requestedRoute;
    const effectiveHistory = activeAgent?.memoryEnabled === false ? [] : safeHistory;

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

    const requiresNativeMultimodal = currentAttachments.some((attachment) => isGeminiNativeAttachment(attachment));
    const routePlan = await resolveRoutePlan(requestedModel, requiresNativeMultimodal, userMessage);

    if (!routePlan.primary) {
      return new Response(JSON.stringify({ error: "No usable AI model is configured for this request. Open Admin > Integrations and Smart Routing." }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const executionChain: RouteCandidate[] = [routePlan.primary, ...routePlan.fallbacks];
    const allowedToolNames = new Set(activeAgent?.allowedTools ?? []);
    const toolExecutionContext = {
      attachments: currentAttachments,
      userId: guard.userId,
      imageSettings: guard.settings,
      runtime: activeAgent ? {
        temperature: activeAgent.temperature,
        maxTokens: activeAgent.maxTokens,
      } : undefined,
    };
    const agentToolContext = {
      ...toolExecutionContext,
      executeTool: (name: string, args?: Record<string, unknown>) =>
        executeAgentTool(name, args, toolExecutionContext),
    };
    const agentTools = activeAgent
      ? getAvailableAgentTools(agentToolContext).filter((tool) => allowedToolNames.has(tool.name))
      : [];
    const agentToolWorkflowActive = agentTools.length > 0;
    const automaticAgentWebSearch = agentTools.some((tool) => tool.name === 'web_search');

    let fallbackWebContext = '';
    let fallbackWebSources: SearchResult[] = [];
    if (
      !agentToolWorkflowActive &&
      webSearchEnabled &&
      userMessage &&
      executionChain.some((candidate) => candidate.providerId !== 'google')
    ) {
      const searchRes = await fetchWebGroundingContext(userMessage);
      fallbackWebContext = searchRes.contextText || '';
      fallbackWebSources = searchRes.sources || [];
    }

    const globalInstructions = await getRuntimeInstructions();
    const encoder = new TextEncoder();
    let streamCancelled = false;

    const stream = new ReadableStream({
      async start(controller) {
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
              activeAgent?.systemPrompt,
              candidate.systemPrompt,
              candidate.providerId === 'google' || agentToolWorkflowActive ? '' : fallbackWebContext,
            ].filter(Boolean).join('\n\n');

            const shouldAppendDocuments = !agentToolWorkflowActive || !allowedToolNames.has('document_qa');
            const documentTextAppendix = shouldAppendDocuments
              ? formatDocumentsForPrompt(currentAttachments, {
                  skipNativePdf: candidate.providerId === 'google',
                })
              : '';
            const userEffectiveContent = (userMessage || 'Please review the attached content.') + documentTextAppendix;

            const chatMessages: any[] = effectiveHistory.map((item) => ({
              role: item.role,
              content: item.content,
            }));
            chatMessages.push({
              role: 'user',
              content: userEffectiveContent,
              attachments: currentAttachments,
            });

            if (!emit({
              type: 'meta',
              modelName: candidate.name,
              failoverUsed: failoverHappened,
              webSearchActive: webSearchEnabled || automaticAgentWebSearch,
              agentId: activeAgent?.id ?? null,
              toolsActive: agentToolWorkflowActive ? agentTools.map((tool) => tool.name) : [],
            })) {
              break;
            }

            let responseSources: SearchResult[] = candidate.providerId === 'google' ? [] : fallbackWebSources;

            if (agentToolWorkflowActive) {
              const adapter = getProviderAdapter(candidate.providerId, candidate.baseUrl);
              if (!adapter?.chatWithTools) {
                throw new Error(`${candidate.name} does not support the active agent tools.`);
              }

              const reply = await withTimeout(
                adapter.chatWithTools(
                  candidate.apiKey,
                  candidate.modelId,
                  chatMessages,
                  combinedPrompt,
                  agentTools,
                  agentToolContext,
                ),
                PROVIDER_TOTAL_TIMEOUT_MS,
                `${candidate.name} tool workflow`,
              );

              if (isCancelled()) throw new Error('CLIENT_ABORTED');
              firstTokenAt = Date.now();
              totalOutputChars += reply.length;
              candidateOutputChars += reply.length;
              if (!emit({ type: 'delta', text: reply })) throw new Error('CLIENT_ABORTED');
            } else if (candidate.providerId === 'google') {
              const ai = new GoogleGenAI({ apiKey: candidate.apiKey });
              const geminiConfig: any = {
                systemInstruction: combinedPrompt,
                ...(activeAgent ? {
                  temperature: activeAgent.temperature,
                  maxOutputTokens: activeAgent.maxTokens,
                } : {}),
              };
              if (webSearchEnabled) geminiConfig.tools = [{ googleSearch: {} }];

              const geminiContents: any[] = effectiveHistory.map((item) => ({
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
                activeAgent ? {
                  temperature: activeAgent.temperature,
                  maxTokens: activeAgent.maxTokens,
                } : undefined,
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

            if (!agentToolWorkflowActive && webSearchEnabled && !isCancelled()) {
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
                modelOrAlias: activeAgent ? `agent:${activeAgent.id}` : requestedModel,
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
            modelOrAlias: activeAgent ? `agent:${activeAgent.id}` : requestedModel,
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
      },
      cancel() {
        streamCancelled = true;
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
    if (req.signal.aborted || isClientAbort(error)) {
      return new Response(null, { status: 499 });
    }

    logger.error('Stream gateway error.', error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
