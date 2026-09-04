export type FailoverErrorKind =
  | 'timeout'
  | 'rate_limit'
  | 'auth'
  | 'quota'
  | 'provider'
  | 'capability'
  | 'invalid_request'
  | 'content_policy'
  | 'unknown';

export type FailoverDecision = {
  kind: FailoverErrorKind;
  retryable: boolean;
  reason: string;
};

function errorText(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`.toLowerCase();
  return String(error ?? '').toLowerCase();
}

export function classifyFailoverError(error: unknown): FailoverDecision {
  const text = errorText(error);

  if (/client_aborted|aborterror|request aborted/.test(text)) {
    return { kind: 'invalid_request', retryable: false, reason: 'client-abort' };
  }
  if (/content policy|safety policy|blocked prompt|moderation/.test(text)) {
    return { kind: 'content_policy', retryable: false, reason: 'content-policy' };
  }
  if (/unsupported capability|tool calling is required|does not support tools|multimodal capability/.test(text)) {
    return { kind: 'capability', retryable: true, reason: 'capability-mismatch' };
  }
  if (/timed out|timeout|etimedout|deadline exceeded/.test(text)) {
    return { kind: 'timeout', retryable: true, reason: 'timeout' };
  }
  if (/429|rate limit|too many requests|resource exhausted/.test(text)) {
    return { kind: 'rate_limit', retryable: true, reason: 'rate-limit' };
  }
  if (/quota|credit|billing limit|insufficient credits/.test(text)) {
    return { kind: 'quota', retryable: true, reason: 'quota' };
  }
  if (/401|403|unauthorized|forbidden|invalid api key|authentication|auth error/.test(text)) {
    return { kind: 'auth', retryable: true, reason: 'provider-auth' };
  }
  if (/400|invalid request|bad request|malformed|validation/.test(text)) {
    return { kind: 'invalid_request', retryable: false, reason: 'invalid-request' };
  }
  if (/500|502|503|504|service unavailable|upstream|provider error|network|fetch failed|econnreset|enotfound/.test(text)) {
    return { kind: 'provider', retryable: true, reason: 'provider-failure' };
  }

  return { kind: 'unknown', retryable: true, reason: 'unknown-provider-failure' };
}

export function clampFailoverAttempts(value: unknown, maxCandidates = 4) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return Math.min(4, maxCandidates);
  return Math.max(1, Math.min(Math.floor(parsed), Math.max(1, maxCandidates)));
}

export function clampProviderTimeoutMs(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 35_000;
  return Math.max(8_000, Math.min(Math.floor(parsed), 90_000));
}
