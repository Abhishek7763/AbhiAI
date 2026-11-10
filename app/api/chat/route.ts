import { NextResponse } from "next/server";
import { getRuntimeInstructions } from "@/lib/ai/runtime-instructions";
import { resolveRoutePlan, RouteCandidate } from "@/lib/ai/router";
import { getProviderAdapter } from "@/lib/ai/providers/registry";
import { getAvailableAgentTools } from "@/lib/ai/tools";
import { executeAgentTool } from "@/lib/ai/tool-executor";
import { getStoredAgents } from "@/lib/data/admin-config";
import { getRoutingConfig } from "@/lib/data/routing-config";
import { classifyFailoverError, clampFailoverAttempts } from "@/lib/ai/failover";
import { logUsageEvent } from "@/lib/usage-logger";
import { recordRuntimeModelFailure, recordRuntimeModelSuccess } from "@/lib/ai/runtime-health";
import { withTimeout } from "@/lib/ai/timeout";
import { sanitizeChatHistory, validateChatRequestSize, validateUserMessage } from "@/lib/ai/chat-input";
import { logger } from "@/lib/logger";
import { protectPublicAiRequest } from "@/lib/security/public-api-guard";
import { formatDocumentsForPrompt, isGeminiNativeAttachment, validateInlineAttachments, type AttachmentPayload } from "@/lib/files/document-extractor";

export const maxDuration = 180;
const TOOL_PROVIDER_TIMEOUT_MS = 90_000;
const RUNTIME_HEALTH_WRITE_TIMEOUT_MS = 2_500;
function isClientAbort(error: unknown) { return error instanceof Error && error.message === 'CLIENT_ABORTED'; }

export async function POST(req: Request) {
  const startTime = Date.now();
  let requestedModel = 'default';
  const sizeError = validateChatRequestSize(req.headers.get('content-length'));
  if (sizeError) return NextResponse.json({ error: sizeError }, { status: 413 });
  const guard = await protectPublicAiRequest(req, 'chat');
  if (!guard.ok) return guard.response;

  try {
    const { message, history, modelId, attachments } = await req.json();
    const userMessage = typeof message === 'string' ? message : '';
    const messageError = validateUserMessage(message);
    if (messageError) return NextResponse.json({ error: messageError }, { status: 400 });
    const currentAttachments: AttachmentPayload[] = Array.isArray(attachments) ? attachments.filter((attachment: unknown): attachment is AttachmentPayload => Boolean(attachment && typeof (attachment as AttachmentPayload).name === 'string' && typeof (attachment as AttachmentPayload).type === 'string' && typeof (attachment as AttachmentPayload).data === 'string')) : [];
    const safeHistory = sanitizeChatHistory(history);
    const requestedRoute = typeof modelId === 'string' && modelId ? modelId : 'default';
    let activeAgent: Awaited<ReturnType<typeof getStoredAgents>>[number] | null = null;
    if (requestedRoute.startsWith('agent:')) {
      const agentId = requestedRoute.slice('agent:'.length).trim();
      activeAgent = (await getStoredAgents()).find((agent) => agent.id === agentId && agent.visibility === 'public') ?? null;
      if (!activeAgent) return NextResponse.json({ error: 'This AI agent is unavailable.' }, { status: 404 });
    }
    requestedModel = activeAgent?.preferredModelOrAlias || requestedRoute;
    const effectiveHistory = activeAgent?.memoryEnabled === false ? [] : safeHistory;
    if (!userMessage && currentAttachments.length === 0) return NextResponse.json({ error: "Message or attachment is required" }, { status: 400 });
    const attachmentError = validateInlineAttachments(currentAttachments);
    if (attachmentError) return NextResponse.json({ error: attachmentError }, { status: 413 });

    const requiresNativeMultimodal = currentAttachments.some((attachment) => isGeminiNativeAttachment(attachment));
    const [routePlan, routingConfig] = await Promise.all([
      resolveRoutePlan(requestedModel, requiresNativeMultimodal, userMessage),
      getRoutingConfig(),
    ]);
    if (!routePlan.primary) return NextResponse.json({ error: "No usable AI model is configured for this request. Open Admin > Integrations and Smart Routing." }, { status: 503 });

    const globalInstructions = await getRuntimeInstructions();
    const allCandidates: RouteCandidate[] = [routePlan.primary, ...routePlan.fallbacks];
    const maxAttempts = routingConfig.failoverEnabled ? clampFailoverAttempts(routingConfig.maxAttempts, allCandidates.length) : 1;
    const executionChain = allCandidates.slice(0, maxAttempts);
    const allowedToolNames = new Set(activeAgent?.allowedTools ?? []);
    const toolExecutionContext = { attachments: currentAttachments, userId: guard.userId, imageSettings: guard.settings, runtime: activeAgent ? { temperature: activeAgent.temperature, maxTokens: activeAgent.maxTokens } : undefined };
    const toolContext = { ...toolExecutionContext, executeTool: (name: string, args?: Record<string, unknown>) => executeAgentTool(name, args, toolExecutionContext) };
    const tools = activeAgent ? getAvailableAgentTools(toolContext).filter((tool) => allowedToolNames.has(tool.name)) : [];
    let successfulReply: string | null = null;
    let executedCandidate: RouteCandidate | null = null;
    let lastFailureKind: string | null = null;

    for (const candidate of executionChain) {
      if (req.signal.aborted) break;
      const candidateStartedAt = Date.now();
      try {
        const combinedPrompt = [globalInstructions, activeAgent?.systemPrompt, candidate.systemPrompt].filter(Boolean).join('\n\n');
        const documentTextAppendix = tools.some((tool) => tool.name === 'document_qa') ? '' : formatDocumentsForPrompt(currentAttachments, { skipNativePdf: candidate.providerId === 'google' });
        const userEffectiveContent = (userMessage || 'Please review the attached content.') + documentTextAppendix;
        const chatMessages: any[] = effectiveHistory.map((item) => ({ role: item.role, content: item.content }));
        chatMessages.push({ role: 'user', content: userEffectiveContent, attachments: candidate.providerId === 'google' ? currentAttachments.filter((attachment) => isGeminiNativeAttachment(attachment)) : currentAttachments });
        const adapter = getProviderAdapter(candidate.providerId, candidate.baseUrl);
        if (!adapter) throw new Error(`Adapter for provider ${candidate.providerId} could not be resolved`);
        if (!candidate.apiKey) throw new Error(`No runtime API key is available for ${candidate.name}`);
        const timeoutMs = tools.length > 0 ? Math.max(routingConfig.providerTimeoutMs, TOOL_PROVIDER_TIMEOUT_MS) : routingConfig.providerTimeoutMs;
        const reply = await withTimeout(tools.length > 0 && adapter.chatWithTools ? adapter.chatWithTools(candidate.apiKey, candidate.modelId, chatMessages, combinedPrompt, tools, toolContext) : adapter.chat(candidate.apiKey, candidate.modelId, chatMessages, combinedPrompt), timeoutMs, candidate.name);
        if (req.signal.aborted) throw new Error('CLIENT_ABORTED');
        if (reply) {
          await withTimeout(recordRuntimeModelSuccess(candidate.connectionId, Date.now() - candidateStartedAt), RUNTIME_HEALTH_WRITE_TIMEOUT_MS, 'Runtime health update').catch((healthError) => logger.warn('Could not record successful runtime health state.', healthError));
          successfulReply = reply; executedCandidate = candidate; break;
        }
        throw new Error('Provider returned an empty response');
      } catch (error) {
        if (req.signal.aborted || isClientAbort(error)) break;
        const decision = classifyFailoverError(error);
        lastFailureKind = decision.kind;
        await withTimeout(recordRuntimeModelFailure(candidate.connectionId, error), RUNTIME_HEALTH_WRITE_TIMEOUT_MS, 'Runtime health update').catch((healthError) => logger.warn('Could not record failed runtime health state.', healthError));
        const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown provider error');
        logger.warn(`Failover execution failed on ${candidate.name} (${candidate.modelId}) [${decision.kind}/${decision.reason}].`, errorMessage);
        if (!routingConfig.failoverEnabled || !decision.retryable) break;
      }
    }

    if (req.signal.aborted) return new Response(null, { status: 499 });
    if (successfulReply && executedCandidate) {
      const failoverUsed = executedCandidate.connectionId !== routePlan.primary.connectionId;
      logUsageEvent({ modelOrAlias: activeAgent ? `agent:${activeAgent.id}` : requestedModel, executedModelName: executedCandidate.name, executedModelId: executedCandidate.modelId, connectionId: executedCandidate.connectionId, provider: executedCandidate.providerId, promptLength: userMessage.length, responseLength: successfulReply.length, durationMs: Date.now() - startTime, failoverUsed, isPublic: true, status: 'success' });
      return NextResponse.json({ reply: successfulReply, model: executedCandidate.name, failoverUsed, attempts: executionChain.findIndex((candidate) => candidate.connectionId === executedCandidate?.connectionId) + 1, agentId: activeAgent?.id ?? null, toolsActive: tools.map((tool) => tool.name) });
    }
    logUsageEvent({ modelOrAlias: activeAgent ? `agent:${activeAgent.id}` : requestedModel, provider: 'all-failed', promptLength: userMessage.length, responseLength: 0, durationMs: Date.now() - startTime, failoverUsed: executionChain.length > 1, isPublic: true, status: 'error', errorCode: lastFailureKind ? `FAILOVER_${lastFailureKind.toUpperCase()}` : 'ALL_CANDIDATES_FAILED' });
    return NextResponse.json({ error: "AbhiAI is temporarily unable to complete this request. Please try again shortly." }, { status: 502 });
  } catch (error) {
    if (req.signal.aborted || isClientAbort(error)) return new Response(null, { status: 499 });
    logger.error('Chat gateway error.', error);
    return NextResponse.json({ error: "Internal Server Error in AbhiAI Chat Gateway" }, { status: 500 });
  }
}
