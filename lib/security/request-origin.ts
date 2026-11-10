export type RequestSourceInput = {
  requestUrl: string;
  origin?: string | null;
  referer?: string | null;
  secFetchSite?: string | null;
  allowedOrigins?: string[];
};

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function parseAllowedOrigins(value: string | undefined) {
  return (value || '')
    .split(',')
    .map((item) => normalizeOrigin(item.trim()))
    .filter((item): item is string => Boolean(item));
}

export function isTrustedRequestSource(input: RequestSourceInput) {
  const requestOrigin = normalizeOrigin(input.requestUrl);
  if (!requestOrigin) return false;

  const allowed = new Set<string>([requestOrigin]);
  for (const origin of input.allowedOrigins ?? []) {
    const normalized = normalizeOrigin(origin);
    if (normalized) allowed.add(normalized);
  }

  const fetchSite = (input.secFetchSite || '').toLowerCase();
  if (fetchSite === 'cross-site') return false;

  if (input.origin !== undefined && input.origin !== null) {
    if (input.origin === 'null') return false;
    const origin = normalizeOrigin(input.origin);
    if (!origin || !allowed.has(origin)) return false;
  }

  if (input.referer) {
    const refererOrigin = normalizeOrigin(input.referer);
    if (!refererOrigin || !allowed.has(refererOrigin)) return false;
  }

  // Non-browser callers may omit Origin/Referer. They still pass through the
  // rate limiter and Turnstile (when configured), while browser cross-site
  // requests are rejected above.
  return true;
}

export function extractClientIp(headers: Headers) {
  const candidates = [
    headers.get('cf-connecting-ip'),
    headers.get('x-vercel-forwarded-for'),
    headers.get('x-forwarded-for'),
    headers.get('x-real-ip'),
  ];

  for (const value of candidates) {
    const first = value?.split(',')[0]?.trim();
    if (first) return first;
  }

  return 'unknown';
}
