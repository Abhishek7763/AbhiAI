import { NextRequest } from "next/server";
import { getInstructions } from "@/lib/instructions";
import { resolveRoutePlan, RouteCandidate } from "@/lib/ai/router";
import { streamOpenAICompatible } from "@/lib/ai/stream";
import { logUsageEvent } from "@/lib/usage-logger";
import { fetchWebGroundingContext, type SearchResult } from "@/lib/ai/web-search";
import {
  formatDocumentsForPrompt,
  isGeminiNativeAttachment,
  isPdfAttachment,
  normalizeAttachmentBase64,
  validateInlineAttachments,
  type AttachmentPayload,
} from "@/lib/files/document-extractor";
import { GoogleGenAI } from "@google/genai";

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

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let requestedModel = 'default';
  let failoverHappened = false;

  try {
    const { message, history, modelId, attachments, webSearch } = await req.json();
    const currentAttachments: AttachmentPayload[] = Array.isArray(attachments) ? attachments : [];
    requestedModel = modelId || 'default';

    if (!message && currentAttachments.length === 0) {
      return new Response(JSON.stringify({ error: "Message or attachment is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const attachmentError = validateInlineAttachments(currentAttachments);
    if (attachmentError) {
      return new Response(JSON.stringify({ error: attachmentError }), {
        status: 413,
        headers: { "Content-Type": "application/json" }
      });
    }

    const requiresNativeMultimodal = currentAttachments.some((attachment) => isGeminiNativeAttachment(attachment));
    const routePlan = await resolveRoutePlan(requestedModel, requiresNativeMultimodal);

    if (!routePlan.primary) {
      return new Response(JSON.stringify({ error: "No usable AI model is configured for this request. Open Admin > Providers and run Test & Discover." }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
    }

    const executionChain: RouteCandidate[] = [
      routePlan.primary,
      ...routePlan.fallbacks
    ];

    let fallbackWebContext = '';
    let fallbackWebSources: SearchResult[] = [];
    if (webSearch && message && executionChain.some((candidate) => candidate.providerId !== 'google')) {
      const searchRes = await fetchWebGroundingContext(message);
      fallbackWebContext = searchRes.contextText || '';
      fallbackWebSources = searchRes.sources || [];
    }

    const globalInstructions = getInstructions().systemPrompt || 'You are AbhiAI, an intelligent assistant created by Abhishek.';
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let executionSucceeded = false;
        let totalOutputChars = 0;

        for (const candidate of executionChain) {
          try {
            failoverHappened = candidate.connectionId !== routePlan.primary?.connectionId;

            if (!candidate.apiKey) {
              throw new Error(`No runtime API key is available for ${candidate.name}`);
            }

            const combinedPrompt = [
              globalInstructions,
              candidate.systemPrompt,
              candidate.providerId === 'google' ? '' : fallbackWebContext
            ].filter(Boolean).join('\n\n');

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
            chatMessages.push({
              role: 'user',
              content: userEffectiveContent,
              attachments: candidate.providerId === 'google' ? [] : currentAttachments,
            });

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'meta',
                modelName: candidate.name,
                failoverUsed: failoverHappened,
                webSearchActive: !!webSearch
              })}\n\n`)
            );

            let responseSources: SearchResult[] = candidate.providerId === 'google' ? [] : fallbackWebSources;

            if (candidate.providerId === 'google') {
              const ai = new GoogleGenAI({ apiKey: candidate.apiKey });

              const geminiConfig: any = {
                systemInstruction: combinedPrompt,
              };

              if (webSearch) {
                geminiConfig.tools = [{ googleSearch: {} }];
              }

              const geminiContents: any[] = [];
              if (Array.isArray(history)) {
                for (const h of history) {
                  geminiContents.push({
                    role: h.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: h.content || '' }]
                  });
                }
              }

              const userParts: any[] = [];
              for (const attachment of currentAttachments) {
                if (!isGeminiNativeAttachment(attachment)) continue;

                if (attachment.name) {
                  userParts.push({ text: `Attached file: ${attachment.name}` });
                }
                userParts.push({
                  inlineData: {
                    mimeType: attachment.type || (isPdfAttachment(attachment) ? 'application/pdf' : 'application/octet-stream'),
                    data: normalizeAttachmentBase64(attachment.data),
                  }
                });
              }
              userParts.push({ text: userEffectiveContent });

              geminiContents.push({
                role: 'user',
                parts: userParts
              });

              const geminiRes = await ai.models.generateContentStream({
                model: candidate.modelId,
                contents: geminiContents,
                config: geminiConfig,
              });

              const groundedSources = new Map<string, SearchResult>();

              for await (const chunk of geminiRes) {
                const text = chunk.text;
                if (text) {
                  totalOutputChars += text.length;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`)
                  );
                }

                if (webSearch) {
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
                combinedPrompt
              );

              for await (const deltaText of streamGen) {
                totalOutputChars += deltaText.length;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: deltaText })}\n\n`)
                );
              }
            }

            if (webSearch) {
              const sourceAppendix = formatSourceAppendix(responseSources);
              if (sourceAppendix) {
                totalOutputChars += sourceAppendix.length;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: sourceAppendix })}\n\n`)
                );
              }
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            executionSucceeded = true;

            logUsageEvent({
              modelOrAlias: requestedModel,
              executedModelName: candidate.name,
              executedModelId: candidate.modelId,
              connectionId: candidate.connectionId,
              provider: candidate.providerId,
              promptLength: (message || '').length,
              responseLength: totalOutputChars,
              durationMs: Date.now() - startTime,
              failoverUsed: failoverHappened,
              isPublic: true,
              status: 'success',
            });

            break;
          } catch (err: any) {
            console.warn(`[Stream Failover] Error on ${candidate.name} (${candidate.modelId}):`, err.message);
          }
        }

        if (!executionSucceeded) {
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

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: 'AbhiAI is temporarily unable to complete this request. Please try again shortly.'
            })}\n\n`)
          );
        }

        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error("Stream Gateway Error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
